import type {
  Ability,
  Affiliation,
  CardDatabase,
  DilemmaCard,
  EventCard,
  InterruptCard,
  MissionCard,
  PersonnelCard,
  ShipCard,
  Skill,
} from "@stccg/shared";

// All valid skills in the game
export const ALL_SKILLS: Skill[] = [
  "Acquisition",
  "Anthropology",
  "Archaeology",
  "Astrometrics",
  "Biology",
  "Diplomacy",
  "Engineer",
  "Exobiology",
  "Geology",
  "Honor",
  "Intelligence",
  "Law",
  "Leadership",
  "Medical",
  "Navigation",
  "Officer",
  "Physics",
  "Programming",
  "Science",
  "Security",
  "Telepathy",
  "Transporters",
  "Treachery",
];

// All valid affiliations
export const ALL_AFFILIATIONS: Affiliation[] = [
  "Bajoran",
  "Borg",
  "Cardassian",
  "Dominion",
  "Federation",
  "Ferengi",
  "Klingon",
  "Non-Aligned",
  "Romulan",
  "Starfleet",
];

// =============================================================================
// MISSIONS
// =============================================================================

const missions: Record<string, MissionCard> = {
  EN03110: {
    id: "EN03110",
    name: "Unicomplex, Root of the Hive Mind",
    unique: true,
    type: "Mission",
    missionType: "Headquarters",
    quadrant: "Delta",
    completed: false,
    range: 2,
    play: ["Equipment", "Borg"],
    jpg: "cards/ST2E-EN03110.jpg",
  },
  EN03094: {
    id: "EN03094",
    name: "Hunt Alien",
    unique: true,
    type: "Mission",
    missionType: "Planet",
    quadrant: "Delta",
    completed: false,
    score: 35,
    range: 3,
    affiliation: ["Borg", "Klingon"],
    skills: [
      ["Exobiology", "Exobiology", "Navigation", "Leadership"],
      ["Exobiology", "Exobiology", "Navigation", "Security"],
    ],
    attribute: "Strength",
    value: 32,
    jpg: "cards/ST2E-EN03094.jpg",
  },
  EN03103: {
    id: "EN03103",
    name: "Salvage Borg Ship",
    unique: true,
    type: "Mission",
    missionType: "Planet",
    quadrant: "Alpha",
    completed: false,
    score: 35,
    range: 2,
    affiliation: ALL_AFFILIATIONS,
    skills: [["Astrometrics", "Engineer", "Medical", "Programming"]],
    attribute: "Cunning",
    value: 34,
    jpg: "cards/ST2E-EN03103.jpg",
  },
  EN03082: {
    id: "EN03082",
    name: "Assault on Species 8472",
    unique: true,
    type: "Mission",
    missionType: "Space",
    quadrant: "Delta",
    completed: false,
    score: 35,
    range: 4,
    affiliation: ["Borg", "Klingon", "Federation"],
    skills: [["Engineer", "Engineer", "Exobiology", "Physics"]],
    attribute: "Cunning",
    value: 34,
    jpg: "cards/ST2E-EN03082.jpg",
  },
  EN03083: {
    id: "EN03083",
    name: "Battle Reconnaissance",
    unique: true,
    type: "Mission",
    missionType: "Space",
    quadrant: "Delta",
    completed: false,
    score: 35,
    range: 2,
    affiliation: ALL_AFFILIATIONS,
    skills: [["Exobiology", "Programming", "Security", "Transporters"]],
    attribute: "Strength",
    value: 32,
    jpg: "cards/ST2E-EN03083.jpg",
  },
};

// =============================================================================
// PERSONNEL
// =============================================================================

