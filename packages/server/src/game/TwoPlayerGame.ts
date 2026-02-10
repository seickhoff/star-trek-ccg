import type {
  GameAction,
  ActionLogEntry,
  TwoPlayerGameState,
  OpponentPublicState,
  DilemmaCard,
  GameEvent,
} from "@stccg/shared";
import { GameEngine, type ActionResult } from "./GameEngine.js";
import { AIPlayer } from "./AIPlayer.js";

/**
 * Orchestrates a two-player game using two independent GameEngine instances.
 * Player 0 = human, Player 1 = AI.
 * Cross-player interaction: dilemma pools are swapped during mission attempts.
 */
export class TwoPlayerGame {
  readonly engines: [GameEngine, GameEngine];
  private _activePlayer: 0 | 1 = 0;
  private aiPlayer: AIPlayer;
  private _winner: 1 | 2 | null = null;
  private lastLogIndices: [number, number] = [0, 0];
  private _isAITurnInProgress = false;

  // Dilemma selection pause state
  private _dilemmaSelectionResolver:
    | ((selectedUniqueIds: string[]) => void)
    | null = null;
  private _pendingDilemmaSelection: {
    eligibleDilemmas: DilemmaCard[];
    reEncounterDilemmas: DilemmaCard[];
    drawCount: number;
    costBudget: number;
  } | null = null;
  private _dilemmaSelectionTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Callback fired after each AI action so the GameRoom can broadcast state.
   * Set by the GameRoom after construction.
   */
  onStateChange: ((isAIAction: boolean) => void) | null = null;

  /**
   * Callback to send an event directly to the human player.
   * Set by the GameRoom after construction.
   */
  onSendToHuman: ((event: GameEvent) => void) | null = null;

  constructor() {
    this.engines = [new GameEngine(), new GameEngine()];
    this.aiPlayer = new AIPlayer();
  }

  get activePlayer(): 0 | 1 {
    return this._activePlayer;
  }

  /** Active player as 1-indexed (for protocol) */
  get activePlayerNumber(): 1 | 2 {
    return (this._activePlayer + 1) as 1 | 2;
  }

  get winner(): 1 | 2 | null {
    return this._winner;
  }

  get isAITurnInProgress(): boolean {
    return this._isAITurnInProgress;
  }

  /**
   * Set up both players with the same deck. Human goes first.
   */
  setupBothPlayers(deckCardIds: string[]): void {
    this.engines[0].executeAction({
      type: "SETUP_GAME",
      deckCardIds,
      requestId: "setup-p1",
    });
    this.engines[1].executeAction({
      type: "SETUP_GAME",
      deckCardIds,
      requestId: "setup-p2",
    });
    this._activePlayer = 0;
    this._winner = null;
    this.lastLogIndices = [0, 0];
  }

