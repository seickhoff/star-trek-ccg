import { create } from "zustand";
import type {
  Card,
  InterruptCard,
  PersonnelCard,
  DilemmaCard,
  GamePhase,
  MissionType,
  MissionDeployment,
  DilemmaEncounter,
  GrantedSkill,
  RangeBoost,
  ActionLogEntry,
  SerializableGameState,
  DilemmaResult,
  Ability,
  AbilityCondition,
  OpponentPublicState,
  TwoPlayerGameState,
} from "@stccg/shared";
import { isInterrupt, isPersonnel } from "@stccg/shared";

/**
 * Interrupt card with the specific ability that can be played
 */
interface PlayableInterrupt {
  card: InterruptCard;
  ability: Ability;
}

/**
 * Client-side game store state (receives state from server)
 */
interface ClientGameState {
  // Deck zones
  deck: Card[];
  hand: Card[];
  discard: Card[];
  removedFromGame: Card[];

  // Board state
  missions: MissionDeployment[];

  // Tracking
  uniquesInPlay: string[];

  // Turn state
  turn: number;
  phase: GamePhase;
  counters: number;

  // Score tracking
  score: number;
  completedPlanetMissions: number;
  completedSpaceMissions: number;

  // Dilemma encounter
  dilemmaEncounter: DilemmaEncounter | null;
  dilemmaResult: DilemmaResult | null;

  // Order ability tracking
  usedOrderAbilities: string[];
  grantedSkills: GrantedSkill[];
  rangeBoosts: RangeBoost[];

  // Game result
  gameOver: boolean;
  victory: boolean;

  // UI helpers
  headquartersIndex: number;

  // Action log
  actionLog: ActionLogEntry[];
  aiActionLog: ActionLogEntry[];

  // Two-player state
  opponentState: OpponentPublicState | null;
  activePlayer: 1 | 2;
  myPlayerNumber: 1 | 2;
  winner: 1 | 2 | null;
  isAITurnInProgress: boolean;

  // Dilemma selection (when AI attempts a mission)
  dilemmaSelectionRequest: {
    drawnDilemmas: DilemmaCard[];
    costBudget: number;
    drawCount: number;
    missionName: string;
    missionType: MissionType;
    aiPersonnelCount: number;
    reEncounterDilemmas: DilemmaCard[];
  } | null;
}

interface ClientGameActions {
  syncState: (serverState: SerializableGameState) => void;
  syncTwoPlayerState: (twoPlayerState: TwoPlayerGameState) => void;
  setAITurnInProgress: (inProgress: boolean) => void;
  addLogEntry: (entry: ActionLogEntry) => void;
  addAILogEntry: (entry: ActionLogEntry) => void;
  setDilemmaSelectionRequest: (
    request: ClientGameState["dilemmaSelectionRequest"]
  ) => void;
  reset: () => void;
}

type ClientGameStore = ClientGameState & ClientGameActions;

const createInitialState = (): ClientGameState => ({
  deck: [],
  hand: [],
  discard: [],
  removedFromGame: [],
  missions: [],
  uniquesInPlay: [],
  turn: 1,
  phase: "PlayAndDraw",
  counters: 7,
  score: 0,
  completedPlanetMissions: 0,
  completedSpaceMissions: 0,
  dilemmaEncounter: null,
  dilemmaResult: null,
  usedOrderAbilities: [],
  grantedSkills: [],
  rangeBoosts: [],
  gameOver: false,
  victory: false,
  headquartersIndex: -1,
  actionLog: [],
  aiActionLog: [],
  opponentState: null,
  activePlayer: 1,
  myPlayerNumber: 1,
  winner: null,
  isAITurnInProgress: false,
  dilemmaSelectionRequest: null,
});

