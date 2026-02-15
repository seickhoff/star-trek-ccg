import type {
  AbilityCondition,
  Card,
  DilemmaCard,
  EventCard,
  InterruptCard,
  PersonnelCard,
  RecoverFromDiscardEffect,
  ShipCard,
  MissionDeployment,
  SerializableGameState,
  GameAction,
  Skill,
} from "@stccg/shared";
import {
  isPersonnel,
  isShip,
  isEvent,
  isInterrupt,
  checkMission,
  checkStaffed,
  calculateRangeCost,
  calculateGroupStats,
  resolveDilemma,
} from "@stccg/shared";
import type { GameEngine, ActionResult } from "./GameEngine.js";

type ActionCallback = (action: GameAction) => Promise<ActionResult>;

/** Tunable AI strategy thresholds. */
const AI_CONFIG = {
  /** Min personnel at HQ before departing (when deck is healthy). */
  minCrewToDepart: 8,
  /** Min personnel at HQ when deck is running low. */
  lowDeckMinCrew: 4,
  /** Deck size at or below which lowDeckMinCrew kicks in. */
  lowDeckThreshold: 10,
  /** Max execute-orders loop iterations per turn. */
  maxExecuteOrdersRounds: 5,
};

let requestCounter = 0;
function aiRequestId(): string {
  return `ai-${++requestCounter}`;
}

/**
 * Heuristic-based AI player for Star Trek CCG.
 * Makes decisions for each game phase using rule-based priorities.
 */
export class AIPlayer {
  /**
   * Play a full turn (all 3 phases) by generating and executing actions.
   */
  async playTurn(
    engine: GameEngine,
    _opponentEngine: GameEngine,
    executeAction: ActionCallback
  ): Promise<void> {
    // PlayAndDraw phase
    await this.playAndDrawPhase(engine, executeAction);

    // Advance to ExecuteOrders
    await executeAction({ type: "NEXT_PHASE", requestId: aiRequestId() });

    // ExecuteOrders phase
    await this.executeOrdersPhase(engine, executeAction);

    // Advance to DiscardExcess
    await executeAction({ type: "NEXT_PHASE", requestId: aiRequestId() });

    // DiscardExcess phase
    await this.discardExcessPhase(engine, executeAction);

    // End turn (advance from DiscardExcess to new turn)
    await executeAction({ type: "NEXT_PHASE", requestId: aiRequestId() });
  }

  // ===========================================================================
  // PlayAndDraw Phase: Deploy cards and draw
  // ===========================================================================

  private async playAndDrawPhase(
    engine: GameEngine,
    executeAction: ActionCallback
  ): Promise<void> {
    // Play events (e.g. Salvaging the Wreckage) when strategically beneficial
    await this.tryPlayEvents(engine, executeAction);

    let state = engine.getSerializableState();
    let counters = state.counters;

    // Build deployment plan
    const deployments = this.planDeployments(state);

    for (const { cardUniqueId, missionIndex } of deployments) {
      if (counters <= 0) break;

      const result = await executeAction({
        type: "DEPLOY",
        cardUniqueId,
        missionIndex,
        requestId: aiRequestId(),
      });

      if (result.success) {
        state = engine.getSerializableState();
        counters = state.counters;
      }
    }

    // Spend remaining counters on drawing
    state = engine.getSerializableState();
    while (state.counters > 0 && state.deck.length > 0) {
      const result = await executeAction({
        type: "DRAW",
        count: 1,
        requestId: aiRequestId(),
      });
      if (!result.success) break;
      state = engine.getSerializableState();
    }
  }

  /**
   * Plan which cards to deploy and where, prioritizing mission readiness.
   */
  private planDeployments(
    state: SerializableGameState
  ): Array<{ cardUniqueId: string; missionIndex?: number }> {
    const plan: Array<{ cardUniqueId: string; missionIndex?: number }> = [];
    let counters = state.counters;
    const deployed = new Set<string>();

    // Score each mission by readiness
    const missionScores = this.scoreMissions(state);

    // Sort hand by deployment priority
    const hand = [...state.hand];
    const scored = hand.map((card) => ({
      card,
      score: this.scoreCardForDeployment(card, state, missionScores),
    }));
    scored.sort((a, b) => b.score - a.score);

    for (const { card, score } of scored) {
      if (score <= 0) continue;
      if (deployed.has(card.uniqueId!)) continue;

      const cost = this.getCardCost(card);
      if (cost > counters) continue;

      // Determine best mission to deploy to
      const missionIndex = this.bestMissionForCard(card, state, missionScores);

      plan.push({ cardUniqueId: card.uniqueId!, missionIndex });
      deployed.add(card.uniqueId!);
      counters -= cost;
    }

    return plan;
  }

