// Re-export all types
export * from "./types";

// Re-export protocol
export * from "./protocol";

// Utils
export { shuffle, shuffleInPlace, configureShuffle } from "./utils/shuffle";

// Data
export * from "./data/cardDatabase";
export { defaultDeck, DECK_STATS } from "./data/defaultDeck";

// Logic — abilities and shipMovement have no name collisions
export * from "./logic/abilities";
export * from "./logic/shipMovement";

// missionChecker: selective exports to avoid GroupStats collision with types/gameState
export {
  type SkillCounts,
  calculateGroupStats,
  formatGroupStats,
  checkMission,
  countUnstoppedPersonnel,
  getUnstoppedPersonnel,
  areAllPersonnelStopped,
  findPersonnelWithSkill,
  hasSkillCount,
  getAttributeTotal,
} from "./logic/missionChecker";

// dilemmaResolver: DilemmaResolution (renamed from DilemmaResult to avoid gameState collision)
export {
  type DilemmaResolution,
  resolveDilemma,
  resolveSelectionStop,
} from "./logic/dilemmaResolver";
