import type {
  Affiliation,
  CardDatabase,
  DilemmaCard,
  EventCard,
  InterruptCard,
  MissionCard,
  PersonnelCard,
  ShipCard,
  Skill,
} from "../types";

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
    deploy: 3,
    rule: "AnOldDebt",
    skills: [
      ["Biology", "Physics"],
      ["Intelligence", "Medical", "Medical"],
    ],
    abilityname: [["Cunning"], ["Cunning"]],
    abilityvalue: [[35], [0]],
    skillkill: "Leadership",
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
    deploy: 3,
    rule: "AnOldDebt",
    skills: [
      ["Anthropology", "Security", "Security"],
      ["Exobiology", "Honor"],
    ],
    abilityname: [["Integrity"], ["Integrity"]],
    abilityvalue: [[0], [32]],
    skillkill: "Treachery",
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
    deploy: 2,
    rule: "LimitedWelcome",
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
    deploy: 4,
    rule: "OrnaranThreat",
    skills: [
      ["Diplomacy", "Medical"],
      ["Security", "Security"],
    ],
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
    deploy: 2,
    rule: "PinnedDown",
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
    deploy: 3,
    rule: "Sokath",
    skills: [["Diplomacy", "Diplomacy"], []],
    abilityname: [["Cunning"], ["Cunning"]],
    abilityvalue: [[0], [35]],
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
    deploy: 2,
    rule: "Wavefront",
    skills: [
      ["Anthropology", "Anthropology"],
      ["Archaeology", "Archaeology"],
    ],
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
    deploy: 2,
    rule: "Wavefront",
    skills: [
      ["Anthropology", "Anthropology"],
      ["Security", "Security"],
    ],
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
    deploy: 1,
    rule: "CommandDecisions",
    skills: ["Leadership", "Security"],
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
    deploy: 1,
    rule: "CommandDecisions",
    skills: ["Biology", "Medical"],
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
    deploy: 1,
    rule: "CommandDecisions",
    skills: ["Leadership", "Officer"],
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
    deploy: 2,
    rule: "SystemDiagnostics",
    skills: ["Engineer", "Programming"],
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
    deploy: 2,
    rule: "Wavefront",
    skills: [
      ["Astrometrics", "Astrometrics"],
      ["Navigation", "Navigation"],
    ],
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
