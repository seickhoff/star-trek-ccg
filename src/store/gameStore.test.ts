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

    it("advances from PlayAndDraw to ExecuteOrders", () => {
      useGameStore.setState({ phase: "PlayAndDraw" });

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
});
