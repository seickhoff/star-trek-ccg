// Re-export all types
export * from "./types/index.js";

// Re-export protocol
export * from "./protocol/index.js";

// Utils
export { shuffle, shuffleInPlace, configureShuffle } from "./utils/shuffle.js";

// Data
export * from "./data/cardDatabase.js";
export { defaultDeck, DECK_STATS } from "./data/defaultDeck.js";

// Logic — abilities and shipMovement have no name collisions
export * from "./logic/abilities.js";
export * from "./logic/shipMovement.js";

// missionChecker: selective exports to avoid GroupStats collision with types/gameState
export {
  type SkillCounts,
  type MissionGap,
  calculateGroupStats,
  formatGroupStats,
  checkMission,
  getMissionGap,
  formatMissionGap,
  countUnstoppedPersonnel,
  getUnstoppedPersonnel,
  areAllPersonnelStopped,
  findPersonnelWithSkill,
  hasSkillCount,
  getAttributeTotal,
} from "./logic/missionChecker.js";

// dilemmaResolver: DilemmaResolution (renamed from DilemmaResult to avoid gameState collision)
export {
  type DilemmaResolution,
  resolveDilemma,
  resolveSelectionStop,
} from "./logic/dilemmaResolver.js";
