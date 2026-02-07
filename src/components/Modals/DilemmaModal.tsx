import { useState, useEffect } from "react";
import type {
  PersonnelCard,
  Card,
  Skill,
  InterruptCard,
} from "../../types/card";
import type { Ability, SkillGrantEffect } from "../../types/ability";
import type { DilemmaEncounter, GrantedSkill } from "../../types/gameState";
import type { DilemmaResult } from "../../logic/dilemmaResolver";
import { CardSlot } from "../GameBoard/CardSlot";
import { getNextZIndex } from "./DraggablePanel";
import { calculateGroupStats } from "../../logic/missionChecker";
import { getSkillsFromSource } from "../../store/gameStore";
import "./DilemmaModal.css";

interface PlayableInterrupt {
  card: InterruptCard;
  ability: Ability;
}

interface InterlinkAbility {
  personnelId: string;
  personnelName: string;
  ability: Ability;
  canUse: boolean; // false if deck is empty or cost can't be paid
  availableSkills?: Skill[]; // For abilities with skillSource - skills that can be chosen
}

interface DilemmaModalProps {
  encounter: DilemmaEncounter | null;
  personnel: PersonnelCard[];
  dilemmaResult?: DilemmaResult | null;
  grantedSkills?: GrantedSkill[];
  deckCount?: number; // For checking if Interlink can be used
  playableInterrupts?: PlayableInterrupt[]; // Interrupts that can be played right now
  onClose: () => void;
  onSelectPersonnel?: (personnelId: string) => void;
  onContinue?: () => void;
  onCardClick?: (card: Card) => void;
  onExecuteInterlink?: (
    personnelId: string,
    abilityId: string,
    skill?: Skill
  ) => void;
  onPlayInterrupt?: (cardUniqueId: string, abilityId: string) => void;
}

/**
 * Modal for dilemma encounter resolution
 * Shows current dilemma and allows player response
 */