  /**
   * Score each mission by how close it is to being completable.
   * Higher score = closer to completion.
   */
  private scoreMissions(state: SerializableGameState): Map<number, number> {
    const scores = new Map<number, number>();

    for (let i = 0; i < state.missions.length; i++) {
      const deployment = state.missions[i]!;
      const mission = deployment.mission;

      // Skip headquarters and completed missions
      if (mission.missionType === "Headquarters" || mission.completed) {
        scores.set(i, -1);
        continue;
      }

      // Calculate readiness based on skills and attributes
      const allCards = deployment.groups.flatMap((g) => g.cards);
      const stats = calculateGroupStats(allCards);

      if (!mission.skills || mission.skills.length === 0) {
        scores.set(i, -1);
        continue;
      }

      // Find the best skill requirement group (most satisfied)
      let bestScore = 0;
      for (const skillReq of mission.skills) {
        let met = 0;
        let total = skillReq.length;

        const available = { ...stats.skills };
        for (const skill of skillReq) {
          if ((available[skill] ?? 0) > 0) {
            met++;
            available[skill]!--;
          }
        }

        // Check attribute
        if (mission.attribute && mission.value !== undefined) {
          total++;
          const attrVal =
            mission.attribute === "Integrity"
              ? stats.integrity
              : mission.attribute === "Cunning"
                ? stats.cunning
                : stats.strength;
          if (attrVal > mission.value) {
            met++;
          }
        }

        const groupScore = total > 0 ? met / total : 0;
        bestScore = Math.max(bestScore, groupScore);
      }

      scores.set(i, bestScore);
    }

    return scores;
  }

  /**
   * Score a card for how useful it is to deploy right now.
   */
  private scoreCardForDeployment(
    card: Card,
    state: SerializableGameState,
    missionScores: Map<number, number>
  ): number {
    if (isPersonnel(card)) {
      // Score by how many mission skill gaps this personnel fills
      let bestContribution = 0;
      for (let i = 0; i < state.missions.length; i++) {
        const score = missionScores.get(i) ?? -1;
        if (score < 0) continue; // Skip HQ/completed

        const mission = state.missions[i]!.mission;
        if (!mission.skills) continue;

        const contribution = this.personnelContribution(
          card,
          state.missions[i]!
        );
        // Weight by mission readiness — deploying to nearly-ready missions is better
        bestContribution = Math.max(
          bestContribution,
          contribution * (1 + score)
        );
      }
      return bestContribution > 0 ? bestContribution : 0.1; // Small base value
    }

    if (isShip(card)) {
      const hqIndex = state.headquartersIndex;
      const shipsInPlay = this.countShipsInPlay(state);

      if (shipsInPlay === 0) {
        // No ships yet — deploy first ship if we have personnel
        if (hqIndex >= 0) {
          const hqCards = state.missions[hqIndex]!.groups[0]?.cards ?? [];
          const personnelAtHQ = hqCards.filter(isPersonnel).length;
          return personnelAtHQ > 0 ? 3 : 0.5;
        }
        return 1;
      }

      // Already have a ship — only deploy another if first ship is out on missions
      if (!this.hasShipAwayFromHQ(state, hqIndex)) {
        return 0; // First ship still at HQ, don't deploy another yet
      }

      // First ship is out — deploy 2nd ship if HQ has waiting personnel
      if (hqIndex >= 0) {
        const hqCards = state.missions[hqIndex]!.groups[0]?.cards ?? [];
        const personnelAtHQ = hqCards.filter(isPersonnel).length;
        return personnelAtHQ >= 3 ? 2 : 0.1;
      }
      return 0.1;
    }

    if (isEvent(card)) {
      return 0; // Events handled separately via tryPlayEvents
    }

    return 0;
  }

  /**
   * How much does a personnel card contribute to a mission's requirements?
   */
  private personnelContribution(
    card: PersonnelCard,
    deployment: MissionDeployment
  ): number {
    const mission = deployment.mission;
    if (!mission.skills) return 0;

    const allCards = deployment.groups.flatMap((g) => g.cards);
    const currentStats = calculateGroupStats(allCards);

    let bestContribution = 0;

    for (const skillReq of mission.skills) {
      let gaps = 0;
      let fills = 0;

      const available = { ...currentStats.skills };
      const cardSkills = card.skills.flat();

      // Find skills not yet met
      for (const skill of skillReq) {
        if ((available[skill] ?? 0) > 0) {
          available[skill]!--;
        } else {
          gaps++;
          // Does this card fill the gap?
          if (cardSkills.includes(skill as Skill)) {
            fills++;
          }
        }
      }

      // Check attribute contribution
      if (mission.attribute && mission.value !== undefined) {
        const currentAttr =
          mission.attribute === "Integrity"
            ? currentStats.integrity
            : mission.attribute === "Cunning"
              ? currentStats.cunning
              : currentStats.strength;
        if (currentAttr <= mission.value) {
          const cardAttr =
            mission.attribute === "Integrity"
              ? card.integrity
              : mission.attribute === "Cunning"
                ? card.cunning
                : card.strength;
          if (currentAttr + cardAttr > mission.value) {
            fills += 0.5; // Partial credit for attribute help
          }
        }
      }

      bestContribution = Math.max(bestContribution, fills);
    }

    return bestContribution;
  }

  /**
   * Pick the best mission index to deploy a card to.
   */
  private bestMissionForCard(
    card: Card,
    _state: SerializableGameState,
    _missionScores: Map<number, number>
  ): number | undefined {
    if (isPersonnel(card) || isShip(card)) {
      // Deploy to headquarters (personnel and ships start there)
      return undefined; // Engine default = headquarters
    }
    return undefined;
  }

  private getCardCost(card: Card): number {
    if (isPersonnel(card) || isShip(card)) {
      return (card as PersonnelCard | ShipCard).deploy;
    }
    if (isEvent(card)) {
      return (card as { deploy?: number }).deploy ?? 0;
    }
    return 0;
  }

