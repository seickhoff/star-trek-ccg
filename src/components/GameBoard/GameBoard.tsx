import { useState, useCallback, useEffect, useRef } from "react";
import type { Card, PersonnelCard } from "../../types/card";
import { isPersonnel } from "../../types/card";
import {
  useGameStore,
  selectCanDraw,
  selectCanAdvancePhase,
  selectDilemmaResult,
} from "../../store";
import { MissionColumn } from "./MissionColumn";
import { TopBar } from "../UI/TopBar";
import { HandContainer } from "../Hand/HandContainer";
import { CardViewer, GroupViewer, OrdersModal, DilemmaModal } from "../Modals";
import { defaultDeck } from "../../data/defaultDeck";
import { useAudio, GAME_SOUNDS } from "../../hooks";
import "./GameBoard.css";

/**
 * Main game board component
 * Renders the full game UI with missions, hand, and controls
 */
export function GameBoard() {
  // Game state from store
  const {
    missions,
    hand,
    turn,
    phase,
    counters,
    score,
    deck,
    dilemmaEncounter,
    gameOver,
    victory,
    headquartersIndex,
    uniquesInPlay,
    setupGame,
    draw,
    deploy,
    nextPhase,
    discardCard,
    moveShip,
    beamToShip,
    beamToPlanet,
    attemptMission,
    selectPersonnelForDilemma,
    advanceDilemma,
    clearDilemmaEncounter,
  } = useGameStore();

  // Derived selectors
  const canDraw = useGameStore(selectCanDraw);
  const canAdvancePhase = useGameStore(selectCanAdvancePhase);
  const dilemmaResult = useGameStore(selectDilemmaResult);

  // Audio
  const { play } = useAudio();

  // Track previous values for change detection
  const prevPhase = useRef(phase);
  const prevTurn = useRef(turn);
  const prevDilemmaEncounter = useRef(dilemmaEncounter);
  const prevGameOver = useRef(gameOver);

  // Sound effects for state changes
  useEffect(() => {
    // Phase change sound
    if (prevPhase.current !== phase && missions.length > 0) {
      play(GAME_SOUNDS.phaseChange);
    }
    prevPhase.current = phase;
  }, [phase, missions.length, play]);

  useEffect(() => {
    // New turn sound
    if (prevTurn.current !== turn && turn > 1) {
      play(GAME_SOUNDS.newTurn);
    }
    prevTurn.current = turn;
  }, [turn, play]);

  useEffect(() => {
    // Mission attempt / dilemma encounter sound
    if (!prevDilemmaEncounter.current && dilemmaEncounter) {
      play(GAME_SOUNDS.missionAttempt);
    }
    prevDilemmaEncounter.current = dilemmaEncounter;
  }, [dilemmaEncounter, play]);

  useEffect(() => {
    // Game over sound
    if (!prevGameOver.current && gameOver) {
      play(victory ? GAME_SOUNDS.victory : GAME_SOUNDS.defeat);
    }
    prevGameOver.current = gameOver;
  }, [gameOver, victory, play]);

  // Modal state
  const [viewingCard, setViewingCard] = useState<Card | null>(null);
  const [groupViewerState, setGroupViewerState] = useState<{
    isOpen: boolean;
    cards: Card[];
    title: string;
  }>({ isOpen: false, cards: [], title: "" });
  const [ordersModalState, setOrdersModalState] = useState<{
    isOpen: boolean;
    missionIndex: number;
    groupIndex: number;
  }>({ isOpen: false, missionIndex: 0, groupIndex: 0 });

  // Handlers
  const handleNewGame = useCallback(() => {
    setupGame(defaultDeck);
  }, [setupGame]);

  const handleDraw = useCallback(() => {
    draw(1);
  }, [draw]);

  const handleDeploy = useCallback(
    (card: Card) => {
      if (card.uniqueId) {
        const success = deploy(card.uniqueId);
        if (success) {
          play(GAME_SOUNDS.deploy);
        }
      }
    },
    [deploy, play]
  );

  const handleViewCard = useCallback(
    (card: Card) => {
      // In DiscardExcess phase, clicking a hand card discards it
      if (
        phase === "DiscardExcess" &&
        card.uniqueId &&
        hand.some((c) => c.uniqueId === card.uniqueId)
      ) {
        discardCard(card.uniqueId);
      } else {
        setViewingCard(card);
      }
    },
    [phase, hand, discardCard]
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleMissionClick = useCallback((_missionIndex: number) => {
    // Could show mission details in future
  }, []);

  const handleGroupClick = useCallback(
    (missionIndex: number, groupIndex: number) => {
      const mission = missions[missionIndex];
      if (!mission) return;

      const group = mission.groups[groupIndex];
      if (!group || group.cards.length === 0) return;

      if (phase === "ExecuteOrders") {
        // Open orders modal in execute orders phase
        setOrdersModalState({
          isOpen: true,
          missionIndex,
          groupIndex,
        });
      } else {
        // Open group viewer in other phases
        setGroupViewerState({
          isOpen: true,
          cards: group.cards,
          title: `${mission.mission.name} - Group ${groupIndex}`,
        });
      }
    },
    [missions, phase]
  );

  const handleAttemptMission = useCallback(
    (missionIndex: number, groupIndex: number) => {
      attemptMission(missionIndex, groupIndex);
    },
    [attemptMission]
  );

  const handleSelectPersonnelForDilemma = useCallback(
    (personnelId: string) => {
      selectPersonnelForDilemma(personnelId);
    },
    [selectPersonnelForDilemma]
  );

  const handleAdvanceDilemma = useCallback(() => {
    advanceDilemma();
  }, [advanceDilemma]);

  const handleCloseDilemma = useCallback(() => {
    clearDilemmaEncounter();
  }, [clearDilemmaEncounter]);

  const handleBeamToShip = useCallback(
    (
      personnelId: string,
      missionIndex: number,
      fromGroup: number,
      toGroup: number
    ) => {
      beamToShip(personnelId, missionIndex, fromGroup, toGroup);
      play(GAME_SOUNDS.beam);
    },
    [beamToShip, play]
  );

  const handleBeamToPlanet = useCallback(
    (personnelId: string, missionIndex: number, fromGroup: number) => {
      beamToPlanet(personnelId, missionIndex, fromGroup);
      play(GAME_SOUNDS.beam);
    },
    [beamToPlanet, play]
  );

  const handleMoveShip = useCallback(
    (sourceMission: number, groupIndex: number, destMission: number) => {
      moveShip(sourceMission, groupIndex, destMission);
      play(GAME_SOUNDS.moveShip);
    },
    [moveShip, play]
  );

  // Get personnel for dilemma encounter
  const dilemmaPersonnel: PersonnelCard[] = dilemmaEncounter
    ? (missions[dilemmaEncounter.missionIndex]?.groups[
        dilemmaEncounter.groupIndex
      ]?.cards.filter(isPersonnel) as PersonnelCard[]) || []
    : [];

  // If game not started, show start screen
  if (missions.length === 0) {
    return (
      <div className="game-board game-board--start">
        <div className="game-board__start-screen">
          <h1 className="game-board__title">Star Trek CCG 2E</h1>
          <p className="game-board__subtitle">Solitaire Edition</p>
          <button className="game-board__start-btn" onClick={handleNewGame}>
            Start New Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-board">
      {/* Top bar with controls */}
      <TopBar
        turn={turn}
        phase={phase}
        counters={counters}
        score={score}
        deckCount={deck.length}
        canDraw={canDraw}
        canAdvancePhase={canAdvancePhase}
        gameOver={gameOver}
        victory={victory}
        onDraw={handleDraw}
        onAdvancePhase={nextPhase}
        onNewGame={handleNewGame}
      />

      {/* Mission columns */}
      <div className="game-board__missions">
        {missions.map((deployment, index) => (
          <MissionColumn
            key={deployment.mission.uniqueId || index}
            deployment={deployment}
            missionIndex={index}
            isHeadquarters={index === headquartersIndex}
            onCardClick={handleViewCard}
            onMissionClick={handleMissionClick}
            onGroupClick={handleGroupClick}
            onAttemptMission={handleAttemptMission}
            canAttempt={phase === "ExecuteOrders"}
          />
        ))}
      </div>

      {/* Hand */}
      <HandContainer
        cards={hand}
        counters={counters}
        phase={phase}
        uniquesInPlay={uniquesInPlay}
        onDeploy={handleDeploy}
        onView={handleViewCard}
      />

      {/* Modals */}
      <CardViewer card={viewingCard} onClose={() => setViewingCard(null)} />

      <GroupViewer
        cards={groupViewerState.cards}
        title={groupViewerState.title}
        isOpen={groupViewerState.isOpen}
        onClose={() => setGroupViewerState((s) => ({ ...s, isOpen: false }))}
        onCardClick={handleViewCard}
      />

      <OrdersModal
        isOpen={ordersModalState.isOpen}
        onClose={() => setOrdersModalState((s) => ({ ...s, isOpen: false }))}
        missions={missions}
        currentMissionIndex={ordersModalState.missionIndex}
        currentGroupIndex={ordersModalState.groupIndex}
        onCardClick={handleViewCard}
        onMoveShip={handleMoveShip}
        onBeamToShip={handleBeamToShip}
        onBeamToPlanet={handleBeamToPlanet}
      />

      <DilemmaModal
        encounter={dilemmaEncounter}
        personnel={dilemmaPersonnel}
        dilemmaResult={dilemmaResult}
        onClose={handleCloseDilemma}
        onSelectPersonnel={handleSelectPersonnelForDilemma}
        onContinue={handleAdvanceDilemma}
        onCardClick={handleViewCard}
      />
    </div>
  );
}
