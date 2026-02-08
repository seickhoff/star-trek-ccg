import type {
  Card,
  DilemmaCard,
  MissionCard,
  PersonnelCard,
  ShipCard,
  InterruptCard,
  EventCard,
  Skill,
  GamePhase,
  MissionDeployment,
  DilemmaEncounter,
  GrantedSkill,
  RangeBoost,
  ActionLogEntry,
  ActionLogType,
  SerializableGameState,
  DilemmaResult,
  Ability,
  SkillSourceFilter,
} from "@stccg/shared";
import {
  isMission,
  isDilemma,
  isPersonnel,
  isShip,
  isInterrupt,
  isEvent,
} from "@stccg/shared";
import type { GameAction } from "@stccg/shared";
import { cardDatabase } from "../data/cardDatabase.js";
import { shuffle } from "./RNG.js";
import { resetShipRange, checkStaffed } from "../logic/shipMovement.js";
import {
  resolveDilemma,
  resolveSelectionStop,
} from "../logic/dilemmaResolver.js";
import { checkMission } from "../logic/missionChecker.js";
import { getEffectiveDeployCost } from "../logic/abilities.js";

/**
 * Result of executing an action
 */
export interface ActionResult {
  success: boolean;
  reason?: string;
}

/**
 * Internal game state (with Set for efficient lookups)
 */
interface InternalGameState {
  deck: Card[];
  hand: Card[];
  discard: Card[];
  removedFromGame: Card[];
  dilemmaPool: DilemmaCard[];
  missions: MissionDeployment[];
  uniquesInPlay: Set<string>;
  turn: number;
  phase: GamePhase;
  counters: number;
  score: number;
  completedPlanetMissions: number;
  completedSpaceMissions: number;
  dilemmaEncounter: DilemmaEncounter | null;
  dilemmaResult: DilemmaResult | null;
  usedOrderAbilities: Set<string>;
  grantedSkills: GrantedSkill[];
  rangeBoosts: RangeBoost[];
  gameOver: boolean;
  victory: boolean;
  headquartersIndex: number;
  actionLog: ActionLogEntry[];
}

const STARTING_COUNTERS = 7;
const MAX_HAND_SIZE = 7;
const WIN_SCORE = 100;

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
 * Create a unique instance of a card with a unique ID
 */