const personnel: Record<string, PersonnelCard> = {
  EN03118: {
    id: "EN03118",
    name: "Acclimation Drone",
    unique: false,
    type: "Personnel",
    affiliation: ["Borg"],
    deploy: 2,
    species: ["Borg"],
    status: "Unstopped",
    other: ["Staff"],
    skills: [["Anthropology", "Engineer", "Exobiology", "Medical"]],
    integrity: 5,
    cunning: 5,
    strength: 5,
    jpg: "cards/ST2E-EN03118.jpg",
    abilities: [
      {
        id: "acclimation-drone-cost-reduction",
        trigger: "whilePlaying",
        target: {
          scope: "self",
        },
        effects: [
          {
            type: "costModifier",
            value: -1,
            perMatchingCard: {
              cardTypes: ["Personnel"],
              ownership: "commandedNotOwned",
            },
          },
        ],
      } satisfies Ability,
    ],
  },
  EN03122: {
    id: "EN03122",
    name: "Borg Queen, Bringer of Order",
    unique: true,
    type: "Personnel",
    affiliation: ["Borg"],
    deploy: 4,
    species: ["Borg"],
    status: "Unstopped",
    other: ["Command"],
    skills: [["Leadership", "Leadership", "Leadership", "Treachery"]],
    integrity: 3,
    cunning: 8,
    strength: 6,
    jpg: "cards/ST2E-EN03122.jpg",
    abilities: [
      {
        id: "borg-queen-skill-grant",
        trigger: "order",
        target: {
          scope: "allInPlay",
          species: ["Borg"],
        },
        effects: [
          {
            type: "skillGrant",
            skill: null, // Player chooses at activation
          },
        ],
        cost: { type: "discardFromDeck", count: 1 },
        duration: "untilEndOfTurn",
        usageLimit: "oncePerTurn",
      } satisfies Ability,
    ],
  },
  EN03124: {
    id: "EN03124",
    name: "Calibration Drone",
    unique: false,
    type: "Personnel",
    affiliation: ["Borg"],
    deploy: 2,
    species: ["Borg"],
    status: "Unstopped",
    other: ["Staff"],
    skills: [["Archaeology", "Biology", "Geology"]],
    integrity: 5,
    cunning: 5,
    strength: 5,
    jpg: "cards/ST2E-EN03124.jpg",
    abilities: [
      {
        id: "calibration-drone-hand-refresh",
        trigger: "order",
        target: { scope: "self" },
        effects: [{ type: "handRefresh" }],
        cost: { type: "sacrificeSelf" },
      } satisfies Ability,
    ],
  },
  EN03125: {
    id: "EN03125",
    name: "Cartography Drone",
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
    jpg: "cards/ST2E-EN03125.jpg",
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
      } satisfies Ability,
    ],
  },
  EN03126: {
    id: "EN03126",
    name: "Computation Drone",
    unique: false,
    type: "Personnel",
    affiliation: ["Borg"],
    deploy: 2,
    species: ["Borg"],
    status: "Unstopped",
    other: ["Staff"],
    skills: [["Navigation", "Programming"]],
    integrity: 5,
    cunning: 6,
    strength: 5,
    jpg: "cards/ST2E-EN03126.jpg",
    abilities: [
      {
        id: "computation-drone-cunning-boost",
        trigger: "passive",
        target: {
          scope: "present",
          species: ["Borg"],
          excludeSelf: true,
        },
        effects: [
          {
            type: "statModifier",
            stat: "cunning",
            value: 1,
          },
        ],
      } satisfies Ability,
    ],
  },
  EN03130: {
    id: "EN03130",
    name: "Information Drone",
    unique: false,
    type: "Personnel",
    affiliation: ["Borg"],
    deploy: 2,
    species: ["Borg"],
    status: "Unstopped",
    other: ["Staff"],
    skills: [["Exobiology", "Science", "Transporters"]],
    integrity: 5,
    cunning: 5,
    strength: 5,
    jpg: "cards/ST2E-EN03130.jpg",
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
            skill: null, // Player chooses from non-Borg personnel present
            skillSource: {
              scope: "present",
              excludeAffiliations: ["Borg"],
            },
          },
        ],
        cost: { type: "discardFromDeck", count: 1 },
        duration: "untilEndOfMissionAttempt",
      } satisfies Ability,
    ],
  },
  EN03131: {
    id: "EN03131",
    name: "Invasive Drone",
    unique: false,
    type: "Personnel",
    affiliation: ["Borg"],
    deploy: 2,
    species: ["Borg"],
    status: "Unstopped",
    other: ["Staff"],
    skills: [["Programming", "Security", "Transporters"]],
    integrity: 5,
    cunning: 5,
    strength: 5,
    jpg: "cards/ST2E-EN03131.jpg",
    abilities: [
      {
        id: "invasive-drone-beam-to-ship",
        trigger: "order",
        target: { scope: "mission" },
        effects: [{ type: "beamAllToShip" }],
        cost: { type: "returnToHand" },
      } satisfies Ability,
    ],
  },
  EN03134: {
    id: "EN03134",
    name: "Opposition Drone",
    unique: false,
    type: "Personnel",
    affiliation: ["Borg"],
    deploy: 2,
    species: ["Borg"],
    status: "Unstopped",
    other: ["Staff"],
    skills: [["Biology", "Security"]],
    integrity: 5,
    cunning: 5,
    strength: 6,
    jpg: "cards/ST2E-EN03134.jpg",
    abilities: [
      {
        id: "opposition-drone-strength-boost",
        trigger: "passive",
        target: {
          scope: "present",
          species: ["Borg"],
          excludeSelf: true,
        },
        effects: [
          {
            type: "statModifier",
            stat: "strength",
            value: 1,
          },
        ],
      } satisfies Ability,
    ],
  },
  EN03137: {
    id: "EN03137",
    name: "Research Drone",
    unique: false,
    type: "Personnel",
    affiliation: ["Borg"],
    deploy: 1,
    species: ["Borg"],
    status: "Unstopped",
    other: ["Staff"],
    skills: [["Medical"]],
    integrity: 5,
    cunning: 5,
    strength: 5,
    jpg: "cards/ST2E-EN03137.jpg",
    abilities: [
      {
        id: "research-drone-interlink-physics",
        trigger: "interlink",
        target: {
          scope: "allInPlay",
          species: ["Borg"],
        },
        effects: [
          {
            type: "skillGrant",
            skill: "Physics",
          },
        ],
        cost: { type: "discardFromDeck", count: 1 },
        duration: "untilEndOfMissionAttempt",
      } satisfies Ability,
    ],
  },
  EN03139: {
    id: "EN03139",
    name: "Seven of Nine, Representative of the Hive",
    unique: true,
    type: "Personnel",
    affiliation: ["Borg"],
    deploy: 3,
    species: ["Borg"],
    status: "Unstopped",
    other: ["Staff"],
    skills: [["Engineer", "Exobiology", "Physics", "Programming", "Science"]],
    integrity: 5,
    cunning: 7,
    strength: 6,
    jpg: "cards/ST2E-EN03139.jpg",
    abilities: [
      {
        id: "seven-of-nine-dilemma-boost",
        trigger: "whileFacingDilemma",
        target: { scope: "self" },
        effects: [
          {
            type: "statModifier",
            stat: "strength",
            value: 2,
          },
          {
            type: "skillGrant",
            skill: "Security",
          },
        ],
      } satisfies Ability,
    ],
  },
  EN03140: {
    id: "EN03140",
    name: "Transwarp Drone",
    unique: false,
    type: "Personnel",
    affiliation: ["Borg"],
    deploy: 2,
    species: ["Borg"],
    status: "Unstopped",
    other: ["Staff"],
    skills: [["Astrometrics", "Navigation", "Physics"]],
    integrity: 5,
    cunning: 5,
    strength: 5,
    jpg: "cards/ST2E-EN03140.jpg",
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
      } satisfies Ability,
    ],
  },
};

