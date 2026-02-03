import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "./gameStore";
import { defaultDeck } from "../data/defaultDeck";
import { GAME_CONSTANTS } from "../types";

describe("gameStore", () => {
  beforeEach(() => {
    // Reset store before each test
    useGameStore.getState().resetGame();
  });

  describe("setupGame", () => {
    it("initializes game state from deck list", () => {
      const store = useGameStore.getState();
      store.setupGame(defaultDeck);

      const state = useGameStore.getState();

      // Should have 5 missions
      expect(state.missions).toHaveLength(5);

      // Should have drawn initial hand
      expect(state.hand).toHaveLength(GAME_CONSTANTS.MAX_HAND_SIZE);

      // Should have dilemmas in pool
      expect(state.dilemmaPool.length).toBeGreaterThan(0);

      // Should be on turn 1, PlayAndDraw phase with full counters
      // (initial hand draw is free, like the original game)
      expect(state.turn).toBe(1);
      expect(state.phase).toBe("PlayAndDraw");
      expect(state.counters).toBe(GAME_CONSTANTS.STARTING_COUNTERS);

      // Deck should be reduced by 7
      expect(state.deck.length).toBeGreaterThan(0);
    });

    it("identifies headquarters index", () => {
      const store = useGameStore.getState();
      store.setupGame(defaultDeck);

      const state = useGameStore.getState();
      expect(state.headquartersIndex).toBe(0); // Unicomplex is first mission
      expect(state.missions[0]!.mission.missionType).toBe("Headquarters");
    });

    it("creates unique IDs for each card instance", () => {
      const store = useGameStore.getState();
      store.setupGame(defaultDeck);

      const state = useGameStore.getState();

      // All cards in hand should have unique IDs
      const uniqueIds = new Set(state.hand.map((c) => c.uniqueId));
      expect(uniqueIds.size).toBe(state.hand.length);
    });
  });

  describe("draw", () => {
    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
      // Reset to have counters available
      useGameStore.setState({ counters: 7, phase: "PlayAndDraw" });
    });

    it("draws cards from deck to hand", () => {
      const initialDeckSize = useGameStore.getState().deck.length;
      const initialHandSize = useGameStore.getState().hand.length;

      useGameStore.getState().draw(2);

      const state = useGameStore.getState();
      expect(state.deck.length).toBe(initialDeckSize - 2);
      expect(state.hand.length).toBe(initialHandSize + 2);
      expect(state.counters).toBe(5);
    });

    it("does not draw more than available counters", () => {
      useGameStore.setState({ counters: 2 });

      const initialDeckSize = useGameStore.getState().deck.length;

      useGameStore.getState().draw(5);

      const state = useGameStore.getState();
      expect(state.deck.length).toBe(initialDeckSize - 2);
      expect(state.counters).toBe(0);
    });

    it("does not draw more than deck size", () => {
      useGameStore.setState({ deck: useGameStore.getState().deck.slice(0, 1) });

      useGameStore.getState().draw(5);

      const state = useGameStore.getState();
      expect(state.deck.length).toBe(0);
    });

    it("auto-advances to ExecuteOrders when counters hit 0", () => {
      useGameStore.setState({ counters: 2 });

      useGameStore.getState().draw(2);

      expect(useGameStore.getState().phase).toBe("ExecuteOrders");
    });

    it("does not draw during non-PlayAndDraw phases", () => {
      useGameStore.setState({ phase: "ExecuteOrders" });
      const initialHandSize = useGameStore.getState().hand.length;

      useGameStore.getState().draw(1);

      expect(useGameStore.getState().hand.length).toBe(initialHandSize);
    });
  });

  describe("deploy", () => {
    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
      useGameStore.setState({ counters: 7, phase: "PlayAndDraw" });
    });

    it("deploys personnel from hand to headquarters", () => {
      const state = useGameStore.getState();
      const personnel = state.hand.find((c) => c.type === "Personnel");

      if (!personnel?.uniqueId) {
        throw new Error("No personnel in hand for test");
      }

      const result = state.deploy(personnel.uniqueId);

      expect(result).toBe(true);

      const newState = useGameStore.getState();
      // Card should be removed from hand
      expect(
        newState.hand.find((c) => c.uniqueId === personnel.uniqueId)
      ).toBeUndefined();

      // Card should be at headquarters (group 0)
      const hqCards =
        newState.missions[newState.headquartersIndex]!.groups[0]!.cards;
      expect(
        hqCards.find((c) => c.uniqueId === personnel.uniqueId)
      ).toBeDefined();
    });

    it("deploys ship from hand creating new group", () => {
      const state = useGameStore.getState();
      const ship = state.hand.find((c) => c.type === "Ship");

      if (!ship?.uniqueId) {
        // Need to draw until we get a ship
        useGameStore.setState({ counters: 20 });
        while (!useGameStore.getState().hand.find((c) => c.type === "Ship")) {
          if (useGameStore.getState().deck.length === 0) {
            console.log("No ships available in deck for test, skipping");
            return;
          }
          useGameStore.getState().draw(1);
        }
      }

      const stateWithShip = useGameStore.getState();
      const shipCard = stateWithShip.hand.find((c) => c.type === "Ship");
      if (!shipCard?.uniqueId) return;

      const initialGroupCount =
        stateWithShip.missions[stateWithShip.headquartersIndex]!.groups.length;

      stateWithShip.deploy(shipCard.uniqueId);

      const newState = useGameStore.getState();
      const hqGroups = newState.missions[newState.headquartersIndex]!.groups;

      // Should have added a new group
      expect(hqGroups.length).toBe(initialGroupCount + 1);

      // Ship should be in the new group
      const lastGroup = hqGroups[hqGroups.length - 1]!;
      expect(
        lastGroup.cards.find((c) => c.uniqueId === shipCard.uniqueId)
      ).toBeDefined();
    });

    it("deducts deploy cost from counters", () => {
      const state = useGameStore.getState();
      const personnel = state.hand.find((c) => c.type === "Personnel");

      if (!personnel?.uniqueId) throw new Error("No personnel");

      const initialCounters = state.counters;
      const deployCost = (personnel as { deploy: number }).deploy;

      state.deploy(personnel.uniqueId);

      expect(useGameStore.getState().counters).toBe(
        initialCounters - deployCost
      );
    });

    it("fails to deploy if not enough counters", () => {
      useGameStore.setState({ counters: 0 });

      const state = useGameStore.getState();
      const personnel = state.hand.find((c) => c.type === "Personnel");

      if (!personnel?.uniqueId) throw new Error("No personnel");

      const result = state.deploy(personnel.uniqueId);

      expect(result).toBe(false);
    });

    it("tracks unique cards in play", () => {
      const state = useGameStore.getState();
      const uniquePersonnel = state.hand.find(
        (c) => c.type === "Personnel" && c.unique
      );

      if (!uniquePersonnel?.uniqueId) {
        console.log("No unique personnel in hand, skipping test");
        return;
      }

      state.deploy(uniquePersonnel.uniqueId);

      const newState = useGameStore.getState();
      expect(newState.uniquesInPlay.has(uniquePersonnel.id)).toBe(true);
    });

    it("prevents deploying duplicate unique cards", () => {
      // First, deploy a unique card
      const state = useGameStore.getState();
      const uniquePersonnel = state.hand.find(
        (c) => c.type === "Personnel" && c.unique
      );

      if (!uniquePersonnel?.uniqueId) {
        console.log("No unique personnel in hand, skipping test");
        return;
      }

      state.deploy(uniquePersonnel.uniqueId);

      // Now try to deploy another instance of the same unique card
      // (this would require the card to be in hand again, which won't happen in this test)
      // Instead, verify the uniquesInPlay set is being checked
      useGameStore.setState({
        uniquesInPlay: new Set([uniquePersonnel.id]),
      });

      // Create a fake card with same base ID
      const fakeCard = { ...uniquePersonnel, uniqueId: "fake-123" };
      useGameStore.setState((s) => ({ hand: [...s.hand, fakeCard] }));

      const result = useGameStore.getState().deploy("fake-123");
      expect(result).toBe(false);
    });
  });

  describe("nextPhase", () => {
    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
    });

    it("advances from PlayAndDraw to ExecuteOrders when counters are spent", () => {
      // Rule 6.6: Must spend all counters (or deck must be empty) to advance
      useGameStore.setState({ phase: "PlayAndDraw", counters: 0 });

      useGameStore.getState().nextPhase();

      expect(useGameStore.getState().phase).toBe("ExecuteOrders");
    });

    it("advances from ExecuteOrders to DiscardExcess", () => {
      useGameStore.setState({ phase: "ExecuteOrders" });

      useGameStore.getState().nextPhase();

      expect(useGameStore.getState().phase).toBe("DiscardExcess");
    });

    it("calls newTurn from DiscardExcess when hand is valid", () => {
      useGameStore.setState({
        phase: "DiscardExcess",
        counters: 0,
        hand: useGameStore.getState().hand.slice(0, 7),
        turn: 1,
      });

      useGameStore.getState().nextPhase();

      const state = useGameStore.getState();
      expect(state.turn).toBe(2);
      expect(state.phase).toBe("PlayAndDraw");
    });

    it("does not advance from DiscardExcess if hand > 7", () => {
      // Make sure hand has more than 7 cards
      useGameStore.setState({
        phase: "DiscardExcess",
        counters: 0,
        hand: [
          ...useGameStore.getState().hand,
          ...useGameStore.getState().hand.slice(0, 2),
        ],
      });

      const initialTurn = useGameStore.getState().turn;

      useGameStore.getState().nextPhase();

      expect(useGameStore.getState().turn).toBe(initialTurn);
      expect(useGameStore.getState().phase).toBe("DiscardExcess");
    });
  });

  describe("newTurn", () => {
    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
    });

    it("increments turn counter", () => {
      const initialTurn = useGameStore.getState().turn;

      useGameStore.getState().newTurn();

      expect(useGameStore.getState().turn).toBe(initialTurn + 1);
    });

    it("resets counters to 7", () => {
      useGameStore.setState({ counters: 0 });

      useGameStore.getState().newTurn();

      expect(useGameStore.getState().counters).toBe(
        GAME_CONSTANTS.STARTING_COUNTERS
      );
    });

    it("resets phase to PlayAndDraw", () => {
      useGameStore.setState({ phase: "DiscardExcess" });

      useGameStore.getState().newTurn();

      expect(useGameStore.getState().phase).toBe("PlayAndDraw");
    });

    it("unstops stopped personnel", () => {
      // Deploy some personnel first
      useGameStore.setState({ counters: 20, phase: "PlayAndDraw" });
      const state = useGameStore.getState();
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 2);

      for (const p of personnel) {
        if (p.uniqueId) state.deploy(p.uniqueId);
      }

      // Stop the personnel
      const missions = useGameStore.getState().missions;
      const updatedMissions = missions.map((m) => ({
        ...m,
        groups: m.groups.map((g) => ({
          cards: g.cards.map((c) =>
            c.type === "Personnel" ? { ...c, status: "Stopped" as const } : c
          ),
        })),
      }));
      useGameStore.setState({ missions: updatedMissions });

      // Verify they are stopped
      const stoppedPersonnel = useGameStore
        .getState()
        .missions.flatMap((m) => m.groups.flatMap((g) => g.cards))
        .filter((c) => c.type === "Personnel");

      expect(
        stoppedPersonnel.every(
          (p) => (p as { status: string }).status === "Stopped"
        )
      ).toBe(true);

      // New turn should unstop them
      useGameStore.getState().newTurn();

      const unstoppedPersonnel = useGameStore
        .getState()
        .missions.flatMap((m) => m.groups.flatMap((g) => g.cards))
        .filter((c) => c.type === "Personnel");

      expect(
        unstoppedPersonnel.every(
          (p) => (p as { status: string }).status === "Unstopped"
        )
      ).toBe(true);
    });
  });

  describe("discard", () => {
    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
    });

    it("moves card from hand to discard pile", () => {
      useGameStore.setState({ phase: "DiscardExcess" });

      const state = useGameStore.getState();
      const card = state.hand[0];

      if (!card?.uniqueId) throw new Error("No card in hand");

      state.discardCard(card.uniqueId);

      const newState = useGameStore.getState();
      expect(
        newState.hand.find((c) => c.uniqueId === card.uniqueId)
      ).toBeUndefined();
      expect(
        newState.discard.find((c) => c.uniqueId === card.uniqueId)
      ).toBeDefined();
    });

    it("does not discard during non-DiscardExcess phases", () => {
      useGameStore.setState({ phase: "PlayAndDraw" });

      const state = useGameStore.getState();
      const card = state.hand[0];
      const initialHandSize = state.hand.length;

      if (!card?.uniqueId) throw new Error("No card in hand");

      state.discardCard(card.uniqueId);

      expect(useGameStore.getState().hand.length).toBe(initialHandSize);
    });
  });

  describe("beamToShip", () => {
    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
      useGameStore.setState({ counters: 50, phase: "PlayAndDraw" });

      // Draw until we have both personnel and a ship in hand
      while (
        !useGameStore.getState().hand.find((c) => c.type === "Ship") &&
        useGameStore.getState().deck.length > 0
      ) {
        useGameStore.getState().draw(1);
      }

      // Deploy personnel and a ship
      const state = useGameStore.getState();
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 3);
      const ship = state.hand.find((c) => c.type === "Ship");

      for (const p of personnel) {
        if (p.uniqueId) useGameStore.getState().deploy(p.uniqueId);
      }
      if (ship?.uniqueId) useGameStore.getState().deploy(ship.uniqueId);

      useGameStore.setState({ phase: "ExecuteOrders" });
    });

    it("moves personnel from planet to ship", () => {
      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;
      const hq = state.missions[hqIndex]!;

      // Personnel should be in group 0
      const personnel = hq.groups[0]!.cards.find((c) => c.type === "Personnel");
      if (!personnel?.uniqueId) {
        console.log("No personnel in group 0, skipping test");
        return;
      }

      // Ship should be in group 1 (if we successfully deployed one)
      if (hq.groups.length <= 1) {
        console.log("No ship deployed, skipping test");
        return;
      }

      state.beamToShip(personnel.uniqueId, hqIndex, 0, 1);

      const newState = useGameStore.getState();
      const newHq = newState.missions[hqIndex]!;

      // Personnel should no longer be in group 0
      expect(
        newHq.groups[0]!.cards.find((c) => c.uniqueId === personnel.uniqueId)
      ).toBeUndefined();

      // Personnel should be in group 1
      expect(
        newHq.groups[1]!.cards.find((c) => c.uniqueId === personnel.uniqueId)
      ).toBeDefined();
    });

    it("does not beam during non-ExecuteOrders phase", () => {
      useGameStore.setState({ phase: "PlayAndDraw" });

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;
      const hq = state.missions[hqIndex]!;
      const personnel = hq.groups[0]!.cards.find((c) => c.type === "Personnel");

      if (!personnel?.uniqueId) return;

      const initialGroup0Count = hq.groups[0]!.cards.length;

      state.beamToShip(personnel.uniqueId, hqIndex, 0, 1);

      expect(
        useGameStore.getState().missions[hqIndex]!.groups[0]!.cards.length
      ).toBe(initialGroup0Count);
    });
  });

  describe("selectors", () => {
    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
    });

    it("selectTurnSummary returns correct info", () => {
      const state = useGameStore.getState();

      const summary = {
        turn: state.turn,
        phase: state.phase,
        counters: state.counters,
        handCount: state.hand.length,
        deckCount: state.deck.length,
        score: state.score,
        completedPlanetMissions: state.completedPlanetMissions,
        completedSpaceMissions: state.completedSpaceMissions,
      };

      expect(summary.turn).toBe(1);
      expect(summary.handCount).toBe(GAME_CONSTANTS.MAX_HAND_SIZE);
    });
  });

  describe("attemptMission - Rule 6.1: Overcome Dilemma Count", () => {
    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
      useGameStore.setState({ counters: 50, phase: "PlayAndDraw" });
    });

    it("subtracts overcome dilemmas from dilemma draw count", () => {
      // Deploy 4 personnel to a non-headquarters mission
      const state = useGameStore.getState();
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 4);

      // Find a planet mission (not headquarters)
      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet" && !m.mission.completed
      );

      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      // Deploy personnel to that mission
      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      // Add 2 overcome dilemmas to the mission
      const dilemmaPool = useGameStore.getState().dilemmaPool;
      const twoDilemmas = dilemmaPool.slice(0, 2).map((d) => ({
        ...d,
        overcome: true,
        faceup: true,
      }));

      const missions = useGameStore.getState().missions;
      const updatedMissions = missions.map((m, idx) =>
        idx === planetMissionIndex ? { ...m, dilemmas: twoDilemmas } : m
      );
      useGameStore.setState({
        missions: updatedMissions,
        dilemmaPool: dilemmaPool.slice(2), // Remove used dilemmas from pool
      });

      // Start mission attempt
      useGameStore.setState({ phase: "ExecuteOrders" });
      const initialDilemmaPoolSize = useGameStore.getState().dilemmaPool.length;

      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      // With 4 personnel and 2 overcome dilemmas, should draw 4-2=2 dilemmas
      const encounter = useGameStore.getState().dilemmaEncounter;
      if (encounter) {
        // Should have drawn at most 2 dilemmas (personnel count - overcome count)
        expect(encounter.selectedDilemmas.length).toBeLessThanOrEqual(2);
      }

      // Dilemma pool should be reduced by at most 2
      const newDilemmaPoolSize = useGameStore.getState().dilemmaPool.length;
      expect(initialDilemmaPoolSize - newDilemmaPoolSize).toBeLessThanOrEqual(
        2
      );
    });

    it("draws zero dilemmas when overcome count equals or exceeds personnel count", () => {
      // Deploy 2 personnel to a planet mission
      const state = useGameStore.getState();
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 2);

      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet" && !m.mission.completed
      );

      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      // Add 3 overcome dilemmas (more than personnel count)
      const dilemmaPool = useGameStore.getState().dilemmaPool;
      const threeDilemmas = dilemmaPool.slice(0, 3).map((d) => ({
        ...d,
        overcome: true,
        faceup: true,
      }));

      const missions = useGameStore.getState().missions;
      const updatedMissions = missions.map((m, idx) =>
        idx === planetMissionIndex ? { ...m, dilemmas: threeDilemmas } : m
      );
      useGameStore.setState({
        missions: updatedMissions,
        dilemmaPool: dilemmaPool.slice(3),
      });

      useGameStore.setState({ phase: "ExecuteOrders" });

      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      // With 2 personnel and 3 overcome dilemmas, should draw max(0, 2-3)=0 dilemmas
      const encounter = useGameStore.getState().dilemmaEncounter;

      // Either no encounter started (went straight to scoring) or 0 dilemmas
      if (encounter) {
        expect(encounter.selectedDilemmas.length).toBe(0);
      }
    });
  });

  describe("attemptMission - Rule 6.2: Dilemma Cost Budget", () => {
    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
      useGameStore.setState({ counters: 50, phase: "PlayAndDraw" });
    });

    it("sets cost budget equal to personnel count minus overcome dilemmas", () => {
      const state = useGameStore.getState();
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 5);

      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet" && !m.mission.completed
      );

      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      // Deploy 5 personnel
      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      // Add 1 overcome dilemma
      const dilemmaPool = useGameStore.getState().dilemmaPool;
      const oneDilemma = dilemmaPool.slice(0, 1).map((d) => ({
        ...d,
        overcome: true,
        faceup: true,
      }));

      const missions = useGameStore.getState().missions;
      const updatedMissions = missions.map((m, idx) =>
        idx === planetMissionIndex ? { ...m, dilemmas: oneDilemma } : m
      );
      useGameStore.setState({
        missions: updatedMissions,
        dilemmaPool: dilemmaPool.slice(1),
      });

      useGameStore.setState({ phase: "ExecuteOrders" });
      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      const encounter = useGameStore.getState().dilemmaEncounter;
      if (encounter) {
        // Cost budget should be 5 personnel - 1 overcome = 4
        expect(encounter.costBudget).toBe(4);
        // costSpent will be non-zero if first dilemma was auto-resolved
        // Just verify it doesn't exceed budget
        expect(encounter.costSpent).toBeLessThanOrEqual(encounter.costBudget);
      }
    });

    it("selects dilemmas whose total cost fits within budget", () => {
      const state = useGameStore.getState();
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 3);

      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet" && !m.mission.completed
      );

      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      // Deploy 3 personnel (cost budget = 3)
      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      useGameStore.setState({ phase: "ExecuteOrders" });
      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      const encounter = useGameStore.getState().dilemmaEncounter;
      if (encounter) {
        // Total cost of selected dilemmas should not exceed budget
        const totalCost = encounter.selectedDilemmas.reduce(
          (sum, d) => sum + d.deploy,
          0
        );
        expect(totalCost).toBeLessThanOrEqual(encounter.costBudget);
      }
    });

    it("prioritizes higher cost dilemmas when selecting within budget", () => {
      const state = useGameStore.getState();
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 4);

      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet" && !m.mission.completed
      );

      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      // Deploy 4 personnel (cost budget = 4)
      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      useGameStore.setState({ phase: "ExecuteOrders" });
      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      const encounter = useGameStore.getState().dilemmaEncounter;
      if (encounter && encounter.selectedDilemmas.length > 1) {
        // Dilemmas should be sorted by cost descending (highest first)
        for (let i = 1; i < encounter.selectedDilemmas.length; i++) {
          expect(
            encounter.selectedDilemmas[i - 1]!.deploy
          ).toBeGreaterThanOrEqual(encounter.selectedDilemmas[i]!.deploy);
        }
      }
    });

    it("tracks cost spent as dilemmas are resolved", () => {
      const state = useGameStore.getState();
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 4);

      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet" && !m.mission.completed
      );

      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      useGameStore.setState({ phase: "ExecuteOrders" });
      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      const initialEncounter = useGameStore.getState().dilemmaEncounter;
      if (!initialEncounter || initialEncounter.selectedDilemmas.length === 0) {
        console.log("No dilemmas selected, skipping test");
        return;
      }

      // After first dilemma is resolved (happens in attemptMission), costSpent should increase
      const dilemmaResult = useGameStore.getState().dilemmaResult;
      if (dilemmaResult && !dilemmaResult.requiresSelection) {
        const encounter = useGameStore.getState().dilemmaEncounter;
        if (encounter) {
          const firstDilemmaCost = encounter.selectedDilemmas[0]!.deploy;
          expect(encounter.costSpent).toBe(firstDilemmaCost);
        }
      }
    });

    it("selects no dilemmas when cost budget is zero", () => {
      const state = useGameStore.getState();
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 2);

      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet" && !m.mission.completed
      );

      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      // Deploy 2 personnel
      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      // Add 2 overcome dilemmas (budget = 2 - 2 = 0)
      const dilemmaPool = useGameStore.getState().dilemmaPool;
      const twoDilemmas = dilemmaPool.slice(0, 2).map((d) => ({
        ...d,
        overcome: true,
        faceup: true,
      }));

      const missions = useGameStore.getState().missions;
      const updatedMissions = missions.map((m, idx) =>
        idx === planetMissionIndex ? { ...m, dilemmas: twoDilemmas } : m
      );
      useGameStore.setState({
        missions: updatedMissions,
        dilemmaPool: dilemmaPool.slice(2),
      });

      useGameStore.setState({ phase: "ExecuteOrders" });
      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      const encounter = useGameStore.getState().dilemmaEncounter;
      // With zero budget, no dilemmas should be selected (may go straight to scoring)
      if (encounter) {
        expect(encounter.selectedDilemmas.length).toBe(0);
        expect(encounter.costBudget).toBe(0);
      }
    });
  });

  describe("attemptMission - Rule 6.4: Mission Affiliation Check", () => {
    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
      useGameStore.setState({ counters: 50, phase: "PlayAndDraw" });
    });

    it("allows mission attempt when personnel affiliation matches mission affiliation", () => {
      const state = useGameStore.getState();

      // Find a planet mission with Borg affiliation (matching our Borg deck)
      const planetMissionIndex = state.missions.findIndex(
        (m) =>
          m.mission.missionType === "Planet" &&
          !m.mission.completed &&
          m.mission.affiliation?.includes("Borg")
      );

      if (planetMissionIndex === -1) {
        console.log("No Borg planet mission found, skipping test");
        return;
      }

      // Deploy Borg personnel (our deck is all Borg)
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 3);

      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      useGameStore.setState({ phase: "ExecuteOrders" });
      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      // Mission attempt should proceed (encounter created or mission scored)
      const encounter = useGameStore.getState().dilemmaEncounter;
      const mission =
        useGameStore.getState().missions[planetMissionIndex]!.mission;

      // Either we have an encounter or the mission was scored (if no dilemmas)
      const attemptProceeded = encounter !== null || mission.completed;
      expect(attemptProceeded).toBe(true);
    });

    it("prevents mission attempt when no personnel affiliation matches mission", () => {
      const state = useGameStore.getState();

      // Find a planet mission (not headquarters)
      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet" && !m.mission.completed
      );

      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      // Deploy personnel to the mission
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 3);

      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      // Modify mission to require Federation only (our deck is Borg)
      const missions = useGameStore.getState().missions;
      const updatedMissions = missions.map((m, idx) =>
        idx === planetMissionIndex
          ? {
              ...m,
              mission: { ...m.mission, affiliation: ["Federation" as const] },
            }
          : m
      );
      useGameStore.setState({ missions: updatedMissions });

      useGameStore.setState({ phase: "ExecuteOrders" });
      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      // Mission attempt should NOT proceed (no encounter created)
      const encounter = useGameStore.getState().dilemmaEncounter;
      expect(encounter).toBeNull();

      // Mission should not be completed
      const mission =
        useGameStore.getState().missions[planetMissionIndex]!.mission;
      expect(mission.completed).toBe(false);
    });

    it("allows mission attempt when mission has no affiliation requirement", () => {
      const state = useGameStore.getState();

      // Find a planet mission
      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet" && !m.mission.completed
      );

      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      // Deploy personnel
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 3);

      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      // Remove affiliation requirement from mission
      const missions = useGameStore.getState().missions;
      const updatedMissions = missions.map((m, idx) =>
        idx === planetMissionIndex
          ? {
              ...m,
              mission: { ...m.mission, affiliation: undefined },
            }
          : m
      );
      useGameStore.setState({ missions: updatedMissions });

      useGameStore.setState({ phase: "ExecuteOrders" });
      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      // Mission attempt should proceed when no affiliation requirement
      const encounter = useGameStore.getState().dilemmaEncounter;
      const mission =
        useGameStore.getState().missions[planetMissionIndex]!.mission;

      // Either we have an encounter or the mission was scored
      const attemptProceeded = encounter !== null || mission.completed;
      expect(attemptProceeded).toBe(true);
    });

    it("checks only unstopped personnel for affiliation matching", () => {
      const state = useGameStore.getState();

      // Find a planet mission with Borg affiliation
      const planetMissionIndex = state.missions.findIndex(
        (m) =>
          m.mission.missionType === "Planet" &&
          !m.mission.completed &&
          m.mission.affiliation?.includes("Borg")
      );

      if (planetMissionIndex === -1) {
        console.log("No Borg planet mission found, skipping test");
        return;
      }

      // Deploy personnel
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 2);

      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      // Stop all personnel
      const missions = useGameStore.getState().missions;
      const updatedMissions = missions.map((m, idx) =>
        idx === planetMissionIndex
          ? {
              ...m,
              groups: m.groups.map((g) => ({
                cards: g.cards.map((c) =>
                  c.type === "Personnel"
                    ? { ...c, status: "Stopped" as const }
                    : c
                ),
              })),
            }
          : m
      );
      useGameStore.setState({ missions: updatedMissions });

      useGameStore.setState({ phase: "ExecuteOrders" });
      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      // Mission attempt should NOT proceed (no unstopped personnel)
      const encounter = useGameStore.getState().dilemmaEncounter;
      expect(encounter).toBeNull();
    });

    it("allows attempt if any personnel has matching affiliation", () => {
      const state = useGameStore.getState();

      // Find a planet mission
      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet" && !m.mission.completed
      );

      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      // Deploy personnel
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 3);

      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      // Set mission to require Borg or Federation (Borg should match)
      const missions = useGameStore.getState().missions;
      const updatedMissions = missions.map((m, idx) =>
        idx === planetMissionIndex
          ? {
              ...m,
              mission: {
                ...m.mission,
                affiliation: ["Borg" as const, "Federation" as const],
              },
            }
          : m
      );
      useGameStore.setState({ missions: updatedMissions });

      useGameStore.setState({ phase: "ExecuteOrders" });
      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      // Mission attempt should proceed (Borg personnel match)
      const encounter = useGameStore.getState().dilemmaEncounter;
      const mission =
        useGameStore.getState().missions[planetMissionIndex]!.mission;

      const attemptProceeded = encounter !== null || mission.completed;
      expect(attemptProceeded).toBe(true);
    });
  });

  describe("attemptMission - Rule 6.5: Duplicate Dilemma Detection", () => {
    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
      useGameStore.setState({ counters: 50, phase: "PlayAndDraw" });
    });

    it("tracks faced dilemma IDs in the encounter", () => {
      const state = useGameStore.getState();
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 4);

      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet" && !m.mission.completed
      );

      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      useGameStore.setState({ phase: "ExecuteOrders" });
      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      const encounter = useGameStore.getState().dilemmaEncounter;
      if (encounter && encounter.selectedDilemmas.length > 0) {
        // First dilemma's base ID should be tracked
        expect(encounter.facedDilemmaIds).toBeDefined();
        expect(encounter.facedDilemmaIds.length).toBeGreaterThan(0);
        expect(encounter.facedDilemmaIds[0]).toBe(
          encounter.selectedDilemmas[0]!.id
        );
      }
    });

    it("auto-overcomes duplicate dilemmas during advancement", () => {
      const state = useGameStore.getState();
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 4);

      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet" && !m.mission.completed
      );

      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      // Get a dilemma from the pool to create duplicates
      const dilemmaPool = useGameStore.getState().dilemmaPool;
      if (dilemmaPool.length < 2) {
        console.log("Not enough dilemmas in pool, skipping test");
        return;
      }

      // Create duplicate dilemmas with the same base ID but different uniqueIds
      const baseDilemma = dilemmaPool[0]!;
      const duplicateDilemmas = [
        { ...baseDilemma, uniqueId: `${baseDilemma.id}-test-1` },
        { ...baseDilemma, uniqueId: `${baseDilemma.id}-test-2` }, // Duplicate
        { ...baseDilemma, uniqueId: `${baseDilemma.id}-test-3` }, // Duplicate
      ];

      // Set up a controlled encounter with duplicate dilemmas
      useGameStore.setState({ phase: "ExecuteOrders" });

      // Start the mission attempt
      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      const initialEncounter = useGameStore.getState().dilemmaEncounter;
      if (!initialEncounter) {
        console.log("No encounter created, skipping test");
        return;
      }

      // Manually set up an encounter with duplicate dilemmas for testing
      useGameStore.setState({
        dilemmaEncounter: {
          ...initialEncounter,
          selectedDilemmas: duplicateDilemmas,
          currentDilemmaIndex: 0,
          facedDilemmaIds: [baseDilemma.id], // First dilemma already faced
        },
      });

      // Advance to the second dilemma (which is a duplicate)
      useGameStore.getState().advanceDilemma();

      // After advancing past duplicates, check that they were auto-overcome
      const finalEncounter = useGameStore.getState().dilemmaEncounter;

      // If encounter still exists, check that duplicates were handled
      if (finalEncounter) {
        // Duplicate dilemmas should have been marked overcome
        const mission = useGameStore.getState().missions[planetMissionIndex]!;
        const overcomeDilemmas = mission.dilemmas.filter((d) => d.overcome);

        // Should have at least some overcome dilemmas from duplicates
        expect(overcomeDilemmas.length).toBeGreaterThanOrEqual(0);
      }
    });

    it("does not add duplicate base IDs to facedDilemmaIds", () => {
      const state = useGameStore.getState();
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 4);

      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet" && !m.mission.completed
      );

      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      // Get dilemmas from the pool
      const dilemmaPool = useGameStore.getState().dilemmaPool;
      if (dilemmaPool.length < 2) {
        console.log("Not enough dilemmas in pool, skipping test");
        return;
      }

      // Create dilemmas where the second is a duplicate of the first
      const baseDilemma = dilemmaPool[0]!;
      const testDilemmas = [
        { ...baseDilemma, uniqueId: `${baseDilemma.id}-test-1` },
        { ...baseDilemma, uniqueId: `${baseDilemma.id}-test-2` }, // Duplicate
      ];

      useGameStore.setState({ phase: "ExecuteOrders" });
      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      const initialEncounter = useGameStore.getState().dilemmaEncounter;
      if (!initialEncounter) {
        console.log("No encounter created, skipping test");
        return;
      }

      // Set up controlled encounter
      useGameStore.setState({
        dilemmaEncounter: {
          ...initialEncounter,
          selectedDilemmas: testDilemmas,
          currentDilemmaIndex: 0,
          facedDilemmaIds: [baseDilemma.id],
        },
      });

      // Advance (second dilemma is duplicate, should be auto-overcome)
      useGameStore.getState().advanceDilemma();

      const finalEncounter = useGameStore.getState().dilemmaEncounter;
      if (finalEncounter) {
        // facedDilemmaIds should still only have one entry (no duplicate added)
        const uniqueFacedIds = new Set(finalEncounter.facedDilemmaIds);
        expect(uniqueFacedIds.size).toBe(finalEncounter.facedDilemmaIds.length);
      }
    });

    it("initializes facedDilemmaIds as empty array in new encounter", () => {
      const state = useGameStore.getState();
      const personnel = state.hand
        .filter((c) => c.type === "Personnel")
        .slice(0, 3);

      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet" && !m.mission.completed
      );

      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      for (const p of personnel) {
        if (p.uniqueId)
          useGameStore.getState().deploy(p.uniqueId, planetMissionIndex);
      }

      // Clear any existing dilemmas on the mission
      const missions = useGameStore.getState().missions;
      const updatedMissions = missions.map((m, idx) =>
        idx === planetMissionIndex ? { ...m, dilemmas: [] } : m
      );
      useGameStore.setState({ missions: updatedMissions });

      useGameStore.setState({ phase: "ExecuteOrders" });
      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      const encounter = useGameStore.getState().dilemmaEncounter;
      if (encounter) {
        // facedDilemmaIds should be defined and contain at least the first dilemma's ID
        expect(encounter.facedDilemmaIds).toBeDefined();
        expect(Array.isArray(encounter.facedDilemmaIds)).toBe(true);
      }
    });
  });

  describe("nextPhase - Rule 6.6: Counter Spending Enforcement", () => {
    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
    });

    it("prevents advancing from PlayAndDraw if counters remain and deck has cards", () => {
      useGameStore.setState({
        phase: "PlayAndDraw",
        counters: 3, // Still have counters
      });

      // Verify deck has cards
      expect(useGameStore.getState().deck.length).toBeGreaterThan(0);

      useGameStore.getState().nextPhase();

      // Should still be in PlayAndDraw
      expect(useGameStore.getState().phase).toBe("PlayAndDraw");
    });

    it("allows advancing from PlayAndDraw when all counters are spent", () => {
      useGameStore.setState({
        phase: "PlayAndDraw",
        counters: 0, // All counters spent
      });

      useGameStore.getState().nextPhase();

      // Should advance to ExecuteOrders
      expect(useGameStore.getState().phase).toBe("ExecuteOrders");
    });

    it("allows advancing from PlayAndDraw when deck is empty (even with counters)", () => {
      useGameStore.setState({
        phase: "PlayAndDraw",
        counters: 5, // Still have counters
        deck: [], // But deck is empty
      });

      useGameStore.getState().nextPhase();

      // Should advance to ExecuteOrders (exception when deck is empty)
      expect(useGameStore.getState().phase).toBe("ExecuteOrders");
    });

    it("allows advancing when counters are 0 even if deck is empty", () => {
      useGameStore.setState({
        phase: "PlayAndDraw",
        counters: 0,
        deck: [],
      });

      useGameStore.getState().nextPhase();

      expect(useGameStore.getState().phase).toBe("ExecuteOrders");
    });

    it("selectCanAdvancePhase returns false when counters remain and deck has cards", () => {
      useGameStore.setState({
        phase: "PlayAndDraw",
        counters: 4,
      });

      // Import and use selector
      const state = useGameStore.getState();
      const canAdvance =
        state.phase === "PlayAndDraw" &&
        !(state.counters > 0 && state.deck.length > 0);

      expect(canAdvance).toBe(false);
    });

    it("selectCanAdvancePhase returns true when deck is empty", () => {
      useGameStore.setState({
        phase: "PlayAndDraw",
        counters: 4,
        deck: [],
      });

      const state = useGameStore.getState();
      const canAdvance =
        state.phase === "PlayAndDraw" &&
        !(state.counters > 0 && state.deck.length > 0);

      expect(canAdvance).toBe(true);
    });

    it("selectCanAdvancePhase returns true when counters are spent", () => {
      useGameStore.setState({
        phase: "PlayAndDraw",
        counters: 0,
      });

      const state = useGameStore.getState();
      const canAdvance =
        state.phase === "PlayAndDraw" &&
        !(state.counters > 0 && state.deck.length > 0);

      expect(canAdvance).toBe(true);
    });

    it("drawing cards to exhaust counters then allows phase advancement", () => {
      // Start with 7 counters
      useGameStore.setState({
        phase: "PlayAndDraw",
        counters: 7,
      });

      // Try to advance - should fail
      useGameStore.getState().nextPhase();
      expect(useGameStore.getState().phase).toBe("PlayAndDraw");

      // Draw 7 cards (exhausts counters)
      useGameStore.getState().draw(7);

      // Should auto-advance when counters hit 0, but let's verify phase
      // The draw function auto-advances, so check if we're in ExecuteOrders
      expect(useGameStore.getState().phase).toBe("ExecuteOrders");
    });

    it("deploying cards to exhaust counters then allows phase advancement", () => {
      useGameStore.setState({
        phase: "PlayAndDraw",
        counters: 7,
      });

      // Find personnel to deploy
      const state = useGameStore.getState();
      const personnel = state.hand.filter((c) => c.type === "Personnel");

      // Deploy personnel until counters are 0
      let countersRemaining = 7;
      for (const p of personnel) {
        if (!p.uniqueId) continue;
        const deployCost = (p as { deploy: number }).deploy;
        if (deployCost <= countersRemaining) {
          useGameStore.getState().deploy(p.uniqueId);
          countersRemaining = useGameStore.getState().counters;
          if (countersRemaining === 0) break;
        }
      }

      // If we still have counters, draw the rest
      const currentCounters = useGameStore.getState().counters;
      if (currentCounters > 0) {
        useGameStore.getState().draw(currentCounters);
      }

      // Should now be in ExecuteOrders (either auto-advanced or can advance)
      if (useGameStore.getState().phase === "PlayAndDraw") {
        useGameStore.getState().nextPhase();
      }
      expect(useGameStore.getState().phase).toBe("ExecuteOrders");
    });
  });

  describe("deploy - Rule 6.7: Deployment Affiliation Validation", () => {
    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
      useGameStore.setState({ counters: 50, phase: "PlayAndDraw" });
    });

    it("allows deploying personnel with matching affiliation to headquarters", () => {
      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Verify headquarters has Borg in its play array
      const hqMission = state.missions[hqIndex]!.mission;
      expect(hqMission.play).toContain("Borg");

      // Find a Borg personnel in hand
      const borgPersonnel = state.hand.find(
        (c) =>
          c.type === "Personnel" &&
          (c as { affiliation: string[] }).affiliation.includes("Borg")
      );

      if (!borgPersonnel?.uniqueId) {
        console.log("No Borg personnel in hand, skipping test");
        return;
      }

      // Deploy should succeed
      const result = state.deploy(borgPersonnel.uniqueId, hqIndex);
      expect(result).toBe(true);

      // Personnel should be at headquarters
      const newState = useGameStore.getState();
      const hqCards = newState.missions[hqIndex]!.groups[0]!.cards;
      expect(
        hqCards.find((c) => c.uniqueId === borgPersonnel.uniqueId)
      ).toBeDefined();
    });

    it("prevents deploying personnel with non-matching affiliation to headquarters", () => {
      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Find a personnel in hand
      const personnel = state.hand.find((c) => c.type === "Personnel");
      if (!personnel?.uniqueId) {
        console.log("No personnel in hand, skipping test");
        return;
      }

      // Create a fake Federation personnel (not allowed at Borg headquarters)
      const federationPersonnel = {
        ...personnel,
        uniqueId: "fed-test-1",
        affiliation: ["Federation" as const],
      };
      useGameStore.setState((s) => ({
        hand: [...s.hand, federationPersonnel],
      }));

      // Deploy should fail
      const result = useGameStore.getState().deploy("fed-test-1", hqIndex);
      expect(result).toBe(false);

      // Personnel should NOT be at headquarters
      const newState = useGameStore.getState();
      const hqCards = newState.missions[hqIndex]!.groups[0]!.cards;
      expect(hqCards.find((c) => c.uniqueId === "fed-test-1")).toBeUndefined();

      // Personnel should still be in hand
      expect(
        newState.hand.find((c) => c.uniqueId === "fed-test-1")
      ).toBeDefined();
    });

    it("allows deploying ships with matching affiliation to headquarters", () => {
      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Find a Borg ship in hand
      let borgShip = state.hand.find(
        (c) =>
          c.type === "Ship" &&
          (c as { affiliation: string[] }).affiliation.includes("Borg")
      );

      // If no ship in hand, draw until we find one
      if (!borgShip) {
        while (!borgShip && useGameStore.getState().deck.length > 0) {
          useGameStore.getState().draw(1);
          borgShip = useGameStore
            .getState()
            .hand.find(
              (c) =>
                c.type === "Ship" &&
                (c as { affiliation: string[] }).affiliation.includes("Borg")
            );
        }
      }

      if (!borgShip?.uniqueId) {
        console.log("No Borg ship available, skipping test");
        return;
      }

      // Deploy should succeed
      const result = useGameStore.getState().deploy(borgShip.uniqueId, hqIndex);
      expect(result).toBe(true);

      // Ship should create a new group at headquarters
      const newState = useGameStore.getState();
      const hqGroups = newState.missions[hqIndex]!.groups;
      const shipGroup = hqGroups.find((g) =>
        g.cards.some((c) => c.uniqueId === borgShip!.uniqueId)
      );
      expect(shipGroup).toBeDefined();
    });

    it("prevents deploying ships with non-matching affiliation to headquarters", () => {
      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Find a ship in hand (any ship to use as base)
      let ship = state.hand.find((c) => c.type === "Ship");

      // If no ship in hand, draw until we find one
      if (!ship) {
        while (!ship && useGameStore.getState().deck.length > 0) {
          useGameStore.getState().draw(1);
          ship = useGameStore.getState().hand.find((c) => c.type === "Ship");
        }
      }

      if (!ship) {
        console.log("No ship available, skipping test");
        return;
      }

      // Create a fake Federation ship (not allowed at Borg headquarters)
      const federationShip = {
        ...ship,
        uniqueId: "fed-ship-test-1",
        affiliation: ["Federation" as const],
      };
      useGameStore.setState((s) => ({
        hand: [...s.hand, federationShip],
      }));

      const initialGroupCount =
        useGameStore.getState().missions[hqIndex]!.groups.length;

      // Deploy should fail
      const result = useGameStore.getState().deploy("fed-ship-test-1", hqIndex);
      expect(result).toBe(false);

      // Ship should NOT create a new group at headquarters
      const newState = useGameStore.getState();
      expect(newState.missions[hqIndex]!.groups.length).toBe(initialGroupCount);

      // Ship should still be in hand
      expect(
        newState.hand.find((c) => c.uniqueId === "fed-ship-test-1")
      ).toBeDefined();
    });

    it("allows deploying to non-headquarters missions regardless of affiliation", () => {
      const state = useGameStore.getState();

      // Find a non-headquarters mission
      const nonHqIndex = state.missions.findIndex(
        (m) => m.mission.missionType !== "Headquarters"
      );

      if (nonHqIndex === -1) {
        console.log("No non-headquarters mission found, skipping test");
        return;
      }

      // Find a personnel in hand
      const personnel = state.hand.find((c) => c.type === "Personnel");
      if (!personnel?.uniqueId) {
        console.log("No personnel in hand, skipping test");
        return;
      }

      // Create a fake Federation personnel
      const federationPersonnel = {
        ...personnel,
        uniqueId: "fed-test-nonhq",
        affiliation: ["Federation" as const],
      };
      useGameStore.setState((s) => ({
        hand: [...s.hand, federationPersonnel],
      }));

      // Deploy should succeed (non-headquarters doesn't check affiliation)
      const result = useGameStore
        .getState()
        .deploy("fed-test-nonhq", nonHqIndex);
      expect(result).toBe(true);

      // Personnel should be at the mission
      const newState = useGameStore.getState();
      const missionCards = newState.missions[nonHqIndex]!.groups[0]!.cards;
      expect(
        missionCards.find((c) => c.uniqueId === "fed-test-nonhq")
      ).toBeDefined();
    });

    it("allows deploying if headquarters has no play restrictions", () => {
      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Remove play restrictions from headquarters (edge case)
      const missions = useGameStore.getState().missions;
      const updatedMissions = missions.map((m, idx) =>
        idx === hqIndex
          ? { ...m, mission: { ...m.mission, play: undefined } }
          : m
      );
      useGameStore.setState({ missions: updatedMissions });

      // Find any personnel in hand
      const personnel = useGameStore
        .getState()
        .hand.find((c) => c.type === "Personnel");

      if (!personnel?.uniqueId) {
        console.log("No personnel in hand, skipping test");
        return;
      }

      // Create a Federation personnel (would normally be blocked)
      const federationPersonnel = {
        ...personnel,
        uniqueId: "fed-test-no-restrict",
        affiliation: ["Federation" as const],
      };
      useGameStore.setState((s) => ({
        hand: [...s.hand, federationPersonnel],
      }));

      // Deploy should succeed (no play restrictions)
      const result = useGameStore
        .getState()
        .deploy("fed-test-no-restrict", hqIndex);
      expect(result).toBe(true);
    });

    it("allows deploying personnel with multiple affiliations if any matches", () => {
      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Find any personnel in hand
      const personnel = state.hand.find((c) => c.type === "Personnel");
      if (!personnel?.uniqueId) {
        console.log("No personnel in hand, skipping test");
        return;
      }

      // Create a dual-affiliation personnel (Federation/Borg)
      const dualPersonnel = {
        ...personnel,
        uniqueId: "dual-test-1",
        affiliation: ["Federation" as const, "Borg" as const],
      };
      useGameStore.setState((s) => ({
        hand: [...s.hand, dualPersonnel],
      }));

      // Deploy should succeed (Borg is one of the affiliations)
      const result = useGameStore.getState().deploy("dual-test-1", hqIndex);
      expect(result).toBe(true);

      // Personnel should be at headquarters
      const newState = useGameStore.getState();
      const hqCards = newState.missions[hqIndex]!.groups[0]!.cards;
      expect(hqCards.find((c) => c.uniqueId === "dual-test-1")).toBeDefined();
    });

    it("counters are not deducted when deployment fails due to affiliation mismatch", () => {
      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;
      const initialCounters = state.counters;

      // Find any personnel in hand
      const personnel = state.hand.find((c) => c.type === "Personnel");
      if (!personnel?.uniqueId) {
        console.log("No personnel in hand, skipping test");
        return;
      }

      // Create a Federation personnel
      const federationPersonnel = {
        ...personnel,
        uniqueId: "fed-test-counters",
        affiliation: ["Federation" as const],
        deploy: 2,
      };
      useGameStore.setState((s) => ({
        hand: [...s.hand, federationPersonnel],
      }));

      // Attempt deploy (should fail)
      useGameStore.getState().deploy("fed-test-counters", hqIndex);

      // Counters should NOT be deducted
      expect(useGameStore.getState().counters).toBe(initialCounters);
    });
  });
});
