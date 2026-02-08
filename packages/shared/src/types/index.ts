// Card types
export type {
  CardType,
  PersonnelStatus,
  MissionType,
  DilemmaLocation,
  StaffingIcon,
  AttributeName,
  Quadrant,
  Skill,
  Affiliation,
  DilemmaRequirement,
  DilemmaFailPenalty,
  DilemmaRule,
  BaseCard,
  MissionCard,
  PersonnelCard,
  ShipCard,
  EventCard,
  InterruptCard,
  DilemmaCard,
  Card,
  CardDatabase,
} from "./card.js";

export {
  isMission,
  isPersonnel,
  isShip,
  isEvent,
  isInterrupt,
  isDilemma,
} from "./card.js";

// Ability types
export type {
  AbilityTrigger,
  InterruptTiming,
  OwnershipCondition,
  TargetScope,
  TargetFilter,
  StatModifierEffect,
  CostModifierEffect,
  SkillSourceFilter,
  SkillGrantEffect,
  HandRefreshEffect,
  BeamAllToShipEffect,
  ShipRangeModifierEffect,
  PreventAndOvercomeDilemmaEffect,
  RecoverFromDiscardEffect,
  AbilityCost,
  AbilityCondition,
  EffectDuration,
  UsageLimit,
  AbilityEffect,
  Ability,
} from "./ability.js";

// Game state types
export type {
  GamePhase,
  CardGroup,
  MissionDeployment,
  DilemmaEncounter,
  GrantedSkill,
  RangeBoost,
  GroupStats,
  ActionLogType,
  CardRef,
  ActionLogEntry,
  DilemmaResult,
  SerializableGameState,
} from "./gameState.js";

export { PHASE_INDEX, PHASE_FROM_INDEX, GAME_CONSTANTS } from "./gameState.js";