// =============================================================================
// SHIPS
// =============================================================================

const ships: Record<string, ShipCard> = {
  EN03198: {
    id: "EN03198",
    name: "Borg Cube",
    unique: false,
    type: "Ship",
    affiliation: ["Borg"],
    deploy: 6,
    species: ["Borg"],
    staffing: [["Staff", "Staff", "Staff", "Staff", "Staff"]],
    range: 10,
    rangeRemaining: 10,
    weapons: 12,
    shields: 11,
    jpg: "cards/ST2E-EN03198.jpg",
  },
  EN03199: {
    id: "EN03199",
    name: "Borg Sphere",
    unique: false,
    type: "Ship",
    affiliation: ["Borg"],
    deploy: 5,
    species: ["Borg"],
    staffing: [["Staff", "Staff", "Staff", "Staff"]],
    range: 9,
    rangeRemaining: 9,
    weapons: 10,
    shields: 9,
    jpg: "cards/ST2E-EN03199.jpg",
  },
};

// =============================================================================
// EVENTS
// =============================================================================

const events: Record<string, EventCard> = {
  EN03036: {
    id: "EN03036",
    name: "Borg Cutting Beam",
    unique: false,
    type: "Event",
    deploy: 5,
    jpg: "cards/ST2E-EN03036.jpg",
  },
  EN02060: {
    id: "EN02060",
    name: "Salvaging the Wreckage",
    unique: false,
    type: "Event",
    deploy: 3,
    jpg: "cards/ST2E-EN02060.jpg",
    abilities: [
      {
        id: "salvaging-the-wreckage-recover",
        trigger: "event",
        target: { scope: "self" },
        effects: [
          {
            type: "recoverFromDiscard",
            maxCount: 4,
            cardTypes: ["Personnel", "Ship"],
            destination: "deckBottom",
          },
        ],
        removeFromGame: true,
      } satisfies Ability,
    ],
  },
};

