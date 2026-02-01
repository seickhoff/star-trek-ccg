import { create } from "zustand";
import type {
  Card,
  DilemmaCard,
  MissionCard,
  PersonnelCard,
  ShipCard,
  GamePhase,
  MissionDeployment,
  DilemmaEncounter,
} from "../types";
import {
  isMission,
  isDilemma,
  isPersonnel,
  isShip,
  GAME_CONSTANTS,
} from "../types";
import { cardDatabase } from "../data/cardDatabase";
import { shuffle } from "../utils/shuffle";
import { resetShipRange } from "../logic/shipMovement";

/**
 * Deep clone a card to avoid mutation issues
 */
function cloneCard<T extends Card>(card: T): T {
  return { ...card };
}

/**
 * Create a unique instance of a card with a unique ID
 */
function createCardInstance<T extends Card>(card: T, index: number): T {
  return {
    ...cloneCard(card),
    uniqueId: `${card.id}-${index}`,
  };
}

/**
 * Game store state
 */
interface GameStoreState {
  // Deck zones
  deck: Card[];
  hand: Card[];
  discard: Card[];
  dilemmaPool: DilemmaCard[];

  // Board state
  missions: MissionDeployment[];

  // Tracking
  uniquesInPlay: Set<string>;

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

  // Game result
  gameOver: boolean;
  victory: boolean;

  // Headquarters mission index (for deploying cards)
  headquartersIndex: number;
}

/**
 * Game store actions
 */
interface GameStoreActions {
  // Setup
  setupGame: (deckCardIds: string[]) => void;
  resetGame: () => void;

  // Turn management
  newTurn: () => void;
  nextPhase: () => void;

  // Card actions
  draw: (count?: number) => void;
  deploy: (cardUniqueId: string, missionIndex?: number) => boolean;
  discardCard: (cardUniqueId: string) => void;

  // Movement (basic - full implementation in Phase 4)
  beamToShip: (
    personnelId: string,
    missionIndex: number,
    fromGroup: number,
    toGroup: number
  ) => void;
  beamToPlanet: (
    personnelId: string,
    missionIndex: number,
    fromGroup: number
  ) => void;

  // Internal helpers
  _findCardInHand: (uniqueId: string) => Card | undefined;
  _removeFromHand: (uniqueId: string) => void;
  _checkWinCondition: () => void;
  _checkLoseCondition: () => void;
}

type GameStore = GameStoreState & GameStoreActions;

/**
 * Initial state factory
 */
const createInitialState = (): GameStoreState => ({
  deck: [],
  hand: [],
  discard: [],
  dilemmaPool: [],
  missions: [],
  uniquesInPlay: new Set(),
  turn: 1,
  phase: "PlayAndDraw",
  counters: GAME_CONSTANTS.STARTING_COUNTERS,
  score: 0,
  completedPlanetMissions: 0,
  completedSpaceMissions: 0,
  dilemmaEncounter: null,
  gameOver: false,
  victory: false,
  headquartersIndex: -1,
});

/**
 * Main game store
 */
