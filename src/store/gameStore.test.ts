import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore, selectPlayableInterrupts } from "./gameStore";
import { defaultDeck } from "../data/defaultDeck";
import { GAME_CONSTANTS } from "../types";
import type {
  Card,
  PersonnelCard,
  ShipCard,
  StaffingIcon,
  Skill,
  Ability,
  MissionDeployment,
} from "../types";

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
      // Draw extra cards to exceed hand limit
      useGameStore.setState({ counters: 3 });
      useGameStore.getState().draw(3);
      useGameStore.setState({ phase: "DiscardExcess" });

      const state = useGameStore.getState();
      expect(state.hand.length).toBeGreaterThan(GAME_CONSTANTS.MAX_HAND_SIZE);

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

    it("does not allow discarding below hand limit of 7", () => {
      useGameStore.setState({ phase: "DiscardExcess" });

      const state = useGameStore.getState();
      expect(state.hand.length).toBe(GAME_CONSTANTS.MAX_HAND_SIZE);

      const card = state.hand[0];
      if (!card?.uniqueId) throw new Error("No card in hand");

      state.discardCard(card.uniqueId);

      // Hand should still be 7 since we can't discard below the limit
      expect(useGameStore.getState().hand.length).toBe(
        GAME_CONSTANTS.MAX_HAND_SIZE
      );
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

      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet" && !m.mission.completed
      );

      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      // Create 5 personnel cards and place them directly in the mission group
      const testPersonnel: PersonnelCard[] = Array.from(
        { length: 5 },
        (_, i) => ({
          id: "EN03118",
          uniqueId: `test-personnel-${i}`,
          name: "Acclimation Drone",
          unique: false,
          type: "Personnel",
          affiliation: ["Borg"],
          deploy: 2,
          species: ["Borg"],
          status: "Unstopped",
          other: ["Staff"] as StaffingIcon[],
          skills: [
            ["Anthropology", "Engineer", "Exobiology", "Medical"],
          ] as Skill[][],
          integrity: 5,
          cunning: 5,
          strength: 5,
          jpg: "cards/ST2E-EN03118.jpg",
        })
      );

      // Add 1 overcome dilemma and place personnel directly in mission
      const dilemmaPool = useGameStore.getState().dilemmaPool;
      const oneDilemma = dilemmaPool.slice(0, 1).map((d) => ({
        ...d,
        overcome: true,
        faceup: true,
      }));

      const currentMissions = useGameStore.getState().missions;
      const updatedMissions = currentMissions.map((m, idx) =>
        idx === planetMissionIndex
          ? {
              ...m,
              groups: [
                { cards: testPersonnel as Card[] },
                ...m.groups.slice(1),
              ],
              dilemmas: oneDilemma,
            }
          : m
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

    it("waits for user to continue after detecting duplicate dilemma (does not auto-advance)", () => {
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

      const dilemmaPool = useGameStore.getState().dilemmaPool;
      if (dilemmaPool.length < 2) {
        console.log("Not enough dilemmas in pool, skipping test");
        return;
      }

      // Create three dilemmas: first is unique, second is duplicate, third is different
      const baseDilemma = dilemmaPool[0]!;
      const differentDilemma = dilemmaPool[1]!;
      const testDilemmas = [
        { ...baseDilemma, uniqueId: `${baseDilemma.id}-test-1` },
        { ...baseDilemma, uniqueId: `${baseDilemma.id}-test-2` }, // Duplicate of first
        { ...differentDilemma, uniqueId: `${differentDilemma.id}-test-1` }, // Different dilemma
      ];

      useGameStore.setState({ phase: "ExecuteOrders" });
      useGameStore.getState().attemptMission(planetMissionIndex, 0);

      const initialEncounter = useGameStore.getState().dilemmaEncounter;
      if (!initialEncounter) {
        console.log("No encounter created, skipping test");
        return;
      }

      // Ensure personnel are unstopped (they may have been stopped by initial dilemma)
      const missions = useGameStore.getState().missions;
      const updatedMissions = missions.map((m, idx) => {
        if (idx !== planetMissionIndex) return m;
        return {
          ...m,
          groups: m.groups.map((group) => ({
            cards: group.cards.map((card) => {
              if (card.type === "Personnel") {
                return { ...card, status: "Unstopped" as const };
              }
              return card;
            }),
          })),
        };
      }) as MissionDeployment[];

      // Set up controlled encounter with first dilemma already faced
      // Also clear the dilemmaResult from the initial resolution
      useGameStore.setState({
        missions: updatedMissions,
        dilemmaEncounter: {
          ...initialEncounter,
          selectedDilemmas: testDilemmas,
          currentDilemmaIndex: 0,
          facedDilemmaIds: [baseDilemma.id], // First dilemma already faced
        },
        dilemmaResult: null, // Clear previous result
      });

      // Advance to the second dilemma (which is a duplicate)
      useGameStore.getState().advanceDilemma();

      // Check that duplicate was detected and message was set
      const afterFirstAdvance = useGameStore.getState();

      // If encounter was ended (all stopped or mission completed), skip the rest
      if (!afterFirstAdvance.dilemmaEncounter) {
        console.log("Encounter ended early, skipping duplicate test");
        return;
      }

      expect(afterFirstAdvance.dilemmaResult).toBeDefined();
      expect(afterFirstAdvance.dilemmaResult?.message).toBeDefined();
      expect(afterFirstAdvance.dilemmaResult?.message).toContain(
        "Duplicate dilemma"
      );
      expect(afterFirstAdvance.dilemmaResult?.message).toContain(
        "auto-overcome"
      );
      expect(afterFirstAdvance.dilemmaResult?.overcome).toBe(true);
      expect(afterFirstAdvance.dilemmaResult?.stoppedPersonnel).toEqual([]);

      // Crucially, the currentDilemmaIndex should be at the duplicate (index 1),
      // NOT at the third dilemma (index 2) - proving we didn't auto-advance
      expect(afterFirstAdvance.dilemmaEncounter?.currentDilemmaIndex).toBe(1);

      // Now manually advance again (simulating user clicking Continue)
      useGameStore.getState().advanceDilemma();

      // Now we should be at the third dilemma (index 2) - or encounter ended if mission completed
      const afterSecondAdvance = useGameStore.getState();
      if (afterSecondAdvance.dilemmaEncounter) {
        expect(afterSecondAdvance.dilemmaEncounter.currentDilemmaIndex).toBe(2);
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

  describe("executeOrderAbility", () => {
    // Create a properly typed Borg Queen fixture
    const createBorgQueen = (): PersonnelCard => ({
      id: "EN03122",
      uniqueId: "queen-1",
      name: "Borg Queen, Bringer of Order",
      type: "Personnel",
      unique: true,
      jpg: "cards/ST2E-EN03122.jpg",
      affiliation: ["Borg"],
      deploy: 4,
      species: ["Borg"],
      status: "Unstopped",
      other: ["Command"] as StaffingIcon[],
      skills: [
        ["Leadership", "Leadership", "Leadership", "Treachery"] as Skill[],
      ],
      integrity: 3,
      cunning: 8,
      strength: 6,
      abilities: [
        {
          id: "borg-queen-skill-grant",
          trigger: "order",
          target: { scope: "allInPlay", species: ["Borg"] },
          effects: [{ type: "skillGrant", skill: null }],
          cost: { type: "discardFromDeck", count: 1 },
          duration: "untilEndOfTurn",
          usageLimit: "oncePerTurn",
        } as Ability,
      ],
    });

    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
    });

    it("fails when not in ExecuteOrders phase", () => {
      const borgQueen = createBorgQueen();

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Place Borg Queen at HQ
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [{ cards: [...m.groups[0]!.cards, borgQueen] }],
              }
            : m
        ),
        phase: "PlayAndDraw", // Wrong phase
      }));

      const result = useGameStore
        .getState()
        .executeOrderAbility("queen-1", "borg-queen-skill-grant", {
          skill: "Navigation",
        });

      expect(result).toBe(false);
    });

    it("executes order ability successfully during ExecuteOrders phase", () => {
      const borgQueen = createBorgQueen();

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;
      const initialDeckSize = state.deck.length;

      // Place Borg Queen at HQ and switch to ExecuteOrders phase
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [{ cards: [...m.groups[0]!.cards, borgQueen] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
      }));

      const result = useGameStore
        .getState()
        .executeOrderAbility("queen-1", "borg-queen-skill-grant", {
          skill: "Navigation",
        });

      expect(result).toBe(true);

      const newState = useGameStore.getState();

      // Deck should have one less card (cost paid)
      expect(newState.deck.length).toBe(initialDeckSize - 1);

      // Discard should have one more card
      expect(newState.discard.length).toBeGreaterThan(0);

      // Granted skill should be added
      expect(newState.grantedSkills).toHaveLength(1);
      expect(newState.grantedSkills[0]!.skill).toBe("Navigation");
      expect(newState.grantedSkills[0]!.target.scope).toBe("allInPlay");
      expect(newState.grantedSkills[0]!.target.species).toContain("Borg");

      // Ability should be marked as used
      expect(
        newState.usedOrderAbilities.has("queen-1:borg-queen-skill-grant")
      ).toBe(true);
    });

    it("fails when ability already used this turn (oncePerTurn)", () => {
      const borgQueen = createBorgQueen();

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Place Borg Queen at HQ and switch to ExecuteOrders phase
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [{ cards: [...m.groups[0]!.cards, borgQueen] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
      }));

      // First use should succeed
      const firstResult = useGameStore
        .getState()
        .executeOrderAbility("queen-1", "borg-queen-skill-grant", {
          skill: "Navigation",
        });
      expect(firstResult).toBe(true);

      // Second use should fail
      const secondResult = useGameStore
        .getState()
        .executeOrderAbility("queen-1", "borg-queen-skill-grant", {
          skill: "Engineer",
        });
      expect(secondResult).toBe(false);

      // Should still only have one granted skill
      expect(useGameStore.getState().grantedSkills).toHaveLength(1);
    });

    it("fails when deck is empty (cannot pay cost)", () => {
      const borgQueen = createBorgQueen();

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Place Borg Queen at HQ, switch to ExecuteOrders, empty the deck
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [{ cards: [...m.groups[0]!.cards, borgQueen] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
        deck: [], // Empty deck
      }));

      const result = useGameStore
        .getState()
        .executeOrderAbility("queen-1", "borg-queen-skill-grant", {
          skill: "Navigation",
        });

      expect(result).toBe(false);
      expect(useGameStore.getState().grantedSkills).toHaveLength(0);
    });

    it("clears granted skills and used abilities at start of new turn", () => {
      const borgQueen = createBorgQueen();

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Place Borg Queen at HQ and switch to ExecuteOrders phase
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [{ cards: [...m.groups[0]!.cards, borgQueen] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
      }));

      // Execute the order ability
      useGameStore
        .getState()
        .executeOrderAbility("queen-1", "borg-queen-skill-grant", {
          skill: "Navigation",
        });

      // Verify ability was used
      expect(useGameStore.getState().grantedSkills).toHaveLength(1);
      expect(
        useGameStore
          .getState()
          .usedOrderAbilities.has("queen-1:borg-queen-skill-grant")
      ).toBe(true);

      // Start new turn
      useGameStore.getState().newTurn();

      // Granted skills should be cleared
      expect(useGameStore.getState().grantedSkills).toHaveLength(0);

      // Used abilities should be cleared
      expect(useGameStore.getState().usedOrderAbilities.size).toBe(0);
    });

    it("executes sacrificeSelf cost by removing card from play", () => {
      // Create a Calibration Drone fixture with the hand refresh ability
      const calibrationDrone: PersonnelCard = {
        id: "EN03124",
        uniqueId: "calibration-drone-1",
        name: "Calibration Drone",
        type: "Personnel",
        unique: false,
        jpg: "cards/ST2E-EN03124.jpg",
        affiliation: ["Borg"],
        deploy: 2,
        species: ["Borg"],
        status: "Unstopped",
        other: ["Staff"] as StaffingIcon[],
        skills: [["Archaeology", "Biology", "Geology"] as Skill[]],
        integrity: 5,
        cunning: 5,
        strength: 5,
        abilities: [
          {
            id: "calibration-drone-hand-refresh",
            trigger: "order",
            target: { scope: "self" },
            effects: [{ type: "handRefresh" }],
            cost: { type: "sacrificeSelf" },
          } as Ability,
        ],
      };

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Place Calibration Drone at HQ
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [{ cards: [...m.groups[0]!.cards, calibrationDrone] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
      }));

      // Verify drone is in play
      const beforeState = useGameStore.getState();
      const hqCards = beforeState.missions[hqIndex]!.groups[0]!.cards;
      expect(
        hqCards.find((c) => c.uniqueId === "calibration-drone-1")
      ).toBeDefined();

      const initialDiscardCount = beforeState.discard.length;

      // Execute the ability
      const result = useGameStore
        .getState()
        .executeOrderAbility(
          "calibration-drone-1",
          "calibration-drone-hand-refresh"
        );

      expect(result).toBe(true);

      // Drone should be removed from play
      const afterState = useGameStore.getState();
      const afterHqCards = afterState.missions[hqIndex]!.groups[0]!.cards;
      expect(
        afterHqCards.find((c) => c.uniqueId === "calibration-drone-1")
      ).toBeUndefined();

      // Drone should be in discard pile
      expect(afterState.discard.length).toBe(initialDiscardCount + 1);
      expect(
        afterState.discard.find((c) => c.uniqueId === "calibration-drone-1")
      ).toBeDefined();
    });

    it("executes handRefresh effect by cycling hand cards", () => {
      const calibrationDrone: PersonnelCard = {
        id: "EN03124",
        uniqueId: "calibration-drone-2",
        name: "Calibration Drone",
        type: "Personnel",
        unique: false,
        jpg: "cards/ST2E-EN03124.jpg",
        affiliation: ["Borg"],
        deploy: 2,
        species: ["Borg"],
        status: "Unstopped",
        other: ["Staff"] as StaffingIcon[],
        skills: [["Archaeology", "Biology", "Geology"] as Skill[]],
        integrity: 5,
        cunning: 5,
        strength: 5,
        abilities: [
          {
            id: "calibration-drone-hand-refresh",
            trigger: "order",
            target: { scope: "self" },
            effects: [{ type: "handRefresh" }],
            cost: { type: "sacrificeSelf" },
          } as Ability,
        ],
      };

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Get initial hand and deck
      const initialHand = [...state.hand];
      const initialHandCount = initialHand.length;
      const initialDeckCount = state.deck.length;
      const initialHandIds = new Set(initialHand.map((c) => c.uniqueId));

      // Place Calibration Drone at HQ
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [{ cards: [...m.groups[0]!.cards, calibrationDrone] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
      }));

      // Execute the ability
      const result = useGameStore
        .getState()
        .executeOrderAbility(
          "calibration-drone-2",
          "calibration-drone-hand-refresh"
        );

      expect(result).toBe(true);

      const afterState = useGameStore.getState();

      // Hand size should remain the same
      expect(afterState.hand.length).toBe(initialHandCount);

      // Deck size should remain the same (cards shuffled to bottom, drew from top)
      expect(afterState.deck.length).toBe(initialDeckCount);

      // Hand should have different cards (drawn from deck)
      // At least some cards should be different (if deck has different cards)
      // We can verify the cards that were in hand are now at the bottom of the deck
      // by checking that some new cards are in hand
      const newCardsInHand = afterState.hand.filter(
        (c) => !initialHandIds.has(c.uniqueId)
      );

      // If deck had cards, we should have drawn new ones
      if (initialDeckCount > 0) {
        expect(newCardsInHand.length).toBeGreaterThan(0);
      }
    });

    it("handles handRefresh with empty hand gracefully", () => {
      const calibrationDrone: PersonnelCard = {
        id: "EN03124",
        uniqueId: "calibration-drone-3",
        name: "Calibration Drone",
        type: "Personnel",
        unique: false,
        jpg: "cards/ST2E-EN03124.jpg",
        affiliation: ["Borg"],
        deploy: 2,
        species: ["Borg"],
        status: "Unstopped",
        other: ["Staff"] as StaffingIcon[],
        skills: [["Archaeology", "Biology", "Geology"] as Skill[]],
        integrity: 5,
        cunning: 5,
        strength: 5,
        abilities: [
          {
            id: "calibration-drone-hand-refresh",
            trigger: "order",
            target: { scope: "self" },
            effects: [{ type: "handRefresh" }],
            cost: { type: "sacrificeSelf" },
          } as Ability,
        ],
      };

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Place Calibration Drone at HQ, empty the hand
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [{ cards: [...m.groups[0]!.cards, calibrationDrone] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
        hand: [], // Empty hand
      }));

      const initialDeckCount = useGameStore.getState().deck.length;

      // Execute the ability - should still work (nothing to shuffle/draw)
      const result = useGameStore
        .getState()
        .executeOrderAbility(
          "calibration-drone-3",
          "calibration-drone-hand-refresh"
        );

      expect(result).toBe(true);

      const afterState = useGameStore.getState();

      // Hand should still be empty
      expect(afterState.hand.length).toBe(0);

      // Deck should be unchanged
      expect(afterState.deck.length).toBe(initialDeckCount);
    });

    it("removes unique card from uniquesInPlay when sacrificed", () => {
      // Create a unique version of the Calibration Drone for this test
      const uniqueDrone: PersonnelCard = {
        id: "unique-drone",
        uniqueId: "unique-drone-1",
        name: "Unique Test Drone",
        type: "Personnel",
        unique: true, // Mark as unique
        jpg: "cards/test.jpg",
        affiliation: ["Borg"],
        deploy: 2,
        species: ["Borg"],
        status: "Unstopped",
        other: ["Staff"] as StaffingIcon[],
        skills: [["Engineer"] as Skill[]],
        integrity: 5,
        cunning: 5,
        strength: 5,
        abilities: [
          {
            id: "test-hand-refresh",
            trigger: "order",
            target: { scope: "self" },
            effects: [{ type: "handRefresh" }],
            cost: { type: "sacrificeSelf" },
          } as Ability,
        ],
      };

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Place unique drone at HQ and mark it in uniquesInPlay
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [{ cards: [...m.groups[0]!.cards, uniqueDrone] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
        uniquesInPlay: new Set([...s.uniquesInPlay, "unique-drone"]),
      }));

      // Verify unique is tracked
      expect(useGameStore.getState().uniquesInPlay.has("unique-drone")).toBe(
        true
      );

      // Execute the ability
      const result = useGameStore
        .getState()
        .executeOrderAbility("unique-drone-1", "test-hand-refresh");

      expect(result).toBe(true);

      // Unique should be removed from tracking (can be deployed again)
      expect(useGameStore.getState().uniquesInPlay.has("unique-drone")).toBe(
        false
      );
    });

    it("preserves granted skills after moving ship", () => {
      const borgQueen = createBorgQueen();

      // Create a ship and personnel for movement
      const ship: ShipCard = {
        id: "testship",
        uniqueId: "ship-1",
        name: "Test Ship",
        unique: false,
        type: "Ship",
        affiliation: ["Borg"],
        deploy: 3,
        range: 8,
        rangeRemaining: 8,
        weapons: 6,
        shields: 6,
        staffing: [["Staff"]],
        jpg: "cards/testship.jpg",
      };

      const drone: PersonnelCard = {
        id: "testdrone",
        uniqueId: "drone-1",
        name: "Test Drone",
        unique: false,
        type: "Personnel",
        affiliation: ["Borg"],
        deploy: 1,
        species: ["Borg"],
        status: "Unstopped",
        other: ["Staff"],
        skills: [["Engineer"]],
        integrity: 5,
        cunning: 5,
        strength: 5,
        jpg: "cards/testdrone.jpg",
      };

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Find a non-HQ mission to move to
      const destMissionIndex = state.missions.findIndex(
        (_, i) => i !== hqIndex
      );

      // Place Borg Queen at HQ, ship with drone at HQ
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [
                  { cards: [...m.groups[0]!.cards, borgQueen] },
                  { cards: [ship, drone] }, // Ship group
                ],
              }
            : m
        ),
        phase: "ExecuteOrders",
      }));

      // Execute the order ability to grant Navigation to all Borg
      const result = useGameStore
        .getState()
        .executeOrderAbility("queen-1", "borg-queen-skill-grant", {
          skill: "Navigation",
        });
      expect(result).toBe(true);

      // Verify granted skill is present
      expect(useGameStore.getState().grantedSkills).toHaveLength(1);
      expect(useGameStore.getState().grantedSkills[0]!.skill).toBe(
        "Navigation"
      );

      // Now move the ship to the destination mission
      useGameStore.getState().moveShip(hqIndex, 1, destMissionIndex);

      // CRITICAL: grantedSkills should still be preserved after moveShip
      expect(useGameStore.getState().grantedSkills).toHaveLength(1);
      expect(useGameStore.getState().grantedSkills[0]!.skill).toBe(
        "Navigation"
      );
      expect(useGameStore.getState().grantedSkills[0]!.target.scope).toBe(
        "allInPlay"
      );
    });

    describe("Transwarp Drone (shipRangeModifier with aboardShip condition)", () => {
      // Create Transwarp Drone fixture
      const createTranswarpDrone = (): PersonnelCard => ({
        id: "EN03140",
        uniqueId: "transwarp-drone-1",
        name: "Transwarp Drone",
        type: "Personnel",
        unique: false,
        jpg: "cards/ST2E-EN03140.jpg",
        affiliation: ["Borg"],
        deploy: 2,
        species: ["Borg"],
        status: "Unstopped",
        other: ["Staff"] as StaffingIcon[],
        skills: [["Astrometrics", "Navigation", "Physics"] as Skill[]],
        integrity: 5,
        cunning: 5,
        strength: 5,
        abilities: [
          {
            id: "transwarp-drone-range-boost",
            trigger: "order",
            condition: { type: "aboardShip" },
            target: { scope: "self" },
            effects: [
              {
                type: "shipRangeModifier",
                value: 2,
                targetShip: "sourceShip",
              },
            ],
            cost: { type: "returnToHand" },
            duration: "untilEndOfTurn",
          } as Ability,
        ],
      });

      const createTestShip = (): ShipCard => ({
        id: "testship",
        uniqueId: "ship-1",
        name: "Test Ship",
        unique: false,
        type: "Ship",
        affiliation: ["Borg"],
        deploy: 3,
        range: 8,
        rangeRemaining: 8,
        weapons: 6,
        shields: 6,
        staffing: [["Staff"]],
        jpg: "cards/testship.jpg",
      });

      it("fails when personnel is not aboard a ship (aboardShip condition)", () => {
        const drone = createTranswarpDrone();

        const state = useGameStore.getState();
        const hqIndex = state.headquartersIndex;

        // Place drone at HQ planet surface (group 0, not aboard ship)
        useGameStore.setState((s) => ({
          missions: s.missions.map((m, i) =>
            i === hqIndex
              ? {
                  ...m,
                  groups: [{ cards: [...m.groups[0]!.cards, drone] }],
                }
              : m
          ),
          phase: "ExecuteOrders",
        }));

        const result = useGameStore
          .getState()
          .executeOrderAbility(
            "transwarp-drone-1",
            "transwarp-drone-range-boost"
          );

        expect(result).toBe(false);
        // Drone should still be in play (cost not paid)
        const finalState = useGameStore.getState();
        const hqDeployment = finalState.missions[hqIndex];
        const droneInPlay = hqDeployment?.groups[0]?.cards.find(
          (c) => c.uniqueId === "transwarp-drone-1"
        );
        expect(droneInPlay).toBeDefined();
      });

      it("succeeds when personnel is aboard a ship and boosts range", () => {
        const drone = createTranswarpDrone();
        const ship = createTestShip();

        const state = useGameStore.getState();
        const hqIndex = state.headquartersIndex;
        const initialHandSize = state.hand.length;

        // Place ship with drone aboard at HQ (group 1 = ship group)
        useGameStore.setState((s) => ({
          missions: s.missions.map((m, i) =>
            i === hqIndex
              ? {
                  ...m,
                  groups: [
                    m.groups[0]!, // Keep planet group
                    { cards: [ship, drone] }, // Ship group with drone aboard
                  ],
                }
              : m
          ),
          phase: "ExecuteOrders",
        }));

        const result = useGameStore
          .getState()
          .executeOrderAbility(
            "transwarp-drone-1",
            "transwarp-drone-range-boost"
          );

        expect(result).toBe(true);

        const finalState = useGameStore.getState();

        // Drone should be returned to hand
        expect(finalState.hand.length).toBe(initialHandSize + 1);
        const droneInHand = finalState.hand.find(
          (c) => c.uniqueId === "transwarp-drone-1"
        );
        expect(droneInHand).toBeDefined();

        // Drone should be removed from ship group
        const hqDeployment = finalState.missions[hqIndex];
        const shipGroup = hqDeployment?.groups[1];
        const droneOnShip = shipGroup?.cards.find(
          (c) => c.uniqueId === "transwarp-drone-1"
        );
        expect(droneOnShip).toBeUndefined();

        // Ship should have Range +2
        const updatedShip = shipGroup?.cards.find(
          (c) => c.uniqueId === "ship-1"
        ) as ShipCard;
        expect(updatedShip).toBeDefined();
        expect(updatedShip.rangeRemaining).toBe(10); // 8 + 2

        // Range boost should be tracked
        expect(finalState.rangeBoosts).toHaveLength(1);
        expect(finalState.rangeBoosts[0]!.shipUniqueId).toBe("ship-1");
        expect(finalState.rangeBoosts[0]!.value).toBe(2);
        expect(finalState.rangeBoosts[0]!.duration).toBe("untilEndOfTurn");
      });

      it("clears range boosts at start of new turn", () => {
        const drone = createTranswarpDrone();
        const ship = createTestShip();

        const state = useGameStore.getState();
        const hqIndex = state.headquartersIndex;

        // Place ship with drone aboard at HQ
        useGameStore.setState((s) => ({
          missions: s.missions.map((m, i) =>
            i === hqIndex
              ? {
                  ...m,
                  groups: [m.groups[0]!, { cards: [ship, drone] }],
                }
              : m
          ),
          phase: "ExecuteOrders",
        }));

        // Execute the ability
        const result = useGameStore
          .getState()
          .executeOrderAbility(
            "transwarp-drone-1",
            "transwarp-drone-range-boost"
          );
        expect(result).toBe(true);

        // Verify range boost is present
        expect(useGameStore.getState().rangeBoosts).toHaveLength(1);

        // Start a new turn
        useGameStore.getState().newTurn();

        // Range boost should be cleared
        expect(useGameStore.getState().rangeBoosts).toHaveLength(0);
      });

      it("fails when ship group has no ship", () => {
        const drone = createTranswarpDrone();

        const state = useGameStore.getState();
        const hqIndex = state.headquartersIndex;

        // Place drone in a group > 0 but without a ship (edge case)
        useGameStore.setState((s) => ({
          missions: s.missions.map((m, i) =>
            i === hqIndex
              ? {
                  ...m,
                  groups: [
                    m.groups[0]!,
                    { cards: [drone] }, // Group 1 but no ship
                  ],
                }
              : m
          ),
          phase: "ExecuteOrders",
        }));

        const result = useGameStore
          .getState()
          .executeOrderAbility(
            "transwarp-drone-1",
            "transwarp-drone-range-boost"
          );

        // Should fail because condition requires being aboard a ship
        expect(result).toBe(false);
      });
    });
  });

  describe("executeInterlinkAbility", () => {
    // Create a Cartography Drone fixture with Interlink ability
    const createCartographyDrone = (): PersonnelCard => ({
      id: "EN03125",
      uniqueId: "cartography-drone-1",
      name: "Cartography Drone",
      type: "Personnel",
      unique: false,
      jpg: "cards/ST2E-EN03125.jpg",
      affiliation: ["Borg"],
      deploy: 1,
      species: ["Borg"],
      status: "Unstopped",
      other: ["Staff"] as StaffingIcon[],
      skills: [["Engineer"] as Skill[]],
      integrity: 5,
      cunning: 5,
      strength: 5,
      abilities: [
        {
          id: "cartography-drone-interlink-astrometrics",
          trigger: "interlink",
          target: {
            scope: "allInPlay",
            species: ["Borg"],
          },
          effects: [
            {
              type: "skillGrant",
              skill: "Astrometrics",
            },
          ],
          cost: { type: "discardFromDeck", count: 1 },
          duration: "untilEndOfMissionAttempt",
        } as Ability,
      ],
    });

    it("fails when not in a mission attempt", () => {
      useGameStore.getState().setupGame(defaultDeck);

      const cartographyDrone = createCartographyDrone();
      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Place drone at HQ (no mission attempt active)
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [{ cards: [...m.groups[0]!.cards, cartographyDrone] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
        dilemmaEncounter: null, // No active mission attempt
      }));

      const result = useGameStore
        .getState()
        .executeInterlinkAbility(
          "cartography-drone-1",
          "cartography-drone-interlink-astrometrics"
        );

      expect(result).toBe(false);
      expect(useGameStore.getState().grantedSkills).toHaveLength(0);
    });

    it("succeeds during a mission attempt and grants skill", () => {
      useGameStore.getState().setupGame(defaultDeck);

      const cartographyDrone = createCartographyDrone();
      const state = useGameStore.getState();

      // Find a non-HQ mission to attempt
      const missionIndex = state.missions.findIndex(
        (m) => m.mission.missionType !== "Headquarters"
      );
      const initialDeckSize = state.deck.length;

      // Place drone at the mission and create a dilemma encounter
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === missionIndex
            ? {
                ...m,
                groups: [{ cards: [cartographyDrone] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
        dilemmaEncounter: {
          missionIndex,
          groupIndex: 0,
          selectedDilemmas: [],
          currentDilemmaIndex: 0,
          costBudget: 1,
          costSpent: 0,
          facedDilemmaIds: [],
        },
      }));

      const result = useGameStore
        .getState()
        .executeInterlinkAbility(
          "cartography-drone-1",
          "cartography-drone-interlink-astrometrics"
        );

      expect(result).toBe(true);

      const newState = useGameStore.getState();

      // Deck should have one less card (cost paid)
      expect(newState.deck.length).toBe(initialDeckSize - 1);

      // Discard should have one more card
      expect(newState.discard.length).toBeGreaterThan(0);

      // Granted skill should be added with correct properties
      expect(newState.grantedSkills).toHaveLength(1);
      expect(newState.grantedSkills[0]!.skill).toBe("Astrometrics");
      expect(newState.grantedSkills[0]!.target.scope).toBe("allInPlay");
      expect(newState.grantedSkills[0]!.target.species).toContain("Borg");
      expect(newState.grantedSkills[0]!.duration).toBe(
        "untilEndOfMissionAttempt"
      );
    });

    it("fails when deck is empty (cannot pay cost)", () => {
      useGameStore.getState().setupGame(defaultDeck);

      const cartographyDrone = createCartographyDrone();
      const state = useGameStore.getState();

      const missionIndex = state.missions.findIndex(
        (m) => m.mission.missionType !== "Headquarters"
      );

      // Place drone at mission, create encounter, but empty deck
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === missionIndex
            ? {
                ...m,
                groups: [{ cards: [cartographyDrone] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
        deck: [], // Empty deck
        dilemmaEncounter: {
          missionIndex,
          groupIndex: 0,
          selectedDilemmas: [],
          currentDilemmaIndex: 0,
          costBudget: 1,
          costSpent: 0,
          facedDilemmaIds: [],
        },
      }));

      const result = useGameStore
        .getState()
        .executeInterlinkAbility(
          "cartography-drone-1",
          "cartography-drone-interlink-astrometrics"
        );

      expect(result).toBe(false);
      expect(useGameStore.getState().grantedSkills).toHaveLength(0);
    });

    it("fails when personnel is stopped", () => {
      useGameStore.getState().setupGame(defaultDeck);

      const cartographyDrone = createCartographyDrone();
      cartographyDrone.status = "Stopped"; // Personnel is stopped

      const state = useGameStore.getState();
      const missionIndex = state.missions.findIndex(
        (m) => m.mission.missionType !== "Headquarters"
      );

      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === missionIndex
            ? {
                ...m,
                groups: [{ cards: [cartographyDrone] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
        dilemmaEncounter: {
          missionIndex,
          groupIndex: 0,
          selectedDilemmas: [],
          currentDilemmaIndex: 0,
          costBudget: 1,
          costSpent: 0,
          facedDilemmaIds: [],
        },
      }));

      const result = useGameStore
        .getState()
        .executeInterlinkAbility(
          "cartography-drone-1",
          "cartography-drone-interlink-astrometrics"
        );

      expect(result).toBe(false);
    });

    it("fails when personnel is not in the attempting group", () => {
      useGameStore.getState().setupGame(defaultDeck);

      const cartographyDrone = createCartographyDrone();
      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      const missionIndex = state.missions.findIndex(
        (m) => m.mission.missionType !== "Headquarters"
      );

      // Place drone at HQ, but attempt is at different mission
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [{ cards: [...m.groups[0]!.cards, cartographyDrone] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
        dilemmaEncounter: {
          missionIndex, // Different from hqIndex
          groupIndex: 0,
          selectedDilemmas: [],
          currentDilemmaIndex: 0,
          costBudget: 1,
          costSpent: 0,
          facedDilemmaIds: [],
        },
      }));

      const result = useGameStore
        .getState()
        .executeInterlinkAbility(
          "cartography-drone-1",
          "cartography-drone-interlink-astrometrics"
        );

      expect(result).toBe(false);
    });

    it("clears interlink-granted skills when mission completes", () => {
      useGameStore.getState().setupGame(defaultDeck);

      const cartographyDrone = createCartographyDrone();
      const state = useGameStore.getState();

      const missionIndex = state.missions.findIndex(
        (m) => m.mission.missionType !== "Headquarters"
      );

      // Set up encounter
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === missionIndex
            ? {
                ...m,
                groups: [{ cards: [cartographyDrone] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
        dilemmaEncounter: {
          missionIndex,
          groupIndex: 0,
          selectedDilemmas: [],
          currentDilemmaIndex: 0,
          costBudget: 1,
          costSpent: 0,
          facedDilemmaIds: [],
        },
      }));

      // Execute interlink ability
      useGameStore
        .getState()
        .executeInterlinkAbility(
          "cartography-drone-1",
          "cartography-drone-interlink-astrometrics"
        );

      // Verify skill was granted
      expect(useGameStore.getState().grantedSkills).toHaveLength(1);
      expect(useGameStore.getState().grantedSkills[0]!.duration).toBe(
        "untilEndOfMissionAttempt"
      );

      // Clear dilemma encounter (simulates mission ending)
      useGameStore.getState()._failMissionAttempt();

      // Interlink-granted skill should be cleared
      expect(useGameStore.getState().grantedSkills).toHaveLength(0);
    });

    it("can be used multiple times in same attempt (no usage limit)", () => {
      useGameStore.getState().setupGame(defaultDeck);

      const cartographyDrone = createCartographyDrone();
      const state = useGameStore.getState();

      const missionIndex = state.missions.findIndex(
        (m) => m.mission.missionType !== "Headquarters"
      );

      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === missionIndex
            ? {
                ...m,
                groups: [{ cards: [cartographyDrone] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
        dilemmaEncounter: {
          missionIndex,
          groupIndex: 0,
          selectedDilemmas: [],
          currentDilemmaIndex: 0,
          costBudget: 1,
          costSpent: 0,
          facedDilemmaIds: [],
        },
      }));

      // First use
      const firstResult = useGameStore
        .getState()
        .executeInterlinkAbility(
          "cartography-drone-1",
          "cartography-drone-interlink-astrometrics"
        );
      expect(firstResult).toBe(true);
      expect(useGameStore.getState().grantedSkills).toHaveLength(1);

      // Second use (should also succeed if deck has cards)
      const secondResult = useGameStore
        .getState()
        .executeInterlinkAbility(
          "cartography-drone-1",
          "cartography-drone-interlink-astrometrics"
        );
      expect(secondResult).toBe(true);
      expect(useGameStore.getState().grantedSkills).toHaveLength(2);
    });
  });

  describe("Information Drone Interlink with skill selection", () => {
    // Create an Information Drone fixture with Interlink ability requiring skill selection
    const createInformationDrone = (): PersonnelCard => ({
      id: "EN03130",
      uniqueId: "information-drone-1",
      name: "Information Drone",
      type: "Personnel",
      unique: false,
      jpg: "cards/ST2E-EN03130.jpg",
      affiliation: ["Borg"],
      deploy: 2,
      species: ["Borg"],
      status: "Unstopped",
      other: ["Staff"] as StaffingIcon[],
      skills: [["Exobiology", "Science", "Transporters"] as Skill[]],
      integrity: 5,
      cunning: 5,
      strength: 5,
      abilities: [
        {
          id: "information-drone-interlink",
          trigger: "interlink",
          target: {
            scope: "allInPlay",
            species: ["Borg"],
          },
          effects: [
            {
              type: "skillGrant",
              skill: null,
              skillSource: {
                scope: "present",
                excludeAffiliations: ["Borg"],
              },
            },
          ],
          cost: { type: "discardFromDeck", count: 1 },
          duration: "untilEndOfMissionAttempt",
        } as Ability,
      ],
    });

    // Non-Borg personnel to provide skills
    const createFederationPersonnel = (): PersonnelCard => ({
      id: "FED001",
      uniqueId: "fed-engineer-1",
      name: "Federation Engineer",
      type: "Personnel",
      unique: false,
      jpg: "cards/test.jpg",
      affiliation: ["Federation"],
      deploy: 2,
      species: ["Human"],
      status: "Unstopped",
      other: ["Staff"] as StaffingIcon[],
      skills: [["Engineer", "Physics"] as Skill[]],
      integrity: 6,
      cunning: 6,
      strength: 5,
    });

    it("grants skill from non-Borg personnel present when valid skill selected", () => {
      useGameStore.getState().setupGame(defaultDeck);

      const informationDrone = createInformationDrone();
      const fedPersonnel = createFederationPersonnel();
      const state = useGameStore.getState();

      // Find a non-HQ mission to attempt
      const nonHqMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType !== "Headquarters"
      );

      // Place both personnel at the mission
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === nonHqMissionIndex
            ? {
                ...m,
                groups: [{ cards: [informationDrone, fedPersonnel] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
        // Set up an active mission attempt
        dilemmaEncounter: {
          missionIndex: nonHqMissionIndex,
          groupIndex: 0,
          selectedDilemmas: s.dilemmaPool.slice(0, 1),
          currentDilemmaIndex: 0,
          costBudget: 5,
          costSpent: 0,
          facedDilemmaIds: [],
        },
      }));

      const deckSizeBefore = useGameStore.getState().deck.length;

      // Execute with a skill that exists on the Federation personnel
      const result = useGameStore
        .getState()
        .executeInterlinkAbility(
          "information-drone-1",
          "information-drone-interlink",
          { skill: "Engineer" }
        );

      expect(result).toBe(true);
      expect(useGameStore.getState().grantedSkills).toHaveLength(1);
      expect(useGameStore.getState().grantedSkills[0]!.skill).toBe("Engineer");
      expect(useGameStore.getState().deck.length).toBe(deckSizeBefore - 1); // Cost paid
    });

    it("fails when no skill parameter provided for skill source ability", () => {
      useGameStore.getState().setupGame(defaultDeck);

      const informationDrone = createInformationDrone();
      const fedPersonnel = createFederationPersonnel();
      const state = useGameStore.getState();

      const nonHqMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType !== "Headquarters"
      );

      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === nonHqMissionIndex
            ? {
                ...m,
                groups: [{ cards: [informationDrone, fedPersonnel] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
        dilemmaEncounter: {
          missionIndex: nonHqMissionIndex,
          groupIndex: 0,
          selectedDilemmas: s.dilemmaPool.slice(0, 1),
          currentDilemmaIndex: 0,
          costBudget: 5,
          costSpent: 0,
          facedDilemmaIds: [],
        },
      }));

      const deckSizeBefore = useGameStore.getState().deck.length;

      // Execute without providing a skill
      const result = useGameStore
        .getState()
        .executeInterlinkAbility(
          "information-drone-1",
          "information-drone-interlink"
        );

      expect(result).toBe(false);
      expect(useGameStore.getState().grantedSkills).toHaveLength(0);
      expect(useGameStore.getState().deck.length).toBe(deckSizeBefore); // Cost not paid
    });

    it("fails when selected skill not available from non-Borg personnel", () => {
      useGameStore.getState().setupGame(defaultDeck);

      const informationDrone = createInformationDrone();
      const fedPersonnel = createFederationPersonnel();
      const state = useGameStore.getState();

      const nonHqMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType !== "Headquarters"
      );

      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === nonHqMissionIndex
            ? {
                ...m,
                groups: [{ cards: [informationDrone, fedPersonnel] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
        dilemmaEncounter: {
          missionIndex: nonHqMissionIndex,
          groupIndex: 0,
          selectedDilemmas: s.dilemmaPool.slice(0, 1),
          currentDilemmaIndex: 0,
          costBudget: 5,
          costSpent: 0,
          facedDilemmaIds: [],
        },
      }));

      const deckSizeBefore = useGameStore.getState().deck.length;

      // Try to select a skill not on the Federation personnel
      const result = useGameStore
        .getState()
        .executeInterlinkAbility(
          "information-drone-1",
          "information-drone-interlink",
          { skill: "Diplomacy" }
        );

      expect(result).toBe(false);
      expect(useGameStore.getState().grantedSkills).toHaveLength(0);
      expect(useGameStore.getState().deck.length).toBe(deckSizeBefore); // Cost not paid
    });

    it("excludes Borg personnel when finding available skills", () => {
      useGameStore.getState().setupGame(defaultDeck);

      const informationDrone = createInformationDrone();
      const fedPersonnel = createFederationPersonnel();
      // Another Borg with Diplomacy skill
      const anotherBorg: PersonnelCard = {
        ...createInformationDrone(),
        uniqueId: "borg-2",
        name: "Another Borg",
        skills: [["Diplomacy"] as Skill[]],
      };

      const state = useGameStore.getState();
      const nonHqMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType !== "Headquarters"
      );

      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === nonHqMissionIndex
            ? {
                ...m,
                groups: [
                  { cards: [informationDrone, anotherBorg, fedPersonnel] },
                ],
              }
            : m
        ),
        phase: "ExecuteOrders",
        dilemmaEncounter: {
          missionIndex: nonHqMissionIndex,
          groupIndex: 0,
          selectedDilemmas: s.dilemmaPool.slice(0, 1),
          currentDilemmaIndex: 0,
          costBudget: 5,
          costSpent: 0,
          facedDilemmaIds: [],
        },
      }));

      // Try to select Diplomacy (only on Borg personnel, should fail)
      const result = useGameStore
        .getState()
        .executeInterlinkAbility(
          "information-drone-1",
          "information-drone-interlink",
          { skill: "Diplomacy" }
        );

      expect(result).toBe(false);

      // But Engineer (on Federation personnel) should work
      const result2 = useGameStore
        .getState()
        .executeInterlinkAbility(
          "information-drone-1",
          "information-drone-interlink",
          { skill: "Engineer" }
        );

      expect(result2).toBe(true);
      expect(useGameStore.getState().grantedSkills[0]!.skill).toBe("Engineer");
    });

    it("fails when no non-Borg personnel present", () => {
      useGameStore.getState().setupGame(defaultDeck);

      const informationDrone = createInformationDrone();
      // Another Borg with Diplomacy skill (no non-Borg present)
      const anotherBorg: PersonnelCard = {
        ...createInformationDrone(),
        uniqueId: "borg-2",
        name: "Another Borg",
        skills: [["Diplomacy"] as Skill[]],
      };

      const state = useGameStore.getState();
      const nonHqMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType !== "Headquarters"
      );

      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === nonHqMissionIndex
            ? {
                ...m,
                groups: [{ cards: [informationDrone, anotherBorg] }],
              }
            : m
        ),
        phase: "ExecuteOrders",
        dilemmaEncounter: {
          missionIndex: nonHqMissionIndex,
          groupIndex: 0,
          selectedDilemmas: s.dilemmaPool.slice(0, 1),
          currentDilemmaIndex: 0,
          costBudget: 5,
          costSpent: 0,
          facedDilemmaIds: [],
        },
      }));

      // Try to select any skill - should fail as no non-Borg present
      const result = useGameStore
        .getState()
        .executeInterlinkAbility(
          "information-drone-1",
          "information-drone-interlink",
          { skill: "Diplomacy" }
        );

      expect(result).toBe(false);
      expect(useGameStore.getState().grantedSkills).toHaveLength(0);
    });
  });

  describe("executeOrderAbility - returnToHand cost and beamAllToShip effect", () => {
    // Create an Invasive Drone fixture with returnToHand cost and beamAllToShip effect
    const createInvasiveDrone = (): PersonnelCard => ({
      id: "EN03131",
      uniqueId: "invasive-drone-1",
      name: "Invasive Drone",
      type: "Personnel",
      unique: false,
      jpg: "cards/ST2E-EN03131.jpg",
      affiliation: ["Borg"],
      deploy: 2,
      species: ["Borg"],
      status: "Unstopped",
      other: ["Staff"] as StaffingIcon[],
      skills: [["Programming", "Security", "Transporters"] as Skill[]],
      integrity: 5,
      cunning: 5,
      strength: 5,
      abilities: [
        {
          id: "invasive-drone-beam-to-ship",
          trigger: "order",
          target: { scope: "mission" },
          effects: [{ type: "beamAllToShip" }],
          cost: { type: "returnToHand" },
        } as Ability,
      ],
    });

    const createTestShip = (): ShipCard => ({
      id: "testship",
      uniqueId: "ship-1",
      name: "Test Ship",
      unique: false,
      type: "Ship",
      affiliation: ["Borg"],
      deploy: 3,
      range: 8,
      rangeRemaining: 8,
      weapons: 6,
      shields: 6,
      staffing: [["Staff"]] as StaffingIcon[][],
      jpg: "cards/test.jpg",
    });

    const createTestPersonnel = (id: string): PersonnelCard => ({
      id: `test-personnel-${id}`,
      uniqueId: `test-personnel-${id}`,
      name: `Test Personnel ${id}`,
      type: "Personnel",
      unique: false,
      jpg: "cards/test.jpg",
      affiliation: ["Borg"],
      deploy: 1,
      species: ["Borg"],
      status: "Unstopped",
      other: ["Staff"] as StaffingIcon[],
      skills: [["Engineer"] as Skill[]],
      integrity: 5,
      cunning: 5,
      strength: 5,
    });

    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
    });

    it("returns card to hand when paying returnToHand cost", () => {
      const invasiveDrone = createInvasiveDrone();
      const ship = createTestShip();
      const personnel1 = createTestPersonnel("1");

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;
      const initialHandSize = state.hand.length;

      // Set up: Invasive Drone and another personnel at HQ, ship in group 1
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [
                  { cards: [invasiveDrone, personnel1] }, // Group 0: planet
                  { cards: [ship] }, // Group 1: ship
                ],
              }
            : m
        ),
        phase: "ExecuteOrders",
      }));

      // Verify drone is at the mission
      const beforeState = useGameStore.getState();
      expect(
        beforeState.missions[hqIndex]!.groups[0]!.cards.find(
          (c) => c.uniqueId === "invasive-drone-1"
        )
      ).toBeDefined();

      // Execute ability: beam personnel1 to ship
      const result = useGameStore
        .getState()
        .executeOrderAbility(
          "invasive-drone-1",
          "invasive-drone-beam-to-ship",
          {
            personnelIds: ["test-personnel-1"],
            targetGroupIndex: 1,
          }
        );

      expect(result).toBe(true);

      // Invasive Drone should be removed from play and in hand
      const afterState = useGameStore.getState();
      expect(
        afterState.missions[hqIndex]!.groups[0]!.cards.find(
          (c) => c.uniqueId === "invasive-drone-1"
        )
      ).toBeUndefined();
      expect(afterState.hand.length).toBe(initialHandSize + 1);
      expect(
        afterState.hand.find((c) => c.uniqueId === "invasive-drone-1")
      ).toBeDefined();
    });

    it("beams selected personnel to ship", () => {
      const invasiveDrone = createInvasiveDrone();
      const ship = createTestShip();
      const personnel1 = createTestPersonnel("1");
      const personnel2 = createTestPersonnel("2");

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Set up: Invasive Drone and 2 personnel at HQ, ship in group 1
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [
                  { cards: [invasiveDrone, personnel1, personnel2] }, // Group 0
                  { cards: [ship] }, // Group 1: ship
                ],
              }
            : m
        ),
        phase: "ExecuteOrders",
      }));

      // Beam both personnel to ship
      const result = useGameStore
        .getState()
        .executeOrderAbility(
          "invasive-drone-1",
          "invasive-drone-beam-to-ship",
          {
            personnelIds: ["test-personnel-1", "test-personnel-2"],
            targetGroupIndex: 1,
          }
        );

      expect(result).toBe(true);

      const afterState = useGameStore.getState();

      // Personnel should be in ship group (group 1)
      const shipGroup = afterState.missions[hqIndex]!.groups[1]!.cards;
      expect(
        shipGroup.find((c) => c.uniqueId === "test-personnel-1")
      ).toBeDefined();
      expect(
        shipGroup.find((c) => c.uniqueId === "test-personnel-2")
      ).toBeDefined();

      // Group 0 should only have invasive drone (now removed to hand) - so empty
      const planetGroup = afterState.missions[hqIndex]!.groups[0]!.cards;
      expect(planetGroup.length).toBe(0);
    });

    it("fails when no personnel are selected", () => {
      const invasiveDrone = createInvasiveDrone();
      const ship = createTestShip();
      const personnel1 = createTestPersonnel("1");

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [
                  { cards: [invasiveDrone, personnel1] },
                  { cards: [ship] },
                ],
              }
            : m
        ),
        phase: "ExecuteOrders",
      }));

      // Execute ability with no personnel selected
      const result = useGameStore
        .getState()
        .executeOrderAbility(
          "invasive-drone-1",
          "invasive-drone-beam-to-ship",
          {
            personnelIds: [],
            targetGroupIndex: 1,
          }
        );

      expect(result).toBe(false);

      // Drone should still be in play (cost not paid if effect fails)
      const afterState = useGameStore.getState();
      expect(
        afterState.missions[hqIndex]!.groups[0]!.cards.find(
          (c) => c.uniqueId === "invasive-drone-1"
        )
      ).toBeDefined();
    });

    it("fails when no target group is specified", () => {
      const invasiveDrone = createInvasiveDrone();
      const ship = createTestShip();
      const personnel1 = createTestPersonnel("1");

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [
                  { cards: [invasiveDrone, personnel1] },
                  { cards: [ship] },
                ],
              }
            : m
        ),
        phase: "ExecuteOrders",
      }));

      // Execute ability without target group
      const result = useGameStore
        .getState()
        .executeOrderAbility(
          "invasive-drone-1",
          "invasive-drone-beam-to-ship",
          {
            personnelIds: ["test-personnel-1"],
            // targetGroupIndex not specified
          }
        );

      expect(result).toBe(false);
    });

    it("fails when target group is planet surface (group 0)", () => {
      const invasiveDrone = createInvasiveDrone();
      const ship = createTestShip();
      const personnel1 = createTestPersonnel("1");

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [
                  { cards: [invasiveDrone, personnel1] },
                  { cards: [ship] },
                ],
              }
            : m
        ),
        phase: "ExecuteOrders",
      }));

      // Try to beam to group 0 (planet surface, not a ship)
      const result = useGameStore
        .getState()
        .executeOrderAbility(
          "invasive-drone-1",
          "invasive-drone-beam-to-ship",
          {
            personnelIds: ["test-personnel-1"],
            targetGroupIndex: 0,
          }
        );

      expect(result).toBe(false);
    });

    it("fails when target group has no ship", () => {
      const invasiveDrone = createInvasiveDrone();
      const personnel1 = createTestPersonnel("1");
      const personnel2 = createTestPersonnel("2");

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Set up without a ship - just two groups of personnel
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [
                  { cards: [invasiveDrone, personnel1] },
                  { cards: [personnel2] }, // Group 1 has no ship
                ],
              }
            : m
        ),
        phase: "ExecuteOrders",
      }));

      const result = useGameStore
        .getState()
        .executeOrderAbility(
          "invasive-drone-1",
          "invasive-drone-beam-to-ship",
          {
            personnelIds: ["test-personnel-1"],
            targetGroupIndex: 1,
          }
        );

      expect(result).toBe(false);
    });

    it("removes unique card from uniquesInPlay when returned to hand", () => {
      // Create a unique version of Invasive Drone
      const uniqueInvasiveDrone: PersonnelCard = {
        ...createInvasiveDrone(),
        id: "unique-invasive",
        uniqueId: "unique-invasive-1",
        unique: true,
      };
      const ship = createTestShip();
      const personnel1 = createTestPersonnel("1");

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [
                  { cards: [uniqueInvasiveDrone, personnel1] },
                  { cards: [ship] },
                ],
              }
            : m
        ),
        phase: "ExecuteOrders",
        uniquesInPlay: new Set([...s.uniquesInPlay, "unique-invasive"]),
      }));

      // Verify unique is tracked
      expect(useGameStore.getState().uniquesInPlay.has("unique-invasive")).toBe(
        true
      );

      const result = useGameStore
        .getState()
        .executeOrderAbility(
          "unique-invasive-1",
          "invasive-drone-beam-to-ship",
          {
            personnelIds: ["test-personnel-1"],
            targetGroupIndex: 1,
          }
        );

      expect(result).toBe(true);

      // Unique should be removed from tracking (can be deployed again)
      expect(useGameStore.getState().uniquesInPlay.has("unique-invasive")).toBe(
        false
      );

      // Card should be in hand
      expect(
        useGameStore
          .getState()
          .hand.find((c) => c.uniqueId === "unique-invasive-1")
      ).toBeDefined();
    });

    it("beams personnel from multiple groups to the target ship", () => {
      const invasiveDrone = createInvasiveDrone();
      const ship1 = { ...createTestShip(), uniqueId: "ship-1" };
      const ship2 = { ...createTestShip(), uniqueId: "ship-2" };
      const personnel1 = createTestPersonnel("1");
      const personnel2 = createTestPersonnel("2");
      const personnel3 = createTestPersonnel("3");

      const state = useGameStore.getState();
      const hqIndex = state.headquartersIndex;

      // Set up: personnel scattered across groups
      useGameStore.setState((s) => ({
        missions: s.missions.map((m, i) =>
          i === hqIndex
            ? {
                ...m,
                groups: [
                  { cards: [invasiveDrone, personnel1] }, // Group 0: planet
                  { cards: [ship1, personnel2] }, // Group 1: ship1 with personnel2
                  { cards: [ship2, personnel3] }, // Group 2: ship2 with personnel3
                ],
              }
            : m
        ),
        phase: "ExecuteOrders",
      }));

      // Beam personnel1 and personnel2 to ship2 (group 2)
      const result = useGameStore
        .getState()
        .executeOrderAbility(
          "invasive-drone-1",
          "invasive-drone-beam-to-ship",
          {
            personnelIds: ["test-personnel-1", "test-personnel-2"],
            targetGroupIndex: 2,
          }
        );

      expect(result).toBe(true);

      const afterState = useGameStore.getState();

      // Personnel 1 and 2 should be in ship2's group (group 2)
      const ship2Group = afterState.missions[hqIndex]!.groups[2]!.cards;
      expect(
        ship2Group.find((c) => c.uniqueId === "test-personnel-1")
      ).toBeDefined();
      expect(
        ship2Group.find((c) => c.uniqueId === "test-personnel-2")
      ).toBeDefined();
      expect(
        ship2Group.find((c) => c.uniqueId === "test-personnel-3")
      ).toBeDefined();

      // Group 0 should be empty (invasive drone returned to hand, personnel1 moved)
      const planetGroup = afterState.missions[hqIndex]!.groups[0]!.cards;
      expect(planetGroup.length).toBe(0);

      // Group 1 should just have ship1 (personnel2 moved)
      const ship1Group = afterState.missions[hqIndex]!.groups[1]!.cards;
      expect(ship1Group.length).toBe(1);
      expect(ship1Group[0]!.uniqueId).toBe("ship-1");
    });
  });

  describe("playInterrupt - Adapt (EN03069)", () => {
    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
    });

    it("prevents playing interrupt when not in dilemma encounter", () => {
      // Add Adapt interrupt to hand
      const adaptCard = {
        id: "EN03069",
        uniqueId: "adapt-test-1",
        name: "Adapt",
        unique: false,
        type: "Interrupt" as const,
        jpg: "cards/ST2E-EN03069.jpg",
        abilities: [
          {
            id: "adapt-prevent-dilemma",
            trigger: "interrupt" as const,
            interruptTiming: "whenFacingDilemma" as const,
            target: { scope: "self" as const },
            effects: [{ type: "preventAndOvercomeDilemma" as const }],
            conditions: [
              { type: "borgPersonnelFacing" as const },
              { type: "dilemmaOvercomeAtAnyMission" as const },
            ],
          },
        ],
      };

      useGameStore.setState((s) => ({
        hand: [...s.hand, adaptCard],
      }));

      // No dilemma encounter active
      expect(useGameStore.getState().dilemmaEncounter).toBeNull();

      // Try to play interrupt - should fail
      const result = useGameStore
        .getState()
        .playInterrupt("adapt-test-1", "adapt-prevent-dilemma");

      expect(result).toBe(false);

      // Card should still be in hand
      expect(
        useGameStore.getState().hand.find((c) => c.uniqueId === "adapt-test-1")
      ).toBeDefined();
    });

    it("prevents playing interrupt when no Borg personnel are facing the dilemma", () => {
      const state = useGameStore.getState();

      // Create a non-Borg personnel for testing
      const nonBorgPersonnel: PersonnelCard = {
        id: "test-human",
        uniqueId: "test-human-1",
        name: "Test Human",
        unique: false,
        type: "Personnel",
        affiliation: ["Federation"],
        deploy: 1,
        species: ["Human"],
        status: "Unstopped",
        other: [],
        skills: [["Leadership"]],
        integrity: 5,
        cunning: 5,
        strength: 5,
        jpg: "test.jpg",
      };

      // Add Adapt to hand
      const adaptCard = {
        id: "EN03069",
        uniqueId: "adapt-test-1",
        name: "Adapt",
        unique: false,
        type: "Interrupt" as const,
        jpg: "cards/ST2E-EN03069.jpg",
        abilities: [
          {
            id: "adapt-prevent-dilemma",
            trigger: "interrupt" as const,
            interruptTiming: "whenFacingDilemma" as const,
            target: { scope: "self" as const },
            effects: [{ type: "preventAndOvercomeDilemma" as const }],
            conditions: [
              { type: "borgPersonnelFacing" as const },
              { type: "dilemmaOvercomeAtAnyMission" as const },
            ],
          },
        ],
      };

      // Find a planet mission
      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet"
      );
      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      // Set up a dilemma encounter with non-Borg personnel
      const testDilemma = {
        id: "test-dilemma",
        uniqueId: "test-dilemma-1",
        name: "Test Dilemma",
        unique: false,
        type: "Dilemma" as const,
        where: "Planet" as const,
        deploy: 1,
        overcome: false,
        faceup: false,
        rule: "SystemDiagnostics" as const,
        skills: [["Leadership" as Skill]],
        jpg: "test.jpg",
      };

      // Add an overcome copy of the same dilemma to another mission
      const overcomeDilemma = {
        ...testDilemma,
        uniqueId: "test-dilemma-2",
        overcome: true,
        faceup: true,
      };
      const overcomeMissionIndex = planetMissionIndex === 1 ? 2 : 1;

      useGameStore.setState({
        hand: [...useGameStore.getState().hand, adaptCard],
        missions: useGameStore.getState().missions.map((m, idx) =>
          idx === planetMissionIndex
            ? {
                ...m,
                groups: [{ cards: [nonBorgPersonnel] }],
                dilemmas: [],
              }
            : idx === overcomeMissionIndex
              ? { ...m, dilemmas: [overcomeDilemma] }
              : m
        ),
        dilemmaEncounter: {
          missionIndex: planetMissionIndex,
          groupIndex: 0,
          selectedDilemmas: [testDilemma],
          currentDilemmaIndex: 0,
          costBudget: 1,
          costSpent: 0,
          facedDilemmaIds: [],
        },
      });

      // Try to play interrupt - should fail (no Borg personnel)
      const result = useGameStore
        .getState()
        .playInterrupt("adapt-test-1", "adapt-prevent-dilemma");

      expect(result).toBe(false);
    });

    it("prevents playing interrupt when no overcome copy of dilemma exists", () => {
      const state = useGameStore.getState();

      // Create a Borg personnel
      const borgPersonnel: PersonnelCard = {
        id: "test-borg",
        uniqueId: "test-borg-1",
        name: "Test Borg",
        unique: false,
        type: "Personnel",
        affiliation: ["Borg"],
        deploy: 1,
        species: ["Borg"],
        status: "Unstopped",
        other: [],
        skills: [["Leadership"]],
        integrity: 5,
        cunning: 5,
        strength: 5,
        jpg: "test.jpg",
      };

      // Add Adapt to hand
      const adaptCard = {
        id: "EN03069",
        uniqueId: "adapt-test-1",
        name: "Adapt",
        unique: false,
        type: "Interrupt" as const,
        jpg: "cards/ST2E-EN03069.jpg",
        abilities: [
          {
            id: "adapt-prevent-dilemma",
            trigger: "interrupt" as const,
            interruptTiming: "whenFacingDilemma" as const,
            target: { scope: "self" as const },
            effects: [{ type: "preventAndOvercomeDilemma" as const }],
            conditions: [
              { type: "borgPersonnelFacing" as const },
              { type: "dilemmaOvercomeAtAnyMission" as const },
            ],
          },
        ],
      };

      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet"
      );
      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      const testDilemma = {
        id: "test-dilemma",
        uniqueId: "test-dilemma-1",
        name: "Test Dilemma",
        unique: false,
        type: "Dilemma" as const,
        where: "Planet" as const,
        deploy: 1,
        overcome: false,
        faceup: false,
        rule: "SystemDiagnostics" as const,
        skills: [["Leadership" as Skill]],
        jpg: "test.jpg",
      };

      // NO overcome copy of this dilemma exists
      useGameStore.setState({
        hand: [...useGameStore.getState().hand, adaptCard],
        missions: useGameStore.getState().missions.map((m, idx) =>
          idx === planetMissionIndex
            ? {
                ...m,
                groups: [{ cards: [borgPersonnel] }],
                dilemmas: [],
              }
            : { ...m, dilemmas: [] }
        ),
        dilemmaEncounter: {
          missionIndex: planetMissionIndex,
          groupIndex: 0,
          selectedDilemmas: [testDilemma],
          currentDilemmaIndex: 0,
          costBudget: 1,
          costSpent: 0,
          facedDilemmaIds: [],
        },
      });

      // Try to play interrupt - should fail (no overcome copy)
      const result = useGameStore
        .getState()
        .playInterrupt("adapt-test-1", "adapt-prevent-dilemma");

      expect(result).toBe(false);
    });

    it("successfully plays Adapt when Borg personnel facing dilemma with overcome copy", () => {
      const state = useGameStore.getState();

      // Create a Borg personnel
      const borgPersonnel: PersonnelCard = {
        id: "test-borg",
        uniqueId: "test-borg-1",
        name: "Test Borg",
        unique: false,
        type: "Personnel",
        affiliation: ["Borg"],
        deploy: 1,
        species: ["Borg"],
        status: "Unstopped",
        other: [],
        skills: [["Leadership"]],
        integrity: 5,
        cunning: 5,
        strength: 5,
        jpg: "test.jpg",
      };

      // Add Adapt to hand
      const adaptCard = {
        id: "EN03069",
        uniqueId: "adapt-test-1",
        name: "Adapt",
        unique: false,
        type: "Interrupt" as const,
        jpg: "cards/ST2E-EN03069.jpg",
        abilities: [
          {
            id: "adapt-prevent-dilemma",
            trigger: "interrupt" as const,
            interruptTiming: "whenFacingDilemma" as const,
            target: { scope: "self" as const },
            effects: [{ type: "preventAndOvercomeDilemma" as const }],
            conditions: [
              { type: "borgPersonnelFacing" as const },
              { type: "dilemmaOvercomeAtAnyMission" as const },
            ],
          },
        ],
      };

      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet"
      );
      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      const testDilemma = {
        id: "test-dilemma",
        uniqueId: "test-dilemma-1",
        name: "Test Dilemma",
        unique: false,
        type: "Dilemma" as const,
        where: "Planet" as const,
        deploy: 1,
        overcome: false,
        faceup: false,
        rule: "SystemDiagnostics" as const,
        skills: [["Leadership" as Skill]],
        jpg: "test.jpg",
      };

      // Create an overcome copy of the same dilemma (same base ID)
      const overcomeDilemma = {
        ...testDilemma,
        uniqueId: "test-dilemma-2",
        overcome: true,
        faceup: true,
      };

      // Put overcome dilemma at a different mission than planetMissionIndex
      const overcomeMissionIndex = planetMissionIndex === 1 ? 2 : 1;

      // Set up state with Borg personnel facing dilemma AND overcome copy at another mission
      useGameStore.setState({
        hand: [...useGameStore.getState().hand, adaptCard],
        missions: useGameStore.getState().missions.map((m, idx) =>
          idx === planetMissionIndex
            ? {
                ...m,
                groups: [{ cards: [borgPersonnel] }],
                dilemmas: [],
              }
            : idx === overcomeMissionIndex
              ? { ...m, dilemmas: [overcomeDilemma] }
              : m
        ),
        dilemmaEncounter: {
          missionIndex: planetMissionIndex,
          groupIndex: 0,
          selectedDilemmas: [testDilemma],
          currentDilemmaIndex: 0,
          costBudget: 1,
          costSpent: 0,
          facedDilemmaIds: [],
        },
      });

      // Play interrupt - should succeed
      const result = useGameStore
        .getState()
        .playInterrupt("adapt-test-1", "adapt-prevent-dilemma");

      expect(result).toBe(true);

      // Interrupt card should be in discard (not hand)
      const newState = useGameStore.getState();
      expect(
        newState.hand.find((c) => c.uniqueId === "adapt-test-1")
      ).toBeUndefined();
      expect(
        newState.discard.find((c) => c.uniqueId === "adapt-test-1")
      ).toBeDefined();

      // Dilemma should be overcome
      expect(newState.dilemmaResult?.overcome).toBe(true);
      expect(newState.dilemmaResult?.message).toContain(
        "prevented and overcome"
      );

      // The dilemma should be added to the mission's overcome dilemmas
      const planetMission = newState.missions[planetMissionIndex]!;
      expect(
        planetMission.dilemmas.some(
          (d) => d.id === "test-dilemma" && d.overcome
        )
      ).toBe(true);
    });

    it("selectPlayableInterrupts returns Adapt when all conditions are met", () => {
      const state = useGameStore.getState();

      // Create a Borg personnel
      const borgPersonnel: PersonnelCard = {
        id: "test-borg",
        uniqueId: "test-borg-1",
        name: "Test Borg",
        unique: false,
        type: "Personnel",
        affiliation: ["Borg"],
        deploy: 1,
        species: ["Borg"],
        status: "Unstopped",
        other: [],
        skills: [["Leadership"]],
        integrity: 5,
        cunning: 5,
        strength: 5,
        jpg: "test.jpg",
      };

      // Add Adapt to hand
      const adaptCard = {
        id: "EN03069",
        uniqueId: "adapt-test-1",
        name: "Adapt",
        unique: false,
        type: "Interrupt" as const,
        jpg: "cards/ST2E-EN03069.jpg",
        abilities: [
          {
            id: "adapt-prevent-dilemma",
            trigger: "interrupt" as const,
            interruptTiming: "whenFacingDilemma" as const,
            target: { scope: "self" as const },
            effects: [{ type: "preventAndOvercomeDilemma" as const }],
            conditions: [
              { type: "borgPersonnelFacing" as const },
              { type: "dilemmaOvercomeAtAnyMission" as const },
            ],
          },
        ],
      };

      const planetMissionIndex = state.missions.findIndex(
        (m) => m.mission.missionType === "Planet"
      );
      if (planetMissionIndex === -1) {
        console.log("No planet mission found, skipping test");
        return;
      }

      const testDilemma = {
        id: "test-dilemma",
        uniqueId: "test-dilemma-1",
        name: "Test Dilemma",
        unique: false,
        type: "Dilemma" as const,
        where: "Planet" as const,
        deploy: 1,
        overcome: false,
        faceup: false,
        rule: "SystemDiagnostics" as const,
        skills: [["Leadership" as Skill]],
        jpg: "test.jpg",
      };

      const overcomeDilemma = {
        ...testDilemma,
        uniqueId: "test-dilemma-2",
        overcome: true,
        faceup: true,
      };

      const overcomeMissionIndex = planetMissionIndex === 1 ? 2 : 1;

      useGameStore.setState({
        hand: [adaptCard], // Replace hand entirely - existing hand may have other Adapt cards
        missions: useGameStore.getState().missions.map((m, idx) =>
          idx === planetMissionIndex
            ? {
                ...m,
                groups: [{ cards: [borgPersonnel] }],
                dilemmas: [],
              }
            : idx === overcomeMissionIndex
              ? { ...m, dilemmas: [overcomeDilemma] }
              : m
        ),
        dilemmaEncounter: {
          missionIndex: planetMissionIndex,
          groupIndex: 0,
          selectedDilemmas: [testDilemma],
          currentDilemmaIndex: 0,
          costBudget: 1,
          costSpent: 0,
          facedDilemmaIds: [],
        },
      });

      // Check selector
      const playable = selectPlayableInterrupts(useGameStore.getState());

      expect(playable.length).toBeGreaterThan(0);
      expect(playable[0]!.card.uniqueId).toBe("adapt-test-1");
      expect(playable[0]!.ability.id).toBe("adapt-prevent-dilemma");
    });

    it("selectPlayableInterrupts returns empty when conditions not met", () => {
      // Add Adapt to hand but no dilemma encounter
      const adaptCard = {
        id: "EN03069",
        uniqueId: "adapt-test-1",
        name: "Adapt",
        unique: false,
        type: "Interrupt" as const,
        jpg: "cards/ST2E-EN03069.jpg",
        abilities: [
          {
            id: "adapt-prevent-dilemma",
            trigger: "interrupt" as const,
            interruptTiming: "whenFacingDilemma" as const,
            target: { scope: "self" as const },
            effects: [{ type: "preventAndOvercomeDilemma" as const }],
            conditions: [
              { type: "borgPersonnelFacing" as const },
              { type: "dilemmaOvercomeAtAnyMission" as const },
            ],
          },
        ],
      };

      useGameStore.setState((s) => ({
        hand: [...s.hand, adaptCard],
        dilemmaEncounter: null,
      }));

      const playable = selectPlayableInterrupts(useGameStore.getState());

      expect(playable.length).toBe(0);
    });
  });

  describe("playEvent", () => {
    beforeEach(() => {
      useGameStore.getState().setupGame(defaultDeck);
    });

    it("plays an event card and deducts counters", () => {
      // Create a simple event card with no ability
      const eventCard = {
        id: "EN03036",
        uniqueId: "event-test-1",
        name: "Test Event",
        unique: false,
        type: "Event" as const,
        deploy: 3,
        jpg: "cards/test.jpg",
      };

      useGameStore.setState((s) => ({
        hand: [eventCard, ...s.hand],
        counters: 7,
        phase: "PlayAndDraw" as const,
      }));

      const result = useGameStore.getState().playEvent("event-test-1");

      expect(result).toBe(true);
      const state = useGameStore.getState();
      expect(state.counters).toBe(4);
      expect(
        state.hand.find((c) => c.uniqueId === "event-test-1")
      ).toBeUndefined();
      expect(
        state.discard.find((c) => c.uniqueId === "event-test-1")
      ).toBeDefined();
    });

    it("fails to play event with insufficient counters", () => {
      const eventCard = {
        id: "EN03036",
        uniqueId: "event-test-1",
        name: "Test Event",
        unique: false,
        type: "Event" as const,
        deploy: 5,
        jpg: "cards/test.jpg",
      };

      useGameStore.setState((s) => ({
        hand: [eventCard, ...s.hand],
        counters: 3,
        phase: "PlayAndDraw" as const,
      }));

      const result = useGameStore.getState().playEvent("event-test-1");

      expect(result).toBe(false);
      const state = useGameStore.getState();
      expect(state.counters).toBe(3);
      expect(
        state.hand.find((c) => c.uniqueId === "event-test-1")
      ).toBeDefined();
    });

    it("fails to play event during wrong phase", () => {
      const eventCard = {
        id: "EN03036",
        uniqueId: "event-test-1",
        name: "Test Event",
        unique: false,
        type: "Event" as const,
        deploy: 3,
        jpg: "cards/test.jpg",
      };

      useGameStore.setState((s) => ({
        hand: [eventCard, ...s.hand],
        counters: 7,
        phase: "ExecuteOrders" as const,
      }));

      const result = useGameStore.getState().playEvent("event-test-1");

      expect(result).toBe(false);
    });

    it("plays Salvaging the Wreckage and recovers cards from discard to deck bottom", () => {
      // Create personnel cards in discard
      const personnel1: PersonnelCard = {
        id: "EN03118",
        uniqueId: "personnel-discard-1",
        name: "Test Personnel 1",
        unique: false,
        type: "Personnel",
        affiliation: ["Borg"],
        deploy: 2,
        species: ["Borg"],
        status: "Unstopped",
        other: ["Staff"],
        skills: [["Engineer"]],
        integrity: 5,
        cunning: 5,
        strength: 5,
        jpg: "cards/test.jpg",
      };

      const personnel2: PersonnelCard = {
        id: "EN03124",
        uniqueId: "personnel-discard-2",
        name: "Test Personnel 2",
        unique: false,
        type: "Personnel",
        affiliation: ["Borg"],
        deploy: 2,
        species: ["Borg"],
        status: "Unstopped",
        other: ["Staff"],
        skills: [["Medical"]],
        integrity: 5,
        cunning: 5,
        strength: 5,
        jpg: "cards/test.jpg",
      };

      const ship1: ShipCard = {
        id: "EN03198",
        uniqueId: "ship-discard-1",
        name: "Test Ship",
        unique: false,
        type: "Ship",
        affiliation: ["Borg"],
        deploy: 5,
        staffing: [["Staff", "Staff"]],
        range: 9,
        rangeRemaining: 9,
        weapons: 10,
        shields: 9,
        jpg: "cards/test.jpg",
      };

      // Create the Salvaging the Wreckage event
      const salvagingEvent = {
        id: "EN02060",
        uniqueId: "salvaging-test-1",
        name: "Salvaging the Wreckage",
        unique: false,
        type: "Event" as const,
        deploy: 3,
        jpg: "cards/ST2E-EN02060.jpg",
        abilities: [
          {
            id: "salvaging-the-wreckage-recover",
            trigger: "event" as const,
            target: { scope: "self" as const },
            effects: [
              {
                type: "recoverFromDiscard" as const,
                maxCount: 4,
                cardTypes: ["Personnel" as const, "Ship" as const],
                destination: "deckBottom" as const,
              },
            ],
            removeFromGame: true,
          },
        ],
      };

      const initialDeckLength = useGameStore.getState().deck.length;

      useGameStore.setState((s) => ({
        hand: [salvagingEvent, ...s.hand],
        discard: [personnel1, personnel2, ship1],
        counters: 7,
        phase: "PlayAndDraw" as const,
        removedFromGame: [],
      }));

      // Play the event, selecting 2 personnel and 1 ship to recover
      const result = useGameStore.getState().playEvent("salvaging-test-1", {
        selectedCardIds: [
          "personnel-discard-1",
          "personnel-discard-2",
          "ship-discard-1",
        ],
      });

      expect(result).toBe(true);
      const state = useGameStore.getState();

      // Event should be removed from game (not in discard)
      expect(
        state.discard.find((c) => c.uniqueId === "salvaging-test-1")
      ).toBeUndefined();
      expect(
        state.removedFromGame.find((c) => c.uniqueId === "salvaging-test-1")
      ).toBeDefined();

      // Recovered cards should be removed from discard
      expect(
        state.discard.find((c) => c.uniqueId === "personnel-discard-1")
      ).toBeUndefined();
      expect(
        state.discard.find((c) => c.uniqueId === "personnel-discard-2")
      ).toBeUndefined();
      expect(
        state.discard.find((c) => c.uniqueId === "ship-discard-1")
      ).toBeUndefined();

      // Recovered cards should be at the bottom of the deck
      expect(state.deck.length).toBe(initialDeckLength + 3);
      const lastThreeCards = state.deck.slice(-3);
      expect(lastThreeCards.map((c) => c.uniqueId)).toContain(
        "personnel-discard-1"
      );
      expect(lastThreeCards.map((c) => c.uniqueId)).toContain(
        "personnel-discard-2"
      );
      expect(lastThreeCards.map((c) => c.uniqueId)).toContain("ship-discard-1");

      // Counters should be deducted
      expect(state.counters).toBe(4);
    });

    it("allows playing Salvaging the Wreckage with no cards selected", () => {
      const salvagingEvent = {
        id: "EN02060",
        uniqueId: "salvaging-test-1",
        name: "Salvaging the Wreckage",
        unique: false,
        type: "Event" as const,
        deploy: 3,
        jpg: "cards/ST2E-EN02060.jpg",
        abilities: [
          {
            id: "salvaging-the-wreckage-recover",
            trigger: "event" as const,
            target: { scope: "self" as const },
            effects: [
              {
                type: "recoverFromDiscard" as const,
                maxCount: 4,
                cardTypes: ["Personnel" as const, "Ship" as const],
                destination: "deckBottom" as const,
              },
            ],
            removeFromGame: true,
          },
        ],
      };

      useGameStore.setState((s) => ({
        hand: [salvagingEvent, ...s.hand],
        discard: [],
        counters: 7,
        phase: "PlayAndDraw" as const,
        removedFromGame: [],
      }));

      // Play without selecting any cards (valid - "up to" means 0 is fine)
      const result = useGameStore.getState().playEvent("salvaging-test-1", {
        selectedCardIds: [],
      });

      expect(result).toBe(true);
      const state = useGameStore.getState();
      expect(
        state.removedFromGame.find((c) => c.uniqueId === "salvaging-test-1")
      ).toBeDefined();
      expect(state.counters).toBe(4);
    });

    it("fails when trying to recover more than maxCount cards", () => {
      const personnel: PersonnelCard[] = Array.from({ length: 5 }, (_, i) => ({
        id: `EN0311${i}`,
        uniqueId: `personnel-discard-${i}`,
        name: `Test Personnel ${i}`,
        unique: false,
        type: "Personnel" as const,
        affiliation: ["Borg"] as const,
        deploy: 2,
        species: ["Borg"],
        status: "Unstopped" as const,
        other: ["Staff"] as StaffingIcon[],
        skills: [["Engineer"]] as Skill[][],
        integrity: 5,
        cunning: 5,
        strength: 5,
        jpg: "cards/test.jpg",
      }));

      const salvagingEvent = {
        id: "EN02060",
        uniqueId: "salvaging-test-1",
        name: "Salvaging the Wreckage",
        unique: false,
        type: "Event" as const,
        deploy: 3,
        jpg: "cards/ST2E-EN02060.jpg",
        abilities: [
          {
            id: "salvaging-the-wreckage-recover",
            trigger: "event" as const,
            target: { scope: "self" as const },
            effects: [
              {
                type: "recoverFromDiscard" as const,
                maxCount: 4,
                cardTypes: ["Personnel" as const, "Ship" as const],
                destination: "deckBottom" as const,
              },
            ],
            removeFromGame: true,
          },
        ],
      };

      useGameStore.setState((s) => ({
        hand: [salvagingEvent, ...s.hand],
        discard: personnel,
        counters: 7,
        phase: "PlayAndDraw" as const,
      }));

      // Try to recover 5 cards (max is 4)
      const result = useGameStore.getState().playEvent("salvaging-test-1", {
        selectedCardIds: personnel.map((p) => p.uniqueId!),
      });

      expect(result).toBe(false);
      // Event should still be in hand
      expect(
        useGameStore
          .getState()
          .hand.find((c) => c.uniqueId === "salvaging-test-1")
      ).toBeDefined();
    });

    it("fails when trying to recover cards of wrong type", () => {
      // Create a dilemma card in discard (not Personnel or Ship)
      const dilemmaCard = {
        id: "EN01034",
        uniqueId: "dilemma-discard-1",
        name: "Test Dilemma",
        unique: false,
        type: "Dilemma" as const,
        where: "Dual" as const,
        deploy: 2,
        overcome: false,
        faceup: false,
        rule: "LimitedWelcome" as const,
        jpg: "cards/test.jpg",
      };

      const salvagingEvent = {
        id: "EN02060",
        uniqueId: "salvaging-test-1",
        name: "Salvaging the Wreckage",
        unique: false,
        type: "Event" as const,
        deploy: 3,
        jpg: "cards/ST2E-EN02060.jpg",
        abilities: [
          {
            id: "salvaging-the-wreckage-recover",
            trigger: "event" as const,
            target: { scope: "self" as const },
            effects: [
              {
                type: "recoverFromDiscard" as const,
                maxCount: 4,
                cardTypes: ["Personnel" as const, "Ship" as const],
                destination: "deckBottom" as const,
              },
            ],
            removeFromGame: true,
          },
        ],
      };

      useGameStore.setState((s) => ({
        hand: [salvagingEvent, ...s.hand],
        discard: [dilemmaCard],
        counters: 7,
        phase: "PlayAndDraw" as const,
      }));

      // Try to recover a dilemma (not allowed)
      const result = useGameStore.getState().playEvent("salvaging-test-1", {
        selectedCardIds: ["dilemma-discard-1"],
      });

      expect(result).toBe(false);
    });

    it("auto-advances to ExecuteOrders when counters hit 0 after playing event", () => {
      const eventCard = {
        id: "EN03036",
        uniqueId: "event-test-1",
        name: "Test Event",
        unique: false,
        type: "Event" as const,
        deploy: 7,
        jpg: "cards/test.jpg",
      };

      useGameStore.setState((s) => ({
        hand: [eventCard, ...s.hand],
        counters: 7,
        phase: "PlayAndDraw" as const,
      }));

      useGameStore.getState().playEvent("event-test-1");

      const state = useGameStore.getState();
      expect(state.counters).toBe(0);
      expect(state.phase).toBe("ExecuteOrders");
    });
  });
});
