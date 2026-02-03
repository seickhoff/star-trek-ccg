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
import { resetShipRange, checkStaffed } from "../logic/shipMovement";
import {
  resolveDilemma,
  resolveSelectionStop,
  type DilemmaResult,
} from "../logic/dilemmaResolver";
import { checkMission } from "../logic/missionChecker";

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
  // Current dilemma resolution result (for UI state)
  dilemmaResult: DilemmaResult | null;

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

  // Movement
  moveShip: (
    sourceMission: number,
    groupIndex: number,
    destMission: number
  ) => void;
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

  // Mission attempt and dilemmas
  attemptMission: (missionIndex: number, groupIndex: number) => void;
  selectPersonnelForDilemma: (personnelId: string) => void;
  advanceDilemma: () => void;
  clearDilemmaEncounter: () => void;

  // Internal helpers
  _findCardInHand: (uniqueId: string) => Card | undefined;
  _removeFromHand: (uniqueId: string) => void;
  _checkWinCondition: () => void;
  _checkLoseCondition: () => void;
  _applyDilemmaResult: (result: DilemmaResult) => void;
  _scoreMission: (missionIndex: number) => void;
  _failMissionAttempt: () => void;
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
  dilemmaResult: null,
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

    // Draw initial hand (free - doesn't cost counters)
    const initialHand = shuffledDeck.slice(0, GAME_CONSTANTS.MAX_HAND_SIZE);
    const remainingDeck = shuffledDeck.slice(GAME_CONSTANTS.MAX_HAND_SIZE);

    set({
      ...createInitialState(),
      deck: remainingDeck,
      hand: initialHand,
      dilemmaPool: shuffledDilemmas,
      missions,
      headquartersIndex,
    });
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
    const { phase, counters, hand, deck, gameOver } = get();

    if (gameOver) return;

    if (phase === "PlayAndDraw") {
      // Rule 6.6: Must spend all seven counters each turn.
      // If your deck is empty, you do not have to spend all seven counters.
      if (counters > 0 && deck.length > 0) return;
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

    // Rule 6.7: Deployment Affiliation Validation
    // "Personnel, Ships, and Equipment are played at a headquarters mission if that
    // mission's game text allows those cards to be played there."
    const targetDeployment = missions[targetMission];
    if (targetDeployment?.mission.missionType === "Headquarters") {
      const playAllowed = targetDeployment.mission.play;
      if (playAllowed) {
        let canPlay = false;

        if (isPersonnel(card) || isShip(card)) {
          // Check if any card affiliation matches allowed affiliations
          const cardAffiliations = card.affiliation;
          canPlay = cardAffiliations.some((aff) => playAllowed.includes(aff));
        }
        // Note: Equipment would check playAllowed.includes('Equipment')
        // but Equipment deployment is not yet implemented

        if (!canPlay) return false;
      }
    }

    // Deploy based on card type
    if (isPersonnel(card)) {
      // Personnel go to group 0 (planet-side)
      const updatedMissions = [...missions];
      const targetDeployment = updatedMissions[targetMission]!;
      const group0 = targetDeployment.groups[0]!;

      updatedMissions[targetMission] = {
        ...targetDeployment,
        groups: [
          {
            cards: [...group0.cards, card],
          },
          ...targetDeployment.groups.slice(1),
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
      const targetDeployment = updatedMissions[targetMission]!;

      updatedMissions[targetMission] = {
        ...targetDeployment,
        groups: [...targetDeployment.groups, { cards: [card] }],
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
   * Move a ship (and all personnel aboard) to a different mission
   */
  moveShip: (
    sourceMission: number,
    groupIndex: number,
    destMission: number
  ) => {
    const { missions, phase } = get();

    if (phase !== "ExecuteOrders") return;
    if (sourceMission < 0 || sourceMission >= missions.length) return;
    if (destMission < 0 || destMission >= missions.length) return;
    if (sourceMission === destMission) return;

    const sourceDeployment = missions[sourceMission]!;
    if (groupIndex < 0 || groupIndex >= sourceDeployment.groups.length) return;

    const group = sourceDeployment.groups[groupIndex]!;
    const ship = group.cards.find(isShip);
    if (!ship) return;

    // Rule 6.3: Ship must be staffed to move
    // Requires matching affiliation personnel + staffing icons
    if (!checkStaffed(group.cards)) return;

    // Calculate range cost
    const sourceMissionCard = sourceDeployment.mission;
    const destMissionCard = missions[destMission]!.mission;
    const rangeCost =
      sourceMissionCard.range +
      destMissionCard.range +
      (sourceMissionCard.quadrant !== destMissionCard.quadrant ? 2 : 0);

    // Check if ship has enough range
    if ((ship as ShipCard).rangeRemaining < rangeCost) return;

    // Update ship's remaining range
    const updatedShip: ShipCard = {
      ...(ship as ShipCard),
      rangeRemaining: (ship as ShipCard).rangeRemaining - rangeCost,
    };

    // Update the group with the new ship
    const updatedGroupCards = group.cards.map((c) =>
      c.uniqueId === ship.uniqueId ? updatedShip : c
    );

    // Remove group from source mission
    const updatedSourceDeployment = {
      ...sourceDeployment,
      groups: sourceDeployment.groups.filter((_, idx) => idx !== groupIndex),
    };

    // Add group to destination mission
    const destDeployment = missions[destMission]!;
    const updatedDestDeployment = {
      ...destDeployment,
      groups: [...destDeployment.groups, { cards: updatedGroupCards }],
    };

    // Update missions array
    const updatedMissions = missions.map((m, idx) => {
      if (idx === sourceMission) return updatedSourceDeployment;
      if (idx === destMission) return updatedDestDeployment;
      return m;
    });

    set({ missions: updatedMissions });
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

    const deployment = missions[missionIndex]!;
    if (fromGroup < 0 || fromGroup >= deployment.groups.length) return;
    if (toGroup < 0 || toGroup >= deployment.groups.length) return;
    if (fromGroup === toGroup) return;

    // Find personnel in source group
    const sourceGroup = deployment.groups[fromGroup]!;
    const personnelIndex = sourceGroup.cards.findIndex(
      (c) => c.uniqueId === personnelId && isPersonnel(c)
    );

    if (personnelIndex === -1) return;

    const personnel = sourceGroup.cards[personnelIndex]!;

    // Target group must have a ship (for beaming to ship)
    const targetGroup = deployment.groups[toGroup]!;
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
   * Start a mission attempt
   * Draws dilemmas and initiates encounter
   */
  attemptMission: (missionIndex: number, groupIndex: number) => {
    const { missions, dilemmaPool, phase, headquartersIndex } = get();

    // Can only attempt during ExecuteOrders
    if (phase !== "ExecuteOrders") return;
    if (missionIndex < 0 || missionIndex >= missions.length) return;

    // Cannot attempt headquarters mission
    if (missionIndex === headquartersIndex) return;

    const deployment = missions[missionIndex]!;
    const mission = deployment.mission;

    // Mission already completed
    if (mission.completed) return;

    // Get the attempting group
    const group = deployment.groups[groupIndex];
    if (!group || group.cards.length === 0) return;

    // Count unstopped personnel
    const unstoppedPersonnel = group.cards.filter(
      (c) => isPersonnel(c) && (c as PersonnelCard).status === "Unstopped"
    );

    if (unstoppedPersonnel.length === 0) return;

    // Rule 6.4: Mission Attempt Affiliation Check
    // "To attempt a mission, the affiliation icon on at least one of the personnel
    // attempting must match one of the icons on that mission."
    const missionAffiliations = mission.affiliation ?? [];
    if (missionAffiliations.length > 0) {
      const hasMatchingAffiliation = unstoppedPersonnel.some((card) => {
        const personnel = card as PersonnelCard;
        return personnel.affiliation.some((a) =>
          missionAffiliations.includes(a)
        );
      });
      if (!hasMatchingAffiliation) return;
    }

    // Filter applicable dilemmas
    const missionType = mission.missionType;
    const applicableDilemmas = dilemmaPool.filter((d) => {
      // Check location match
      if (d.where === "Dual") return true;
      if (d.where === "Planet" && missionType === "Planet") return true;
      if (d.where === "Space" && missionType === "Space") return true;
      return false;
    });

    // Rule 6.1: Subtract overcome dilemmas from draw count
    // "If you attempt a mission where there are overcome dilemmas underneath it,
    // the number of those dilemmas is subtracted from that total first."
    const overcomeCount = deployment.dilemmas.length;
    const baseDrawCount = Math.max(
      0,
      unstoppedPersonnel.length - overcomeCount
    );

    // Rule 6.2: Cost budget equals the draw count (personnel - overcome)
    // "That number is also the total cost in dilemmas your opponent can spend."
    const costBudget = baseDrawCount;

    // For solitaire: select dilemmas by cost (highest first within budget)
    // Shuffle first, then sort by cost descending and select within budget
    const shuffledDilemmas = shuffle(applicableDilemmas) as DilemmaCard[];
    shuffledDilemmas.sort((a, b) => b.deploy - a.deploy);

    // Select dilemmas that fit within the cost budget
    const selectedDilemmas: DilemmaCard[] = [];
    let totalCost = 0;
    for (const dilemma of shuffledDilemmas) {
      if (totalCost + dilemma.deploy <= costBudget) {
        selectedDilemmas.push(dilemma);
        totalCost += dilemma.deploy;
      }
    }

    // Remove selected dilemmas from pool
    const remainingPool = dilemmaPool.filter(
      (d) => !selectedDilemmas.some((s) => s.uniqueId === d.uniqueId)
    );

    // Create encounter state
    const encounter: DilemmaEncounter = {
      missionIndex,
      groupIndex,
      selectedDilemmas,
      currentDilemmaIndex: 0,
      costBudget,
      costSpent: 0,
      facedDilemmaIds: [], // Rule 6.5: Track faced dilemma base IDs
    };

    set({
      dilemmaEncounter: encounter,
      dilemmaPool: remainingPool,
    });

    // If no dilemmas, go straight to scoring
    if (selectedDilemmas.length === 0) {
      get()._scoreMission(missionIndex);
      return;
    }

    // Resolve first dilemma
    const cards = group.cards;
    const firstDilemma = selectedDilemmas[0]!;

    // Rule 6.5: Track this dilemma's base ID as faced
    // (First dilemma can't be a duplicate since facedDilemmaIds starts empty)
    set({
      dilemmaEncounter: {
        ...encounter,
        facedDilemmaIds: [firstDilemma.id],
      },
    });

    const result = resolveDilemma(firstDilemma, cards);

    set({ dilemmaResult: result });

    // Apply automatic results
    if (!result.requiresSelection) {
      get()._applyDilemmaResult(result);
    }
  },

  /**
   * Handle player selecting personnel for dilemma
   */
  selectPersonnelForDilemma: (personnelId: string) => {
    const { dilemmaEncounter, dilemmaResult } = get();

    if (!dilemmaEncounter || !dilemmaResult) return;
    if (!dilemmaResult.requiresSelection) return;
    if (!dilemmaResult.selectablePersonnel.includes(personnelId)) return;

    const currentDilemma =
      dilemmaEncounter.selectedDilemmas[dilemmaEncounter.currentDilemmaIndex];
    if (!currentDilemma) return;

    // Resolve the selection
    const result = resolveSelectionStop(currentDilemma, personnelId);
    get()._applyDilemmaResult(result);
  },

  /**
   * Advance to next dilemma or complete encounter
   */
  advanceDilemma: () => {
    const { dilemmaEncounter, missions } = get();

    if (!dilemmaEncounter) return;

    const { missionIndex, groupIndex, selectedDilemmas, currentDilemmaIndex } =
      dilemmaEncounter;

    // Check if all personnel are stopped
    const deployment = missions[missionIndex]!;
    const group = deployment.groups[groupIndex]!;
    const unstopped = group.cards.filter(
      (c) => isPersonnel(c) && (c as PersonnelCard).status === "Unstopped"
    );

    // If all stopped, remaining dilemmas are overcome
    if (unstopped.length === 0) {
      get()._failMissionAttempt();
      return;
    }

    // Move to next dilemma
    const nextIndex = currentDilemmaIndex + 1;

    if (nextIndex >= selectedDilemmas.length) {
      // All dilemmas resolved - try to score mission
      get()._scoreMission(missionIndex);
      return;
    }

    // Get the next dilemma
    const nextDilemma = selectedDilemmas[nextIndex]!;

    // Rule 6.5: Check for duplicate dilemma
    // "If your opponent reveals more than one copy of the same dilemma in a mission attempt,
    // your personnel do not face that dilemma and it is overcome."
    const isDuplicate = dilemmaEncounter.facedDilemmaIds.includes(
      nextDilemma.id
    );

    if (isDuplicate) {
      // Auto-overcome the duplicate dilemma
      const updatedDilemma = {
        ...nextDilemma,
        overcome: true,
        faceup: true,
      };

      // Add to mission's overcome dilemmas
      const updatedMissions = [...missions];
      const missionDeployment = { ...updatedMissions[missionIndex]! };
      missionDeployment.dilemmas = [
        ...missionDeployment.dilemmas,
        updatedDilemma,
      ];
      updatedMissions[missionIndex] = missionDeployment;

      // Update selected dilemmas with overcome status
      const updatedSelectedDilemmas = selectedDilemmas.map((d, i) =>
        i === nextIndex ? updatedDilemma : d
      );

      // Update encounter to next dilemma (keeping same facedDilemmaIds since duplicate wasn't faced)
      set({
        missions: updatedMissions,
        dilemmaEncounter: {
          ...dilemmaEncounter,
          currentDilemmaIndex: nextIndex,
          selectedDilemmas: updatedSelectedDilemmas,
        },
        dilemmaResult: {
          overcome: true,
          stoppedPersonnel: [],
          killedPersonnel: [],
          requiresSelection: false,
          selectablePersonnel: [],
          returnsToPile: false,
          message: `Duplicate dilemma "${nextDilemma.name}" auto-overcome (Rule 6.5)`,
        },
      });

      // Recursively advance to check the next dilemma
      get().advanceDilemma();
      return;
    }

    // Not a duplicate - add to faced IDs and resolve normally
    set({
      dilemmaEncounter: {
        ...dilemmaEncounter,
        currentDilemmaIndex: nextIndex,
        facedDilemmaIds: [...dilemmaEncounter.facedDilemmaIds, nextDilemma.id],
      },
    });

    // Resolve next dilemma
    const result = resolveDilemma(nextDilemma, group.cards);

    set({ dilemmaResult: result });

    // Apply automatic results
    if (!result.requiresSelection) {
      get()._applyDilemmaResult(result);
    }
  },

  /**
   * Clear dilemma encounter state
   */
  clearDilemmaEncounter: () => {
    set({
      dilemmaEncounter: null,
      dilemmaResult: null,
    });
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

  /**
   * Apply dilemma result to game state
   */
  _applyDilemmaResult: (result: DilemmaResult) => {
    const { dilemmaEncounter, missions, discard, dilemmaPool } = get();

    if (!dilemmaEncounter) return;

    const { missionIndex, groupIndex, selectedDilemmas, currentDilemmaIndex } =
      dilemmaEncounter;

    const currentDilemma = selectedDilemmas[currentDilemmaIndex];
    if (!currentDilemma) return;

    const updatedMissions = [...missions];
    const deployment = { ...updatedMissions[missionIndex]! };
    const newDiscard = [...discard];
    let newDilemmaPool = [...dilemmaPool];

    // Update groups with stopped/killed personnel
    deployment.groups = deployment.groups.map((group, idx) => {
      if (idx !== groupIndex) return group;

      const updatedCards = group.cards
        .map((card) => {
          if (!isPersonnel(card)) return card;

          const personnel = card as PersonnelCard;
          if (!personnel.uniqueId) return card;

          // Check if killed
          if (result.killedPersonnel.includes(personnel.uniqueId)) {
            // Add to discard with killed status
            newDiscard.push({ ...personnel, status: "Killed" });
            return null; // Mark for removal
          }

          // Check if stopped
          if (result.stoppedPersonnel.includes(personnel.uniqueId)) {
            return { ...personnel, status: "Stopped" as const };
          }

          return card;
        })
        .filter((c): c is Card => c !== null);

      return { cards: updatedCards };
    });

    // Update dilemma state
    const updatedDilemma = {
      ...currentDilemma,
      overcome: result.overcome,
      faceup: true,
    };

    // Add dilemma to mission if overcome (or staying on mission like Limited Welcome)
    if (result.overcome || !result.returnsToPile) {
      deployment.dilemmas = [...deployment.dilemmas, updatedDilemma];
    }

    // Return dilemma to pool if specified
    if (result.returnsToPile) {
      newDilemmaPool = [...newDilemmaPool, updatedDilemma];
    }

    // Update selected dilemmas in encounter
    const updatedSelectedDilemmas = selectedDilemmas.map((d, i) =>
      i === currentDilemmaIndex ? updatedDilemma : d
    );

    updatedMissions[missionIndex] = deployment;

    // Update cost spent with the current dilemma's cost
    const newCostSpent = dilemmaEncounter.costSpent + currentDilemma.deploy;

    set({
      missions: updatedMissions,
      discard: newDiscard,
      dilemmaPool: newDilemmaPool,
      dilemmaEncounter: {
        ...dilemmaEncounter,
        selectedDilemmas: updatedSelectedDilemmas,
        costSpent: newCostSpent,
      },
      dilemmaResult: result,
    });
  },

  /**
   * Score a mission after passing all dilemmas
   */
  _scoreMission: (missionIndex: number) => {
    const {
      missions,
      dilemmaEncounter,
      score,
      completedPlanetMissions,
      completedSpaceMissions,
    } = get();

    if (!dilemmaEncounter) return;

    const deployment = missions[missionIndex]!;
    const mission = deployment.mission;
    const group = deployment.groups[dilemmaEncounter.groupIndex]!;

    // Check if mission requirements are still met
    const requirementsMet = checkMission(group.cards, mission);

    if (!requirementsMet) {
      // Failed - stop all remaining personnel
      get()._failMissionAttempt();
      return;
    }

    // Score the mission
    const missionScore = mission.score ?? 0;
    const newScore = score + missionScore;

    // Update mission as completed
    const updatedMissions = [...missions];
    updatedMissions[missionIndex] = {
      ...deployment,
      mission: { ...mission, completed: true },
    };

    // Track planet/space completion
    const isPlanet = mission.missionType === "Planet";
    const isSpace = mission.missionType === "Space";

    set({
      missions: updatedMissions,
      score: newScore,
      completedPlanetMissions: completedPlanetMissions + (isPlanet ? 1 : 0),
      completedSpaceMissions: completedSpaceMissions + (isSpace ? 1 : 0),
      dilemmaEncounter: null,
      dilemmaResult: null,
    });

    // Check win condition
    get()._checkWinCondition();
  },

  /**
   * Fail mission attempt - stop all remaining personnel
   */
  _failMissionAttempt: () => {
    const { missions, dilemmaEncounter } = get();

    if (!dilemmaEncounter) return;

    const { missionIndex, groupIndex } = dilemmaEncounter;

    const updatedMissions = [...missions];
    const deployment = { ...updatedMissions[missionIndex]! };

    // Stop all unstopped personnel in the group
    deployment.groups = deployment.groups.map((group, idx) => {
      if (idx !== groupIndex) return group;

      const updatedCards = group.cards.map((card) => {
        if (
          isPersonnel(card) &&
          (card as PersonnelCard).status === "Unstopped"
        ) {
          return { ...card, status: "Stopped" as const };
        }
        return card;
      });

      return { cards: updatedCards };
    });

    updatedMissions[missionIndex] = deployment;

    set({
      missions: updatedMissions,
      dilemmaEncounter: null,
      dilemmaResult: null,
    });
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
  const { phase, counters, hand, deck } = state;

  if (phase === "PlayAndDraw") {
    // Rule 6.6: Must spend all seven counters each turn.
    // If your deck is empty, you do not have to spend all seven counters.
    if (counters > 0 && deck.length > 0) return false;
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
    if (!mission) return [];
    const group = mission.groups[groupIndex];
    if (!group) return [];
    return group.cards;
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

/**
 * Get current dilemma encounter
 */
export const selectDilemmaEncounter = (state: GameStore) =>
  state.dilemmaEncounter;

/**
 * Get current dilemma result
 */
export const selectDilemmaResult = (state: GameStore) => state.dilemmaResult;