  /**
   * Handle an action from a player.
   * Returns the result and triggers AI turn if needed.
   */
  handleAction(playerIndex: 0 | 1, action: GameAction): ActionResult {
    // Human can submit dilemma selections during AI's turn
    if (action.type === "SELECT_DILEMMAS" && playerIndex === 0) {
      return this.handleDilemmaSelection(action.selectedDilemmaUniqueIds);
    }

    // Validate turn ownership
    if (playerIndex !== this._activePlayer) {
      // Allow setup/reset from anyone
      if (action.type === "SETUP_GAME" || action.type === "RESET_GAME") {
        this.cancelPendingDilemmaSelection();
        if (action.type === "SETUP_GAME") {
          this.setupBothPlayers(action.deckCardIds);
          this.onStateChange?.(false);
          return { success: true };
        }
        this.engines[0].executeAction(action);
        this.engines[1].executeAction(action);
        this._winner = null;
        this.onStateChange?.(false);
        return { success: true };
      }
      return { success: false, reason: "Not your turn" };
    }

    if (action.type === "SETUP_GAME") {
      this.cancelPendingDilemmaSelection();
      this.setupBothPlayers(action.deckCardIds);
      this.onStateChange?.(false);
      return { success: true };
    }

    if (action.type === "RESET_GAME") {
      this.cancelPendingDilemmaSelection();
      this.engines[0].executeAction(action);
      this.engines[1].executeAction(action);
      this._winner = null;
      this.onStateChange?.(false);
      return { success: true };
    }

    const engine = this.engines[playerIndex];
    let result: ActionResult;

    // For mission attempts, use opponent's dilemma pool
    if (action.type === "ATTEMPT_MISSION") {
      const opponentIndex = (1 - playerIndex) as 0 | 1;
      const opponentPool = this.engines[opponentIndex].getDilemmaPool();

      // AI strategically selects dilemmas when human attempts
      if (playerIndex === 0) {
        // Human is attempting — AI selects dilemmas
        const state = engine.getSerializableState();
        const deployment = state.missions[action.missionIndex];
        if (deployment) {
          const group = deployment.groups[action.groupIndex];
          if (group) {
            this.aiPlayer.orderDilemmaPool(opponentPool, group.cards);
          }
        }
      }
      // When AI attempts, dilemmas are randomly ordered (default shuffle in engine)

      result = engine.attemptMissionWithExternalDilemmas(
        action.missionIndex,
        action.groupIndex,
        opponentPool
      );
    } else {
      result = engine.executeAction(action);
    }

    if (!result.success) {
      return result;
    }

    // Check if encounter just ended — restore own dilemma pool
    if (
      engine.isUsingExternalDilemmaPool() &&
      !engine.getState().dilemmaEncounter
    ) {
      engine.restoreOwnDilemmaPool();
    }

    // Check win condition after any scoring
    this.checkGlobalWinCondition();

    // Check if turn should switch (phase went from DiscardExcess to PlayAndDraw = new turn)
    if (action.type === "NEXT_PHASE") {
      const state = engine.getState();
      if (state.phase === "PlayAndDraw" && state.turn > 1) {
        // Turn just advanced — switch active player
        this.switchActivePlayer();
      }
    }

    // Notify state change
    this.onStateChange?.(false);

    // If it's now the AI's turn, trigger AI play
    if (
      this._activePlayer === 1 &&
      !this._isAITurnInProgress &&
      !this._winner
    ) {
      this.startAITurn();
    }

    return result;
  }

  /**
   * Get the combined two-player state for a specific player's perspective.
   */
  getStateForPlayer(playerIndex: 0 | 1): TwoPlayerGameState {
    const opponentIndex = (1 - playerIndex) as 0 | 1;

    return {
      myState: this.engines[playerIndex].getSerializableState(),
      opponentState: this.engines[
        opponentIndex
      ].getPublicState() as OpponentPublicState,
      activePlayer: this.activePlayerNumber,
      myPlayerNumber: (playerIndex + 1) as 1 | 2,
      winner: this._winner,
    };
  }

  /**
   * Get new log entries since last check for a player.
   */
  getNewLogEntries(playerIndex: 0 | 1): ActionLogEntry[] {
    const log = this.engines[playerIndex].getState().actionLog;
    const entries = log.slice(this.lastLogIndices[playerIndex]);
    this.lastLogIndices[playerIndex] = log.length;
    return entries;
  }

  private switchActivePlayer(): void {
    this._activePlayer = (1 - this._activePlayer) as 0 | 1;
  }

  private checkGlobalWinCondition(): void {
    for (let i = 0; i < 2; i++) {
      const state = this.engines[i]!.getState();
      if (state.gameOver && state.victory) {
        this._winner = (i + 1) as 1 | 2;
        // Also mark the other player's game as over
        const otherState = this.engines[1 - i]!.getState();
        otherState.gameOver = true;
        otherState.victory = false;
        return;
      }
    }
  }