  // ===========================================================================
  // Event Playing: Strategic event card usage
  // ===========================================================================

  /**
   * Evaluate and play event cards from hand when strategically beneficial.
   * Currently handles recoverFromDiscard events (e.g. Salvaging the Wreckage).
   */
  private async tryPlayEvents(
    engine: GameEngine,
    executeAction: ActionCallback
  ): Promise<void> {
    const state = engine.getSerializableState();
    if (state.phase !== "PlayAndDraw") return;

    for (const card of state.hand) {
      if (!isEvent(card)) continue;
      const eventCard = card as EventCard;
      if (eventCard.deploy > state.counters) continue;

      const ability = eventCard.abilities?.find((a) => a.trigger === "event");
      if (!ability) continue;

      const recoverEffect = ability.effects.find(
        (e) => e.type === "recoverFromDiscard"
      );
      if (!recoverEffect || recoverEffect.type !== "recoverFromDiscard") {
        continue;
      }

      if (!this.shouldPlayRecoverEvent(state, recoverEffect)) continue;

      const missionScores = this.scoreMissions(state);
      const selectedCardIds = this.selectCardsToRecover(
        state,
        recoverEffect.maxCount,
        recoverEffect.cardTypes,
        missionScores
      );

      if (selectedCardIds.length === 0) continue;

      const result = await executeAction({
        type: "PLAY_EVENT",
        cardUniqueId: eventCard.uniqueId!,
        params: { selectedCardIds },
        requestId: aiRequestId(),
      });

      if (result.success) return; // One event per evaluation
    }
  }

  /**
   * Decide whether playing a recoverFromDiscard event is worth the counters.
   * Play when deck is running low or key personnel/ships are in the discard.
   */
  private shouldPlayRecoverEvent(
    state: SerializableGameState,
    effect: RecoverFromDiscardEffect
  ): boolean {
    const recoverable = state.discard.filter((c) =>
      effect.cardTypes.includes(
        c.type as RecoverFromDiscardEffect["cardTypes"][number]
      )
    );
    if (recoverable.length === 0) return false;

    // Always play if deck is critically low
    if (state.deck.length <= AI_CONFIG.lowDeckThreshold) return true;

    // Play if a needed ship is in the discard
    if (this.countShipsInPlay(state) === 0) {
      if (recoverable.some((c) => isShip(c))) return true;
    }

    // Play if discard has personnel that fill 2+ skill gaps at any mission
    const missionScores = this.scoreMissions(state);
    for (const card of recoverable) {
      if (!isPersonnel(card)) continue;
      for (let i = 0; i < state.missions.length; i++) {
        if ((missionScores.get(i) ?? -1) < 0) continue;
        const contribution = this.personnelContribution(
          card as PersonnelCard,
          state.missions[i]!
        );
        if (contribution >= 2) return true;
      }
    }

    return false;
  }