export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(),

  /**
   * Setup game from a deck list
   * Separates missions, dilemmas, and playable cards
   */
  setupGame: (deckCardIds: string[]) => {
    const missionCards: MissionCard[] = [];
    const dilemmaCards: DilemmaCard[] = [];
    const playableCards: Card[] = [];

    let cardIndex = 0;

    // Process each card ID and create unique instances
    for (const cardId of deckCardIds) {
      const baseCard = cardDatabase[cardId];
      if (!baseCard) {
        console.warn(`Card not found in database: ${cardId}`);
        continue;
      }

      const cardInstance = createCardInstance(baseCard, cardIndex++);

      if (isMission(cardInstance)) {
        missionCards.push(cardInstance);
      } else if (isDilemma(cardInstance)) {
        dilemmaCards.push(cardInstance);
      } else {
        playableCards.push(cardInstance);
      }
    }

    // Find headquarters index
    const headquartersIndex = missionCards.findIndex(
      (m) => m.missionType === "Headquarters"
    );

    // Create mission deployments (5 missions, each with empty groups)
    const missions: MissionDeployment[] = missionCards.map((mission) => ({
      mission,
      groups: [{ cards: [] }], // Group 0 is always for planet-side personnel
      dilemmas: [],
    }));

    // Shuffle playable cards and dilemmas
    const shuffledDeck = shuffle(playableCards);
    const shuffledDilemmas = shuffle(dilemmaCards) as DilemmaCard[];

    set({
      ...createInitialState(),
      deck: shuffledDeck,
      dilemmaPool: shuffledDilemmas,
      missions,
      headquartersIndex,
    });

    // Draw initial hand (7 cards)
    get().draw(GAME_CONSTANTS.MAX_HAND_SIZE);
  },

  /**
   * Reset game to initial state
   */
  resetGame: () => {
    set(createInitialState());
  },

  /**
   * Start a new turn
   * - Increment turn counter
   * - Reset to PlayAndDraw phase
   * - Reset counters to 7
   * - Reset ship ranges
   * - Unstop stopped personnel
   */
  newTurn: () => {
    const { missions, gameOver } = get();

    if (gameOver) return;

    // Reset ship ranges and unstop personnel
    const updatedMissions = missions.map((deployment) => ({
      ...deployment,
      groups: deployment.groups.map((group) => ({
        cards: group.cards.map((card) => {
          if (isShip(card)) {
            return resetShipRange(card);
          }
          if (isPersonnel(card) && card.status === "Stopped") {
            return { ...card, status: "Unstopped" as const };
          }
          return card;
        }),
      })),
    }));

    set((state) => ({
      turn: state.turn + 1,
      phase: "PlayAndDraw",
      counters: GAME_CONSTANTS.STARTING_COUNTERS,
      missions: updatedMissions,
    }));

    // Check lose condition at start of turn
    get()._checkLoseCondition();
  },

  /**
   * Advance to next phase
   * PlayAndDraw -> ExecuteOrders -> DiscardExcess -> (newTurn)
   */
  nextPhase: () => {
    const { phase, counters, hand, gameOver } = get();

    if (gameOver) return;

    if (phase === "PlayAndDraw") {
      // Can only advance if counters are spent or choosing to stop early
      set({ phase: "ExecuteOrders" });
    } else if (phase === "ExecuteOrders") {
      set({ phase: "DiscardExcess" });
    } else if (phase === "DiscardExcess") {
      // Can only end turn if hand size is valid
      if (hand.length <= GAME_CONSTANTS.MAX_HAND_SIZE && counters === 0) {
        get().newTurn();
      }
    }
  },

  /**
   * Draw cards from deck into hand
   */
  draw: (count = 1) => {
    const { deck, hand, counters, phase } = get();

    // Can only draw during PlayAndDraw phase
    if (phase !== "PlayAndDraw") return;

    const actualCount = Math.min(count, deck.length, counters);

    if (actualCount <= 0) return;

    const drawnCards = deck.slice(0, actualCount);
    const remainingDeck = deck.slice(actualCount);

    set({
      deck: remainingDeck,
      hand: [...hand, ...drawnCards],
      counters: counters - actualCount,
    });

    // Auto-advance to Orders if counters are 0
    if (counters - actualCount === 0) {
      set({ phase: "ExecuteOrders" });
    }
  },

  /**
   * Deploy a card from hand to a mission
   */
  deploy: (cardUniqueId: string, missionIndex?: number) => {
    const { counters, phase, missions, uniquesInPlay, headquartersIndex } =
      get();

    // Can only deploy during PlayAndDraw phase
    if (phase !== "PlayAndDraw") return false;

    // Find card in hand
    const card = get()._findCardInHand(cardUniqueId);
    if (!card) return false;

    // Check if card is deployable (has deploy cost)
    if (!("deploy" in card)) return false;
    const deployCost = (card as PersonnelCard | ShipCard).deploy;

    // Check if enough counters
    if (counters < deployCost) return false;

    // Check if unique card is already in play
    if (card.unique && uniquesInPlay.has(card.id)) return false;

    // Default to headquarters if no mission specified
    const targetMission = missionIndex ?? headquartersIndex;
    if (targetMission < 0 || targetMission >= missions.length) return false;

    // Deploy based on card type
    if (isPersonnel(card)) {
      // Personnel go to group 0 (planet-side)
      const updatedMissions = [...missions];
      updatedMissions[targetMission] = {
        ...updatedMissions[targetMission],
        groups: [
          {
            cards: [...updatedMissions[targetMission].groups[0].cards, card],
          },
          ...updatedMissions[targetMission].groups.slice(1),
        ],
      };

      get()._removeFromHand(cardUniqueId);

      const newUniques = new Set(uniquesInPlay);
      if (card.unique) newUniques.add(card.id);

      set({
        missions: updatedMissions,
        counters: counters - deployCost,
        uniquesInPlay: newUniques,
      });

      // Auto-advance if counters are 0
      if (counters - deployCost === 0) {
        set({ phase: "ExecuteOrders" });
      }

      return true;
    }

    if (isShip(card)) {
      // Ships create a new group
      const updatedMissions = [...missions];
      updatedMissions[targetMission] = {
        ...updatedMissions[targetMission],
        groups: [...updatedMissions[targetMission].groups, { cards: [card] }],
      };

      get()._removeFromHand(cardUniqueId);

      const newUniques = new Set(uniquesInPlay);
      if (card.unique) newUniques.add(card.id);

      set({
        missions: updatedMissions,
        counters: counters - deployCost,
        uniquesInPlay: newUniques,
      });

      // Auto-advance if counters are 0
      if (counters - deployCost === 0) {
        set({ phase: "ExecuteOrders" });
      }

      return true;
    }

    return false;
  },

  /**
   * Discard a card from hand
   */
  discardCard: (cardUniqueId: string) => {
    const { discard, phase } = get();

    // Can only discard during DiscardExcess phase (or if hand > 7)
    if (phase !== "DiscardExcess") return;

    const card = get()._findCardInHand(cardUniqueId);
    if (!card) return;

    get()._removeFromHand(cardUniqueId);

    set({
      discard: [...discard, card],
    });
  },

  /**
   * Beam personnel from one group to a ship (another group)
   */
  beamToShip: (
    personnelId: string,
    missionIndex: number,
    fromGroup: number,
    toGroup: number
  ) => {
    const { missions, phase } = get();

    if (phase !== "ExecuteOrders") return;
    if (missionIndex < 0 || missionIndex >= missions.length) return;

    const deployment = missions[missionIndex];
    if (fromGroup < 0 || fromGroup >= deployment.groups.length) return;
    if (toGroup < 0 || toGroup >= deployment.groups.length) return;
    if (fromGroup === toGroup) return;

    // Find personnel in source group
    const sourceGroup = deployment.groups[fromGroup];
    const personnelIndex = sourceGroup.cards.findIndex(
      (c) => c.uniqueId === personnelId && isPersonnel(c)
    );

    if (personnelIndex === -1) return;

    const personnel = sourceGroup.cards[personnelIndex];

    // Target group must have a ship (for beaming to ship)
    const targetGroup = deployment.groups[toGroup];
    if (toGroup > 0 && !targetGroup.cards.some(isShip)) return;

    // Move personnel
    const updatedMissions = [...missions];
    const updatedDeployment = { ...deployment };
    updatedDeployment.groups = deployment.groups.map((group, idx) => {
      if (idx === fromGroup) {
        return {
          cards: group.cards.filter((c) => c.uniqueId !== personnelId),
        };
      }
      if (idx === toGroup) {
        return {
          cards: [...group.cards, personnel],
        };
      }
      return group;
    });

    updatedMissions[missionIndex] = updatedDeployment;
    set({ missions: updatedMissions });
  },

  /**
   * Beam personnel from a ship to planet-side (group 0)
   */
  beamToPlanet: (
    personnelId: string,
    missionIndex: number,
    fromGroup: number
  ) => {
    get().beamToShip(personnelId, missionIndex, fromGroup, 0);
  },

  /**
   * Find a card in hand by unique ID
   */
  _findCardInHand: (uniqueId: string) => {
    return get().hand.find((c) => c.uniqueId === uniqueId);
  },

  /**
   * Remove a card from hand by unique ID
   */
  _removeFromHand: (uniqueId: string) => {
    set((state) => ({
      hand: state.hand.filter((c) => c.uniqueId !== uniqueId),
    }));
  },

  /**
   * Check if player has won
   */
  _checkWinCondition: () => {
    const { score, completedPlanetMissions, completedSpaceMissions } = get();

    if (
      score >= GAME_CONSTANTS.WIN_SCORE &&
      completedPlanetMissions >= 1 &&
      completedSpaceMissions >= 1
    ) {
      set({ gameOver: true, victory: true });
    }
  },

  /**
   * Check if player has lost
   */
  _checkLoseCondition: () => {
    const { deck, hand, missions } = get();

    // Lost if deck is empty and no deployable cards in hand
    if (deck.length === 0) {
      const hasDeployableCards = hand.some((c) => isPersonnel(c) || isShip(c));
      const hasCardsInPlay = missions.some((m) =>
        m.groups.some((g) => g.cards.length > 0)
      );

      if (!hasDeployableCards && !hasCardsInPlay) {
        set({ gameOver: true, victory: false });
      }
    }
  },
}));