  /**
   * Start the AI's turn. Runs asynchronously with delays between actions.
   */
  private async startAITurn(): Promise<void> {
    this._isAITurnInProgress = true;

    try {
      const aiEngine = this.engines[1];
      const humanEngine = this.engines[0];

      // AI plays through all phases
      await this.aiPlayer.playTurn(
        aiEngine,
        humanEngine,
        async (action: GameAction) => {
          // Execute the AI's action
          let result: ActionResult;

          if (action.type === "ATTEMPT_MISSION") {
            result = await this.handleAIMissionAttempt(
              aiEngine,
              humanEngine,
              action.missionIndex,
              action.groupIndex
            );
          } else {
            result = aiEngine.executeAction(action);
          }

          // Check if encounter ended
          if (
            aiEngine.isUsingExternalDilemmaPool() &&
            !aiEngine.getState().dilemmaEncounter
          ) {
            aiEngine.restoreOwnDilemmaPool();
          }

          this.checkGlobalWinCondition();

          // Broadcast state update to human
          this.onStateChange?.(true);

          // Delay between actions for UX
          await delay(600);

          return result;
        }
      );

      // After AI finishes all phases, switch to human
      if (!this._winner) {
        this.switchActivePlayer();
        this.onStateChange?.(true);
      }
    } finally {
      this._isAITurnInProgress = false;
    }
  }

  /**
   * Handle the AI attempting a mission: pause for human dilemma selection.
   */
  private async handleAIMissionAttempt(
    aiEngine: GameEngine,
    humanEngine: GameEngine,
    missionIndex: number,
    groupIndex: number
  ): Promise<ActionResult> {
    const humanPool = humanEngine.getDilemmaPool();

    // Temporarily swap pool so prepareMissionAttempt uses human's dilemmas
    const aiOwnPool = aiEngine.getDilemmaPool();
    aiEngine.setDilemmaPool(humanPool);

    const prep = aiEngine.prepareMissionAttempt(missionIndex, groupIndex);

    // Restore immediately — prep didn't consume anything
    aiEngine.setDilemmaPool(aiOwnPool);

    if ("error" in prep) {
      return { success: false, reason: prep.error };
    }

    // If no eligible dilemmas, skip human selection
    if (
      prep.eligibleDilemmas.length === 0 &&
      prep.reEncounterDilemmas.length === 0
    ) {
      return aiEngine.attemptMissionWithExternalDilemmas(
        missionIndex,
        groupIndex,
        humanPool
      );
    }

    // Store pending state
    this._pendingDilemmaSelection = {
      eligibleDilemmas: prep.eligibleDilemmas,
      reEncounterDilemmas: prep.reEncounterDilemmas,
      drawCount: prep.drawCount,
      costBudget: prep.costBudget,
    };

    // Broadcast state so human sees AI is attempting
    this.onStateChange?.(true);

    // Send dilemma selection request to human
    this.onSendToHuman?.({
      type: "DILEMMA_SELECTION_REQUEST",
      timestamp: Date.now(),
      drawnDilemmas: prep.eligibleDilemmas,
      costBudget: prep.costBudget,
      drawCount: prep.drawCount,
      missionName: prep.missionName,
      missionType: prep.missionType as "Planet" | "Space",
      aiPersonnelCount: prep.personnelCount,
      reEncounterDilemmas: prep.reEncounterDilemmas,
    });

    // Wait for human's response (with 60s timeout fallback)
    const selectedUniqueIds = await new Promise<string[]>((resolve) => {
      this._dilemmaSelectionResolver = resolve;

      this._dilemmaSelectionTimeout = setTimeout(() => {
        if (this._pendingDilemmaSelection) {
          // Auto-select randomly on timeout
          resolve(
            this.autoSelectDilemmas(
              this._pendingDilemmaSelection.eligibleDilemmas,
              this._pendingDilemmaSelection.drawCount,
              this._pendingDilemmaSelection.costBudget
            )
          );
          this._dilemmaSelectionResolver = null;
          this._pendingDilemmaSelection = null;
        }
      }, 60000);
    });

    // Clear timeout
    if (this._dilemmaSelectionTimeout) {
      clearTimeout(this._dilemmaSelectionTimeout);
      this._dilemmaSelectionTimeout = null;
    }

    // Now create the encounter with human-selected dilemmas
    // Swap pool again for the encounter duration
    aiEngine.setDilemmaPool(humanPool);
    const result = aiEngine.startMissionEncounterWithSelectedDilemmas(
      missionIndex,
      groupIndex,
      selectedUniqueIds,
      prep.eligibleDilemmas,
      prep.reEncounterDilemmas,
      prep.costBudget
    );

    // Store own pool for later restoration (same pattern as attemptMissionWithExternalDilemmas)
    // Access private field via the public setter pattern
    (
      aiEngine as unknown as { _ownDilemmaPool: DilemmaCard[] | null }
    )._ownDilemmaPool = aiOwnPool;

    this._pendingDilemmaSelection = null;

    return result;
  }