function createCardInstance<T extends Card>(card: T, index: number): T {
  return {
    ...cloneCard(card),
    uniqueId: `${card.id}-${index}`,
  };
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
 * Get available skills from personnel matching a skill source filter.
 * Used by Interlink abilities that copy skills from specific personnel.
 */
function getSkillsFromSource(
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
 * Server-side game engine
 * Handles all game logic with server-authoritative state
 */
export class GameEngine {
  private state: InternalGameState;

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): InternalGameState {
    return {
      deck: [],
      hand: [],
      discard: [],
      removedFromGame: [],
      dilemmaPool: [],
      missions: [],
      uniquesInPlay: new Set(),
      turn: 1,
      phase: "PlayAndDraw",
      counters: STARTING_COUNTERS,
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
    };
  }

  /**
   * Get internal state (for testing)
   */
  getState(): InternalGameState {
    return this.state;
  }

  /**
   * Get serializable state for WebSocket transmission
   */
  getSerializableState(): SerializableGameState {
    return {
      deck: this.state.deck,
      hand: this.state.hand,
      discard: this.state.discard,
      removedFromGame: this.state.removedFromGame,
      dilemmaPool: this.state.dilemmaPool,
      missions: this.state.missions,
      uniquesInPlay: Array.from(this.state.uniquesInPlay),
      turn: this.state.turn,
      phase: this.state.phase,
      counters: this.state.counters,
      score: this.state.score,
      completedPlanetMissions: this.state.completedPlanetMissions,
      completedSpaceMissions: this.state.completedSpaceMissions,
      dilemmaEncounter: this.state.dilemmaEncounter,
      dilemmaResult: this.state.dilemmaResult,
      usedOrderAbilities: Array.from(this.state.usedOrderAbilities),
      grantedSkills: this.state.grantedSkills,
      rangeBoosts: this.state.rangeBoosts,
      gameOver: this.state.gameOver,
      victory: this.state.victory,
      headquartersIndex: this.state.headquartersIndex,
      actionLog: this.state.actionLog,
    };
  }

  /**
   * Execute a game action
   */
  executeAction(action: GameAction): ActionResult {
    switch (action.type) {
      case "JOIN_GAME":
        // Join is handled by GameRoom, not engine
        return { success: true };

      case "SETUP_GAME":
        return this.setupGame(action.deckCardIds);

      case "RESET_GAME":
        return this.resetGame();

      case "DRAW":
        return this.draw(action.count);

      case "DEPLOY":
        return this.deploy(action.cardUniqueId, action.missionIndex);

      case "DISCARD_CARD":
        return this.discardCard(action.cardUniqueId);

      case "NEXT_PHASE":
        return this.nextPhase();

      case "MOVE_SHIP":
        return this.moveShip(
          action.sourceMission,
          action.groupIndex,
          action.destMission
        );

      case "BEAM_TO_SHIP":
        return this.beamToShip(
          action.personnelId,
          action.missionIndex,
          action.fromGroup,
          action.toGroup
        );

      case "BEAM_TO_PLANET":
        return this.beamToPlanet(
          action.personnelId,
          action.missionIndex,
          action.fromGroup
        );

      case "BEAM_ALL_TO_SHIP":
        return this.beamAllToShip(
          action.missionIndex,
          action.fromGroup,
          action.toGroup
        );

      case "BEAM_ALL_TO_PLANET":
        return this.beamAllToPlanet(action.missionIndex, action.fromGroup);

      case "ATTEMPT_MISSION":
        return this.attemptMission(action.missionIndex, action.groupIndex);

      case "SELECT_PERSONNEL_FOR_DILEMMA":
        return this.selectPersonnelForDilemma(action.personnelId);

      case "ADVANCE_DILEMMA":
        return this.advanceDilemma();

      case "CLEAR_DILEMMA_ENCOUNTER":
        return this.clearDilemmaEncounter();

      case "EXECUTE_ORDER_ABILITY":
        return this.executeOrderAbility(
          action.cardUniqueId,
          action.abilityId,
          action.params
        );

      case "EXECUTE_INTERLINK_ABILITY":
        return this.executeInterlinkAbility(
          action.cardUniqueId,
          action.abilityId,
          action.params
        );

      case "PLAY_INTERRUPT":
        return this.playInterrupt(action.cardUniqueId, action.abilityId);

      case "PLAY_EVENT":
        return this.playEvent(action.cardUniqueId, action.params);

      default:
        return { success: false, reason: "Unknown action type" };
    }
  }

  // =========================================================================
  // Setup Actions
  // =========================================================================

  private setupGame(deckCardIds: string[]): ActionResult {
    // Reset state
    this.state = this.createInitialState();

    // Look up cards from database and create instances
    const allCards: Card[] = [];
    let instanceIndex = 0;

    for (const cardId of deckCardIds) {
      const card = cardDatabase[cardId];
      if (card) {
        allCards.push(createCardInstance(card, instanceIndex++));
      }
    }

    // Separate cards by type
    const missionCards: MissionCard[] = [];
    const dilemmaCards: DilemmaCard[] = [];
    const playableCards: Card[] = [];

    for (const card of allCards) {
      if (isMission(card)) {
        missionCards.push(card);
      } else if (isDilemma(card)) {
        dilemmaCards.push(card);
      } else {
        playableCards.push(card);
      }
    }

    // Set up missions (find headquarters)
    const missions: MissionDeployment[] = missionCards.map((mission) => ({
      mission,
      groups: [{ cards: [] }], // Group 0 is planet surface
      dilemmas: [],
    }));

    // Find headquarters index
    const hqIndex = missions.findIndex(
      (m) => m.mission.missionType === "Headquarters"
    );

    // Shuffle and set up deck
    const shuffledDeck = shuffle(playableCards);
    const shuffledDilemmas = shuffle(dilemmaCards);

    // Draw initial hand
    const initialHand = shuffledDeck.slice(0, 7);
    const remainingDeck = shuffledDeck.slice(7);

    // Update state
    this.state.missions = missions;
    this.state.headquartersIndex = hqIndex;
    this.state.deck = remainingDeck;
    this.state.hand = initialHand;
    this.state.dilemmaPool = shuffledDilemmas;

    this.state.actionLog.push(
      createLogEntry(
        "game_start",
        "Game started",
        `Drew ${initialHand.length} cards`
      )
    );

    return { success: true };
  }

  private resetGame(): ActionResult {
    this.state = this.createInitialState();
    return { success: true };
  }

  // =========================================================================
  // Turn Management
  // =========================================================================

  private nextPhase(): ActionResult {
    const { phase, counters, hand, deck } = this.state;

    if (phase === "PlayAndDraw") {
      // Must spend all counters unless deck is empty
      if (counters > 0 && deck.length > 0) {
        return {
          success: false,
          reason: "Must spend all counters before advancing phase",
        };
      }
      this.state.phase = "ExecuteOrders";
      this.state.actionLog.push(
        createLogEntry("phase_change", "Execute Orders phase")
      );
    } else if (phase === "ExecuteOrders") {
      this.state.phase = "DiscardExcess";
      this.state.actionLog.push(
        createLogEntry("phase_change", "Discard Excess phase")
      );
    } else if (phase === "DiscardExcess") {
      // Must discard down to 7
      if (hand.length > MAX_HAND_SIZE) {
        return {
          success: false,
          reason: `Must discard to ${MAX_HAND_SIZE} cards before ending turn`,
        };
      }
      this.newTurn();
    }

    return { success: true };
  }

  private newTurn(): void {
    this.state.turn++;
    this.state.phase = "PlayAndDraw";
    this.state.counters = STARTING_COUNTERS;
    this.state.usedOrderAbilities.clear();

    // Clear end-of-turn effects
    this.state.grantedSkills = this.state.grantedSkills.filter(
      (g) => g.duration !== "untilEndOfTurn"
    );
    this.state.rangeBoosts = this.state.rangeBoosts.filter(
      (r) => r.duration !== "untilEndOfTurn"
    );

    // Reset all personnel to unstopped and reset ship ranges
    for (const deployment of this.state.missions) {
      for (const group of deployment.groups) {
        for (const card of group.cards) {
          if (isPersonnel(card) && card.status === "Stopped") {
            card.status = "Unstopped";
          }
          if (isShip(card)) {
            resetShipRange(card);
          }
        }
      }
    }

    // Check lose condition
    if (this.state.deck.length === 0 && this.state.hand.length === 0) {
      this.state.gameOver = true;
      this.state.victory = false;
      this.state.actionLog.push(
        createLogEntry("game_over", "Defeat - deck and hand empty")
      );
    }

    this.state.actionLog.push(
      createLogEntry("new_turn", `Turn ${this.state.turn}`)
    );
  }

  // =========================================================================
  // Card Actions
  // =========================================================================

  private draw(count: number = 1): ActionResult {
    if (this.state.phase !== "PlayAndDraw") {
      return {
        success: false,
        reason: "Can only draw during Play and Draw phase",
      };
    }

    if (this.state.counters < count) {
      return { success: false, reason: "Not enough counters" };
    }

    if (this.state.deck.length < count) {
      return { success: false, reason: "Not enough cards in deck" };
    }

    const drawn = this.state.deck.splice(0, count);
    this.state.hand.push(...drawn);
    this.state.counters -= count;

    this.state.actionLog.push(
      createLogEntry(
        "draw",
        `Drew ${count} card(s)`,
        `${this.state.deck.length} remaining`
      )
    );

    return { success: true };
  }

  private deploy(cardUniqueId: string, missionIndex?: number): ActionResult {
    if (this.state.phase !== "PlayAndDraw") {
      return {
        success: false,
        reason: "Can only deploy during Play and Draw phase",
      };
    }

    const cardIndex = this.state.hand.findIndex(
      (c) => c.uniqueId === cardUniqueId
    );
    if (cardIndex === -1) {
      return { success: false, reason: "Card not in hand" };
    }

    const card = this.state.hand[cardIndex]!;

    // Get effective cost (playerId not used in solitaire, pass empty string)
    const cost =
      isPersonnel(card) || isShip(card)
        ? getEffectiveDeployCost(
            card,
            getAllCardsInPlay(this.state.missions),
            ""
          )
        : ((card as { deploy?: number }).deploy ?? 0);

    if (this.state.counters < cost) {
      return { success: false, reason: "Not enough counters" };
    }

    // Check unique card
    if (card.unique && this.state.uniquesInPlay.has(card.id)) {
      return { success: false, reason: "Unique card already in play" };
    }

    // Determine target mission
    const targetMission = missionIndex ?? this.state.headquartersIndex;
    if (targetMission < 0 || targetMission >= this.state.missions.length) {
      return { success: false, reason: "Invalid mission index" };
    }

    const deployment = this.state.missions[targetMission]!;

    // Check affiliation for headquarters
    if (deployment.mission.missionType === "Headquarters") {
      const playRestrictions = deployment.mission.play;
      if (playRestrictions && (isPersonnel(card) || isShip(card))) {
        const hasMatchingAffiliation = card.affiliation.some((aff) =>
          playRestrictions.includes(aff)
        );
        if (!hasMatchingAffiliation) {
          return {
            success: false,
            reason: "Card affiliation doesn't match headquarters",
          };
        }
      }
    }

    // Remove from hand, add to mission
    this.state.hand.splice(cardIndex, 1);
    this.state.counters -= cost;

    if (card.unique) {
      this.state.uniquesInPlay.add(card.id);
    }

    // Add to appropriate group
    if (isShip(card)) {
      // Ships create a new group
      deployment.groups.push({ cards: [card] });
    } else if (deployment.mission.missionType === "Space") {
      // At Space missions, personnel must be aboard a ship
      return {
        success: false,
        reason: "Personnel at Space missions must be aboard a ship",
      };
    } else {
      // Personnel go to group 0 (planet surface / HQ)
      deployment.groups[0]!.cards.push(card);
    }

    this.state.actionLog.push(
      createLogEntry("deploy", `Deployed ${card.name}`, `Cost: ${cost}`)
    );

    return { success: true };
  }

  private discardCard(cardUniqueId: string): ActionResult {
    if (this.state.phase !== "DiscardExcess") {
      return {
        success: false,
        reason: "Can only discard during Discard Excess phase",
      };
    }

    if (this.state.hand.length <= MAX_HAND_SIZE) {
      return { success: false, reason: "Hand size is at limit" };
    }

    const cardIndex = this.state.hand.findIndex(
      (c) => c.uniqueId === cardUniqueId
    );
    if (cardIndex === -1) {
      return { success: false, reason: "Card not in hand" };
    }

    const card = this.state.hand.splice(cardIndex, 1)[0]!;
    this.state.discard.push(card);

    this.state.actionLog.push(
      createLogEntry("discard", `Discarded ${card.name}`)
    );

    return { success: true };
  }

  // =========================================================================
  // Movement Actions
  // =========================================================================

  private moveShip(
    sourceMission: number,
    groupIndex: number,
    destMission: number
  ): ActionResult {
    if (this.state.phase !== "ExecuteOrders") {
      return {
        success: false,
        reason: "Can only move during Execute Orders phase",
      };
    }

    if (sourceMission === destMission) {
      return { success: false, reason: "Already at destination" };
    }

    const sourceDeployment = this.state.missions[sourceMission];
    const destDeployment = this.state.missions[destMission];

    if (!sourceDeployment || !destDeployment) {
      return { success: false, reason: "Invalid mission index" };
    }

    const group = sourceDeployment.groups[groupIndex];
    if (!group || groupIndex === 0) {
      return {
        success: false,
        reason: "Invalid group or cannot move planet group",
      };
    }

    // Find ship in group
    const ship = group.cards.find(isShip);
    if (!ship) {
      return { success: false, reason: "No ship in group" };
    }

    // Check staffing
    if (!checkStaffed(group.cards)) {
      return { success: false, reason: "Ship is not properly staffed" };
    }

    // Calculate range cost
    const sourceRange = sourceDeployment.mission.range;
    const destRange = destDeployment.mission.range;
    let rangeCost = sourceRange + destRange;

    // Add quadrant penalty if different quadrants
    if (sourceDeployment.mission.quadrant !== destDeployment.mission.quadrant) {
      rangeCost += 5;
    }

    // Check range
    const rangeBoost = this.state.rangeBoosts
      .filter((r) => r.shipUniqueId === ship.uniqueId)
      .reduce((sum, r) => sum + r.value, 0);
    const effectiveRange = ship.rangeRemaining + rangeBoost;

    if (effectiveRange < rangeCost) {
      return { success: false, reason: "Not enough range" };
    }

    // Move the group
    sourceDeployment.groups.splice(groupIndex, 1);
    destDeployment.groups.push(group);

    // Deduct range
    ship.rangeRemaining -= rangeCost;

    this.state.actionLog.push(
      createLogEntry(
        "move_ship",
        `Moved ${ship.name}`,
        `To ${destDeployment.mission.name}`
      )
    );

    return { success: true };
  }

  private beamToShip(
    personnelId: string,
    missionIndex: number,
    fromGroup: number,
    toGroup: number
  ): ActionResult {
    if (this.state.phase !== "ExecuteOrders") {
      return {
        success: false,
        reason: "Can only beam during Execute Orders phase",
      };
    }

    const deployment = this.state.missions[missionIndex];
    if (!deployment) {
      return { success: false, reason: "Invalid mission index" };
    }

    const sourceGroup = deployment.groups[fromGroup];
    const targetGroup = deployment.groups[toGroup];

    if (!sourceGroup || !targetGroup) {
      return { success: false, reason: "Invalid group index" };
    }

    const personnelIndex = sourceGroup.cards.findIndex(
      (c) => c.uniqueId === personnelId
    );
    if (personnelIndex === -1) {
      return { success: false, reason: "Personnel not in source group" };
    }

    const personnel = sourceGroup.cards[personnelIndex]!;
    if (!isPersonnel(personnel)) {
      return { success: false, reason: "Can only beam personnel" };
    }

    // Move personnel
    sourceGroup.cards.splice(personnelIndex, 1);
    targetGroup.cards.push(personnel);

    this.state.actionLog.push(
      createLogEntry("beam", `Beamed ${personnel.name}`)
    );

    return { success: true };
  }

  private beamToPlanet(
    personnelId: string,
    missionIndex: number,
    fromGroup: number
  ): ActionResult {
    const deployment = this.state.missions[missionIndex];
    if (deployment?.mission.missionType === "Space") {
      return {
        success: false,
        reason: "Cannot beam to planet at a Space mission",
      };
    }
    return this.beamToShip(personnelId, missionIndex, fromGroup, 0);
  }

  private beamAllToShip(
    missionIndex: number,
    fromGroup: number,
    toGroup: number
  ): ActionResult {
    if (this.state.phase !== "ExecuteOrders") {
      return {
        success: false,
        reason: "Can only beam during Execute Orders phase",
      };
    }

    const deployment = this.state.missions[missionIndex];
    if (!deployment) {
      return { success: false, reason: "Invalid mission index" };
    }

    const sourceGroup = deployment.groups[fromGroup];
    const targetGroup = deployment.groups[toGroup];

    if (!sourceGroup || !targetGroup) {
      return { success: false, reason: "Invalid group index" };
    }

    const personnelToMove: typeof sourceGroup.cards = [];
    for (let i = sourceGroup.cards.length - 1; i >= 0; i--) {
      const card = sourceGroup.cards[i]!;
      if (isPersonnel(card) && card.status === "Unstopped") {
        personnelToMove.push(card);
        sourceGroup.cards.splice(i, 1);
      }
    }

    if (personnelToMove.length === 0) {
      return { success: false, reason: "No unstopped personnel to beam" };
    }

    targetGroup.cards.push(...personnelToMove);

    this.state.actionLog.push(
      createLogEntry("beam", `Beamed ${personnelToMove.length} personnel`)
    );

    return { success: true };
  }

  private beamAllToPlanet(
    missionIndex: number,
    fromGroup: number
  ): ActionResult {
    const deployment = this.state.missions[missionIndex];
    if (deployment?.mission.missionType === "Space") {
      return {
        success: false,
        reason: "Cannot beam to planet at a Space mission",
      };
    }
    return this.beamAllToShip(missionIndex, fromGroup, 0);
  }

  // =========================================================================
  // Mission Attempt Actions
  // =========================================================================

  private attemptMission(
    missionIndex: number,
    groupIndex: number
  ): ActionResult {
    if (this.state.phase !== "ExecuteOrders") {
      return {
        success: false,
        reason: "Can only attempt during Execute Orders phase",
      };
    }

    if (this.state.dilemmaEncounter) {
      return {
        success: false,
        reason: "Cannot attempt a mission while a dilemma encounter is active",
      };
    }

    const deployment = this.state.missions[missionIndex];
    if (!deployment) {
      return { success: false, reason: "Invalid mission index" };
    }

    if (deployment.mission.completed) {
      return { success: false, reason: "Mission already completed" };
    }

    if (deployment.mission.missionType === "Headquarters") {
      return { success: false, reason: "Cannot attempt headquarters" };
    }

    const group = deployment.groups[groupIndex];
    if (!group) {
      return { success: false, reason: "Invalid group index" };
    }

    // Get unstopped personnel
    const unstoppedPersonnel = group.cards.filter(
      (c): c is PersonnelCard => isPersonnel(c) && c.status === "Unstopped"
    );

    if (unstoppedPersonnel.length === 0) {
      return { success: false, reason: "No unstopped personnel" };
    }

    // Check affiliation match
    const missionAffiliations = deployment.mission.affiliation || [];
    if (missionAffiliations.length > 0) {
      const hasMatchingAffiliation = unstoppedPersonnel.some((p) =>
        p.affiliation.some((aff) => missionAffiliations.includes(aff))
      );
      if (!hasMatchingAffiliation) {
        return {
          success: false,
          reason: "No personnel with matching affiliation",
        };
      }
    }

    // Calculate dilemma draw count (Rule 6.1)
    // Only overcome dilemmas reduce the draw count; dilemmas merely "placed
    // on mission" (like Limited Welcome) do not.
    const overcomeCount = deployment.dilemmas.filter((d) => d.overcome).length;
    const drawCount = Math.max(0, unstoppedPersonnel.length - overcomeCount);

    // Filter applicable dilemmas by location
    const missionType = deployment.mission.missionType;
    const applicableDilemmas = this.state.dilemmaPool.filter((d) => {
      if (d.where === "Dual") return true;
      if (missionType === "Planet" && d.where === "Planet") return true;
      if (missionType === "Space" && d.where === "Space") return true;
      return false;
    });

    // Select dilemmas respecting cost budget (Rule 6.2)
    const costBudget = unstoppedPersonnel.length - overcomeCount;
    const selectedDilemmas: DilemmaCard[] = [];
    let costSpent = 0;

    // Sort by cost (descending) for solitaire auto-selection
    const sortedDilemmas = shuffle(applicableDilemmas);

    for (const dilemma of sortedDilemmas) {
      if (selectedDilemmas.length >= drawCount) break;
      if (costSpent + dilemma.deploy <= costBudget) {
        selectedDilemmas.push(dilemma);
        costSpent += dilemma.deploy;
        // Remove from pool
        const poolIndex = this.state.dilemmaPool.findIndex(
          (d) => d.uniqueId === dilemma.uniqueId
        );
        if (poolIndex !== -1) {
          this.state.dilemmaPool.splice(poolIndex, 1);
        }
      }
    }

    // Set up encounter
    this.state.dilemmaEncounter = {
      missionIndex,
      groupIndex,
      selectedDilemmas,
      currentDilemmaIndex: 0,
      costBudget,
      costSpent: 0,
      facedDilemmaIds: [],
    };

    this.state.actionLog.push(
      createLogEntry(
        "mission_attempt",
        `Attempting ${deployment.mission.name}`,
        `${selectedDilemmas.length} dilemmas`
      )
    );

    // Auto-resolve first dilemma if any
    if (selectedDilemmas.length > 0) {
      this.resolveCurrentDilemma();
    } else {
      // No dilemmas, check mission completion
      this.checkMissionCompletion();
    }

    return { success: true };
  }

  private selectPersonnelForDilemma(personnelId: string): ActionResult {
    const encounter = this.state.dilemmaEncounter;
    if (!encounter) {
      return { success: false, reason: "No active dilemma encounter" };
    }

    const result = this.state.dilemmaResult;
    if (!result?.requiresSelection) {
      return { success: false, reason: "No selection required" };
    }

    const group =
      this.state.missions[encounter.missionIndex]!.groups[
        encounter.groupIndex
      ]!;
    const dilemma = encounter.selectedDilemmas[encounter.currentDilemmaIndex]!;

    // Apply selection (resolveSelectionStop only takes dilemma and personnelId)
    const selectionResult = resolveSelectionStop(dilemma, personnelId);

    // Apply the personnel stop/kill immediately (this IS the player's choice)
    for (const card of group.cards) {
      if (isPersonnel(card)) {
        if (selectionResult.stoppedPersonnel.includes(card.uniqueId!)) {
          card.status = "Stopped";
        }
        if (selectionResult.killedPersonnel.includes(card.uniqueId!)) {
          card.status = "Killed";
        }
      }
    }

    // Update dilemma result — placement and logging deferred to advanceDilemma
    this.state.dilemmaResult = {
      dilemmaName: dilemma.name,
      overcome: selectionResult.overcome,
      stoppedPersonnel: selectionResult.stoppedPersonnel,
      killedPersonnel: selectionResult.killedPersonnel,
      returnsToPile: selectionResult.returnsToPile,
      message: selectionResult.message,
      // Clear requiresSelection so advanceDilemma knows selection is done
      requiresSelection: false,
    };

    return { success: true };
  }

  private advanceDilemma(): ActionResult {
    const encounter = this.state.dilemmaEncounter;
    if (!encounter) {
      return { success: false, reason: "No active dilemma encounter" };
    }

    const deployment = this.state.missions[encounter.missionIndex]!;
    const group = deployment.groups[encounter.groupIndex]!;

    // Apply pending effects from the current dilemma (deferred from
    // resolveCurrentDilemma so the player had an interrupt window).
    // If an interrupt (e.g. Adapt) was played, dilemmaResult will have been
    // overwritten with overcome=true and empty stopped/killed lists.
    if (this.state.dilemmaResult && !this.state.dilemmaResult.requiresSelection) {
      this.applyPendingDilemmaEffects();
    }

    // Check if all personnel stopped (after applying effects)
    const allStopped = group.cards
      .filter(isPersonnel)
      .every((p) => p.status !== "Unstopped");

    if (allStopped) {
      this.failMissionAttempt();
      return { success: true };
    }

    // Move to next dilemma
    encounter.currentDilemmaIndex++;

    if (encounter.currentDilemmaIndex >= encounter.selectedDilemmas.length) {
      // All dilemmas resolved, check mission
      this.checkMissionCompletion();
    } else {
      // Check for duplicate (Rule 6.5)
      const nextDilemma =
        encounter.selectedDilemmas[encounter.currentDilemmaIndex]!;
      if (encounter.facedDilemmaIds.includes(nextDilemma.id)) {
        // Auto-overcome duplicate
        nextDilemma.faceup = true;
        nextDilemma.overcome = true;
        deployment.dilemmas.push(nextDilemma);
        this.state.actionLog.push(
          createLogEntry(
            "dilemma_result",
            `${nextDilemma.name} auto-overcome (duplicate)`
          )
        );
        return this.advanceDilemma();
      }

      encounter.facedDilemmaIds.push(nextDilemma.id);
      this.resolveCurrentDilemma();
    }

    return { success: true };
  }

  private clearDilemmaEncounter(): ActionResult {
    this.state.dilemmaEncounter = null;
    this.state.dilemmaResult = null;
    return { success: true };
  }

  /**
   * Calculate dilemma resolution but do NOT apply effects yet.
   * Effects are deferred to advanceDilemma() so the player has an
   * interrupt window (e.g. Adapt) before personnel are stopped/killed.
   */
  private resolveCurrentDilemma(): void {
    const encounter = this.state.dilemmaEncounter;
    if (!encounter) return;

    const group =
      this.state.missions[encounter.missionIndex]!.groups[
        encounter.groupIndex
      ]!;
    const dilemma = encounter.selectedDilemmas[encounter.currentDilemmaIndex]!;

    // Track faced dilemma
    encounter.facedDilemmaIds.push(dilemma.id);
    encounter.costSpent += dilemma.deploy;

    // Resolve dilemma — calculate what WOULD happen
    const result = resolveDilemma(
      dilemma,
      group.cards.filter(isPersonnel),
      this.state.grantedSkills
    );

    // Store result for UI (pending — not yet applied)
    const selectablePersonnelCards = result.requiresSelection
      ? group.cards.filter(
          (c): c is PersonnelCard =>
            isPersonnel(c) && result.selectablePersonnel.includes(c.uniqueId!)
        )
      : undefined;

    this.state.dilemmaResult = {
      dilemmaName: dilemma.name,
      overcome: result.overcome,
      stoppedPersonnel: result.stoppedPersonnel,
      killedPersonnel: result.killedPersonnel,
      requiresSelection: result.requiresSelection,
      selectablePersonnel: selectablePersonnelCards,
      selectionPrompt: result.selectionPrompt,
      returnsToPile: result.returnsToPile,
      message: result.message,
    };

    this.state.actionLog.push(
      createLogEntry(
        "dilemma_draw",
        `Facing ${dilemma.name}`,
        `Cost: ${dilemma.deploy}`
      )
    );
  }

  /**
   * Apply the pending dilemma effects (stops, kills, placement).
   * Called from advanceDilemma() after the interrupt window closes.
   */
  private applyPendingDilemmaEffects(): void {
    const encounter = this.state.dilemmaEncounter;
    const result = this.state.dilemmaResult;
    if (!encounter || !result) return;

    const deployment = this.state.missions[encounter.missionIndex]!;
    const group = deployment.groups[encounter.groupIndex]!;
    const dilemma = encounter.selectedDilemmas[encounter.currentDilemmaIndex]!;

    // Apply stopped/killed status
    for (const card of group.cards) {
      if (isPersonnel(card)) {
        if (result.stoppedPersonnel.includes(card.uniqueId!)) {
          card.status = "Stopped";
        }
        if (result.killedPersonnel.includes(card.uniqueId!)) {
          card.status = "Killed";
        }
      }
    }

    // Place dilemma
    if (result.overcome) {
      dilemma.faceup = true;
      dilemma.overcome = true;
      deployment.dilemmas.push(dilemma);
    } else if (!result.returnsToPile) {
      // Stays on mission (e.g. Limited Welcome)
      dilemma.faceup = true;
      dilemma.overcome = false;
      deployment.dilemmas.push(dilemma);
    }

    // Log final result
    const detail = (result.message || "").replace(/\.$/, "");
    const placedOnMission = !result.overcome && !result.returnsToPile;
    const logMessage = result.overcome
      ? `${dilemma.name} overcome`
      : placedOnMission
        ? `${dilemma.name} placed on mission`
        : `${dilemma.name} not overcome`;

    this.state.actionLog.push(
      createLogEntry("dilemma_result", logMessage, detail || undefined)
    );
  }

  private checkMissionCompletion(): void {
    const encounter = this.state.dilemmaEncounter;
    if (!encounter) return;

    const deployment = this.state.missions[encounter.missionIndex]!;
    const group = deployment.groups[encounter.groupIndex]!;

    // Check if mission requirements are met
    if (
      checkMission(group.cards, deployment.mission, this.state.grantedSkills)
    ) {
      this.scoreMission(encounter.missionIndex);
    } else {
      this.failMissionAttempt();
    }
  }

  private scoreMission(missionIndex: number): void {
    const deployment = this.state.missions[missionIndex]!;
    const points = deployment.mission.score || 0;

    deployment.mission.completed = true;
    this.state.score += points;

    if (deployment.mission.missionType === "Planet") {
      this.state.completedPlanetMissions++;
    } else if (deployment.mission.missionType === "Space") {
      this.state.completedSpaceMissions++;
    }

    this.state.actionLog.push(
      createLogEntry(
        "mission_complete",
        `Completed ${deployment.mission.name}`,
        `+${points} points`
      )
    );

    // Check win condition
    if (
      this.state.score >= WIN_SCORE &&
      this.state.completedPlanetMissions >= 1 &&
      this.state.completedSpaceMissions >= 1
    ) {
      this.state.gameOver = true;
      this.state.victory = true;
      this.state.actionLog.push(
        createLogEntry(
          "game_over",
          "Victory!",
          `Final score: ${this.state.score}`
        )
      );
    }

    this.state.dilemmaEncounter = null;
    this.state.dilemmaResult = null;
  }

  private failMissionAttempt(): void {
    const encounter = this.state.dilemmaEncounter;
    if (!encounter) return;

    const deployment = this.state.missions[encounter.missionIndex]!;
    const group = deployment.groups[encounter.groupIndex]!;

    // Per rulebook: "If all the personnel you have attempting a mission are
    // killed, stopped, or otherwise removed from the mission attempt, your
    // personnel do not face any remaining dilemmas in your opponent's dilemma
    // stack. Instead, those remaining dilemmas are overcome."
    // Place remaining unfaced dilemmas beneath the mission as overcome.
    for (
      let i = encounter.currentDilemmaIndex + 1;
      i < encounter.selectedDilemmas.length;
      i++
    ) {
      const remaining = encounter.selectedDilemmas[i]!;
      remaining.faceup = true;
      remaining.overcome = true;
      deployment.dilemmas.push(remaining);
      this.state.actionLog.push(
        createLogEntry(
          "dilemma_result",
          `${remaining.name} overcome (no personnel remaining)`,
          "Placed beneath mission"
        )
      );
    }

    // Stop all remaining personnel
    for (const card of group.cards) {
      if (isPersonnel(card) && card.status === "Unstopped") {
        card.status = "Stopped";
      }
    }

    this.state.actionLog.push(
      createLogEntry("mission_fail", `Failed ${deployment.mission.name}`)
    );

    this.state.dilemmaEncounter = null;
    this.state.dilemmaResult = null;
  }

  // =========================================================================
  // Ability Actions (stubs - full implementation would mirror gameStore.ts)
  // =========================================================================

  private executeOrderAbility(
    cardUniqueId: string,
    abilityId: string,
    params?: {
      skill?: Skill;
      personnelIds?: string[];
      targetGroupIndex?: number;
    }
  ): ActionResult {
    // Order abilities can only be used during Execute Orders phase
    if (this.state.phase !== "ExecuteOrders") {
      return {
        success: false,
        reason: "Order abilities can only be used during Execute Orders phase",
      };
    }

    // Find the card in play and track its location
    let sourceCard: PersonnelCard | null = null;
    let sourceMissionIndex = -1;
    let sourceGroupIndex = -1;

    for (let mIdx = 0; mIdx < this.state.missions.length; mIdx++) {
      const deployment = this.state.missions[mIdx];
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

    if (!sourceCard || sourceMissionIndex === -1 || sourceGroupIndex === -1) {
      return { success: false, reason: "Card not found in play" };
    }

    // Find the ability
    const ability = sourceCard.abilities?.find(
      (a: Ability) => a.id === abilityId && a.trigger === "order"
    );
    if (!ability) {
      return { success: false, reason: "Ability not found" };
    }

    // Check ability condition
    if (ability.condition) {
      if (ability.condition.type === "aboardShip") {
        // Personnel must be aboard a ship (group index > 0, and group contains a ship)
        if (sourceGroupIndex === 0) {
          return { success: false, reason: "Personnel must be aboard a ship" };
        }
        const sourceGroup =
          this.state.missions[sourceMissionIndex]?.groups[sourceGroupIndex];
        if (!sourceGroup || !sourceGroup.cards.some(isShip)) {
          return { success: false, reason: "Personnel must be aboard a ship" };
        }
      }
    }

    // Check usage limit
    const usageKey = `${cardUniqueId}:${abilityId}`;
    if (
      ability.usageLimit === "oncePerTurn" &&
      this.state.usedOrderAbilities.has(usageKey)
    ) {
      return { success: false, reason: "Ability already used this turn" };
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
          return {
            success: false,
            reason: "Must select personnel and target ship",
          };
        }
        // Validate target group exists and has a ship
        const missionDeployment = this.state.missions[sourceMissionIndex];
        if (!missionDeployment)
          return { success: false, reason: "Mission not found" };
        const targetGroup = missionDeployment.groups[targetGroupIndex];
        if (!targetGroup || targetGroupIndex === 0) {
          return { success: false, reason: "Invalid target group" };
        }
        const hasShip = targetGroup.cards.some(isShip);
        if (!hasShip)
          return { success: false, reason: "Target group has no ship" };
      }
      if (
        effect.type === "skillGrant" &&
        effect.skill === null &&
        !params?.skill
      ) {
        return { success: false, reason: "Must select a skill" };
      }
    }

    // Check and pay cost
    if (ability.cost) {
      if (ability.cost.type === "discardFromDeck") {
        if (this.state.deck.length < ability.cost.count) {
          return { success: false, reason: "Not enough cards in deck" };
        }
        // Pay cost: discard from deck
        const discardedCards = this.state.deck.splice(0, ability.cost.count);
        this.state.discard.push(...discardedCards);
      } else if (ability.cost.type === "sacrificeSelf") {
        // Pay cost: place this card in discard pile (remove from play)
        for (const deployment of this.state.missions) {
          for (const group of deployment.groups) {
            const cardIndex = group.cards.findIndex(
              (c) => c.uniqueId === cardUniqueId
            );
            if (cardIndex !== -1) {
              group.cards.splice(cardIndex, 1);
              break;
            }
          }
        }
        // Remove from uniques in play if unique
        if (sourceCard.unique) {
          this.state.uniquesInPlay.delete(sourceCard.id);
        }
        this.state.discard.push(sourceCard);
      } else if (ability.cost.type === "returnToHand") {
        // Pay cost: return this card to owner's hand (remove from play)
        for (const deployment of this.state.missions) {
          for (const group of deployment.groups) {
            const cardIndex = group.cards.findIndex(
              (c) => c.uniqueId === cardUniqueId
            );
            if (cardIndex !== -1) {
              group.cards.splice(cardIndex, 1);
              break;
            }
          }
        }
        // Remove from uniques in play if unique (can be played again)
        if (sourceCard.unique) {
          this.state.uniquesInPlay.delete(sourceCard.id);
        }
        this.state.hand.push(sourceCard);
      }
    }

    // Apply effects
    const effectDescriptions: string[] = [];

    for (const effect of ability.effects) {
      if (effect.type === "skillGrant") {
        // Skill grant effect requires a skill choice if skill is null
        const grantedSkill = effect.skill ?? params?.skill;
        if (!grantedSkill) {
          return { success: false, reason: "No skill provided" };
        }

        // Create the granted skill entry
        const newGrant: GrantedSkill = {
          skill: grantedSkill,
          target: ability.target,
          duration: ability.duration ?? "untilEndOfTurn",
          sourceCardId: cardUniqueId,
          sourceAbilityId: abilityId,
        };

        this.state.grantedSkills.push(newGrant);
        effectDescriptions.push(`Granted ${grantedSkill} skill`);
      } else if (effect.type === "handRefresh") {
        // Hand refresh: shuffle hand, place on bottom of deck, draw equal
        const handCount = this.state.hand.length;

        if (handCount > 0) {
          // Shuffle the hand cards
          const shuffledHand = shuffle(this.state.hand);

          // Place shuffled cards on bottom of deck
          this.state.deck.push(...shuffledHand);

          // Draw equal number from top of deck
          const drawnCards = this.state.deck.splice(0, handCount);
          this.state.hand = drawnCards;
        }
        effectDescriptions.push("Hand refreshed");
      } else if (effect.type === "beamAllToShip") {
        // Beam personnel at this mission aboard a ship at the same mission
        const { personnelIds, targetGroupIndex } = params ?? {};

        if (
          !personnelIds ||
          personnelIds.length === 0 ||
          targetGroupIndex === undefined
        ) {
          return { success: false, reason: "Invalid beam parameters" };
        }

        const missionDeployment = this.state.missions[sourceMissionIndex];
        if (!missionDeployment)
          return { success: false, reason: "Mission not found" };

        const targetGroup = missionDeployment.groups[targetGroupIndex];
        if (!targetGroup || targetGroupIndex === 0) {
          return { success: false, reason: "Invalid target group" };
        }

        // Collect personnel to move from all groups at this mission
        const personnelToMove: PersonnelCard[] = [];

        for (let gIdx = 0; gIdx < missionDeployment.groups.length; gIdx++) {
          if (gIdx === targetGroupIndex) continue;
          const group = missionDeployment.groups[gIdx]!;

          for (let i = group.cards.length - 1; i >= 0; i--) {
            const card = group.cards[i]!;
            if (isPersonnel(card) && personnelIds.includes(card.uniqueId!)) {
              personnelToMove.push(card as PersonnelCard);
              group.cards.splice(i, 1);
            }
          }
        }

        // Add personnel to target group
        targetGroup.cards.push(...personnelToMove);
        effectDescriptions.push(`Beamed ${personnelToMove.length} personnel`);
      } else if (effect.type === "shipRangeModifier") {
        // Ship range modifier: boost the ship this personnel was aboard
        if (effect.targetShip === "sourceShip" && sourceGroupIndex > 0) {
          const missionDeployment = this.state.missions[sourceMissionIndex];
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
          ship.rangeRemaining += effect.value;
          this.state.rangeBoosts.push(newBoost);
          effectDescriptions.push(`Range +${effect.value}`);
        }
      }
    }

    // Mark ability as used
    this.state.usedOrderAbilities.add(usageKey);

    this.state.actionLog.push(
      createLogEntry(
        "order_ability",
        `${sourceCard.name}: Order ability`,
        effectDescriptions.join(", ") || "Activated"
      )
    );

    return { success: true };
  }

  private executeInterlinkAbility(
    cardUniqueId: string,
    abilityId: string,
    params?: { skill?: Skill }
  ): ActionResult {
    // Interlink abilities can only be used during a mission attempt
    if (!this.state.dilemmaEncounter) {
      return {
        success: false,
        reason: "Interlink abilities can only be used during a mission attempt",
      };
    }

    const { missionIndex, groupIndex } = this.state.dilemmaEncounter;

    // Get the attempting group
    const deployment = this.state.missions[missionIndex];
    if (!deployment) {
      return { success: false, reason: "Mission not found" };
    }

    const group = deployment.groups[groupIndex];
    if (!group) {
      return { success: false, reason: "Group not found" };
    }

    // Find the card in the attempting group
    const sourceCard = group.cards.find(
      (c) => c.uniqueId === cardUniqueId && isPersonnel(c)
    ) as PersonnelCard | undefined;

    if (!sourceCard) {
      return {
        success: false,
        reason: "Personnel not found in attempting group",
      };
    }

    // Personnel must be unstopped to use Interlink
    if (sourceCard.status !== "Unstopped") {
      return { success: false, reason: "Personnel must be unstopped" };
    }

    // Find the ability
    const ability = sourceCard.abilities?.find(
      (a: Ability) => a.id === abilityId && a.trigger === "interlink"
    );
    if (!ability) {
      return { success: false, reason: "Ability not found" };
    }

    // Apply effects (validate skill before paying cost)
    for (const effect of ability.effects) {
      if (effect.type === "skillGrant") {
        let grantedSkill: Skill | null = effect.skill;

        // If skill is null, we need a skill from params or skillSource
        if (!grantedSkill) {
          if (effect.skillSource) {
            // Skill must come from matching source personnel
            const availableSkills = getSkillsFromSource(
              group.cards.filter(isPersonnel) as PersonnelCard[],
              effect.skillSource,
              sourceCard.uniqueId
            );

            if (!params?.skill || !availableSkills.includes(params.skill)) {
              return {
                success: false,
                reason: "Skill not available from source",
              };
            }
            grantedSkill = params.skill;
          } else {
            // No skillSource - any skill is valid (like Borg Queen)
            if (!params?.skill) {
              return { success: false, reason: "Must select a skill" };
            }
            grantedSkill = params.skill;
          }
        }

        // Check and pay cost (only after validation passes)
        if (ability.cost) {
          if (ability.cost.type === "discardFromDeck") {
            if (this.state.deck.length < ability.cost.count) {
              return { success: false, reason: "Not enough cards in deck" };
            }
            // Pay cost: discard from deck
            const discardedCards = this.state.deck.splice(
              0,
              ability.cost.count
            );
            this.state.discard.push(...discardedCards);
          }
        }

        // Create the granted skill entry
        const newGrant: GrantedSkill = {
          skill: grantedSkill,
          target: ability.target,
          duration: ability.duration ?? "untilEndOfMissionAttempt",
          sourceCardId: cardUniqueId,
          sourceAbilityId: abilityId,
        };

        this.state.grantedSkills.push(newGrant);

        this.state.actionLog.push(
          createLogEntry(
            "interlink",
            `${sourceCard.name}: Interlink`,
            `Granted ${grantedSkill} skill`
          )
        );
      }
    }

    return { success: true };
  }

  private playInterrupt(cardUniqueId: string, abilityId: string): ActionResult {
    // Find the interrupt card in hand
    const cardIndex = this.state.hand.findIndex(
      (c) => c.uniqueId === cardUniqueId
    );
    if (cardIndex === -1) {
      return { success: false, reason: "Card not in hand" };
    }

    const card = this.state.hand[cardIndex]!;
    if (!isInterrupt(card)) {
      return { success: false, reason: "Card is not an interrupt" };
    }

    const interruptCard = card as InterruptCard;
    if (!interruptCard.abilities) {
      return { success: false, reason: "Interrupt has no abilities" };
    }

    // Find the ability
    const ability = interruptCard.abilities.find(
      (a: Ability) => a.id === abilityId && a.trigger === "interrupt"
    );
    if (!ability) {
      return { success: false, reason: "Ability not found" };
    }

    // Check timing window
    if (ability.interruptTiming === "whenFacingDilemma") {
      // Must be during a dilemma encounter
      if (!this.state.dilemmaEncounter) {
        return { success: false, reason: "Must be facing a dilemma" };
      }
    }

    // Check all conditions
    if (ability.conditions) {
      for (const condition of ability.conditions) {
        if (condition.type === "borgPersonnelFacing") {
          // At least one Borg personnel must be in the attempting group
          if (!this.state.dilemmaEncounter) {
            return { success: false, reason: "Not in a dilemma encounter" };
          }

          const { missionIndex, groupIndex } = this.state.dilemmaEncounter;
          const deployment = this.state.missions[missionIndex];
          if (!deployment) {
            return { success: false, reason: "Mission not found" };
          }

          const group = deployment.groups[groupIndex];
          if (!group) {
            return { success: false, reason: "Group not found" };
          }

          const hasBorgPersonnel = group.cards.some(
            (c) =>
              isPersonnel(c) &&
              (c as PersonnelCard).species.includes("Borg") &&
              (c as PersonnelCard).status === "Unstopped"
          );
          if (!hasBorgPersonnel) {
            return {
              success: false,
              reason: "No unstopped Borg personnel facing dilemma",
            };
          }
        }

        if (condition.type === "dilemmaOvercomeAtAnyMission") {
          // A copy of the current dilemma must be overcome at some mission
          if (!this.state.dilemmaEncounter) {
            return { success: false, reason: "Not in a dilemma encounter" };
          }

          const currentDilemma =
            this.state.dilemmaEncounter.selectedDilemmas[
              this.state.dilemmaEncounter.currentDilemmaIndex
            ];
          if (!currentDilemma) {
            return { success: false, reason: "No current dilemma" };
          }

          // Check if any mission has this dilemma (by base ID) in its overcome dilemmas
          const hasOvercomeCopy = this.state.missions.some((deployment) =>
            deployment.dilemmas.some(
              (d) => d.id === currentDilemma.id && d.overcome
            )
          );
          if (!hasOvercomeCopy) {
            return {
              success: false,
              reason: "No overcome copy of this dilemma",
            };
          }
        }
      }
    }

    // Apply effects
    let effectDesc = "";

    for (const effect of ability.effects) {
      if (effect.type === "preventAndOvercomeDilemma") {
        // Prevent and overcome the current dilemma
        if (!this.state.dilemmaEncounter) {
          return { success: false, reason: "Not in a dilemma encounter" };
        }

        const { selectedDilemmas, currentDilemmaIndex } =
          this.state.dilemmaEncounter;

        const currentDilemma = selectedDilemmas[currentDilemmaIndex];
        if (!currentDilemma) {
          return { success: false, reason: "No current dilemma" };
        }

        // Override the pending dilemma result: prevent all effects and
        // mark as overcome. applyPendingDilemmaEffects() in advanceDilemma
        // will handle placement based on this result.
        this.state.dilemmaResult = {
          dilemmaName: currentDilemma.name,
          overcome: true,
          stoppedPersonnel: [],
          killedPersonnel: [],
          requiresSelection: false,
          selectablePersonnel: [],
          returnsToPile: false,
          message: `Prevented and overcome by ${interruptCard.name}`,
        };

        effectDesc = `"${currentDilemma.name}" prevented and overcome by ${interruptCard.name}`;
      }
    }

    // Move interrupt from hand to discard (interrupts are destroyed after use)
    this.state.hand.splice(cardIndex, 1);
    this.state.discard.push(interruptCard);

    this.state.actionLog.push(
      createLogEntry(
        "interrupt",
        `Played ${interruptCard.name}`,
        effectDesc || "Interrupt effect applied"
      )
    );

    return { success: true };
  }

  private playEvent(
    cardUniqueId: string,
    params?: { selectedCardIds?: string[] }
  ): ActionResult {
    // Events can only be played during PlayAndDraw phase
    if (this.state.phase !== "PlayAndDraw") {
      return {
        success: false,
        reason: "Events can only be played during Play and Draw phase",
      };
    }

    // Find the event card in hand
    const cardIndex = this.state.hand.findIndex(
      (c) => c.uniqueId === cardUniqueId
    );
    if (cardIndex === -1) {
      return { success: false, reason: "Card not in hand" };
    }

    const card = this.state.hand[cardIndex]!;
    if (!isEvent(card)) {
      return { success: false, reason: "Card is not an event" };
    }

    const eventCard = card as EventCard;

    // Check if we have enough counters
    if (this.state.counters < eventCard.deploy) {
      return { success: false, reason: "Not enough counters" };
    }

    // Find the event ability (trigger: "event")
    const ability = eventCard.abilities?.find((a) => a.trigger === "event");

    // Remove event from hand
    this.state.hand.splice(cardIndex, 1);

    if (!ability) {
      // Event without ability - just pay cost and destroy
      this.state.counters -= eventCard.deploy;
      this.state.discard.push(eventCard);
      this.state.actionLog.push(
        createLogEntry(
          "event",
          `Played ${eventCard.name}`,
          `Cost ${eventCard.deploy}`
        )
      );
      return { success: true };
    }

    // Process effects
    const effectDescriptions: string[] = [];

    for (const effect of ability.effects) {
      if (effect.type === "recoverFromDiscard") {
        const { selectedCardIds } = params ?? {};

        if (selectedCardIds && selectedCardIds.length > 0) {
          // Validate we don't exceed maxCount
          if (selectedCardIds.length > effect.maxCount) {
            // Restore hand state
            this.state.hand.push(eventCard);
            return {
              success: false,
              reason: `Cannot select more than ${effect.maxCount} cards`,
            };
          }

          // Find and validate selected cards
          const cardsToRecover: Card[] = [];
          for (const selectedId of selectedCardIds) {
            const cardInDiscard = this.state.discard.find(
              (c) => c.uniqueId === selectedId
            );
            if (!cardInDiscard) {
              this.state.hand.push(eventCard);
              return { success: false, reason: "Selected card not in discard" };
            }

            // Check card type matches allowed types
            if (!effect.cardTypes.includes(cardInDiscard.type)) {
              this.state.hand.push(eventCard);
              return { success: false, reason: "Card type not allowed" };
            }

            cardsToRecover.push(cardInDiscard);
          }

          // Remove selected cards from discard
          this.state.discard = this.state.discard.filter(
            (c) => !selectedCardIds.includes(c.uniqueId!)
          );

          // Place cards based on destination
          if (effect.destination === "deckBottom") {
            this.state.deck.push(...cardsToRecover);
          } else if (effect.destination === "deckTop") {
            this.state.deck.unshift(...cardsToRecover);
          } else if (effect.destination === "hand") {
            this.state.hand.push(...cardsToRecover);
          }

          effectDescriptions.push(
            `Recovered ${cardsToRecover.length} card${cardsToRecover.length > 1 ? "s" : ""} from discard`
          );
        }
      }
    }

    // Pay cost
    this.state.counters -= eventCard.deploy;

    // Determine where the event goes after playing
    if (ability.removeFromGame) {
      // Remove from game
      this.state.removedFromGame.push(eventCard);
      this.state.actionLog.push(
        createLogEntry(
          "event",
          `Played ${eventCard.name}`,
          effectDescriptions.join(", ") ||
            `Cost ${eventCard.deploy}, removed from game`
        )
      );
    } else {
      // Destroy (send to discard)
      this.state.discard.push(eventCard);
      this.state.actionLog.push(
        createLogEntry(
          "event",
          `Played ${eventCard.name}`,
          effectDescriptions.join(", ") || `Cost ${eventCard.deploy}`
        )
      );
    }

    return { success: true };
  }
}
