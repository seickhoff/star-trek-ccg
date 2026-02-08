import { create } from "zustand";
import type {
  Ability,
  Card,
  CardType,
  DilemmaCard,
  EventCard,
  InterruptCard,
  MissionCard,
  PersonnelCard,
  ShipCard,
  Skill,
  GamePhase,
  MissionDeployment,
  DilemmaEncounter,
  GrantedSkill,
  RangeBoost,
  SkillSourceFilter,
  ActionLogEntry,
  ActionLogType,
  DilemmaResolution,
} from "@stccg/shared";
import {
  isMission,
  isDilemma,
  isPersonnel,
  isShip,
  isInterrupt,
  isEvent,
  GAME_CONSTANTS,
  cardDatabase,
  shuffle,
  resetShipRange,
  checkStaffed,
  resolveDilemma,
  resolveSelectionStop,
  checkMission,
  getEffectiveDeployCost,
} from "@stccg/shared";

/**
 * Generate unique ID for log entries
 */
let logIdCounter = 0;
function createLogEntry(
  type: ActionLogType,
  message: string,
  details?: string
): ActionLogEntry {
  return {
    id: `log-${++logIdCounter}`,
    timestamp: Date.now(),
    type,
    message,
    details,
  };
}

/**
 * Deep clone a card to avoid mutation issues
 */
function cloneCard<T extends Card>(card: T): T {
  return { ...card };
}

/**
 * Get all cards currently in play across all missions
 */
