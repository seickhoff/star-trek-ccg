// Default Borg deck configuration
// Card IDs reference cards in cardDatabase

export const defaultDeck: string[] = [
  // Missions (5)
  "EN03110", // Unicomplex, Root of the Hive Mind (Headquarters)
  "EN03094", // Hunt Alien (Planet)
  "EN03103", // Salvage Borg Ship (Planet)
  "EN03082", // Assault on Species 8472 (Space)
  "EN03083", // Battle Reconnaissance (Space)

  // Personnel (22)
  "EN03118", // Acclimation Drone x3
  "EN03118",
  "EN03118",
  "EN03122", // Borg Queen, Bringer of Order x2
  "EN03122",
  "EN03124", // Calibration Drone x2
  "EN03124",
  "EN03125", // Cartography Drone x2
  "EN03125",
  "EN03126", // Computation Drone x2
  "EN03126",
  "EN03130", // Information Drone x2
  "EN03130",
  "EN03131", // Invasive Drone x2
  "EN03131",
  "EN03134", // Opposition Drone x2
  "EN03134",
  "EN03137", // Research Drone x2
  "EN03137",
  "EN03139", // Seven of Nine, Representative of the Hive x1
  "EN03140", // Transwarp Drone x2
  "EN03140",

  // Ships (4)
  "EN03198", // Borg Cube x1
  "EN03199", // Borg Sphere x3
  "EN03199",
  "EN03199",

  // Interrupts (3)
  "EN03069", // Adapt x3
  "EN03069",
  "EN03069",

  // Events (3)
  "EN02060", // Salvaging the Wreckage x3
  "EN02060",
  "EN02060",

  // Space Dilemmas (4)
  "EN01017", // Command Decisions x2
  "EN01017",
  "EN01052", // Systems Diagnostic x1
  "EN01060", // Wavefront x1

  // Planet Dilemmas (6)
  "EN01008", // Authenticate Artifacts x1
  "EN03010", // Failure To Communicate x2
  "EN03010",
  "EN01033", // Kolaran Raiders x2
  "EN01033",
  "EN01057", // Triage x1

  // Dual Dilemmas (10)
  "EN03002", // An Old Debt x2
  "EN03002",
  "EN03016", // Justice or Vengeance x2
  "EN03016",
  "EN01034", // Limited Welcome x2
  "EN01034",
  "EN01041", // Ornaran Threat x1
  "EN01043", // Pinned Down x2
  "EN01043",
  "EN03030", // Sokath, His Eyes Uncovered! x1
];

// Deck statistics
export const DECK_STATS = {
  missions: 5,
  personnel: 22,
  ships: 4,
  interrupts: 3,
  events: 3,
  dilemmas: {
    space: 4,
    planet: 6,
    dual: 10,
    total: 20,
  },
  total: 57,
} as const;