// =============================================================================
// INTERRUPTS
// =============================================================================

const interrupts: Record<string, InterruptCard> = {
  EN03069: {
    id: "EN03069",
    name: "Adapt",
    unique: false,
    type: "Interrupt",
    jpg: "cards/ST2E-EN03069.jpg",
    abilities: [
      {
        id: "adapt-prevent-dilemma",
        trigger: "interrupt",
        interruptTiming: "whenFacingDilemma",
        target: { scope: "self" },
        effects: [{ type: "preventAndOvercomeDilemma" }],
        conditions: [
          { type: "borgPersonnelFacing" },
          { type: "dilemmaOvercomeAtAnyMission" },
        ],
      } satisfies Ability,
    ],
  },
  EN01136: {
    id: "EN01136",
    name: "Render Assistance",
    unique: false,
    type: "Interrupt",
    jpg: "cards/ST2E-EN01136.jpg",
  },
};

// =============================================================================
// DILEMMAS
// =============================================================================

const dilemmas: Record<string, DilemmaCard> = {
  EN03002: {
    id: "EN03002",
    name: "An Old Debt",
    unique: false,
    overcome: false,
    faceup: false,
    type: "Dilemma",
    where: "Dual",
    cost: 3,
    rule: "AnOldDebt",
    skills: [
      ["Biology", "Physics"],
      ["Intelligence", "Medical", "Medical"],
    ],
    abilityname: [["Cunning"], ["Cunning"]],
    abilityvalue: [[35], [0]],
    skillkill: "Leadership",
    text: "Unless you have Biology, Physics, and Cunning>32 or Intelligence and 2 Medical, randomly select a Leadership personnel to be killed.",
    lore: "I have been waiting a long nine years for this, Picard! … You murdered my only son! … And I have spent these years searching, seeking a proper blood revenge. And I found it!",
    jpg: "cards/ST2E-EN03002.jpg",
  },
  EN03016: {
    id: "EN03016",
    name: "Justice or Vengeance",
    unique: false,
    overcome: false,
    faceup: false,
    type: "Dilemma",
    where: "Dual",
    cost: 3,
    rule: "AnOldDebt",
    skills: [
      ["Anthropology", "Security", "Security"],
      ["Exobiology", "Honor"],
    ],
    abilityname: [["Integrity"], ["Integrity"]],
    abilityvalue: [[0], [32]],
    skillkill: "Treachery",
    text: "Unless you have Anthropology and 2 Security or Exobiology, Honor, and Integrity>32, randomly select a Treachery personnel to be killed.",
    lore: "A most logical use of violence, to punish the violent. We both know that I am prepared to die. But are you prepared to kill?",
    jpg: "cards/ST2E-EN03016.jpg",
  },
  EN01034: {
    id: "EN01034",
    name: "Limited Welcome",
    unique: false,
    overcome: false,
    faceup: false,
    type: "Dilemma",
    where: "Dual",
    cost: 2,
    rule: "LimitedWelcome",
    text: "Randomly select nine personnel. All your other personnel are stopped. Place this dilemma on this mission. When you attempt this mission again, after your opponent draws dilemmas, he or she may take this dilemma and add it to those drawn.",
    lore: "I hope you'll forgive the darkness. We are not comfortable in the light.",
    jpg: "cards/ST2E-EN01034.jpg",
  },
  EN01041: {
    id: "EN01041",
    name: "Ornaran Threat",
    unique: false,
    overcome: false,
    faceup: false,
    type: "Dilemma",
    where: "Dual",
    cost: 4,
    rule: "OrnaranThreat",
    skills: [
      ["Diplomacy", "Medical"],
      ["Security", "Security"],
    ],
    text: "Randomly select a personnel to be stopped. Unless you have Diplomacy and Medical or 2 Security, that personnel is killed instead, then all your other personnel are stopped and this dilemma returns to its owner's dilemma pile.",
    lore: "You will take us to our planet. Leave us there with our medicine or this person dies.",
    jpg: "cards/ST2E-EN01041.jpg",
  },
  EN01043: {
    id: "EN01043",
    name: "Pinned Down",
    unique: false,
    overcome: false,
    faceup: false,
    type: "Dilemma",
    where: "Dual",
    cost: 2,
    rule: "PinnedDown",
    text: "Randomly select a personnel to be stopped. If you still have nine personnel remaining, randomly select a second personnel to be stopped. If you still have ten personnel remaining, randomly select a third personnel to be stopped.",
    lore: "Quick! Into the forest!",
    jpg: "cards/ST2E-EN01043.jpg",
  },
  EN03030: {
    id: "EN03030",
    name: "Sokath, His Eyes Uncovered!",
    unique: false,
    overcome: false,
    faceup: false,
    type: "Dilemma",
    where: "Dual",
    cost: 3,
    rule: "Sokath",
    skills: [["Diplomacy", "Diplomacy"], []],
    abilityname: [["Cunning"], ["Cunning"]],
    abilityvalue: [[0], [35]],
    text: "Unless you have 2 Diplomacy or Cunning>35, all your personnel are stopped and this dilemma returns to its owner's dilemma pile.",
    lore: "ou hoped that something like this would happen, didn’t you? You knew there was a dangerous creature on this planet. And you knew from the tale of Darmok that a danger shared might sometimes bring two people together.",
    jpg: "cards/ST2E-EN03030.jpg",
  },
  EN01008: {
    id: "EN01008",
    name: "Authenticate Artifacts",
    unique: false,
    overcome: false,
    faceup: false,
    type: "Dilemma",
    where: "Planet",
    cost: 2,
    rule: "Wavefront",
    skills: [
      ["Anthropology", "Anthropology"],
      ["Archaeology", "Archaeology"],
    ],
    text: "Unless you have a personnel who has 2 Anthropology or a personnel who has 2 Archaeology, your opponent chooses an Anthropology or Archaeology personnel to be stopped. If your opponent cannot, all your personnel are stopped and this dilemma returns to its owner's dilemma pile.",
    lore: "You can tell Baran that I’m working as fast as I can.",
    jpg: "cards/ST2E-EN01008.jpg",
  },
  EN03010: {
    id: "EN03010",
    name: "Failure To Communicate",
    unique: false,
    overcome: false,
    faceup: false,
    type: "Dilemma",
    where: "Planet",
    cost: 2,
    rule: "Wavefront",
    skills: [
      ["Anthropology", "Anthropology"],
      ["Security", "Security"],
    ],
    text: "Unless you have a personnel who has 2 Anthropology or a personnel who has 2 Security, your opponent chooses a Anthropology or Security personnel to be stopped. If your opponent cannot, all your personnel are stopped and this dilemma returns to its owner's dilemma pile.",
    lore: "Once we get back to Enterprise and we can finally understand each other, the first words out of your mouth better be ‘thank you.’",
    jpg: "cards/ST2E-EN03010.jpg",
  },
  EN01033: {
    id: "EN01033",
    name: "Kolaran Raiders",
    unique: false,
    overcome: false,
    faceup: false,
    type: "Dilemma",
    where: "Planet",
    cost: 1,
    rule: "CommandDecisions",
    skills: ["Leadership", "Security"],
    text: "Choose a personnel who has Leadership or Security to be stopped. If you cannot, randomly select a personnel to be killed.",
    lore: "Isolated pockets of humanoids. It appears to be a pre-warp civilization at an early stage of industrial development.",
    jpg: "cards/ST2E-EN01033.jpg",
  },
  EN01057: {
    id: "EN01057",
    name: "Triage",
    unique: false,
    overcome: false,
    faceup: false,
    type: "Dilemma",
    where: "Planet",
    cost: 1,
    rule: "CommandDecisions",
    skills: ["Biology", "Medical"],
    text: "Choose a personnel who has Biology or Medical to be stopped. If you cannot, randomly select a personnel to be killed.",
    lore: "Don’t be afraid. There’s a lot of bleeding, but it’s not as bad as it looks.",
    jpg: "cards/ST2E-EN01057.jpg",
  },
  EN01017: {
    id: "EN01017",
    name: "Command Decisions",
    unique: false,
    overcome: false,
    faceup: false,
    type: "Dilemma",
    where: "Space",
    cost: 1,
    rule: "CommandDecisions",
    skills: ["Leadership", "Officer"],
    text: "Choose a personnel who has Leadership or Officer to be stopped. If you cannot, randomly select a personnel to be killed.",
    lore: "Although there are as many command styles as there are ships in the fleet, all the best captains share the ability to make quick decisions in a crisis situation.",
    jpg: "cards/ST2E-EN01017.jpg",
  },
  EN01052: {
    id: "EN01052",
    name: "Systems Diagnostic",
    unique: false,
    overcome: false,
    faceup: false,
    type: "Dilemma",
    where: "Space",
    cost: 2,
    rule: "SystemDiagnostics",
    skills: ["Engineer", "Programming"],
    text: "Choose a personnel who has Engineer or Programming to be stopped. If you cannot, all your personnel are stopped and this dilemma returns to its owner's dilemma pile.",
    lore: "Starship systems can be checked by computer-automated diagnostics, but this routine examination is no substitute for the scrutiny of a trained engineer.",
    jpg: "cards/ST2E-EN01052.jpg",
  },
  EN01060: {
    id: "EN01060",
    name: "Wavefront",
    unique: false,
    overcome: false,
    faceup: false,
    type: "Dilemma",
    where: "Space",
    cost: 2,
    rule: "Wavefront",
    skills: [
      ["Astrometrics", "Astrometrics"],
      ["Navigation", "Navigation"],
    ],
    text: "Unless you have a personnel who has 2 Astrometrics or a personnel who has 2 Navigation, your opponent chooses an Astrometrics or Navigation personnel to be stopped. If your opponent cannot, all your personnel are stopped and this dilemma returns to its owner's dilemma pile.",
    lore: "Let’s batten down the hatches.",
    jpg: "cards/ST2E-EN01060.jpg",
  },
};

// =============================================================================
// COMBINED DATABASE
// =============================================================================

export const cardDatabase: CardDatabase = {
  ...missions,
  ...personnel,
  ...ships,
  ...events,
  ...interrupts,
  ...dilemmas,
};

// Helper to get a card by ID
export function getCard(id: string) {
  return cardDatabase[id];
}

// Helpers to get all cards of a specific type
export function getMissions(): MissionCard[] {
  return Object.values(cardDatabase).filter(
    (card): card is MissionCard => card.type === "Mission"
  );
}

export function getPersonnel(): PersonnelCard[] {
  return Object.values(cardDatabase).filter(
    (card): card is PersonnelCard => card.type === "Personnel"
  );
}

export function getShips(): ShipCard[] {
  return Object.values(cardDatabase).filter(
    (card): card is ShipCard => card.type === "Ship"
  );
}

export function getDilemmas(): DilemmaCard[] {
  return Object.values(cardDatabase).filter(
    (card): card is DilemmaCard => card.type === "Dilemma"
  );
}