  /**
   * Handle the human's dilemma selection during an AI mission attempt.
   */
  private handleDilemmaSelection(selectedUniqueIds: string[]): ActionResult {
    if (!this._pendingDilemmaSelection || !this._dilemmaSelectionResolver) {
      return { success: false, reason: "No pending dilemma selection" };
    }

    const pending = this._pendingDilemmaSelection;
    const eligibleIds = new Set(
      pending.eligibleDilemmas.map((d) => d.uniqueId)
    );
    const reEncounterIds = new Set(
      pending.reEncounterDilemmas.map((d) => d.uniqueId)
    );

    // Validate: all selected uniqueIds must be in eligible or re-encounter set
    for (const id of selectedUniqueIds) {
      if (!eligibleIds.has(id) && !reEncounterIds.has(id)) {
        return { success: false, reason: `Invalid dilemma selection: ${id}` };
      }
    }

    // Separate pool selections from re-encounter selections for validation
    const poolSelections = selectedUniqueIds.filter((id) =>
      eligibleIds.has(id)
    );

    // Validate: no duplicate base IDs among pool selections
    const selectedBaseIds = new Set<string>();
    for (const uid of poolSelections) {
      const dilemma = pending.eligibleDilemmas.find((d) => d.uniqueId === uid);
      if (dilemma) {
        if (selectedBaseIds.has(dilemma.id)) {
          return {
            success: false,
            reason: "Cannot select duplicate dilemmas",
          };
        }
        selectedBaseIds.add(dilemma.id);
      }
    }

    // Validate: total cost <= budget (re-encounter dilemmas are free)
    let totalCost = 0;
    for (const uid of poolSelections) {
      const dilemma = pending.eligibleDilemmas.find((d) => d.uniqueId === uid);
      if (dilemma) totalCost += dilemma.cost;
    }
    if (totalCost > pending.costBudget) {
      return {
        success: false,
        reason: "Selected dilemmas exceed cost budget",
      };
    }

    // Validate: pool selection count <= drawCount (re-encounter dilemmas don't count)
    if (poolSelections.length > pending.drawCount) {
      return { success: false, reason: "Too many dilemmas selected" };
    }

    // Resolve the promise to unblock the AI turn
    this._dilemmaSelectionResolver(selectedUniqueIds);
    this._dilemmaSelectionResolver = null;

    return { success: true };
  }

  /**
   * Cancel any pending dilemma selection (on game reset).
   */
  private cancelPendingDilemmaSelection(): void {
    if (this._dilemmaSelectionResolver) {
      this._dilemmaSelectionResolver([]);
      this._dilemmaSelectionResolver = null;
    }
    this._pendingDilemmaSelection = null;
    if (this._dilemmaSelectionTimeout) {
      clearTimeout(this._dilemmaSelectionTimeout);
      this._dilemmaSelectionTimeout = null;
    }
  }

  /**
   * Fallback: auto-select dilemmas randomly (greedy by cost).
   */
  private autoSelectDilemmas(
    eligible: DilemmaCard[],
    drawCount: number,
    costBudget: number
  ): string[] {
    const selected: string[] = [];
    const usedBaseIds = new Set<string>();
    let costSpent = 0;
    for (const d of eligible) {
      if (selected.length >= drawCount) break;
      if (usedBaseIds.has(d.id)) continue;
      if (costSpent + d.cost <= costBudget) {
        selected.push(d.uniqueId!);
        usedBaseIds.add(d.id);
        costSpent += d.cost;
      }
    }
    return selected;
  }

  get isAwaitingDilemmaSelection(): boolean {
    return this._pendingDilemmaSelection !== null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