// =============================================================================
// SELECTORS (derived state)
// =============================================================================

/**
 * Get total cards in deck
 */
export const selectDeckCount = (state: GameStore) => state.deck.length;

/**
 * Get cards in hand
 */
export const selectHand = (state: GameStore) => state.hand;

/**
 * Get hand count
 */
export const selectHandCount = (state: GameStore) => state.hand.length;

/**
 * Check if hand is over limit
 */
export const selectNeedsDiscard = (state: GameStore) =>
  state.hand.length > GAME_CONSTANTS.MAX_HAND_SIZE;

/**
 * Get current phase
 */
export const selectPhase = (state: GameStore) => state.phase;

/**
 * Get current turn
 */
export const selectTurn = (state: GameStore) => state.turn;

/**
 * Get remaining counters
 */
export const selectCounters = (state: GameStore) => state.counters;

/**
 * Get current score
 */
export const selectScore = (state: GameStore) => state.score;

/**
 * Check if game is over
 */
export const selectGameOver = (state: GameStore) => state.gameOver;

/**
 * Check if player won
 */
export const selectVictory = (state: GameStore) => state.victory;

/**
 * Get all missions
 */
export const selectMissions = (state: GameStore) => state.missions;

/**
 * Get mission at index
 */
export const selectMissionAt = (index: number) => (state: GameStore) =>
  state.missions[index];

