import { useState, useCallback, useEffect, useRef } from "react";
import type {
  Card,
  CardRef,
  PersonnelCard,
  Skill,
  GameAction,
} from "@stccg/shared";
import { isPersonnel } from "@stccg/shared";
import { useShallow } from "zustand/react/shallow";
import {
  useClientGameStore,
  selectCanDraw,
  selectCanAdvancePhase,
  selectDilemmaResult,
  selectPlayableInterrupts,
  selectActionLog,
  selectIsMyTurn,
  selectOpponentState,
  selectWinner,
  selectDilemmaSelectionRequest,
} from "../../store/clientGameStore";
import { MissionColumn } from "./MissionColumn";
import { OpponentBoard } from "./OpponentBoard";
import { TopBar } from "../UI/TopBar";
import { HandContainer } from "../Hand/HandContainer";
import {
  CardViewer,
  GroupViewer,
  OrdersModal,
  DilemmaModal,
  DiscardPicker,
  ActionLog,
  DilemmaSelectionModal,
} from "../Modals";
import { useConnectionStore } from "../../store/connectionStore";
import { defaultDeck } from "@stccg/shared";
import { useAudio, GAME_SOUNDS } from "../../hooks";
import "./GameBoard.css";

interface GameBoardProps {
  sendAction: <T extends Omit<GameAction, "requestId">>(action: T) => string;
}

/**
 * Main game board component
 * Renders the full game UI with missions, hand, and controls
 */