export const useClientGameStore = create<ClientGameStore>((set) => ({
  ...createInitialState(),

  syncState: (serverState: SerializableGameState) => {
    set({
      deck: serverState.deck,
      hand: serverState.hand,
      discard: serverState.discard,
      removedFromGame: serverState.removedFromGame,
      missions: serverState.missions,
      uniquesInPlay: serverState.uniquesInPlay,
      turn: serverState.turn,
      phase: serverState.phase,
      counters: serverState.counters,
      score: serverState.score,
      completedPlanetMissions: serverState.completedPlanetMissions,
      completedSpaceMissions: serverState.completedSpaceMissions,
      dilemmaEncounter: serverState.dilemmaEncounter,
      dilemmaResult: serverState.dilemmaResult,
      usedOrderAbilities: serverState.usedOrderAbilities,
      grantedSkills: serverState.grantedSkills,
      rangeBoosts: serverState.rangeBoosts,
      gameOver: serverState.gameOver,
      victory: serverState.victory,
      headquartersIndex: serverState.headquartersIndex,
      actionLog: serverState.actionLog,
    });
  },

  syncTwoPlayerState: (twoPlayerState: TwoPlayerGameState) => {
    const s = twoPlayerState.myState;
    set((prev) => ({
      deck: s.deck,
      hand: s.hand,
      discard: s.discard,
      removedFromGame: s.removedFromGame,
      missions: s.missions,
      uniquesInPlay: s.uniquesInPlay,
      turn: s.turn,
      phase: s.phase,
      counters: s.counters,
      score: s.score,
      completedPlanetMissions: s.completedPlanetMissions,
      completedSpaceMissions: s.completedSpaceMissions,
      dilemmaEncounter: s.dilemmaEncounter,
      dilemmaResult: s.dilemmaResult,
      usedOrderAbilities: s.usedOrderAbilities,
      grantedSkills: s.grantedSkills,
      rangeBoosts: s.rangeBoosts,
      gameOver: s.gameOver,
      victory: s.victory,
      headquartersIndex: s.headquartersIndex,
      actionLog: s.actionLog,
      // Reset AI log on new game (human log resets to 1 entry = game start)
      aiActionLog: s.actionLog.length <= 1 ? [] : prev.aiActionLog,
      opponentState: twoPlayerState.opponentState,
      activePlayer: twoPlayerState.activePlayer,
      myPlayerNumber: twoPlayerState.myPlayerNumber,
      winner: twoPlayerState.winner,
    }));
  },

  setAITurnInProgress: (inProgress: boolean) =>
    set({ isAITurnInProgress: inProgress }),

  addLogEntry: (entry: ActionLogEntry) =>
    set((state) => ({ actionLog: [...state.actionLog, entry] })),

  addAILogEntry: (entry: ActionLogEntry) =>
    set((state) => ({ aiActionLog: [...state.aiActionLog, entry] })),

  setDilemmaSelectionRequest: (request) =>
    set({ dilemmaSelectionRequest: request }),

  reset: () => set(createInitialState()),
}));

// Selectors (work the same as before)
export const selectCanDraw = (state: ClientGameStore) =>
  state.phase === "PlayAndDraw" && state.deck.length > 0 && state.counters > 0;

export const selectCanAdvancePhase = (state: ClientGameStore) => {
  const { phase, counters, hand, deck } = state;
  if (phase === "PlayAndDraw") {
    // Must spend all counters unless deck is empty
    if (counters > 0 && deck.length > 0) return false;
    return true;
  }
  if (phase === "ExecuteOrders") return true;
  if (phase === "DiscardExcess") {
    return hand.length <= 7 && counters === 0;
  }
  return false;
};

export const selectDilemmaResult = (state: ClientGameStore) =>
  state.dilemmaResult;

/**
 * Check whether an interrupt ability's conditions are met client-side.
 * This prevents showing a "Play" button for interrupts that the server will reject.
 */
function checkInterruptConditions(
  conditions: AbilityCondition[] | undefined,
  state: ClientGameStore
): boolean {
  if (!conditions || conditions.length === 0) return true;
  if (!state.dilemmaEncounter) return false;

  const { missionIndex, groupIndex, selectedDilemmas, currentDilemmaIndex } =
    state.dilemmaEncounter;
  const deployment = state.missions[missionIndex];
  if (!deployment) return false;
  const group = deployment.groups[groupIndex];
  if (!group) return false;

  for (const condition of conditions) {
    if (condition.type === "borgPersonnelFacing") {
      const hasBorg = group.cards.some(
        (c) =>
          isPersonnel(c) &&
          (c as PersonnelCard).species.includes("Borg") &&
          (c as PersonnelCard).status === "Unstopped"
      );
      if (!hasBorg) return false;
    }

    if (condition.type === "dilemmaOvercomeAtAnyMission") {
      const currentDilemma = selectedDilemmas[currentDilemmaIndex];
      if (!currentDilemma) return false;

      const hasOvercomeCopy = state.missions.some((d) =>
        d.dilemmas.some(
          (dilemma) => dilemma.id === currentDilemma.id && dilemma.overcome
        )
      );
      if (!hasOvercomeCopy) return false;
    }
  }

  return true;
}

export const selectPlayableInterrupts = (
  state: ClientGameStore
): PlayableInterrupt[] => {
  // Interrupts can only be played during dilemma encounters
  if (!state.dilemmaEncounter) return [];

  const playable: PlayableInterrupt[] = [];

  for (const card of state.hand) {
    if (!isInterrupt(card)) continue;

    const interruptCard = card as InterruptCard;
    const abilities = interruptCard.abilities || [];

    for (const ability of abilities) {
      if (
        ability.trigger === "interrupt" &&
        ability.interruptTiming === "whenFacingDilemma" &&
        checkInterruptConditions(ability.conditions, state)
      ) {
        playable.push({ card: interruptCard, ability });
      }
    }
  }

  return playable;
};

export const selectActionLog = (state: ClientGameStore) => {
  if (state.aiActionLog.length === 0) return state.actionLog;
  return [...state.actionLog, ...state.aiActionLog].sort(
    (a, b) => a.timestamp - b.timestamp
  );
};

export const selectIsMyTurn = (state: ClientGameStore) =>
  state.activePlayer === state.myPlayerNumber;

export const selectOpponentState = (state: ClientGameStore) =>
  state.opponentState;

export const selectWinner = (state: ClientGameStore) => state.winner;

export const selectDilemmaSelectionRequest = (state: ClientGameStore) =>
  state.dilemmaSelectionRequest;