function getAllCardsInPlay(missions: MissionDeployment[]): Card[] {
  const cards: Card[] = [];
  for (const deployment of missions) {
    for (const group of deployment.groups) {
      cards.push(...group.cards);
    }
  }
  return cards;
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
 * Get available skills from personnel matching a skill source filter.
 * Used by Interlink abilities that copy skills from specific personnel.
 *
 * @param personnel - Personnel in the group to filter
 * @param source - Filter defining which personnel's skills can be copied
 * @param excludeUniqueId - Optional unique ID to exclude (the source card itself)
 * @returns Array of unique skills available from matching personnel
 */
export function getSkillsFromSource(
  personnel: PersonnelCard[],
  source: SkillSourceFilter,
  excludeUniqueId?: string
): Skill[] {
  const skills = new Set<Skill>();

  for (const person of personnel) {
    // Skip excluded card
    if (excludeUniqueId && person.uniqueId === excludeUniqueId) continue;

    // Check affiliation exclusions (e.g., "non-Borg")
    if (source.excludeAffiliations && person.affiliation) {
      const hasExcludedAffiliation = person.affiliation.some((aff) =>
        source.excludeAffiliations!.includes(aff)
      );
      if (hasExcludedAffiliation) continue;
    }

    // Check affiliation inclusions
    if (source.affiliations && person.affiliation) {
      const hasRequiredAffiliation = person.affiliation.some((aff) =>
        source.affiliations!.includes(aff)
      );
      if (!hasRequiredAffiliation) continue;
    }

    // Check species exclusions
    if (source.excludeSpecies && person.species) {
      const hasExcludedSpecies = person.species.some((sp) =>
        source.excludeSpecies!.includes(sp)
      );
      if (hasExcludedSpecies) continue;
    }

    // Check species inclusions
    if (source.species && person.species) {
      const hasRequiredSpecies = person.species.some((sp) =>
        source.species!.includes(sp)
      );
      if (!hasRequiredSpecies) continue;
    }

    // Collect skills from this personnel
    if (person.skills) {
      for (const skillGroup of person.skills) {
        for (const skill of skillGroup) {
          skills.add(skill as Skill);
        }
      }
    }
  }

  return Array.from(skills).sort();
}

/**
 * Game store state
 */
interface GameStoreState {
  // Deck zones
  deck: Card[];
  hand: Card[];
  discard: Card[];
  removedFromGame: Card[];
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
  dilemmaResult: DilemmaResolution | null;

  // Order ability tracking
  usedOrderAbilities: Set<string>; // Format: "cardUniqueId:abilityId"
  grantedSkills: GrantedSkill[]; // Active skill grants
  rangeBoosts: RangeBoost[]; // Active range boosts on ships

  // Game result
  gameOver: boolean;
  victory: boolean;

  // Headquarters mission index (for deploying cards)
  headquartersIndex: number;

  // Action log for troubleshooting
  actionLog: ActionLogEntry[];
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

  // Order abilities
  executeOrderAbility: (
    cardUniqueId: string,
    abilityId: string,
    params?: {
      skill?: Skill;
      // For beamAllToShip effect
      personnelIds?: string[];
      targetGroupIndex?: number;
    }
  ) => boolean;

  // Interlink abilities (during mission attempts)
  executeInterlinkAbility: (
    cardUniqueId: string,
    abilityId: string,
    params?: { skill?: Skill }
  ) => boolean;

  // Interrupt abilities (played from hand during specific timing windows)
  playInterrupt: (cardUniqueId: string, abilityId: string) => boolean;

  // Event cards (played from hand during PlayAndDraw phase)
  playEvent: (
    cardUniqueId: string,
    params?: {
      // For recoverFromDiscard effect: which cards to recover
      selectedCardIds?: string[];
    }
  ) => boolean;

  // Internal helpers
  _findCardInHand: (uniqueId: string) => Card | undefined;
  _removeFromHand: (uniqueId: string) => void;
  _checkWinCondition: () => void;
  _checkLoseCondition: () => void;
  _applyDilemmaResult: (result: DilemmaResolution) => void;
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
  removedFromGame: [],
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
  usedOrderAbilities: new Set(),
  grantedSkills: [],
  rangeBoosts: [],
  gameOver: false,
  victory: false,
  headquartersIndex: -1,
  actionLog: [],
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

    // Reset log counter for new game
    logIdCounter = 0;

    set({
      ...createInitialState(),
      deck: remainingDeck,
      hand: initialHand,
      dilemmaPool: shuffledDilemmas,
      missions,
      headquartersIndex,
      actionLog: [
        createLogEntry(
          "game_start",
          "Game started",
          `Deck: ${remainingDeck.length} cards, Hand: ${initialHand.length} cards, Dilemmas: ${shuffledDilemmas.length}`
        ),
      ],
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
   * - Clear used order abilities
   * - Remove expired granted skills
   */
  newTurn: () => {
    const { missions, grantedSkills, rangeBoosts, gameOver } = get();

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

    // Remove granted skills with "untilEndOfTurn" duration
    const remainingSkills = grantedSkills.filter(
      (grant) => grant.duration !== "untilEndOfTurn"
    );

    // Remove range boosts with "untilEndOfTurn" duration
    const remainingBoosts = rangeBoosts.filter(
      (boost) => boost.duration !== "untilEndOfTurn"
    );

    const newTurn = get().turn + 1;

    set((state) => ({
      turn: newTurn,
      phase: "PlayAndDraw",
      counters: GAME_CONSTANTS.STARTING_COUNTERS,
      missions: updatedMissions,
      usedOrderAbilities: new Set(), // Reset used abilities for new turn
      grantedSkills: remainingSkills,
      rangeBoosts: remainingBoosts,
      actionLog: [
        ...state.actionLog,
        createLogEntry("new_turn", `Turn ${newTurn} started`),
      ],
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
      set((state) => ({
        phase: "ExecuteOrders",
        actionLog: [
          ...state.actionLog,
          createLogEntry("phase_change", "Execute Orders phase"),
        ],
      }));
    } else if (phase === "ExecuteOrders") {
      set((state) => ({
        phase: "DiscardExcess",
        actionLog: [
          ...state.actionLog,
          createLogEntry("phase_change", "Discard Excess phase"),
        ],
      }));
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
    const cardNames = drawnCards.map((c) => c.name).join(", ");

    set((state) => ({
      deck: remainingDeck,
      hand: [...hand, ...drawnCards],
      counters: counters - actualCount,
      actionLog: [
        ...state.actionLog,
        createLogEntry(
          "draw",
          `Drew ${actualCount} card${actualCount > 1 ? "s" : ""}`,
          cardNames
        ),
      ],
    }));

    // Auto-advance to Orders if counters are 0
    if (counters - actualCount === 0) {
      set((state) => ({
        phase: "ExecuteOrders",
        actionLog: [
          ...state.actionLog,
          createLogEntry("phase_change", "Execute Orders phase"),
        ],
      }));
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

    // Calculate effective deploy cost (considering cost modifier abilities)
    // In solitaire, playerId is always "player1"
    const cardsInPlay = getAllCardsInPlay(missions);
    const deployCost = getEffectiveDeployCost(
      card as PersonnelCard | ShipCard,
      cardsInPlay,
      "player1"
    );

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
      const updatedMissions = [...missions];
      const targetDeployment = updatedMissions[targetMission]!;

      // At Space missions, personnel must be aboard a ship
      if (targetDeployment.mission.missionType === "Space") return false;

      // Personnel go to group 0 (planet surface / HQ)
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
      const missionName = missions[targetMission]?.mission.name ?? "unknown";

      set((state) => ({
        missions: updatedMissions,
        counters: counters - deployCost,
        uniquesInPlay: newUniques,
        actionLog: [
          ...state.actionLog,
          createLogEntry(
            "deploy",
            `Deployed ${card.name}`,
            `To ${missionName} (cost ${deployCost})`
          ),
        ],
      }));

      // Auto-advance if counters are 0
      if (counters - deployCost === 0) {
        set((state) => ({
          phase: "ExecuteOrders",
          actionLog: [
            ...state.actionLog,
            createLogEntry("phase_change", "Execute Orders phase"),
          ],
        }));
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
      const missionName = missions[targetMission]?.mission.name ?? "unknown";

      set((state) => ({
        missions: updatedMissions,
        counters: counters - deployCost,
        uniquesInPlay: newUniques,
        actionLog: [
          ...state.actionLog,
          createLogEntry(
            "deploy",
            `Deployed ${card.name}`,
            `Ship to ${missionName} (cost ${deployCost})`
          ),
        ],
      }));

      // Auto-advance if counters are 0
      if (counters - deployCost === 0) {
        set((state) => ({
          phase: "ExecuteOrders",
          actionLog: [
            ...state.actionLog,
            createLogEntry("phase_change", "Execute Orders phase"),
          ],
        }));
      }

      return true;
    }

    return false;
  },

  /**
   * Discard a card from hand
   */
  discardCard: (cardUniqueId: string) => {
    const { discard, phase, hand } = get();

    // Can only discard during DiscardExcess phase when hand > 7
    if (phase !== "DiscardExcess") return;
    if (hand.length <= GAME_CONSTANTS.MAX_HAND_SIZE) return;

    const card = get()._findCardInHand(cardUniqueId);
    if (!card) return;

    get()._removeFromHand(cardUniqueId);

    set((state) => ({
      discard: [...discard, card],
      actionLog: [
        ...state.actionLog,
        createLogEntry("discard", `Discarded ${card.name}`),
      ],
    }));
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

    set((state) => ({
      missions: updatedMissions,
      actionLog: [
        ...state.actionLog,
        createLogEntry(
          "move_ship",
          `Moved ${ship.name}`,
          `From ${sourceMissionCard.name} to ${destMissionCard.name} (range ${rangeCost})`
        ),
      ],
    }));
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

    // Determine beam direction for log message
    const beamDirection = toGroup === 0 ? "to planet" : "to ship";
    const targetShip =
      toGroup > 0 ? targetGroup.cards.find(isShip)?.name : null;

    set((state) => ({
      missions: updatedMissions,
      actionLog: [
        ...state.actionLog,
        createLogEntry(
          "beam",
          `Beamed ${personnel.name}`,
          targetShip ? `To ${targetShip}` : beamDirection
        ),
      ],
    }));
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
    const { missions, dilemmaPool, phase, headquartersIndex, grantedSkills } =
      get();

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
    shuffledDilemmas.sort((a, b) => b.cost - a.cost);

    // Select dilemmas that fit within the cost budget
    const selectedDilemmas: DilemmaCard[] = [];
    let totalCost = 0;
    for (const dilemma of shuffledDilemmas) {
      if (totalCost + dilemma.cost <= costBudget) {
        selectedDilemmas.push(dilemma);
        totalCost += dilemma.cost;
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

    // Get personnel names for log
    const personnelNames = unstoppedPersonnel
      .map((c) => (c as PersonnelCard).name)
      .join(", ");

    set((state) => ({
      dilemmaEncounter: encounter,
      dilemmaPool: remainingPool,
      actionLog: [
        ...state.actionLog,
        createLogEntry(
          "mission_attempt",
          `Attempting ${mission.name}`,
          `${unstoppedPersonnel.length} personnel: ${personnelNames}`
        ),
        createLogEntry(
          "dilemma_draw",
          `Drew ${selectedDilemmas.length} dilemma${selectedDilemmas.length !== 1 ? "s" : ""}`,
          `Cost budget: ${costBudget}`
        ),
      ],
    }));

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
    set((state) => ({
      dilemmaEncounter: {
        ...encounter,
        facedDilemmaIds: [firstDilemma.id],
      },
      actionLog: [
        ...state.actionLog,
        createLogEntry(
          "dilemma_draw",
          `Facing: ${firstDilemma.name}`,
          `Cost ${firstDilemma.cost} (1/${selectedDilemmas.length})`
        ),
      ],
    }));

    const result = resolveDilemma(firstDilemma, cards, grantedSkills);

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
    const { dilemmaEncounter, missions, grantedSkills } = get();

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
      // Don't recursively advance - let the UI show the duplicate message and wait for user to continue
      set((state) => ({
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
        actionLog: [
          ...state.actionLog,
          createLogEntry(
            "dilemma_result",
            `${nextDilemma.name}: Duplicate auto-overcome`,
            "Rule 6.5 - duplicate dilemmas are overcome"
          ),
        ],
      }));

      // Wait for user to click Continue (like normal dilemma resolution)
      // The next advanceDilemma() call will check the next dilemma for duplicates
      return;
    }

    // Not a duplicate - add to faced IDs and resolve normally
    set((state) => ({
      dilemmaEncounter: {
        ...dilemmaEncounter,
        currentDilemmaIndex: nextIndex,
        facedDilemmaIds: [...dilemmaEncounter.facedDilemmaIds, nextDilemma.id],
      },
      actionLog: [
        ...state.actionLog,
        createLogEntry(
          "dilemma_draw",
          `Facing: ${nextDilemma.name}`,
          `Cost ${nextDilemma.cost} (${nextIndex + 1}/${selectedDilemmas.length})`
        ),
      ],
    }));

    // Resolve next dilemma
    const result = resolveDilemma(nextDilemma, group.cards, grantedSkills);

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
   * Execute an order ability on a card
   * Order abilities can only be used during Execute Orders phase
   *
   * @param cardUniqueId - The unique ID of the card with the ability
   * @param abilityId - The ID of the ability to execute
   * @param params - Optional parameters (e.g., skill choice for skill grant)
   * @returns true if ability was successfully executed
   */
  executeOrderAbility: (
    cardUniqueId: string,
    abilityId: string,
    params?: {
      skill?: Skill;
      personnelIds?: string[];
      targetGroupIndex?: number;
    }
  ): boolean => {
    const {
      phase,
      missions,
      deck,
      discard,
      usedOrderAbilities,
      grantedSkills,
    } = get();

    // Order abilities can only be used during Execute Orders phase
    if (phase !== "ExecuteOrders") return false;

    // Find the card in play and track its location
    let sourceCard: PersonnelCard | null = null;
    let sourceMissionIndex = -1;
    let sourceGroupIndex = -1;

    for (let mIdx = 0; mIdx < missions.length; mIdx++) {
      const deployment = missions[mIdx];
      if (!deployment) continue;
      for (let gIdx = 0; gIdx < deployment.groups.length; gIdx++) {
        const group = deployment.groups[gIdx];
        if (!group) continue;
        for (const card of group.cards) {
          if (card.uniqueId === cardUniqueId && isPersonnel(card)) {
            sourceCard = card as PersonnelCard;
            sourceMissionIndex = mIdx;
            sourceGroupIndex = gIdx;
            break;
          }
        }
        if (sourceCard) break;
      }
      if (sourceCard) break;
    }

    if (!sourceCard || sourceMissionIndex === -1 || sourceGroupIndex === -1)
      return false;

    // Find the ability
    const ability = sourceCard.abilities?.find(
      (a: Ability) => a.id === abilityId && a.trigger === "order"
    );
    if (!ability) return false;

    // Check ability condition
    if (ability.condition) {
      if (ability.condition.type === "aboardShip") {
        // Personnel must be aboard a ship (group index > 0, and group contains a ship)
        if (sourceGroupIndex === 0) return false;
        const sourceGroup =
          missions[sourceMissionIndex]?.groups[sourceGroupIndex];
        if (!sourceGroup || !sourceGroup.cards.some(isShip)) return false;
      }
      // Add other condition types as needed
    }

    // Check usage limit
    const usageKey = `${cardUniqueId}:${abilityId}`;
    if (
      ability.usageLimit === "oncePerTurn" &&
      usedOrderAbilities.has(usageKey)
    ) {
      return false;
    }

    // Pre-validate effects that require params before paying costs
    for (const effect of ability.effects) {
      if (effect.type === "beamAllToShip") {
        const { personnelIds, targetGroupIndex } = params ?? {};
        if (
          !personnelIds ||
          personnelIds.length === 0 ||
          targetGroupIndex === undefined
        ) {
          return false;
        }
        // Validate target group exists and has a ship
        const missionDeployment = missions[sourceMissionIndex];
        if (!missionDeployment) return false;
        const targetGroup = missionDeployment.groups[targetGroupIndex];
        if (!targetGroup || targetGroupIndex === 0) return false;
        const hasShip = targetGroup.cards.some(isShip);
        if (!hasShip) return false;
      }
      if (
        effect.type === "skillGrant" &&
        effect.skill === null &&
        !params?.skill
      ) {
        return false;
      }
    }

    // Check and pay cost
    if (ability.cost) {
      if (ability.cost.type === "discardFromDeck") {
        if (deck.length < ability.cost.count) return false;
        // Pay cost: discard from deck
        const discardedCards = deck.slice(0, ability.cost.count);
        set({
          deck: deck.slice(ability.cost.count),
          discard: [...discard, ...discardedCards],
        });
      } else if (ability.cost.type === "sacrificeSelf") {
        // Pay cost: place this card in discard pile (remove from play)
        const updatedMissions = missions.map((deployment) => ({
          ...deployment,
          groups: deployment.groups.map((group) => ({
            cards: group.cards.filter((c) => c.uniqueId !== cardUniqueId),
          })),
        }));

        // Remove from uniques in play if unique
        const { uniquesInPlay } = get();
        const newUniquesInPlay = new Set(uniquesInPlay);
        if (sourceCard.unique) {
          newUniquesInPlay.delete(sourceCard.id);
        }

        set({
          missions: updatedMissions,
          discard: [...discard, sourceCard],
          uniquesInPlay: newUniquesInPlay,
        });
      } else if (ability.cost.type === "returnToHand") {
        // Pay cost: return this card to owner's hand (remove from play)
        const updatedMissions = missions.map((deployment) => ({
          ...deployment,
          groups: deployment.groups.map((group) => ({
            cards: group.cards.filter((c) => c.uniqueId !== cardUniqueId),
          })),
        }));

        // Remove from uniques in play if unique (can be played again)
        const { uniquesInPlay, hand } = get();
        const newUniquesInPlay = new Set(uniquesInPlay);
        if (sourceCard.unique) {
          newUniquesInPlay.delete(sourceCard.id);
        }

        set({
          missions: updatedMissions,
          hand: [...hand, sourceCard],
          uniquesInPlay: newUniquesInPlay,
        });
      }
      // Add other cost types as needed
    }

    // Apply effects
    for (const effect of ability.effects) {
      if (effect.type === "skillGrant") {
        // Skill grant effect requires a skill choice if skill is null
        const grantedSkill = effect.skill ?? params?.skill;
        if (!grantedSkill) {
          // No skill provided - cannot complete ability
          // (UI should prompt for skill before calling this)
          return false;
        }

        // Create the granted skill entry
        const newGrant: GrantedSkill = {
          skill: grantedSkill,
          target: ability.target,
          duration: ability.duration ?? "untilEndOfTurn",
          sourceCardId: cardUniqueId,
          sourceAbilityId: abilityId,
        };

        set({
          grantedSkills: [...grantedSkills, newGrant],
        });
      } else if (effect.type === "handRefresh") {
        // Hand refresh: shuffle hand, place on bottom of deck, draw equal
        const { hand, deck } = get();
        const handCount = hand.length;

        if (handCount > 0) {
          // Shuffle the hand cards
          const shuffledHand = shuffle(hand);

          // Place shuffled cards on bottom of deck
          const newDeck = [...deck, ...shuffledHand];

          // Draw equal number from top of deck
          const drawnCards = newDeck.slice(0, handCount);
          const remainingDeck = newDeck.slice(handCount);

          set({
            hand: drawnCards,
            deck: remainingDeck,
          });
        }
      } else if (effect.type === "beamAllToShip") {
        // Beam personnel at this mission aboard a ship at the same mission
        // Requires: personnelIds (which personnel to beam), targetGroupIndex (which ship)
        const { personnelIds, targetGroupIndex } = params ?? {};

        if (
          !personnelIds ||
          personnelIds.length === 0 ||
          targetGroupIndex === undefined
        ) {
          // No personnel selected or no target - cannot complete effect
          return false;
        }

        // Get fresh state after cost payment
        const { missions: currentMissions } = get();
        const missionDeployment = currentMissions[sourceMissionIndex];
        if (!missionDeployment) return false;

        // Validate target group exists and has a ship
        const targetGroup = missionDeployment.groups[targetGroupIndex];
        if (!targetGroup || targetGroupIndex === 0) {
          // Target must be a ship group (not planet group 0)
          return false;
        }

        const hasShip = targetGroup.cards.some(isShip);
        if (!hasShip) return false;

        // Collect personnel to move from all groups at this mission
        const personnelToMove: PersonnelCard[] = [];
        const updatedMissions = currentMissions.map((deployment, mIdx) => {
          if (mIdx !== sourceMissionIndex) return deployment;

          return {
            ...deployment,
            groups: deployment.groups.map((group, gIdx) => {
              if (gIdx === targetGroupIndex) {
                // This is the target group - will add personnel later
                return group;
              }

              // Filter out personnel being moved
              const remainingCards = group.cards.filter((card) => {
                if (
                  isPersonnel(card) &&
                  personnelIds.includes(card.uniqueId!)
                ) {
                  personnelToMove.push(card as PersonnelCard);
                  return false;
                }
                return true;
              });

              return { cards: remainingCards };
            }),
          };
        });

        // Add personnel to target group
        const finalMissions = updatedMissions.map((deployment, mIdx) => {
          if (mIdx !== sourceMissionIndex) return deployment;

          return {
            ...deployment,
            groups: deployment.groups.map((group, gIdx) => {
              if (gIdx === targetGroupIndex) {
                return { cards: [...group.cards, ...personnelToMove] };
              }
              return group;
            }),
          };
        });

        set({ missions: finalMissions });
      } else if (effect.type === "shipRangeModifier") {
        // Ship range modifier: boost the ship this personnel was aboard
        // This requires the personnel to have been aboard a ship (sourceGroupIndex > 0)
        // Note: by the time we get here, the card may already be removed (returnToHand cost)
        // so we use the captured source location

        if (effect.targetShip === "sourceShip" && sourceGroupIndex > 0) {
          // Get fresh state
          const { missions: currentMissions, rangeBoosts: currentBoosts } =
            get();
          const missionDeployment = currentMissions[sourceMissionIndex];
          if (!missionDeployment) continue;

          const sourceGroup = missionDeployment.groups[sourceGroupIndex];
          if (!sourceGroup) continue;

          // Find the ship in the source group
          const ship = sourceGroup.cards.find(isShip) as ShipCard | undefined;
          if (!ship || !ship.uniqueId) continue;

          // Create the range boost entry
          const newBoost: RangeBoost = {
            shipUniqueId: ship.uniqueId,
            value: effect.value,
            duration: ability.duration ?? "untilEndOfTurn",
            sourceCardId: cardUniqueId,
            sourceAbilityId: abilityId,
          };

          // Apply the range boost immediately to the ship's rangeRemaining
          const updatedMissions = currentMissions.map((deployment, mIdx) => {
            if (mIdx !== sourceMissionIndex) return deployment;

            return {
              ...deployment,
              groups: deployment.groups.map((group, gIdx) => {
                if (gIdx !== sourceGroupIndex) return group;

                return {
                  cards: group.cards.map((card) => {
                    if (card.uniqueId === ship.uniqueId && isShip(card)) {
                      const shipCard = card as ShipCard;
                      return {
                        ...shipCard,
                        rangeRemaining: shipCard.rangeRemaining + effect.value,
                      };
                    }
                    return card;
                  }),
                };
              }),
            };
          });

          set({
            missions: updatedMissions,
            rangeBoosts: [...currentBoosts, newBoost],
          });
        }
      }
      // Add other effect types as needed
    }

    // Build effect description for log
    const effectDescriptions: string[] = [];
    for (const effect of ability.effects) {
      if (effect.type === "skillGrant") {
        const skill = effect.skill ?? params?.skill;
        effectDescriptions.push(`Granted ${skill} skill`);
      } else if (effect.type === "handRefresh") {
        effectDescriptions.push("Hand refreshed");
      } else if (effect.type === "beamAllToShip") {
        effectDescriptions.push(
          `Beamed ${params?.personnelIds?.length ?? 0} personnel`
        );
      } else if (effect.type === "shipRangeModifier") {
        effectDescriptions.push(`Range +${effect.value}`);
      }
    }

    // Mark ability as used
    const newUsedAbilities = new Set(usedOrderAbilities);
    newUsedAbilities.add(usageKey);

    set((state) => ({
      usedOrderAbilities: newUsedAbilities,
      actionLog: [
        ...state.actionLog,
        createLogEntry(
          "order_ability",
          `${sourceCard.name}: Order ability`,
          effectDescriptions.join(", ") || "Activated"
        ),
      ],
    }));

    return true;
  },

  /**
   * Execute an Interlink ability on a card during a mission attempt
   * Interlink abilities can only be used while the card is attempting a mission
   *
   * @param cardUniqueId - The unique ID of the card with the ability
   * @param abilityId - The ID of the ability to execute
   * @param params - Optional parameters (skill for abilities requiring player choice)
   * @returns true if ability was successfully executed
   */
  executeInterlinkAbility: (
    cardUniqueId: string,
    abilityId: string,
    params?: { skill?: Skill }
  ): boolean => {
    const { dilemmaEncounter, missions, deck, discard } = get();

    // Interlink abilities can only be used during a mission attempt
    if (!dilemmaEncounter) return false;

    const { missionIndex, groupIndex } = dilemmaEncounter;

    // Get the attempting group
    const deployment = missions[missionIndex];
    if (!deployment) return false;

    const group = deployment.groups[groupIndex];
    if (!group) return false;

    // Find the card in the attempting group
    const sourceCard = group.cards.find(
      (c) => c.uniqueId === cardUniqueId && isPersonnel(c)
    ) as PersonnelCard | undefined;

    if (!sourceCard) return false;

    // Personnel must be unstopped to use Interlink
    if (sourceCard.status !== "Unstopped") return false;

    // Find the ability
    const ability = sourceCard.abilities?.find(
      (a: Ability) => a.id === abilityId && a.trigger === "interlink"
    );
    if (!ability) return false;

    // Apply effects (validate skill before paying cost)
    for (const effect of ability.effects) {
      if (effect.type === "skillGrant") {
        let grantedSkill: Skill | null = effect.skill;

        // If skill is null, we need a skill from params or skillSource
        if (!grantedSkill) {
          if (effect.skillSource) {
            // Skill must come from matching source personnel
            const availableSkills = getSkillsFromSource(
              group.cards.filter(isPersonnel),
              effect.skillSource,
              sourceCard.uniqueId
            );

            if (!params?.skill || !availableSkills.includes(params.skill)) {
              // Either no skill provided or skill not available from source
              return false;
            }
            grantedSkill = params.skill;
          } else {
            // No skillSource - any skill is valid (like Borg Queen)
            if (!params?.skill) return false;
            grantedSkill = params.skill;
          }
        }

        // Check and pay cost (only after validation passes)
        if (ability.cost) {
          if (ability.cost.type === "discardFromDeck") {
            if (deck.length < ability.cost.count) return false;
            // Pay cost: discard from deck
            const discardedCards = deck.slice(0, ability.cost.count);
            set({
              deck: deck.slice(ability.cost.count),
              discard: [...discard, ...discardedCards],
            });
          }
          // Add other cost types as needed
        }

        // Create the granted skill entry
        const newGrant: GrantedSkill = {
          skill: grantedSkill,
          target: ability.target,
          duration: ability.duration ?? "untilEndOfMissionAttempt",
          sourceCardId: cardUniqueId,
          sourceAbilityId: abilityId,
        };

        set((state) => ({
          grantedSkills: [...get().grantedSkills, newGrant],
          actionLog: [
            ...state.actionLog,
            createLogEntry(
              "interlink",
              `${sourceCard.name}: Interlink`,
              `Granted ${grantedSkill} skill`
            ),
          ],
        }));
      }
      // Add other effect types as needed
    }

    return true;
  },

  /**
   * Play an interrupt card from hand
   * Interrupts are played from hand in response to specific timing windows
   * and are discarded after use (no deployment cost).
   *
   * @param cardUniqueId - The unique ID of the interrupt card in hand
   * @param abilityId - The ID of the ability to execute
   * @returns true if the interrupt was successfully played
   */
  playInterrupt: (cardUniqueId: string, abilityId: string): boolean => {
    const { hand, dilemmaEncounter, missions } = get();

    // Find the interrupt card in hand
    const card = hand.find((c) => c.uniqueId === cardUniqueId);
    if (!card || !isInterrupt(card)) return false;

    const interruptCard = card as InterruptCard;
    if (!interruptCard.abilities) return false;

    // Find the ability
    const ability = interruptCard.abilities.find(
      (a: Ability) => a.id === abilityId && a.trigger === "interrupt"
    );
    if (!ability) return false;

    // Check timing window
    if (ability.interruptTiming === "whenFacingDilemma") {
      // Must be during a dilemma encounter
      if (!dilemmaEncounter) return false;
    }

    // Check all conditions
    if (ability.conditions) {
      for (const condition of ability.conditions) {
        if (condition.type === "borgPersonnelFacing") {
          // At least one Borg personnel must be in the attempting group
          if (!dilemmaEncounter) return false;

          const { missionIndex, groupIndex } = dilemmaEncounter;
          const deployment = missions[missionIndex];
          if (!deployment) return false;

          const group = deployment.groups[groupIndex];
          if (!group) return false;

          const hasBorgPersonnel = group.cards.some(
            (c) =>
              isPersonnel(c) &&
              (c as PersonnelCard).species.includes("Borg") &&
              (c as PersonnelCard).status === "Unstopped"
          );
          if (!hasBorgPersonnel) return false;
        }

        if (condition.type === "dilemmaOvercomeAtAnyMission") {
          // A copy of the current dilemma must be overcome at some mission
          if (!dilemmaEncounter) return false;

          const currentDilemma =
            dilemmaEncounter.selectedDilemmas[
              dilemmaEncounter.currentDilemmaIndex
            ];
          if (!currentDilemma) return false;

          // Check if any mission has this dilemma (by base ID) in its overcome dilemmas
          const hasOvercomeCopy = missions.some((deployment) =>
            deployment.dilemmas.some(
              (d) => d.id === currentDilemma.id && d.overcome
            )
          );
          if (!hasOvercomeCopy) return false;
        }
      }
    }

    // Apply effects
    for (const effect of ability.effects) {
      if (effect.type === "preventAndOvercomeDilemma") {
        // Prevent and overcome the current dilemma
        if (!dilemmaEncounter) return false;

        const { missionIndex, selectedDilemmas, currentDilemmaIndex } =
          dilemmaEncounter;

        const currentDilemma = selectedDilemmas[currentDilemmaIndex];
        if (!currentDilemma) return false;

        // Mark the dilemma as overcome
        const updatedDilemma = {
          ...currentDilemma,
          overcome: true,
          faceup: true,
        };

        // Add dilemma to mission's overcome dilemmas
        const updatedMissions = [...missions];
        const missionDeployment = { ...updatedMissions[missionIndex]! };
        missionDeployment.dilemmas = [
          ...missionDeployment.dilemmas,
          updatedDilemma,
        ];
        updatedMissions[missionIndex] = missionDeployment;

        // Update selected dilemmas in encounter
        const updatedSelectedDilemmas = selectedDilemmas.map((d, i) =>
          i === currentDilemmaIndex ? updatedDilemma : d
        );

        // Set a result indicating the dilemma was prevented
        set({
          missions: updatedMissions,
          dilemmaEncounter: {
            ...dilemmaEncounter,
            selectedDilemmas: updatedSelectedDilemmas,
          },
          dilemmaResult: {
            overcome: true,
            stoppedPersonnel: [],
            killedPersonnel: [],
            requiresSelection: false,
            selectablePersonnel: [],
            returnsToPile: false,
            message: `"${currentDilemma.name}" prevented and overcome by Adapt!`,
          },
        });
      }
    }

    // Move interrupt from hand to discard (interrupts are destroyed after use)
    get()._removeFromHand(cardUniqueId);

    // Build effect description for log
    let effectDesc = "";
    for (const effect of ability.effects) {
      if (effect.type === "preventAndOvercomeDilemma") {
        effectDesc = "Prevented and overcame dilemma";
      }
    }

    set((state) => ({
      discard: [...get().discard, interruptCard],
      actionLog: [
        ...state.actionLog,
        createLogEntry(
          "interrupt",
          `Played ${interruptCard.name}`,
          effectDesc || "Interrupt effect applied"
        ),
      ],
    }));

    return true;
  },

  /**
   * Play an event card from hand
   * Events are played during PlayAndDraw phase, cost counters, and then
   * are either destroyed (sent to discard) or removed from the game.
   *
   * @param cardUniqueId - The unique ID of the event card in hand
   * @param params - Parameters for effects that require player selection
   * @returns true if the event was successfully played
   */
  playEvent: (
    cardUniqueId: string,
    params?: { selectedCardIds?: string[] }
  ): boolean => {
    const { hand, counters, phase, removedFromGame } = get();

    // Events can only be played during PlayAndDraw phase
    if (phase !== "PlayAndDraw") return false;

    // Find the event card in hand
    const card = hand.find((c) => c.uniqueId === cardUniqueId);
    if (!card || !isEvent(card)) return false;

    const eventCard = card as EventCard;

    // Check if we have enough counters
    if (counters < eventCard.deploy) return false;

    // Find the event ability (trigger: "event")
    const ability = eventCard.abilities?.find(
      (a: Ability) => a.trigger === "event"
    );
    if (!ability) {
      // Event without ability - just pay cost and destroy
      get()._removeFromHand(cardUniqueId);
      const newCounters = counters - eventCard.deploy;
      set((state) => ({
        counters: newCounters,
        discard: [...get().discard, eventCard],
        actionLog: [
          ...state.actionLog,
          createLogEntry(
            "event",
            `Played ${eventCard.name}`,
            `Cost ${eventCard.deploy}`
          ),
        ],
      }));
      // Auto-advance to Orders if counters are 0
      if (newCounters === 0) {
        set((state) => ({
          phase: "ExecuteOrders",
          actionLog: [
            ...state.actionLog,
            createLogEntry("phase_change", "Execute Orders phase"),
          ],
        }));
      }
      return true;
    }

    // Process effects
    for (const effect of ability.effects) {
      if (effect.type === "recoverFromDiscard") {
        const { selectedCardIds } = params ?? {};

        // Validate selection
        if (!selectedCardIds || selectedCardIds.length === 0) {
          // No cards selected - still valid, just no recovery happens
          // But the event still resolves
        } else {
          // Validate we don't exceed maxCount
          if (selectedCardIds.length > effect.maxCount) {
            return false;
          }

          // Get current discard pile
          const currentDiscard = get().discard;

          // Find and validate selected cards
          const cardsToRecover: Card[] = [];
          for (const selectedId of selectedCardIds) {
            const cardInDiscard = currentDiscard.find(
              (c) => c.uniqueId === selectedId
            );
            if (!cardInDiscard) return false;

            // Check card type matches allowed types
            if (!effect.cardTypes.includes(cardInDiscard.type)) {
              return false;
            }

            cardsToRecover.push(cardInDiscard);
          }

          // Remove selected cards from discard
          const updatedDiscard = currentDiscard.filter(
            (c) => !selectedCardIds.includes(c.uniqueId!)
          );

          // Place cards on bottom of deck (in selected order)
          const currentDeck = get().deck;
          const updatedDeck =
            effect.destination === "deckBottom"
              ? [...currentDeck, ...cardsToRecover]
              : effect.destination === "deckTop"
                ? [...cardsToRecover, ...currentDeck]
                : currentDeck; // hand destination handled separately

          if (effect.destination === "hand") {
            const currentHand = get().hand;
            set({
              hand: [...currentHand, ...cardsToRecover],
              discard: updatedDiscard,
            });
          } else {
            set({
              deck: updatedDeck,
              discard: updatedDiscard,
            });
          }
        }
      }
      // Add other effect types as needed
    }

    // Remove event from hand and pay cost
    get()._removeFromHand(cardUniqueId);

    // Build effect description for log
    const effectDescriptions: string[] = [];
    for (const effect of ability.effects) {
      if (effect.type === "recoverFromDiscard") {
        const count = params?.selectedCardIds?.length ?? 0;
        if (count > 0) {
          effectDescriptions.push(
            `Recovered ${count} card${count > 1 ? "s" : ""} from discard`
          );
        }
      }
    }

    // Determine where the event goes after playing
    if (ability.removeFromGame) {
      // Remove from game
      set((state) => ({
        counters: get().counters - eventCard.deploy,
        removedFromGame: [...removedFromGame, eventCard],
        actionLog: [
          ...state.actionLog,
          createLogEntry(
            "event",
            `Played ${eventCard.name}`,
            effectDescriptions.join(", ") ||
              `Cost ${eventCard.deploy}, removed from game`
          ),
        ],
      }));
    } else {
      // Destroy (send to discard)
      set((state) => ({
        counters: get().counters - eventCard.deploy,
        discard: [...get().discard, eventCard],
        actionLog: [
          ...state.actionLog,
          createLogEntry(
            "event",
            `Played ${eventCard.name}`,
            effectDescriptions.join(", ") || `Cost ${eventCard.deploy}`
          ),
        ],
      }));
    }

    // Auto-advance to Orders if counters are 0
    if (get().counters === 0) {
      set((state) => ({
        phase: "ExecuteOrders",
        actionLog: [
          ...state.actionLog,
          createLogEntry("phase_change", "Execute Orders phase"),
        ],
      }));
    }

    return true;
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
      set((state) => ({
        gameOver: true,
        victory: true,
        actionLog: [
          ...state.actionLog,
          createLogEntry(
            "game_over",
            "Victory!",
            `Final score: ${score} points`
          ),
        ],
      }));
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
        set((state) => ({
          gameOver: true,
          victory: false,
          actionLog: [
            ...state.actionLog,
            createLogEntry("game_over", "Defeat", "No cards remaining to play"),
          ],
        }));
      }
    }
  },

  /**
   * Apply dilemma result to game state
   */
  _applyDilemmaResult: (result: DilemmaResolution) => {
    const { dilemmaEncounter, missions, discard, dilemmaPool, uniquesInPlay } =
      get();

    if (!dilemmaEncounter) return;

    const { missionIndex, groupIndex, selectedDilemmas, currentDilemmaIndex } =
      dilemmaEncounter;

    const currentDilemma = selectedDilemmas[currentDilemmaIndex];
    if (!currentDilemma) return;

    const updatedMissions = [...missions];
    const deployment = { ...updatedMissions[missionIndex]! };
    const originalGroup = deployment.groups[groupIndex]!;
    const newDiscard = [...discard];
    let newDilemmaPool = [...dilemmaPool];
    const newUniquesInPlay = new Set(uniquesInPlay);
    const killedUniqueIds: string[] = [];

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
            // Track killed unique cards so they can be deployed again
            if (personnel.unique) {
              killedUniqueIds.push(personnel.id);
            }
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

    // Remove killed unique cards from uniquesInPlay so they can be deployed again
    for (const id of killedUniqueIds) {
      newUniquesInPlay.delete(id);
    }

    // Update cost spent with the current dilemma's cost
    const newCostSpent = dilemmaEncounter.costSpent + currentDilemma.cost;

    // Build dilemma result log message using the resolver's message
    const resultSummary =
      result.message.replace(/\.$/, "") ||
      (result.overcome ? "Overcome" : "Not overcome");

    // Build details with remaining personnel count
    const remainingUnstopped = originalGroup.cards.filter(
      (c) =>
        isPersonnel(c) &&
        (c as PersonnelCard).status === "Unstopped" &&
        !result.stoppedPersonnel.includes(c.uniqueId!) &&
        !result.killedPersonnel.includes(c.uniqueId!)
    ).length;
    const detailParts: string[] = [];
    if (remainingUnstopped > 0) {
      detailParts.push(`${remainingUnstopped} unstopped remaining`);
    }
    if (result.returnsToPile) {
      detailParts.push("Returns to pile");
    }

    set((state) => ({
      missions: updatedMissions,
      discard: newDiscard,
      dilemmaPool: newDilemmaPool,
      uniquesInPlay: newUniquesInPlay,
      dilemmaEncounter: {
        ...dilemmaEncounter,
        selectedDilemmas: updatedSelectedDilemmas,
        costSpent: newCostSpent,
      },
      dilemmaResult: result,
      actionLog: [
        ...state.actionLog,
        createLogEntry(
          "dilemma_result",
          `${currentDilemma.name}: ${resultSummary}`,
          detailParts.length > 0 ? detailParts.join(", ") : undefined
        ),
      ],
    }));
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
      grantedSkills,
    } = get();

    if (!dilemmaEncounter) return;

    const deployment = missions[missionIndex]!;
    const mission = deployment.mission;
    const group = deployment.groups[dilemmaEncounter.groupIndex]!;

    // Check if mission requirements are still met (include granted skills)
    const requirementsMet = checkMission(group.cards, mission, grantedSkills);

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

    // Clear granted skills with "untilEndOfMissionAttempt" duration
    const remainingSkills = grantedSkills.filter(
      (grant) => grant.duration !== "untilEndOfMissionAttempt"
    );

    set((state) => ({
      missions: updatedMissions,
      score: newScore,
      completedPlanetMissions: completedPlanetMissions + (isPlanet ? 1 : 0),
      completedSpaceMissions: completedSpaceMissions + (isSpace ? 1 : 0),
      dilemmaEncounter: null,
      dilemmaResult: null,
      grantedSkills: remainingSkills,
      actionLog: [
        ...state.actionLog,
        createLogEntry(
          "mission_complete",
          `Mission completed: ${mission.name}`,
          `+${missionScore} points (total: ${newScore})`
        ),
      ],
    }));

    // Check win condition
    get()._checkWinCondition();
  },

  /**
   * Fail mission attempt - stop all remaining personnel
   */
  _failMissionAttempt: () => {
    const { missions, dilemmaEncounter, grantedSkills } = get();

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
    const missionName = deployment.mission.name;

    // Clear granted skills with "untilEndOfMissionAttempt" duration
    const remainingSkills = grantedSkills.filter(
      (grant) => grant.duration !== "untilEndOfMissionAttempt"
    );

    set((state) => ({
      missions: updatedMissions,
      dilemmaEncounter: null,
      dilemmaResult: null,
      grantedSkills: remainingSkills,
      actionLog: [
        ...state.actionLog,
        createLogEntry(
          "mission_fail",
          `Mission attempt failed: ${missionName}`,
          "All remaining personnel stopped"
        ),
      ],
    }));
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

/**
 * Get playable interrupts from hand for the current timing window
 * Returns an array of { card, ability } pairs that can be played right now
 */
export const selectPlayableInterrupts = (state: GameStore) => {
  const { hand, dilemmaEncounter, missions } = state;

  const playable: { card: InterruptCard; ability: Ability }[] = [];

  for (const card of hand) {
    if (!isInterrupt(card)) continue;

    const interruptCard = card as InterruptCard;
    if (!interruptCard.abilities) continue;

    for (const ability of interruptCard.abilities) {
      if (ability.trigger !== "interrupt") continue;

      // Check timing window
      let timingValid = false;
      if (ability.interruptTiming === "whenFacingDilemma") {
        timingValid = dilemmaEncounter !== null;
      }
      if (!timingValid) continue;

      // Check all conditions
      let allConditionsMet = true;
      if (ability.conditions) {
        for (const condition of ability.conditions) {
          if (condition.type === "borgPersonnelFacing") {
            if (!dilemmaEncounter) {
              allConditionsMet = false;
              break;
            }

            const { missionIndex, groupIndex } = dilemmaEncounter;
            const deployment = missions[missionIndex];
            if (!deployment) {
              allConditionsMet = false;
              break;
            }

            const group = deployment.groups[groupIndex];
            if (!group) {
              allConditionsMet = false;
              break;
            }

            const hasBorgPersonnel = group.cards.some(
              (c) =>
                isPersonnel(c) &&
                (c as PersonnelCard).species.includes("Borg") &&
                (c as PersonnelCard).status === "Unstopped"
            );
            if (!hasBorgPersonnel) {
              allConditionsMet = false;
              break;
            }
          }

          if (condition.type === "dilemmaOvercomeAtAnyMission") {
            if (!dilemmaEncounter) {
              allConditionsMet = false;
              break;
            }

            const currentDilemma =
              dilemmaEncounter.selectedDilemmas[
                dilemmaEncounter.currentDilemmaIndex
              ];
            if (!currentDilemma) {
              allConditionsMet = false;
              break;
            }

            const hasOvercomeCopy = missions.some((deployment) =>
              deployment.dilemmas.some(
                (d) => d.id === currentDilemma.id && d.overcome
              )
            );
            if (!hasOvercomeCopy) {
              allConditionsMet = false;
              break;
            }
          }
        }
      }

      if (allConditionsMet) {
        playable.push({ card: interruptCard, ability });
      }
    }
  }

  return playable;
};

/**
 * Get playable event cards from hand
 * Returns events that have enough counters to play during PlayAndDraw phase
 */
export const selectPlayableEvents = (state: GameStore) => {
  const { hand, counters, phase } = state;

  if (phase !== "PlayAndDraw") return [];

  return hand.filter((card) => {
    if (!isEvent(card)) return false;
    const eventCard = card as EventCard;
    return eventCard.deploy <= counters;
  }) as EventCard[];
};

/**
 * Get cards in discard pile that can be recovered by an event's recoverFromDiscard effect
 * @param allowedTypes - Array of card types that can be recovered (e.g., ["Personnel", "Ship"])
 */
export const selectRecoverableCards =
  (allowedTypes: CardType[]) => (state: GameStore) => {
    return state.discard.filter((card) => allowedTypes.includes(card.type));
  };

/**
 * Get the discard pile
 */
export const selectDiscard = (state: GameStore) => state.discard;

/**
 * Get the removed from game pile
 */
export const selectRemovedFromGame = (state: GameStore) =>
  state.removedFromGame;

/**
 * Get the action log
 */
export const selectActionLog = (state: GameStore) => state.actionLog;