export function GameBoard({ sendAction }: GameBoardProps) {
  // Game state from client store (synced from server)
  // useShallow ensures re-renders only when individual field references change,
  // not on every store update (which caused infinite re-render loops with useSyncExternalStore)
  const {
    missions,
    hand,
    turn,
    phase,
    counters,
    score,
    deck,
    discard,
    dilemmaEncounter,
    gameOver,
    victory,
    headquartersIndex,
    uniquesInPlay,
    grantedSkills,
    usedOrderAbilities,
  } = useClientGameStore(
    useShallow((s) => ({
      missions: s.missions,
      hand: s.hand,
      turn: s.turn,
      phase: s.phase,
      counters: s.counters,
      score: s.score,
      deck: s.deck,
      discard: s.discard,
      dilemmaEncounter: s.dilemmaEncounter,
      gameOver: s.gameOver,
      victory: s.victory,
      headquartersIndex: s.headquartersIndex,
      uniquesInPlay: s.uniquesInPlay,
      grantedSkills: s.grantedSkills,
      usedOrderAbilities: s.usedOrderAbilities,
    }))
  );

  // Derived selectors
  const canDraw = useClientGameStore(selectCanDraw);
  const canAdvancePhase = useClientGameStore(selectCanAdvancePhase);
  const dilemmaResult = useClientGameStore(selectDilemmaResult);
  const playableInterrupts = useClientGameStore(selectPlayableInterrupts);
  const actionLog = useClientGameStore(selectActionLog);
  const isMyTurn = useClientGameStore(selectIsMyTurn);
  const opponentState = useClientGameStore(selectOpponentState);
  const winner = useClientGameStore(selectWinner);
  const dilemmaSelectionRequest = useClientGameStore(
    selectDilemmaSelectionRequest
  );

  // Dilemma selection clear action
  const setDilemmaSelectionRequest = useClientGameStore(
    (s) => s.setDilemmaSelectionRequest
  );

  // Add rejected actions to the action log
  const addLogEntry = useClientGameStore((s) => s.addLogEntry);
  const connectionError = useConnectionStore((s) => s.error);
  const prevConnectionError = useRef<string | null>(null);
  useEffect(() => {
    if (connectionError && connectionError !== prevConnectionError.current) {
      addLogEntry({
        id: `rejected-${Date.now()}`,
        timestamp: Date.now(),
        type: "rejected",
        message: "Action rejected",
        details: connectionError,
      });
    }
    prevConnectionError.current = connectionError;
  }, [connectionError, addLogEntry]);

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

  // Close phase-specific modals when phase changes
  useEffect(() => {
    // OrdersModal should only be open during ExecuteOrders phase
    if (phase !== "ExecuteOrders") {
      setOrdersModalState((s) => ({ ...s, isOpen: false }));
    }
    // Close GroupViewer when entering ExecuteOrders (OrdersModal replaces it)
    if (phase === "ExecuteOrders") {
      setGroupViewerState((s) => ({ ...s, isOpen: false }));
    }
  }, [phase]);

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
  const [discardPickerState, setDiscardPickerState] = useState<{
    isOpen: boolean;
    eventCard: Card | null;
    maxSelections: number;
    allowedTypes: string[];
  }>({ isOpen: false, eventCard: null, maxSelections: 0, allowedTypes: [] });

  // Handlers - all actions now go through sendAction to server
  const handleNewGame = useCallback(() => {
    // Close all modals
    setViewingCard(null);
    setGroupViewerState((s) => ({ ...s, isOpen: false }));
    setOrdersModalState((s) => ({ ...s, isOpen: false }));
    // Start new game via server
    sendAction({ type: "SETUP_GAME", deckCardIds: defaultDeck });
  }, [sendAction]);

  const handleDraw = useCallback(() => {
    sendAction({ type: "DRAW", count: 1 });
  }, [sendAction]);

  const handleDeploy = useCallback(
    (card: Card) => {
      if (card.uniqueId) {
        sendAction({ type: "DEPLOY", cardUniqueId: card.uniqueId });
        play(GAME_SOUNDS.deploy);
      }
    },
    [sendAction, play]
  );

  const handlePlayEvent = useCallback(
    (card: Card) => {
      if (!card.uniqueId) return;

      // Check if this event has a recoverFromDiscard effect that needs selection
      const eventCard = card as import("@stccg/shared").EventCard;
      const ability = eventCard.abilities?.find((a) => a.trigger === "event");
      const recoverEffect = ability?.effects.find(
        (e) => e.type === "recoverFromDiscard"
      );

      if (
        recoverEffect &&
        recoverEffect.type === "recoverFromDiscard" &&
        discard.length > 0
      ) {
        // Open discard picker modal
        setDiscardPickerState({
          isOpen: true,
          eventCard: card,
          maxSelections: recoverEffect.maxCount,
          allowedTypes: recoverEffect.cardTypes,
        });
      } else {
        // No selection needed, just play the event
        sendAction({ type: "PLAY_EVENT", cardUniqueId: card.uniqueId });
        play(GAME_SOUNDS.deploy);
      }
    },
    [discard.length, sendAction, play]
  );

  const handleDiscardPickerConfirm = useCallback(
    (selectedCardIds: string[]) => {
      if (!discardPickerState.eventCard?.uniqueId) return;

      sendAction({
        type: "PLAY_EVENT",
        cardUniqueId: discardPickerState.eventCard.uniqueId,
        params: { selectedCardIds },
      });
      play(GAME_SOUNDS.deploy);

      setDiscardPickerState({
        isOpen: false,
        eventCard: null,
        maxSelections: 0,
        allowedTypes: [],
      });
    },
    [discardPickerState.eventCard, sendAction, play]
  );

  const handleDiscardPickerClose = useCallback(() => {
    setDiscardPickerState({
      isOpen: false,
      eventCard: null,
      maxSelections: 0,
      allowedTypes: [],
    });
  }, []);

  const handleDiscard = useCallback(
    (card: Card) => {
      if (card.uniqueId) {
        sendAction({ type: "DISCARD_CARD", cardUniqueId: card.uniqueId });
      }
    },
    [sendAction]
  );

  const handleViewCard = useCallback(
    (card: Card) => {
      // In DiscardExcess phase, clicking a hand card discards it
      if (
        phase === "DiscardExcess" &&
        card.uniqueId &&
        hand.some((c) => c.uniqueId === card.uniqueId)
      ) {
        sendAction({ type: "DISCARD_CARD", cardUniqueId: card.uniqueId });
      } else {
        setViewingCard(card);
      }
    },
    [phase, hand, sendAction]
  );

  const handleLogCardClick = useCallback((ref: CardRef) => {
    const base = {
      id: ref.cardId,
      name: ref.name,
      type: ref.type,
      unique: false,
      jpg: ref.jpg,
    };
    // Add type-specific defaults so CardSlot doesn't crash
    if (ref.type === "Personnel") {
      setViewingCard({ ...base, status: "Unstopped" } as Card);
    } else if (ref.type === "Ship") {
      setViewingCard({ ...base, range: 0, rangeRemaining: 0 } as Card);
    } else {
      setViewingCard(base as Card);
    }
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
      sendAction({ type: "ATTEMPT_MISSION", missionIndex, groupIndex });
    },
    [sendAction]
  );

  const handleDilemmasClick = useCallback(
    (missionIndex: number) => {
      const mission = missions[missionIndex];
      if (!mission || mission.dilemmas.length === 0) return;
      setGroupViewerState({
        isOpen: true,
        cards: mission.dilemmas,
        title: `Dilemmas Beneath ${mission.mission.name}`,
      });
    },
    [missions]
  );

  const handleSelectPersonnelForDilemma = useCallback(
    (personnelId: string) => {
      sendAction({ type: "SELECT_PERSONNEL_FOR_DILEMMA", personnelId });
    },
    [sendAction]
  );

  const handleAdvanceDilemma = useCallback(() => {
    sendAction({ type: "ADVANCE_DILEMMA" });
  }, [sendAction]);

  const handleBeamToShip = useCallback(
    (
      personnelId: string,
      missionIndex: number,
      fromGroup: number,
      toGroup: number
    ) => {
      // Check if this is the last unstopped personnel in the source group
      const group = missions[missionIndex]?.groups[fromGroup];
      const unstoppedCount =
        group?.cards.filter(
          (c) => isPersonnel(c) && (c as PersonnelCard).status === "Unstopped"
        ).length ?? 0;

      sendAction({
        type: "BEAM_TO_SHIP",
        personnelId,
        missionIndex,
        fromGroup,
        toGroup,
      });
      play(GAME_SOUNDS.beam);

      // If last unstopped personnel, switch to destination group
      if (unstoppedCount <= 1) {
        setOrdersModalState((s) => ({ ...s, groupIndex: toGroup }));
      }
    },
    [sendAction, play, missions]
  );

  const handleBeamToPlanet = useCallback(
    (personnelId: string, missionIndex: number, fromGroup: number) => {
      // Check if this is the last unstopped personnel in the source group
      const group = missions[missionIndex]?.groups[fromGroup];
      const unstoppedCount =
        group?.cards.filter(
          (c) => isPersonnel(c) && (c as PersonnelCard).status === "Unstopped"
        ).length ?? 0;

      sendAction({
        type: "BEAM_TO_PLANET",
        personnelId,
        missionIndex,
        fromGroup,
      });
      play(GAME_SOUNDS.beam);

      // If last unstopped personnel, switch to destination group
      if (unstoppedCount <= 1) {
        setOrdersModalState((s) => ({ ...s, groupIndex: 0 }));
      }
    },
    [sendAction, play, missions]
  );

  const handleBeamAllToShip = useCallback(
    (missionIndex: number, fromGroup: number, toGroup: number) => {
      sendAction({
        type: "BEAM_ALL_TO_SHIP",
        missionIndex,
        fromGroup,
        toGroup,
      });
      play(GAME_SOUNDS.beam);
      // Switch to destination group
      setOrdersModalState((s) => ({ ...s, groupIndex: toGroup }));
    },
    [sendAction, play]
  );

  const handleBeamAllToPlanet = useCallback(
    (missionIndex: number, fromGroup: number) => {
      sendAction({
        type: "BEAM_ALL_TO_PLANET",
        missionIndex,
        fromGroup,
      });
      play(GAME_SOUNDS.beam);
      // Switch to destination group (planet = group 0)
      setOrdersModalState((s) => ({ ...s, groupIndex: 0 }));
    },
    [sendAction, play]
  );

  const handleMoveShip = useCallback(
    (sourceMission: number, groupIndex: number, destMission: number) => {
      sendAction({
        type: "MOVE_SHIP",
        sourceMission,
        groupIndex,
        destMission,
      });
      play(GAME_SOUNDS.moveShip);
    },
    [sendAction, play]
  );

  const handleExecuteOrderAbility = useCallback(
    (cardUniqueId: string, abilityId: string, params?: { skill?: Skill }) => {
      sendAction({
        type: "EXECUTE_ORDER_ABILITY",
        cardUniqueId,
        abilityId,
        params,
      });
      return true;
    },
    [sendAction]
  );

  const handleExecuteInterlinkAbility = useCallback(
    (cardUniqueId: string, abilityId: string, skill?: Skill) => {
      sendAction({
        type: "EXECUTE_INTERLINK_ABILITY",
        cardUniqueId,
        abilityId,
        params: skill ? { skill } : undefined,
      });
      return true;
    },
    [sendAction]
  );

  const handlePlayInterrupt = useCallback(
    (cardUniqueId: string, abilityId: string) => {
      sendAction({
        type: "PLAY_INTERRUPT",
        cardUniqueId,
        abilityId,
      });
      return true;
    },
    [sendAction]
  );

  const handleSelectDilemmas = useCallback(
    (selectedUniqueIds: string[]) => {
      sendAction({
        type: "SELECT_DILEMMAS",
        selectedDilemmaUniqueIds: selectedUniqueIds,
      });
      setDilemmaSelectionRequest(null);
    },
    [sendAction, setDilemmaSelectionRequest]
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
          <p className="game-board__subtitle">vs AI Opponent</p>
          <button className="game-board__start-btn" onClick={handleNewGame}>
            Start New Game
          </button>
        </div>
      </div>
    );
  }

  const gameOverMessage = winner
    ? winner === 1
      ? "VICTORY!"
      : "DEFEAT - AI Wins"
    : victory
      ? "VICTORY!"
      : "DEFEAT";

  return (
    <div className="game-board">
      {/* Top bar with controls */}
      <TopBar
        turn={turn}
        phase={phase}
        counters={counters}
        score={score}
        deckCount={deck.length}
        canDraw={canDraw && isMyTurn}
        canAdvancePhase={canAdvancePhase && isMyTurn}
        gameOver={gameOver}
        victory={winner ? winner === 1 : victory}
        gameOverMessage={gameOverMessage}
        opponentScore={opponentState?.score ?? 0}
        isMyTurn={isMyTurn}
        onDraw={handleDraw}
        onAdvancePhase={() => sendAction({ type: "NEXT_PHASE" })}
        onNewGame={handleNewGame}
      />

      {/* Opponent board (top) */}
      {opponentState && (
        <OpponentBoard
          opponentState={opponentState}
          isOpponentTurn={!isMyTurn}
        />
      )}

      {/* AI turn overlay (hidden when human needs to select dilemmas) */}
      {!isMyTurn && !gameOver && !dilemmaSelectionRequest && (
        <div className="game-board__ai-overlay">AI is playing...</div>
      )}

      {/* Player's mission columns */}
      <div className="game-board__missions">
        {missions.map((deployment, index) => (
          <MissionColumn
            key={deployment.mission.uniqueId || index}
            deployment={deployment}
            missionIndex={index}
            isHeadquarters={index === headquartersIndex}
            onCardClick={handleViewCard}
            onGroupClick={handleGroupClick}
            onAttemptMission={handleAttemptMission}
            onDilemmasClick={handleDilemmasClick}
            canAttempt={phase === "ExecuteOrders" && !dilemmaEncounter}
            grantedSkills={grantedSkills}
          />
        ))}
      </div>

      {/* Hand */}
      <HandContainer
        cards={hand}
        counters={counters}
        phase={gameOver ? "" : phase}
        uniquesInPlay={new Set(uniquesInPlay)}
        onDeploy={gameOver ? undefined : handleDeploy}
        onPlayEvent={gameOver ? undefined : handlePlayEvent}
        onDiscard={gameOver ? undefined : handleDiscard}
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
        grantedSkills={grantedSkills}
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
        onBeamAllToShip={handleBeamAllToShip}
        onBeamAllToPlanet={handleBeamAllToPlanet}
        usedOrderAbilities={usedOrderAbilities}
        grantedSkills={grantedSkills}
        deckSize={deck.length}
        onExecuteOrderAbility={handleExecuteOrderAbility}
      />

      <DilemmaModal
        encounter={dilemmaEncounter}
        personnel={dilemmaPersonnel}
        dilemmaResult={dilemmaResult}
        grantedSkills={grantedSkills}
        deckCount={deck.length}
        playableInterrupts={playableInterrupts}
        onSelectPersonnel={handleSelectPersonnelForDilemma}
        onContinue={handleAdvanceDilemma}
        onCardClick={handleViewCard}
        onExecuteInterlink={handleExecuteInterlinkAbility}
        onPlayInterrupt={handlePlayInterrupt}
      />

      <DiscardPicker
        isOpen={discardPickerState.isOpen}
        onClose={handleDiscardPickerClose}
        onConfirm={handleDiscardPickerConfirm}
        onCardClick={handleViewCard}
        discardPile={discard}
        maxSelections={discardPickerState.maxSelections}
        allowedTypes={discardPickerState.allowedTypes}
        eventCard={discardPickerState.eventCard}
      />

      <DilemmaSelectionModal
        request={dilemmaSelectionRequest}
        onSubmit={handleSelectDilemmas}
        onCardClick={handleViewCard}
      />

      {/* Captain's Log */}
      <ActionLog entries={actionLog} onCardClick={handleLogCardClick} />
    </div>
  );
}
