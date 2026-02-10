import type { Ability } from "./ability.js";

// Card type discriminants
export type CardType =
  | "Mission"
  | "Personnel"
  | "Ship"
  | "Dilemma"
  | "Event"
  | "Interrupt";

export type PersonnelStatus = "Unstopped" | "Stopped" | "Killed";

export type MissionType = "Headquarters" | "Planet" | "Space";

export type DilemmaLocation = "Planet" | "Space" | "Dual";

export type StaffingIcon = "Staff" | "Command";

export type AttributeName = "Strength" | "Integrity" | "Cunning";

export type Quadrant = "Alpha" | "Beta" | "Gamma" | "Delta";

// All valid skills in the game
export type Skill =
  | "Acquisition"
  | "Anthropology"
  | "Archaeology"
  | "Astrometrics"
  | "Biology"
  | "Diplomacy"
  | "Engineer"
  | "Exobiology"
  | "Geology"
  | "Honor"
  | "Intelligence"
  | "Law"
  | "Leadership"
  | "Medical"
  | "Navigation"
  | "Officer"
  | "Physics"
  | "Programming"
  | "Science"
  | "Security"
  | "Telepathy"
  | "Transporters"
  | "Treachery";

// All valid affiliations
export type Affiliation =
  | "Bajoran"
  | "Borg"
  | "Cardassian"
  | "Dominion"
  | "Federation"
  | "Ferengi"
  | "Klingon"
  | "Non-Aligned"
  | "Romulan"
  | "Starfleet";

// Dilemma requirement for passing a check (one of several OR options)
export interface DilemmaRequirement {
  skills?: Skill[]; // Required skills (repeated = need multiple)
  singlePersonnel?: boolean; // true = one person must have all; default = group total
  attribute?: AttributeName; // Optional attribute check
  attributeThreshold?: number; // Must exceed this value (>)
}

// What happens when a dilemma check fails
export type DilemmaFailPenalty =
  | { type: "randomKill" }
  | { type: "randomKillWithSkill"; skill: Skill }
  | { type: "stopAllReturnToPile" }
  | { type: "chooseMatchingToStopElseStopAll"; skills: Skill[] };

// Structured dilemma rule (discriminated union)
export type DilemmaRule =
  | {
      type: "chooseToStop";
      skills: Skill[];
      penalty: "randomKill" | "stopAllReturnToPile";
    }
  | {
      type: "unlessCheck";
      requirements: DilemmaRequirement[];
      penalty: DilemmaFailPenalty;
    }
  | { type: "randomThenCheck"; requirements: DilemmaRequirement[] }
  | { type: "randomStop"; stops: { remainingThreshold: number }[] }
  | { type: "crewLimit"; keepCount: number };

// Base properties shared by all cards
export interface BaseCard {
  id: string; // Card ID from database (e.g., "EN03118")
  uniqueId?: string; // Instance ID (e.g., "EN03118-5")
  name: string;
  type: CardType;
  unique: boolean;
  jpg: string;
  ownerId?: string; // Player who started the game with this card (for multiplayer)
  concealed?: boolean; // True when card is face-down to opponent (personnel/equipment)
}

// Mission card
export interface MissionCard extends BaseCard {
  type: "Mission";
  missionType: MissionType;
  quadrant: Quadrant;
  range: number;
  completed: boolean;
  // Headquarters-specific
  play?: string[]; // Card types that can be played here
  // Scorable mission-specific
  score?: number;
  affiliation?: Affiliation[];
  skills?: Skill[][]; // Alternative skill requirements (OR)
  attribute?: AttributeName;
  value?: number; // Attribute threshold
}

// Personnel card
export interface PersonnelCard extends BaseCard {
  type: "Personnel";
  affiliation: Affiliation[];
  deploy: number;
  species: string[];
  status: PersonnelStatus;
  other: StaffingIcon[];
  skills: Skill[][];
  integrity: number;
  cunning: number;
  strength: number;
  abilities?: Ability[];
}

// Ship card
export interface ShipCard extends BaseCard {
  type: "Ship";
  affiliation: Affiliation[];
  deploy: number;
  species?: string[];
  staffing: StaffingIcon[][];
  range: number;
  rangeRemaining: number;
  weapons: number;
  shields: number;
}

// Event card
export interface EventCard extends BaseCard {
  type: "Event";
  deploy: number;
  abilities?: Ability[];
}

// Interrupt card
export interface InterruptCard extends BaseCard {
  type: "Interrupt";
  abilities?: Ability[];
}

// Dilemma card
export interface DilemmaCard extends BaseCard {
  type: "Dilemma";
  where: DilemmaLocation;
  cost: number;
  overcome: boolean;
  faceup: boolean;
  text: string;
  lore: string;
  rule: DilemmaRule;
}

// Union type for all cards
export type Card =
  | MissionCard
  | PersonnelCard
  | ShipCard
  | EventCard
  | InterruptCard
  | DilemmaCard;

// Type guards for card types
export function isMission(card: Card): card is MissionCard {
  return card.type === "Mission";
}

export function isPersonnel(card: Card): card is PersonnelCard {
  return card.type === "Personnel";
}

export function isShip(card: Card): card is ShipCard {
  return card.type === "Ship";
}

export function isEvent(card: Card): card is EventCard {
  return card.type === "Event";
}

export function isInterrupt(card: Card): card is InterruptCard {
  return card.type === "Interrupt";
}

export function isDilemma(card: Card): card is DilemmaCard {
  return card.type === "Dilemma";
}

// Card database type
export type CardDatabase = Record<string, Card>;