/**
 * Get deployable cards from hand (have enough counters and not unique-in-play)
 */
export const selectDeployableCards = (state: GameStore) => {
  const { hand, counters, uniquesInPlay, phase } = state;

  if (phase !== "PlayAndDraw") return [];

  return hand.filter((card) => {
    if (!("deploy" in card)) return false;
    const cost = (card as PersonnelCard | ShipCard).deploy;
    if (cost > counters) return false;
    if (card.unique && uniquesInPlay.has(card.id)) return false;
    return true;
  });
};

/**
 * Check if can draw (deck not empty, have counters, in PlayAndDraw phase)
 */
export const selectCanDraw = (state: GameStore) =>
  state.phase === "PlayAndDraw" && state.deck.length > 0 && state.counters > 0;

/**
 * Check if can advance phase
 */
export const selectCanAdvancePhase = (state: GameStore) => {
  const { phase, counters, hand } = state;

  if (phase === "PlayAndDraw") {
    // Can always advance from PlayAndDraw (choosing to stop spending counters)
    return true;
  }

  if (phase === "ExecuteOrders") {
    return true;
  }

  if (phase === "DiscardExcess") {
    // Can only start new turn if hand is valid and counters are spent
    return hand.length <= GAME_CONSTANTS.MAX_HAND_SIZE && counters === 0;
  }

  return false;
};

/**
 * Get all personnel at a mission (across all groups)
 */
export const selectPersonnelAtMission =
  (missionIndex: number) => (state: GameStore) => {
    const mission = state.missions[missionIndex];
    if (!mission) return [];

    return mission.groups.flatMap((group) => group.cards.filter(isPersonnel));
  };

/**
 * Get all ships at a mission
 */
export const selectShipsAtMission =
  (missionIndex: number) => (state: GameStore) => {
    const mission = state.missions[missionIndex];
    if (!mission) return [];

    return mission.groups.flatMap((group) => group.cards.filter(isShip));
  };

/**
 * Get cards in a specific group at a mission
 */
export const selectCardsInGroup =
  (missionIndex: number, groupIndex: number) => (state: GameStore) => {
    const mission = state.missions[missionIndex];
    if (!mission || groupIndex >= mission.groups.length) return [];
    return mission.groups[groupIndex].cards;
  };

/**
 * Get the headquarters mission
 */
export const selectHeadquarters = (state: GameStore) => {
  const { missions, headquartersIndex } = state;
  if (headquartersIndex < 0 || headquartersIndex >= missions.length)
    return null;
  return missions[headquartersIndex];
};

/**
 * Get turn summary info
 */
export const selectTurnSummary = (state: GameStore) => ({
  turn: state.turn,
  phase: state.phase,
  counters: state.counters,
  handCount: state.hand.length,
  deckCount: state.deck.length,
  score: state.score,
  completedPlanetMissions: state.completedPlanetMissions,
  completedSpaceMissions: state.completedSpaceMissions,
});