export function DilemmaModal({
  encounter,
  personnel,
  dilemmaResult,
  grantedSkills = [],
  deckCount = 0,
  playableInterrupts = [],
  onClose,
  onSelectPersonnel,
  onContinue,
  onCardClick,
  onExecuteInterlink,
  onPlayInterrupt,
}: DilemmaModalProps) {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [zIndex, setZIndex] = useState(getNextZIndex);
  // Track selected skills for interlink abilities that require skill selection
  // Key format: "personnelId:abilityId"
  const [selectedInterlinkSkills, setSelectedInterlinkSkills] = useState<
    Record<string, Skill>
  >({});

  // Bring to front when opened
  useEffect(() => {
    if (encounter) {
      setZIndex(getNextZIndex());
    }
  }, [encounter]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Bring to front on any click
    setZIndex(getNextZIndex());

    // Only drag from header
    if (!(e.target as HTMLElement).closest(".dilemma-modal__header")) return;

    e.preventDefault();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startPosX = position.x;
    const startPosY = position.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setPosition({
        x: startPosX + (moveEvent.clientX - startMouseX),
        y: startPosY + (moveEvent.clientY - startMouseY),
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && encounter) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [encounter, onClose]);

  if (!encounter) return null;

  const currentDilemma =
    encounter.selectedDilemmas[encounter.currentDilemmaIndex];
  if (!currentDilemma) return null;

  const unstoppedPersonnel = personnel.filter((p) => p.status === "Unstopped");
  const stoppedPersonnel = personnel.filter((p) => p.status === "Stopped");

  // Collect available Interlink abilities from unstopped personnel
  const interlinkAbilities: InterlinkAbility[] = [];
  for (const person of unstoppedPersonnel) {
    if (person.abilities) {
      for (const ability of person.abilities) {
        if (ability.trigger === "interlink") {
          // Check if cost can be paid
          let canUse = true;
          if (ability.cost?.type === "discardFromDeck") {
            canUse = deckCount >= ability.cost.count;
          }

          // Check if this ability requires skill selection from source
          const skillEffect = ability.effects.find(
            (e): e is SkillGrantEffect => e.type === "skillGrant"
          );
          let availableSkills: Skill[] | undefined;

          if (skillEffect && !skillEffect.skill && skillEffect.skillSource) {
            // Compute available skills from source personnel
            availableSkills = getSkillsFromSource(
              personnel, // All personnel in group (includes stopped)
              skillEffect.skillSource,
              person.uniqueId
            );
            // Can't use if no skills available from source
            if (availableSkills.length === 0) {
              canUse = false;
            }
          }

          interlinkAbilities.push({
            personnelId: person.uniqueId!,
            personnelName: person.name,
            ability,
            canUse,
            availableSkills,
          });
        }
      }
    }
  }

  // Calculate real-time stats from unstopped personnel only
  const stats = calculateGroupStats(unstoppedPersonnel, grantedSkills);
  const skillEntries = Object.entries(stats.skills).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  // Determine if we need selection
  const needsSelection = dilemmaResult?.requiresSelection ?? false;
  const selectableIds = dilemmaResult?.selectablePersonnel ?? [];

  // Filter to only selectable personnel
  const selectablePersonnel = needsSelection
    ? unstoppedPersonnel.filter(
        (p) => p.uniqueId && selectableIds.includes(p.uniqueId)
      )
    : [];

  return (
    <div
      className="dilemma-modal"
      style={{ left: position.x, top: position.y, zIndex }}
      onMouseDown={handleMouseDown}
    >
      <div className="dilemma-modal__header">
        <h2 className="dilemma-modal__title">Dilemma Encounter</h2>
        <button className="dilemma-modal__close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="dilemma-modal__content">
        {/* Progress indicator */}
        <div className="dilemma-modal__progress">
          Dilemma {encounter.currentDilemmaIndex + 1} of{" "}
          {encounter.selectedDilemmas.length}
        </div>

        {/* Real-time stats panel */}
        <div className="dilemma-modal__stats-panel">
          <div className="dilemma-modal__stats-header">
            <span className="dilemma-modal__stats-title">Your Team</span>
            <span className="dilemma-modal__stats-count">
              {unstoppedPersonnel.length} unstopped
            </span>
          </div>
          <div className="dilemma-modal__stats-row">
            <span className="dilemma-modal__stat dilemma-modal__stat--integrity">
              I: {stats.integrity}
            </span>
            <span className="dilemma-modal__stat dilemma-modal__stat--cunning">
              C: {stats.cunning}
            </span>
            <span className="dilemma-modal__stat dilemma-modal__stat--strength">
              S: {stats.strength}
            </span>
          </div>
          {skillEntries.length > 0 && (
            <div className="dilemma-modal__skills">
              {skillEntries.map(([skill, count]) => (
                <span key={skill} className="dilemma-modal__skill">
                  {skill}
                  {count > 1 && (
                    <span className="dilemma-modal__skill-count">×{count}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Playable interrupts section */}
        {playableInterrupts.length > 0 && onPlayInterrupt && (
          <div className="dilemma-modal__interrupts">
            <h4 className="dilemma-modal__interrupts-title">
              Interrupts Available
            </h4>
            <div className="dilemma-modal__interrupts-list">
              {playableInterrupts.map(({ card, ability }) => (
                <div
                  key={`${card.uniqueId}:${ability.id}`}
                  className="dilemma-modal__interrupt-item"
                >
                  <CardSlot
                    card={card}
                    size="thumb"
                    onClick={() => onCardClick?.(card)}
                  />
                  <div className="dilemma-modal__interrupt-info">
                    <span className="dilemma-modal__interrupt-name">
                      {card.name}
                    </span>
                    <span className="dilemma-modal__interrupt-effect">
                      Prevent and overcome this dilemma
                    </span>
                  </div>
                  <button
                    className="dilemma-modal__interrupt-btn"
                    onClick={() => onPlayInterrupt(card.uniqueId!, ability.id)}
                    title="Play this interrupt to prevent the dilemma"
                  >
                    Play
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interlink abilities section */}
        {interlinkAbilities.length > 0 && onExecuteInterlink && (
          <div className="dilemma-modal__interlink">
            <h4 className="dilemma-modal__interlink-title">
              Interlink Available
            </h4>
            <div className="dilemma-modal__interlink-list">
              {interlinkAbilities.map(
                ({
                  personnelId,
                  personnelName,
                  ability,
                  canUse,
                  availableSkills,
                }) => {
                  // Extract skill name from the skillGrant effect
                  const skillEffect = ability.effects.find(
                    (e) => e.type === "skillGrant"
                  );
                  const fixedSkill =
                    skillEffect?.type === "skillGrant"
                      ? skillEffect.skill
                      : null;
                  const needsSkillSelection =
                    !fixedSkill &&
                    availableSkills &&
                    availableSkills.length > 0;
                  const abilityKey = `${personnelId}:${ability.id}`;
                  const selectedSkill = selectedInterlinkSkills[abilityKey];

                  // For abilities with skill selection, require a skill to be selected
                  const canActivate =
                    canUse && (!needsSkillSelection || selectedSkill);

                  return (
                    <div
                      key={abilityKey}
                      className="dilemma-modal__interlink-item"
                    >
                      <span className="dilemma-modal__interlink-name">
                        {personnelName}
                      </span>
                      {needsSkillSelection ? (
                        // Skill selection dropdown
                        <select
                          className="dilemma-modal__interlink-select"
                          value={selectedSkill || ""}
                          onChange={(e) =>
                            setSelectedInterlinkSkills((prev) => ({
                              ...prev,
                              [abilityKey]: e.target.value as Skill,
                            }))
                          }
                          disabled={!canUse}
                        >
                          <option value="">Select skill...</option>
                          {availableSkills.map((skill) => (
                            <option key={skill} value={skill}>
                              {skill}
                            </option>
                          ))}
                        </select>
                      ) : (
                        // Fixed skill display
                        <span className="dilemma-modal__interlink-skill">
                          → {fixedSkill || "?"}
                        </span>
                      )}
                      <button
                        className="dilemma-modal__interlink-btn"
                        disabled={!canActivate}
                        onClick={() => {
                          const skillToGrant = fixedSkill || selectedSkill;
                          onExecuteInterlink(
                            personnelId,
                            ability.id,
                            skillToGrant || undefined
                          );
                        }}
                        title={
                          !canUse
                            ? "Not enough cards in deck"
                            : needsSkillSelection && !selectedSkill
                              ? "Select a skill first"
                              : `Discard 1 card to grant ${fixedSkill || selectedSkill} to all Borg`
                        }
                      >
                        Use
                      </button>
                    </div>
                  );
                }
              )}
            </div>
            <div className="dilemma-modal__interlink-cost">
              Cost: Discard top card of deck
            </div>
          </div>
        )}

        {/* Current dilemma card */}
        <div className="dilemma-modal__card">
          <CardSlot
            card={currentDilemma}
            size="medium"
            onClick={() => onCardClick?.(currentDilemma)}
          />

          <div className="dilemma-modal__card-info">
            <h3 className="dilemma-modal__card-name">{currentDilemma.name}</h3>
            <div className="dilemma-modal__card-type">
              {currentDilemma.where} Dilemma
            </div>

            {currentDilemma.skills && (
              <div className="dilemma-modal__requirements">
                <span className="dilemma-modal__req-label">Requires:</span>
                <span className="dilemma-modal__req-skills">
                  {Array.isArray(currentDilemma.skills[0])
                    ? (currentDilemma.skills as string[][])
                        .map((group) => group.join(" + "))
                        .join(" OR ")
                    : (currentDilemma.skills as string[]).join(" + ")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Result message */}
        {dilemmaResult?.message && (
          <div className="dilemma-modal__message">{dilemmaResult.message}</div>
        )}

        {/* Personnel selection - only when required */}
        {needsSelection &&
          onSelectPersonnel &&
          selectablePersonnel.length > 0 && (
            <div className="dilemma-modal__section">
              <h4 className="dilemma-modal__section-title">
                Select personnel to stop:
              </h4>
              <div className="dilemma-modal__personnel">
                {selectablePersonnel.map((person) => (
                  <div key={person.uniqueId} className="dilemma-modal__person">
                    <CardSlot
                      card={person}
                      size="thumb"
                      onClick={() => onCardClick?.(person)}
                    />
                    <span className="dilemma-modal__person-name">
                      {person.name}
                    </span>
                    <button
                      className="dilemma-modal__select-btn"
                      onClick={() => onSelectPersonnel(person.uniqueId!)}
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Stopped personnel display */}
        {stoppedPersonnel.length > 0 && (
          <div className="dilemma-modal__section">
            <h4 className="dilemma-modal__section-title dilemma-modal__section-title--stopped">
              Stopped:
            </h4>
            <div className="dilemma-modal__personnel dilemma-modal__personnel--stopped">
              {stoppedPersonnel.map((person) => (
                <div
                  key={person.uniqueId}
                  className="dilemma-modal__stopped-person"
                >
                  <CardSlot
                    card={person}
                    size="thumb"
                    dimmed
                    onClick={() => onCardClick?.(person)}
                  />
                  <span className="dilemma-modal__person-name">
                    {person.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Continue button - only when selection is NOT required */}
        {!needsSelection && onContinue && (
          <div className="dilemma-modal__actions">
            <button
              className="dilemma-modal__continue-btn"
              onClick={onContinue}
            >
              {unstoppedPersonnel.length === 0
                ? "Mission Failed"
                : encounter.currentDilemmaIndex <
                    encounter.selectedDilemmas.length - 1
                  ? "Next Dilemma"
                  : "Complete Mission"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