  /**
   * Select the best cards to recover from the discard pile.
   * Prioritizes personnel that fill mission skill gaps and ships when needed.
   */
  private selectCardsToRecover(
    state: SerializableGameState,
    maxCount: number,
    allowedTypes: RecoverFromDiscardEffect["cardTypes"],
    missionScores: Map<number, number>
  ): string[] {
    const recoverable = state.discard.filter((c) =>
      allowedTypes.includes(
        c.type as RecoverFromDiscardEffect["cardTypes"][number]
      )
    );
    if (recoverable.length === 0) return [];

    const scored = recoverable.map((card) => {
      let score = 0;

      if (isPersonnel(card)) {
        const p = card as PersonnelCard;
        // Score by best mission contribution
        for (let i = 0; i < state.missions.length; i++) {
          if ((missionScores.get(i) ?? -1) < 0) continue;
          const contribution = this.personnelContribution(
            p,
            state.missions[i]!
          );
          const missionReadiness = missionScores.get(i) ?? 0;
          score = Math.max(score, contribution * (1 + missionReadiness));
        }
        // Base value from skill count and attributes
        const skillCount = p.skills.flat().length;
        score += skillCount * 0.1;
      }

      if (isShip(card)) {
        score = this.countShipsInPlay(state) === 0 ? 5 : 1;
      }

      return { uniqueId: card.uniqueId!, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored
      .slice(0, maxCount)
      .filter((s) => s.score > 0)
      .map((s) => s.uniqueId);
  }

  // ===========================================================================
  // ExecuteOrders Phase: Move, beam, attempt missions
  // ===========================================================================

  private async executeOrdersPhase(
    engine: GameEngine,
    executeAction: ActionCallback
  ): Promise<void> {
    for (let round = 0; round < AI_CONFIG.maxExecuteOrdersRounds; round++) {
      let state = engine.getSerializableState();
      if (state.gameOver) return;

      // Attempt ALL completable missions
      const anyAttempted = await this.tryAttemptAllMissions(
        state,
        executeAction,
        engine
      );

      state = engine.getSerializableState();
      if (state.gameOver) return;

      // Move ships toward promising missions
      const anyMoved = await this.moveAndBeamPhase(
        state,
        executeAction,
        engine
      );

      // No progress this round → done
      if (!anyAttempted && !anyMoved) break;
    }
  }

  /**
   * Attempt ALL completable missions (not just the first one).
   * After each successful attempt + dilemma resolution, re-scans since state changed.
   */
  private async tryAttemptAllMissions(
    _state: SerializableGameState,
    executeAction: ActionCallback,
    engine: GameEngine
  ): Promise<boolean> {
    let anyAttempted = false;
    let madeProgress = true;

    while (madeProgress) {
      madeProgress = false;
      const state = engine.getSerializableState();
      if (state.gameOver) return anyAttempted;

      for (let i = 0; i < state.missions.length; i++) {
        const deployment = state.missions[i]!;
        const mission = deployment.mission;

        if (mission.missionType === "Headquarters" || mission.completed) {
          continue;
        }

        // Check each group for mission completability
        for (let g = 0; g < deployment.groups.length; g++) {
          const group = deployment.groups[g]!;
          const unstoppedPersonnel = group.cards.filter(
            (c) => isPersonnel(c) && (c as PersonnelCard).status === "Unstopped"
          );

          if (unstoppedPersonnel.length === 0) continue;

          // Check if mission can be completed
          if (checkMission(group.cards, mission)) {
            const result = await executeAction({
              type: "ATTEMPT_MISSION",
              missionIndex: i,
              groupIndex: g,
              requestId: aiRequestId(),
            });

            if (result.success) {
              await this.handleDilemmaEncounter(engine, executeAction);
              anyAttempted = true;
              madeProgress = true;
              break; // restart scan — state changed
            }
          }
        }

        if (madeProgress) break; // restart outer for-loop
      }
    }

    return anyAttempted;
  }

  /**
   * Handle all dilemmas in an active encounter.
   */
  private async handleDilemmaEncounter(
    engine: GameEngine,
    executeAction: ActionCallback
  ): Promise<void> {
    let state = engine.getSerializableState();

    while (state.dilemmaEncounter) {
      const result = state.dilemmaResult;

      if (result?.requiresSelection && result.selectablePersonnel) {
        // Choose least valuable personnel to stop
        const toStop = this.chooseLeastValuablePersonnel(
          result.selectablePersonnel,
          state
        );
        if (toStop) {
          await executeAction({
            type: "SELECT_PERSONNEL_FOR_DILEMMA",
            personnelId: toStop.uniqueId!,
            requestId: aiRequestId(),
          });
        }
      }

      // Check for playable interrupts (e.g., Adapt) before advancing
      state = engine.getSerializableState();
      if (state.dilemmaResult && !state.dilemmaResult.requiresSelection) {
        const playable = this.findPlayableInterrupts(state);
        for (const { cardUniqueId, abilityId } of playable) {
          await executeAction({
            type: "PLAY_INTERRUPT",
            cardUniqueId,
            abilityId,
            requestId: aiRequestId(),
          });
          state = engine.getSerializableState();
          // After playing an interrupt, the dilemma result may have changed
          // (e.g., Adapt prevents and overcomes it) — no need to play more
          break;
        }

        await executeAction({
          type: "ADVANCE_DILEMMA",
          requestId: aiRequestId(),
        });
      }

      state = engine.getSerializableState();
    }
  }

  /**
   * Choose the least valuable personnel from selectable ones.
   */
  private chooseLeastValuablePersonnel(
    selectable: PersonnelCard[],
    _state: SerializableGameState
  ): PersonnelCard | null {
    if (selectable.length === 0) return null;

    // Score each by how many mission skills they provide
    let leastScore = Infinity;
    let leastValuable: PersonnelCard = selectable[0]!;

    for (const personnel of selectable) {
      let totalSkills = 0;
      for (const skillGroup of personnel.skills) {
        totalSkills += skillGroup.length;
      }
      // Weight by attributes too
      const score =
        totalSkills * 10 +
        personnel.integrity +
        personnel.cunning +
        personnel.strength;

      if (score < leastScore) {
        leastScore = score;
        leastValuable = personnel;
      }
    }

    return leastValuable;
  }

  /**
   * Find playable interrupt cards in the AI's hand during a dilemma encounter.
   * Mirrors the client's selectPlayableInterrupts logic.
   */
  private findPlayableInterrupts(
    state: SerializableGameState
  ): Array<{ cardUniqueId: string; abilityId: string }> {
    if (!state.dilemmaEncounter) return [];

    const { missionIndex, groupIndex, selectedDilemmas, currentDilemmaIndex } =
      state.dilemmaEncounter;
    const deployment = state.missions[missionIndex];
    if (!deployment) return [];
    const group = deployment.groups[groupIndex];
    if (!group) return [];

    const playable: Array<{ cardUniqueId: string; abilityId: string }> = [];

    for (const card of state.hand) {
      if (!isInterrupt(card)) continue;
      const interruptCard = card as InterruptCard;
      if (!interruptCard.abilities) continue;

      for (const ability of interruptCard.abilities) {
        if (
          ability.trigger !== "interrupt" ||
          ability.interruptTiming !== "whenFacingDilemma"
        ) {
          continue;
        }

        // Check all conditions
        if (
          !this.checkInterruptConditions(
            ability.conditions,
            state,
            group,
            selectedDilemmas,
            currentDilemmaIndex
          )
        ) {
          continue;
        }

        playable.push({
          cardUniqueId: interruptCard.uniqueId!,
          abilityId: ability.id,
        });
      }
    }

    return playable;
  }

  /**
   * Check whether an interrupt's conditions are met.
   */
  private checkInterruptConditions(
    conditions: AbilityCondition[] | undefined,
    state: SerializableGameState,
    group: { cards: Card[] },
    selectedDilemmas: DilemmaCard[],
    currentDilemmaIndex: number
  ): boolean {
    if (!conditions || conditions.length === 0) return true;

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

  /**
   * Move ships and beam personnel toward missions.
   * Four strategies in priority order:
   *  1. Direct transfer: ship at completed/failed mission moves directly to next completable mission
   *  2. Deploy from HQ: ship at HQ sends crew to a completable mission
   *  3. Reinforce: ship at HQ sends extra crew to a mission with survivors
   *  4. Recall: ship stranded at a failed mission returns to HQ to pick up crew
   */
  private async moveAndBeamPhase(
    state: SerializableGameState,
    executeAction: ActionCallback,
    engine: GameEngine
  ): Promise<boolean> {
    const hqIndex = state.headquartersIndex;
    if (hqIndex < 0) return false;

    // Try moving a ship directly from a completed/failed mission to another completable one
    const transferred = await this.tryDirectTransfer(
      state,
      executeAction,
      engine,
      hqIndex
    );
    if (transferred) return true;

    // Try deploying or reinforcing from HQ
    const sentFromHQ = await this.trySendShipFromHQ(
      state,
      executeAction,
      engine,
      hqIndex
    );
    if (sentFromHQ) return true;

    // No ship at HQ or no completable target — try recalling a stranded ship
    return this.tryRecallStrandedShip(state, executeAction, engine, hqIndex);
  }

  /**
   * Move a ship directly from a completed/failed mission to another
   * completable mission, skipping the HQ round-trip to save range.
   */
  private async tryDirectTransfer(
    state: SerializableGameState,
    executeAction: ActionCallback,
    engine: GameEngine,
    hqIndex: number
  ): Promise<boolean> {
    for (let i = 0; i < state.missions.length; i++) {
      if (i === hqIndex) continue;
      const deployment = state.missions[i]!;
      const mission = deployment.mission;
      if (mission.missionType === "Headquarters") continue;

      // Only consider ships at missions where there's nothing left to do
      if (!this.shouldRecallShip(deployment, mission)) continue;

      for (let g = 1; g < deployment.groups.length; g++) {
        const group = deployment.groups[g]!;
        const ship = group.cards.find(isShip) as ShipCard | undefined;
        if (!ship || ship.rangeRemaining <= 0) continue;

        // Collect all unstopped personnel at this location (ship + planet)
        const shipPersonnel = group.cards.filter(
          (c) => isPersonnel(c) && (c as PersonnelCard).status === "Unstopped"
        );
        const planetPersonnel = (deployment.groups[0]?.cards ?? []).filter(
          (c) => isPersonnel(c) && (c as PersonnelCard).status === "Unstopped"
        );
        const allPersonnel = [...shipPersonnel, ...planetPersonnel];

        // Check staffed with combined crew (planet crew will be beamed up)
        if (!checkStaffed([...group.cards, ...planetPersonnel])) continue;

        // Find a completable mission reachable from current location
        const bestTarget = this.findCompletableMission(
          state,
          allPersonnel,
          i,
          ship
        );

        // Determine destination: completable mission or HQ fallback
        const destMission = bestTarget ? bestTarget.missionIndex : hqIndex;
        const destMissionData = state.missions[destMission]!.mission;
        const rangeCost = calculateRangeCost(mission, destMissionData);
        if (ship.rangeRemaining < rangeCost) continue;

        // Beam planet personnel to ship before moving
        if (planetPersonnel.length > 0) {
          await executeAction({
            type: "BEAM_ALL_TO_SHIP",
            missionIndex: i,
            fromGroup: 0,
            toGroup: g,
            requestId: aiRequestId(),
          });
          state = engine.getSerializableState();
        }

        // Move ship to destination
        await executeAction({
          type: "MOVE_SHIP",
          sourceMission: i,
          groupIndex: g,
          destMission,
          requestId: aiRequestId(),
        });
        state = engine.getSerializableState();

        // Beam to planet if going to a mission (not HQ)
        if (bestTarget) {
          await this.beamToDestinationPlanet(
            state,
            bestTarget.missionIndex,
            ship.uniqueId!,
            executeAction
          );
        }

        return true;
      }
    }
    return false;
  }

  /**
   * Attempt to send a ship from HQ to a completable mission.
   * Returns true if a ship was sent.
   */
  private async trySendShipFromHQ(
    state: SerializableGameState,
    executeAction: ActionCallback,
    engine: GameEngine,
    hqIndex: number
  ): Promise<boolean> {
    const hqDeployment = state.missions[hqIndex]!;

    // Collect unstopped personnel at HQ planet
    const hqPlanetPersonnel = (hqDeployment.groups[0]?.cards ?? []).filter(
      (c) => isPersonnel(c) && (c as PersonnelCard).status === "Unstopped"
    );

    // Find a ship at HQ
    let shipGroupIndex = -1;
    let ship: ShipCard | undefined;
    for (let g = 1; g < hqDeployment.groups.length; g++) {
      const s = hqDeployment.groups[g]!.cards.find(isShip) as
        | ShipCard
        | undefined;
      if (s) {
        shipGroupIndex = g;
        ship = s;
        break;
      }
    }
    if (!ship || shipGroupIndex < 0) return false;

    // Personnel already on the ship at HQ
    const shipPersonnel = hqDeployment.groups[shipGroupIndex]!.cards.filter(
      (c) => isPersonnel(c) && (c as PersonnelCard).status === "Unstopped"
    );

    const allHQPersonnel = [...hqPlanetPersonnel, ...shipPersonnel];

    // Find the best mission we can complete with HQ crew (+ destination crew).
    // findCompletableMission combines with existing crew at the destination,
    // so reinforcing a stranded crew is handled automatically.
    const bestTarget = this.findCompletableMission(
      state,
      allHQPersonnel,
      hqIndex,
      ship
    );

    if (!bestTarget) return false;

    // If no stranded crew at the destination, enforce minCrew threshold —
    // don't send a small crew alone to face dilemmas.
    const destPersonnel = state.missions[
      bestTarget.missionIndex
    ]!.groups.flatMap((g) => g.cards).filter(
      (c) => isPersonnel(c) && (c as PersonnelCard).status === "Unstopped"
    );
    if (destPersonnel.length === 0) {
      const minCrew =
        state.deck.length > AI_CONFIG.lowDeckThreshold
          ? AI_CONFIG.minCrewToDepart
          : AI_CONFIG.lowDeckMinCrew;
      if (allHQPersonnel.length < minCrew) {
        return false;
      }
    }

    // Beam planet personnel to ship
    if (hqPlanetPersonnel.length > 0) {
      await executeAction({
        type: "BEAM_ALL_TO_SHIP",
        missionIndex: hqIndex,
        fromGroup: 0,
        toGroup: shipGroupIndex,
        requestId: aiRequestId(),
      });
      state = engine.getSerializableState();
    }

    // Check ship is staffed
    const updatedGroup = state.missions[hqIndex]!.groups[shipGroupIndex]!;
    if (!checkStaffed(updatedGroup.cards)) return false;

    const updatedShip = updatedGroup.cards.find(isShip) as ShipCard | undefined;
    if (!updatedShip || updatedShip.rangeRemaining <= 0) return false;

    // Move ship to target mission
    await executeAction({
      type: "MOVE_SHIP",
      sourceMission: hqIndex,
      groupIndex: shipGroupIndex,
      destMission: bestTarget.missionIndex,
      requestId: aiRequestId(),
    });
    state = engine.getSerializableState();

    // Beam personnel to planet for planet missions
    await this.beamToDestinationPlanet(
      state,
      bestTarget.missionIndex,
      updatedShip.uniqueId!,
      executeAction
    );

    return true;
  }

  /**
   * Recall a ship from a non-HQ mission when it can't make progress.
   * Compares two options and picks the quickest:
   *  A) Recall stranded ship to HQ → pick up crew → redeploy
   *  B) Leave crew in place, let HQ send a second ship with reinforcements
   * Option B wins when HQ has (or will soon have) a ship that can reinforce.
   */
  private async tryRecallStrandedShip(
    state: SerializableGameState,
    executeAction: ActionCallback,
    engine: GameEngine,
    hqIndex: number
  ): Promise<boolean> {
    const hqMission = state.missions[hqIndex]!.mission;

    // Check if HQ has a second ship that could deliver reinforcements
    const hqHasShip = state.missions[hqIndex]!.groups.some(
      (g, idx) => idx > 0 && g.cards.some(isShip)
    );

    // Find a ship at a non-HQ mission that should be recalled
    for (let i = 0; i < state.missions.length; i++) {
      if (i === hqIndex) continue;
      const deployment = state.missions[i]!;
      const mission = deployment.mission;
      if (mission.missionType === "Headquarters") continue;

      for (let g = 1; g < deployment.groups.length; g++) {
        const group = deployment.groups[g]!;
        const ship = group.cards.find(isShip) as ShipCard | undefined;
        if (!ship || ship.rangeRemaining <= 0) continue;

        // Check staffed with combined crew (planet crew will be beamed up)
        const planetCrewForStaff = (deployment.groups[0]?.cards ?? []).filter(
          (c) => isPersonnel(c) && (c as PersonnelCard).status === "Unstopped"
        );
        if (!checkStaffed([...group.cards, ...planetCrewForStaff])) continue;

        // Decide if this ship should be recalled
        const shouldRecall = this.shouldRecallShip(deployment, mission);
        if (!shouldRecall) continue;

        // For INCOMPLETE missions: if HQ has a ship that could bring
        // reinforcements, leave this crew in place (option B is faster —
        // one trip vs round trip). trySendShipFromHQ already combines
        // ship crew with existing destination crew via findCompletableMission.
        if (!mission.completed && hqHasShip && planetCrewForStaff.length > 0) {
          continue; // skip recall — let HQ reinforce instead
        }

        // Calculate range for recall
        const rangeCost = calculateRangeCost(mission, hqMission);
        if (ship.rangeRemaining < rangeCost) continue;

        // Beam planet survivors to ship before leaving (non-space missions)
        if (mission.missionType !== "Space") {
          const planetPersonnel = deployment.groups[0]?.cards.filter(
            (c) => isPersonnel(c) && (c as PersonnelCard).status === "Unstopped"
          );
          if (planetPersonnel && planetPersonnel.length > 0) {
            await executeAction({
              type: "BEAM_ALL_TO_SHIP",
              missionIndex: i,
              fromGroup: 0,
              toGroup: g,
              requestId: aiRequestId(),
            });
            state = engine.getSerializableState();
          }
        }

        // Move ship back to HQ
        await executeAction({
          type: "MOVE_SHIP",
          sourceMission: i,
          groupIndex: g,
          destMission: hqIndex,
          requestId: aiRequestId(),
        });
        state = engine.getSerializableState();

        // Now at HQ: beam HQ planet personnel aboard
        const updatedHQ = state.missions[hqIndex]!;
        const newShipGroup = this.findShipGroup(updatedHQ, ship.uniqueId!);
        if (newShipGroup < 0) return true;

        const hqPlanet = updatedHQ.groups[0]?.cards.filter(
          (c) => isPersonnel(c) && (c as PersonnelCard).status === "Unstopped"
        );
        if (hqPlanet && hqPlanet.length > 0) {
          await executeAction({
            type: "BEAM_ALL_TO_SHIP",
            missionIndex: hqIndex,
            fromGroup: 0,
            toGroup: newShipGroup,
            requestId: aiRequestId(),
          });
          state = engine.getSerializableState();
        }

        // Try to immediately redeploy to any completable mission
        await this.tryRedeployFromHQ(
          state,
          executeAction,
          engine,
          hqIndex,
          newShipGroup
        );

        // Recalled one ship this round
        return true;
      }
    }
    return false;
  }

  /** Check whether a ship at this mission should be recalled to HQ. */
  private shouldRecallShip(
    deployment: MissionDeployment,
    mission: MissionDeployment["mission"]
  ): boolean {
    // Always recall from completed missions — nothing left to do
    if (mission.completed) return true;

    // Recall if crew can't complete this mission
    if (!mission.skills || mission.skills.length === 0) return true;

    const allCrewHere = deployment.groups.flatMap((gr) => gr.cards);
    return !checkMission(allCrewHere, mission);
  }

  /**
   * After recalling a ship to HQ and loading personnel, try to
   * immediately send it to a completable mission if range allows.
   */
  private async tryRedeployFromHQ(
    state: SerializableGameState,
    executeAction: ActionCallback,
    engine: GameEngine,
    hqIndex: number,
    shipGroupIndex: number
  ): Promise<void> {
    const shipGroup = state.missions[hqIndex]!.groups[shipGroupIndex]!;
    const ship = shipGroup.cards.find(isShip) as ShipCard | undefined;
    if (!ship || ship.rangeRemaining <= 0) return;
    if (!checkStaffed(shipGroup.cards)) return;

    // Collect all personnel on the ship
    const shipPersonnel = shipGroup.cards.filter(
      (c) => isPersonnel(c) && (c as PersonnelCard).status === "Unstopped"
    );

    // Find the best completable mission with remaining range
    const bestTarget = this.findCompletableMission(
      state,
      shipPersonnel,
      hqIndex,
      ship
    );
    if (!bestTarget) return;

    // Move ship to target
    await executeAction({
      type: "MOVE_SHIP",
      sourceMission: hqIndex,
      groupIndex: shipGroupIndex,
      destMission: bestTarget.missionIndex,
      requestId: aiRequestId(),
    });
    state = engine.getSerializableState();

    // Beam to planet if needed
    await this.beamToDestinationPlanet(
      state,
      bestTarget.missionIndex,
      ship.uniqueId!,
      executeAction
    );
  }

  /**
   * Find the best mission that crew can complete (combined with
   * any personnel already at the destination). Returns null if no
   * mission is reachable + completable — the AI should keep accumulating.
   */
  private findCompletableMission(
    state: SerializableGameState,
    shipPersonnel: Card[],
    sourceMissionIndex: number,
    ship: ShipCard
  ): { missionIndex: number; readiness: number } | null {
    const sourceMission = state.missions[sourceMissionIndex]!.mission;
    let bestTarget: { missionIndex: number; readiness: number } | null = null;

    for (let i = 0; i < state.missions.length; i++) {
      if (i === sourceMissionIndex) continue;
      const deployment = state.missions[i]!;
      const mission = deployment.mission;

      if (mission.missionType === "Headquarters" || mission.completed) continue;
      if (!mission.skills || mission.skills.length === 0) continue;

      // Check ship range
      const rangeCost = calculateRangeCost(sourceMission, mission);
      if (ship.rangeRemaining < rangeCost) continue;

      // Combine ship personnel with unstopped personnel already at this mission
      const existingPersonnel = deployment.groups
        .flatMap((g) => g.cards)
        .filter(
          (c) => isPersonnel(c) && (c as PersonnelCard).status === "Unstopped"
        );
      const combinedCrew = [...shipPersonnel, ...existingPersonnel];

      // Only move when the combined crew can fully complete the mission
      if (checkMission(combinedCrew, mission)) {
        const priority = (mission.score ?? 0) / Math.max(rangeCost, 1);
        if (!bestTarget || priority > bestTarget.readiness) {
          bestTarget = { missionIndex: i, readiness: priority };
        }
      }
    }

    return bestTarget;
  }

  /** Find the group index of a ship by uniqueId at a mission. */
  private findShipGroup(
    deployment: MissionDeployment,
    shipUniqueId: string
  ): number {
    for (let g = 1; g < deployment.groups.length; g++) {
      if (
        deployment.groups[g]!.cards.some(
          (c) => isShip(c) && c.uniqueId === shipUniqueId
        )
      ) {
        return g;
      }
    }
    return -1;
  }

  /** Count how many ships the AI currently has in play (across all missions). */
  private countShipsInPlay(state: SerializableGameState): number {
    let count = 0;
    for (const deployment of state.missions) {
      for (const group of deployment.groups) {
        count += group.cards.filter(isShip).length;
      }
    }
    return count;
  }

  /** Check if any ship is stationed away from HQ (i.e., actively on missions). */
  private hasShipAwayFromHQ(
    state: SerializableGameState,
    hqIndex: number
  ): boolean {
    for (let i = 0; i < state.missions.length; i++) {
      if (i === hqIndex) continue;
      const deployment = state.missions[i]!;
      if (deployment.mission.missionType === "Headquarters") continue;
      for (const group of deployment.groups) {
        if (group.cards.some(isShip)) return true;
      }
    }
    return false;
  }

  /** Beam all personnel from a ship to planet at a mission (if it's a planet mission). */
  private async beamToDestinationPlanet(
    state: SerializableGameState,
    missionIndex: number,
    shipUniqueId: string,
    executeAction: ActionCallback
  ): Promise<void> {
    const destDeployment = state.missions[missionIndex]!;
    if (destDeployment.mission.missionType !== "Planet") return;

    const shipGroup = this.findShipGroup(destDeployment, shipUniqueId);
    if (shipGroup < 0) return;

    await executeAction({
      type: "BEAM_ALL_TO_PLANET",
      missionIndex,
      fromGroup: shipGroup,
      requestId: aiRequestId(),
    });
  }

  // ===========================================================================
  // DiscardExcess Phase: Discard down to 7
  // ===========================================================================

  private async discardExcessPhase(
    engine: GameEngine,
    executeAction: ActionCallback
  ): Promise<void> {
    let state = engine.getSerializableState();

    while (state.hand.length > 7) {
      // Find least useful card
      const missionScores = this.scoreMissions(state);
      const worstCard = this.findLeastUsefulCard(state, missionScores);

      if (!worstCard) break;

      await executeAction({
        type: "DISCARD_CARD",
        cardUniqueId: worstCard.uniqueId!,
        requestId: aiRequestId(),
      });

      state = engine.getSerializableState();
    }
  }

  /**
   * Find the least useful card in hand for discarding.
   */
  private findLeastUsefulCard(
    state: SerializableGameState,
    missionScores: Map<number, number>
  ): Card | null {
    if (state.hand.length === 0) return null;

    let worstScore = Infinity;
    let worstCard: Card = state.hand[0]!;

    for (const card of state.hand) {
      const score = this.scoreCardForDeployment(card, state, missionScores);
      if (score < worstScore) {
        worstScore = score;
        worstCard = card;
      }
    }

    return worstCard;
  }

  // ===========================================================================
  // Dilemma Selection: Choose dilemmas against opponent
  // ===========================================================================

  /**
   * Reorder the dilemma pool to put the most effective dilemmas first.
   * Called by TwoPlayerGame when the human attempts a mission.
   * The engine's random shuffle + budget system will then pick from the front.
   *
   * Strategy: put dilemmas that are hardest for the crew to overcome first.
   */
  orderDilemmaPool(pool: DilemmaCard[], attemptingCards: Card[]): void {
    const personnel = attemptingCards.filter(
      (c): c is PersonnelCard => isPersonnel(c) && c.status === "Unstopped"
    );

    // Score each dilemma by how damaging it would be
    const scored = pool.map((dilemma) => ({
      dilemma,
      score: this.scoreDilemmaEffectiveness(dilemma, personnel),
    }));

    // Sort: highest score (most damaging) first
    scored.sort((a, b) => b.score - a.score);

    // Reorder the pool array in place
    for (let i = 0; i < scored.length; i++) {
      pool[i] = scored[i]!.dilemma;
    }
  }

  /**
   * Score how effective a dilemma would be against the given crew.
   * Higher = more damaging / harder to overcome.
   */
  private scoreDilemmaEffectiveness(
    dilemma: DilemmaCard,
    personnel: PersonnelCard[]
  ): number {
    if (personnel.length === 0) return 0;

    try {
      const result = resolveDilemma(dilemma, personnel, []);

      let score = 0;

      // Killing is very valuable
      score += result.killedPersonnel.length * 10;

      // Stopping is good
      score += result.stoppedPersonnel.length * 5;

      // Not overcome is better (stays as obstacle)
      if (!result.overcome) {
        score += 3;
      }

      // Returns to pile is good (can be used again)
      if (result.returnsToPile) {
        score += 2;
      }

      // Penalize if easily overcome (all requirements met)
      if (
        result.overcome &&
        result.killedPersonnel.length === 0 &&
        result.stoppedPersonnel.length === 0
      ) {
        score -= 5;
      }

      // Weight by cost efficiency
      if (dilemma.cost > 0) {
        score = score / dilemma.cost;
      }

      return score;
    } catch {
      return 0; // If resolution fails, skip
    }
  }
}
