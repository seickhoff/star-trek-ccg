import { useState } from "react";
import type {
  Card,
  ShipCard,
  PersonnelCard,
  Skill,
  MissionDeployment,
  GrantedSkill,
  Ability,
} from "@stccg/shared";
import { isShip, isPersonnel } from "@stccg/shared";
import { CardSlot } from "../GameBoard/CardSlot";
import { checkStaffed, calculateRangeCost } from "@stccg/shared";
import { calculateGroupStats, checkMission } from "@stccg/shared";
import { useDraggablePanel } from "../../hooks/useDraggablePanel";
import { SkillPicker } from "./SkillPicker";
import "./OrdersModal.css";

interface OrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  missions: MissionDeployment[];
  currentMissionIndex: number;
  currentGroupIndex: number;
  onCardClick?: (card: Card) => void;
  onMoveShip?: (
    sourceMission: number,
    groupIndex: number,
    destMission: number
  ) => void;
  onBeamToShip?: (
    personnelId: string,
    missionIndex: number,
    fromGroup: number,
    toGroup: number
  ) => void;
  onBeamToPlanet?: (
    personnelId: string,
    missionIndex: number,
    fromGroup: number
  ) => void;
  onBeamAllToShip?: (
    missionIndex: number,
    fromGroup: number,
    toGroup: number
  ) => void;
  onBeamAllToPlanet?: (missionIndex: number, fromGroup: number) => void;
  // Order abilities
  usedOrderAbilities?: string[];
  grantedSkills?: GrantedSkill[];
  deckSize?: number;
  onExecuteOrderAbility?: (
    cardUniqueId: string,
    abilityId: string,
    params?: {
      skill?: Skill;
      personnelIds?: string[];
      targetGroupIndex?: number;
    }
  ) => boolean;
}

interface DestinationInfo {
  missionIndex: number;
  name: string;
  rangeCost: number;
  attemptable: boolean;
  completed: boolean;
  isHeadquarters: boolean;
}

/**
 * Modal for executing orders - move ships, beam personnel
 */
export function OrdersModal({
  isOpen,
  onClose,
  missions,
  currentMissionIndex,
  currentGroupIndex,
  onCardClick,
  onMoveShip,
  onBeamToShip,
  onBeamToPlanet,
  onBeamAllToShip,
  onBeamAllToPlanet,
  usedOrderAbilities = [],
  grantedSkills = [],
  deckSize = 0,
  onExecuteOrderAbility,
}: OrdersModalProps) {
  const { position, zIndex, minimized, containerRef, handleMouseDown } =
    useDraggablePanel({ isOpen, initialPosition: { x: 50, y: 50 } });

  // State for skill picker
  const [skillPickerState, setSkillPickerState] = useState<{
    isOpen: boolean;
    cardUniqueId: string;
    abilityId: string;
  }>({ isOpen: false, cardUniqueId: "", abilityId: "" });

  // State for beamAllToShip ability selection
  const [beamSelectionState, setBeamSelectionState] = useState<{
    isSelecting: boolean;
    cardUniqueId: string;
    abilityId: string;
    selectedPersonnelIds: string[];
    step: "selectPersonnel" | "selectShip";
  }>({
    isSelecting: false,
    cardUniqueId: "",
    abilityId: "",
    selectedPersonnelIds: [],
    step: "selectPersonnel",
  });

  const mission = missions[currentMissionIndex];
  if (!isOpen || !mission) return null;

  const group = mission.groups[currentGroupIndex];
  if (!group) return null;

  const cards = group.cards;
  const ship = cards.find(isShip) as ShipCard | undefined;
  const personnel = cards.filter(isPersonnel) as PersonnelCard[];
  const unstoppedPersonnel = personnel.filter((p) => p.status === "Unstopped");
  const stoppedPersonnel = personnel.filter((p) => p.status === "Stopped");

  // Calculate group stats (include granted skills)
  const stats = calculateGroupStats(cards, grantedSkills);
  const skillEntries = Object.entries(stats.skills).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  // Check if ship can move
  const isStaffed = ship ? checkStaffed(cards) : false;

  // Calculate valid destinations with range costs and attemptability
  const validDestinations: DestinationInfo[] = [];
  if (ship && isStaffed) {
    const currentMission = mission.mission;
    missions.forEach((m, idx) => {
      if (idx === currentMissionIndex) return; // Can't move to current location

      const rangeCost = calculateRangeCost(currentMission, m.mission);
      if (ship.rangeRemaining >= rangeCost) {
        const destMission = m.mission;
        const isHQ = !destMission.skills || destMission.skills.length === 0;
        const completed = destMission.completed;

        // Check if current crew can attempt the destination mission
        let attemptable = false;
        if (!isHQ && !completed) {
          // Check affiliation match: at least one unstopped personnel must match
          const hasAffiliationMatch =
            !destMission.affiliation ||
            destMission.affiliation.length === 0 ||
            unstoppedPersonnel.some((p) =>
              p.affiliation.some((a) => destMission.affiliation!.includes(a))
            );
          // Check skill/attribute requirements
          const meetsRequirements = checkMission(
            cards,
            destMission,
            grantedSkills
          );
          attemptable = hasAffiliationMatch && meetsRequirements;
        }

        validDestinations.push({
          missionIndex: idx,
          name: destMission.name,
          rangeCost,
          attemptable,
          completed,
          isHeadquarters: isHQ,
        });
      }
    });
  }

  // Get other groups at this mission for beaming
  const otherGroups = mission.groups
    .map((g, idx) => ({ group: g, index: idx }))
    .filter(({ index }) => index !== currentGroupIndex);

  // Collect personnel with order abilities
  const personnelWithOrderAbilities = unstoppedPersonnel.filter((p) =>
    p.abilities?.some((a: Ability) => a.trigger === "order")
  );

  // Handle order ability execution
  const handleExecuteOrderAbility = (
    cardUniqueId: string,
    ability: Ability
  ) => {
    // Check if ability requires skill selection
    const skillGrantEffect = ability.effects.find(
      (e) => e.type === "skillGrant" && e.skill === null
    );

    // Check if ability has beamAllToShip effect
    const beamToShipEffect = ability.effects.find(
      (e) => e.type === "beamAllToShip"
    );

    if (skillGrantEffect) {
      // Open skill picker
      setSkillPickerState({
        isOpen: true,
        cardUniqueId,
        abilityId: ability.id,
      });
    } else if (beamToShipEffect) {
      // Start beam selection process
      setBeamSelectionState({
        isSelecting: true,
        cardUniqueId,
        abilityId: ability.id,
        selectedPersonnelIds: [],
        step: "selectPersonnel",
      });
    } else {
      // Execute directly
      onExecuteOrderAbility?.(cardUniqueId, ability.id);
    }
  };

  // Handle personnel selection toggle for beamAllToShip
  const handleTogglePersonnelForBeam = (personnelId: string) => {
    setBeamSelectionState((prev) => {
      const isSelected = prev.selectedPersonnelIds.includes(personnelId);
      return {
        ...prev,
        selectedPersonnelIds: isSelected
          ? prev.selectedPersonnelIds.filter((id) => id !== personnelId)
          : [...prev.selectedPersonnelIds, personnelId],
      };
    });
  };

  // Handle ship selection for beamAllToShip
  const handleSelectShipForBeam = (targetGroupIndex: number) => {
    onExecuteOrderAbility?.(
      beamSelectionState.cardUniqueId,
      beamSelectionState.abilityId,
      {
        personnelIds: beamSelectionState.selectedPersonnelIds,
        targetGroupIndex,
      }
    );
    // Reset state
    setBeamSelectionState({
      isSelecting: false,
      cardUniqueId: "",
      abilityId: "",
      selectedPersonnelIds: [],
      step: "selectPersonnel",
    });
  };

  // Cancel beam selection
  const handleCancelBeamSelection = () => {
    setBeamSelectionState({
      isSelecting: false,
      cardUniqueId: "",
      abilityId: "",
      selectedPersonnelIds: [],
      step: "selectPersonnel",
    });
  };

  // Handle skill selection from picker
  const handleSkillSelected = (skill: Skill) => {
    onExecuteOrderAbility?.(
      skillPickerState.cardUniqueId,
      skillPickerState.abilityId,
      { skill }
    );
    setSkillPickerState({ isOpen: false, cardUniqueId: "", abilityId: "" });
  };

  // Check if an ability can be used
  const canUseAbility = (cardUniqueId: string, ability: Ability): boolean => {
    // Check usage limit
    const usageKey = `${cardUniqueId}:${ability.id}`;
    if (
      ability.usageLimit === "oncePerTurn" &&
      usedOrderAbilities?.includes(usageKey)
    ) {
      return false;
    }

    // Check ability condition
    if (ability.condition) {
      if (ability.condition.type === "aboardShip") {
        // Personnel must be aboard a ship (current group index > 0 and has a ship)
        if (currentGroupIndex === 0) return false;
        if (!ship) return false;
      }
      // Add other condition types as needed
    }

    // Check cost
    if (ability.cost?.type === "discardFromDeck") {
      if (deckSize < ability.cost.count) return false;
    }

    // Check beamAllToShip requirements
    const beamToShipEffect = ability.effects.find(
      (e) => e.type === "beamAllToShip"
    );
    if (beamToShipEffect) {
      // Need at least one ship at this mission
      const hasShip = mission.groups.some(
        (g, idx) => idx > 0 && g.cards.some(isShip)
      );
      if (!hasShip) return false;

      // Need at least one other personnel at this mission (excluding the card itself)
      const otherPersonnel = mission.groups.flatMap((g) =>
        g.cards.filter((c) => isPersonnel(c) && c.uniqueId !== cardUniqueId)
      );
      if (otherPersonnel.length === 0) return false;
    }

    return true;
  };

  // Get ability description
  const getAbilityDescription = (ability: Ability): string => {
    const parts: string[] = [];

    // Describe cost
    if (ability.cost?.type === "discardFromDeck") {
      parts.push(`Cost: Discard ${ability.cost.count} from deck.`);
    } else if (ability.cost?.type === "sacrificeSelf") {
      parts.push("Cost: Sacrifice this personnel.");
    } else if (ability.cost?.type === "returnToHand") {
      parts.push("Cost: Return to hand.");
    }

    // Describe effects
    const skillGrant = ability.effects.find((e) => e.type === "skillGrant");
    if (skillGrant && skillGrant.type === "skillGrant") {
      if (skillGrant.skill) {
        parts.push(`Grants ${skillGrant.skill}`);
      } else {
        parts.push("Choose a skill to grant");
      }

      if (ability.target.species) {
        parts.push(`to all ${ability.target.species.join("/")}`);
      }
    }

    const handRefresh = ability.effects.find((e) => e.type === "handRefresh");
    if (handRefresh) {
      parts.push("Shuffle hand to bottom of deck, draw equal cards");
    }

    const beamToShip = ability.effects.find((e) => e.type === "beamAllToShip");
    if (beamToShip) {
      parts.push("Beam personnel at this mission aboard a ship");
    }

    const rangeModifier = ability.effects.find(
      (e) => e.type === "shipRangeModifier"
    );
    if (rangeModifier && rangeModifier.type === "shipRangeModifier") {
      const sign = rangeModifier.value >= 0 ? "+" : "";
      parts.push(`Ship Range ${sign}${rangeModifier.value}`);
    }

    if (ability.duration === "untilEndOfTurn") {
      parts.push("until end of turn");
    }

    if (ability.usageLimit === "oncePerTurn") {
      parts.push("(once per turn)");
    }

    return parts.join(" ");
  };

  return (
    <div
      ref={containerRef}
      className={`orders-modal${minimized ? " orders-modal--minimized" : ""}`}
      style={{
        left: position.x,
        top: position.y,
        zIndex,
        maxHeight: `calc(100vh - ${position.y}px - 20px)`,
      }}
      onMouseDown={(e) => handleMouseDown(e, ".orders-modal__header")}
    >
      <div className="orders-modal__header">
        <h2 className="orders-modal__title">Execute Orders</h2>
        <button className="orders-modal__close" onClick={onClose}>
          ×
        </button>
      </div>
      {!minimized && (
        <div className="orders-modal__content">
          {/* Current group info */}
          <div className="orders-modal__current">
            <h3 className="orders-modal__section-title">
              {ship ? `${ship.name}` : "Away Team"} at {mission.mission.name}
            </h3>

            <div className="orders-modal__cards">
              {cards.map((card) => (
                <CardSlot
                  key={card.uniqueId}
                  card={card}
                  size="thumb"
                  onClick={() => onCardClick?.(card)}
                />
              ))}
            </div>

            {/* Stats summary */}
            <div className="orders-modal__stats">
              <div className="orders-modal__stats-row">
                <span className="orders-modal__stat-label">Personnel:</span>
                <span className="orders-modal__stat-value">
                  {unstoppedPersonnel.length} ready
                  {stoppedPersonnel.length > 0 &&
                    `, ${stoppedPersonnel.length} stopped`}
                </span>
              </div>
              <div className="orders-modal__stats-row">
                <span className="orders-modal__stat orders-modal__stat--integrity">
                  I: {stats.integrity}
                </span>
                <span className="orders-modal__stat orders-modal__stat--cunning">
                  C: {stats.cunning}
                </span>
                <span className="orders-modal__stat orders-modal__stat--strength">
                  S: {stats.strength}
                </span>
              </div>
            </div>

            {/* Skills */}
            {skillEntries.length > 0 && (
              <div className="orders-modal__skills">
                {skillEntries.map(([skill, count]) => (
                  <span key={skill} className="orders-modal__skill">
                    {skill}
                    {count > 1 && (
                      <span className="orders-modal__skill-count">
                        ×{count}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {ship && (
              <div className="orders-modal__ship-status">
                <span>
                  Range: {ship.rangeRemaining}/{ship.range}
                </span>
                <span className={isStaffed ? "staffed" : "not-staffed"}>
                  {isStaffed ? "✓ Staffed" : "✗ Not staffed"}
                </span>
              </div>
            )}
          </div>

          {/* Ship movement options */}
          {ship && validDestinations.length > 0 && (
            <div className="orders-modal__section">
              <h4 className="orders-modal__section-title">Move Ship</h4>
              <div className="orders-modal__destinations">
                {validDestinations.map((dest) => (
                  <button
                    key={dest.missionIndex}
                    className="orders-modal__dest-btn"
                    onClick={() => {
                      onMoveShip?.(
                        currentMissionIndex,
                        currentGroupIndex,
                        dest.missionIndex
                      );
                      onClose();
                    }}
                  >
                    <span className="orders-modal__dest-name">
                      {dest.name}
                      {dest.completed && (
                        <span className="orders-modal__dest-status orders-modal__dest-status--completed">
                          Completed
                        </span>
                      )}
                      {!dest.completed && !dest.isHeadquarters && (
                        <span
                          className={`orders-modal__dest-status ${dest.attemptable ? "orders-modal__dest-status--ready" : "orders-modal__dest-status--not-ready"}`}
                        >
                          {dest.attemptable ? "Can attempt" : "Cannot attempt"}
                        </span>
                      )}
                    </span>
                    <span className="orders-modal__dest-cost">
                      Cost: {dest.rangeCost} range
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {ship && validDestinations.length === 0 && isStaffed && (
            <div className="orders-modal__no-options">
              No valid destinations (not enough range)
            </div>
          )}

          {ship && !isStaffed && (
            <div className="orders-modal__no-options">
              Cannot move - ship is not properly staffed
            </div>
          )}

          {/* Beam personnel options */}
          {unstoppedPersonnel.length > 0 && otherGroups.length > 0 && (
            <div className="orders-modal__section">
              <h4 className="orders-modal__section-title">Beam Personnel</h4>

              {unstoppedPersonnel.length > 1 && (
                <div className="orders-modal__beam-all">
                  {currentGroupIndex !== 0 &&
                    mission.mission.missionType !== "Space" && (
                      <button
                        className="orders-modal__beam-btn orders-modal__beam-btn--all"
                        onClick={() =>
                          onBeamAllToPlanet?.(
                            currentMissionIndex,
                            currentGroupIndex
                          )
                        }
                      >
                        All →{" "}
                        {mission.mission.missionType === "Headquarters"
                          ? mission.mission.name
                          : "Planet"}{" "}
                        ({unstoppedPersonnel.length})
                      </button>
                    )}
                  {otherGroups
                    .filter(({ index }) => index > 0)
                    .map(({ group: targetGroup, index }) => {
                      const targetShip = targetGroup.cards.find(isShip);
                      const personnelCount =
                        targetGroup.cards.filter(isPersonnel).length;
                      return (
                        <button
                          key={index}
                          className="orders-modal__beam-btn orders-modal__beam-btn--all"
                          onClick={() =>
                            onBeamAllToShip?.(
                              currentMissionIndex,
                              currentGroupIndex,
                              index
                            )
                          }
                        >
                          All → {targetShip?.name || `Group ${index}`} (
                          {personnelCount})
                        </button>
                      );
                    })}
                </div>
              )}

              <div className="orders-modal__beam-grid">
                {unstoppedPersonnel.map((person) => (
                  <div key={person.uniqueId} className="orders-modal__beam-row">
                    <div className="orders-modal__beam-person">
                      <CardSlot
                        card={person}
                        size="thumb"
                        onClick={() => onCardClick?.(person)}
                      />
                      <span className="orders-modal__person-name">
                        {person.name}
                      </span>
                    </div>

                    <div className="orders-modal__beam-targets">
                      {currentGroupIndex !== 0 &&
                        mission.mission.missionType !== "Space" && (
                          <button
                            className="orders-modal__beam-btn"
                            onClick={() => {
                              onBeamToPlanet?.(
                                person.uniqueId!,
                                currentMissionIndex,
                                currentGroupIndex
                              );
                            }}
                          >
                            →{" "}
                            {mission.mission.missionType === "Headquarters"
                              ? mission.mission.name
                              : "Planet"}
                          </button>
                        )}

                      {otherGroups
                        .filter(({ index }) => index > 0)
                        .map(({ group: targetGroup, index }) => {
                          const targetShip = targetGroup.cards.find(isShip);
                          const personnelCount =
                            targetGroup.cards.filter(isPersonnel).length;
                          return (
                            <button
                              key={index}
                              className="orders-modal__beam-btn"
                              onClick={() => {
                                onBeamToShip?.(
                                  person.uniqueId!,
                                  currentMissionIndex,
                                  currentGroupIndex,
                                  index
                                );
                              }}
                            >
                              → {targetShip?.name || `Group ${index}`} (
                              {personnelCount})
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unstoppedPersonnel.length === 0 && (
            <div className="orders-modal__no-options">
              No unstopped personnel to beam
            </div>
          )}

          {/* Order abilities section */}
          {personnelWithOrderAbilities.length > 0 && (
            <div className="orders-modal__section">
              <h4 className="orders-modal__section-title">Order Abilities</h4>

              <div className="orders-modal__ability-grid">
                {personnelWithOrderAbilities.map((person) => {
                  const orderAbilities =
                    person.abilities?.filter(
                      (a: Ability) => a.trigger === "order"
                    ) || [];

                  return (
                    <div
                      key={person.uniqueId}
                      className="orders-modal__ability-row"
                    >
                      <div className="orders-modal__ability-person">
                        <CardSlot
                          card={person}
                          size="thumb"
                          onClick={() => onCardClick?.(person)}
                        />
                        <span className="orders-modal__person-name">
                          {person.name}
                        </span>
                      </div>

                      <div className="orders-modal__abilities">
                        {orderAbilities.map((ability: Ability) => {
                          const isUsable = canUseAbility(
                            person.uniqueId!,
                            ability
                          );
                          const usageKey = `${person.uniqueId}:${ability.id}`;
                          const isUsed = usedOrderAbilities?.includes(usageKey);

                          return (
                            <button
                              key={ability.id}
                              className={`orders-modal__ability-btn ${
                                isUsed ? "orders-modal__ability-btn--used" : ""
                              } ${!isUsable ? "orders-modal__ability-btn--disabled" : ""}`}
                              disabled={!isUsable}
                              onClick={() =>
                                handleExecuteOrderAbility(
                                  person.uniqueId!,
                                  ability
                                )
                              }
                            >
                              <span className="orders-modal__ability-name">
                                Order
                              </span>
                              <span className="orders-modal__ability-desc">
                                {getAbilityDescription(ability)}
                              </span>
                              {isUsed && (
                                <span className="orders-modal__ability-used">
                                  (Used)
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active granted skills display */}
          {grantedSkills.length > 0 && (
            <div className="orders-modal__section">
              <h4 className="orders-modal__section-title">
                Active Skill Grants
              </h4>
              <div className="orders-modal__granted-skills">
                {grantedSkills.map((grant, idx) => (
                  <span key={idx} className="orders-modal__granted-skill">
                    {grant.skill}
                    {grant.target.species && (
                      <span className="orders-modal__granted-target">
                        {" → "}
                        {grant.target.species.join("/")}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Beam to ship selection UI */}
          {beamSelectionState.isSelecting && (
            <div className="orders-modal__section orders-modal__beam-selection">
              <h4 className="orders-modal__section-title">
                {beamSelectionState.step === "selectPersonnel"
                  ? "Select Personnel to Beam"
                  : "Select Target Ship"}
              </h4>

              {beamSelectionState.step === "selectPersonnel" && (
                <>
                  <p className="orders-modal__beam-instructions">
                    Select personnel at this mission to beam aboard a ship.
                  </p>
                  <div className="orders-modal__beam-personnel-list">
                    {/* List all personnel at this mission (across all groups) */}
                    {mission.groups.flatMap((group, gIdx) =>
                      group.cards
                        .filter(isPersonnel)
                        .filter(
                          (p) =>
                            (p as PersonnelCard).uniqueId !==
                            beamSelectionState.cardUniqueId
                        )
                        .map((p) => {
                          const personnel = p as PersonnelCard;
                          const isSelected =
                            beamSelectionState.selectedPersonnelIds.includes(
                              personnel.uniqueId!
                            );
                          return (
                            <button
                              key={personnel.uniqueId}
                              className={`orders-modal__beam-person-btn ${
                                isSelected
                                  ? "orders-modal__beam-person-btn--selected"
                                  : ""
                              }`}
                              onClick={() =>
                                handleTogglePersonnelForBeam(
                                  personnel.uniqueId!
                                )
                              }
                            >
                              <CardSlot card={personnel} size="thumb" />
                              <span>{personnel.name}</span>
                              {gIdx > 0 && (
                                <span className="orders-modal__beam-location">
                                  (aboard)
                                </span>
                              )}
                              {isSelected && (
                                <span className="orders-modal__beam-check">
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        })
                    )}
                  </div>
                  <div className="orders-modal__beam-actions">
                    <button
                      className="orders-modal__beam-cancel"
                      onClick={handleCancelBeamSelection}
                    >
                      Cancel
                    </button>
                    <button
                      className="orders-modal__beam-next"
                      disabled={
                        beamSelectionState.selectedPersonnelIds.length === 0
                      }
                      onClick={() =>
                        setBeamSelectionState((prev) => ({
                          ...prev,
                          step: "selectShip",
                        }))
                      }
                    >
                      Next: Select Ship (
                      {beamSelectionState.selectedPersonnelIds.length} selected)
                    </button>
                  </div>
                </>
              )}

              {beamSelectionState.step === "selectShip" && (
                <>
                  <p className="orders-modal__beam-instructions">
                    Select a ship to beam{" "}
                    {beamSelectionState.selectedPersonnelIds.length} personnel
                    aboard.
                  </p>
                  <div className="orders-modal__beam-ship-list">
                    {mission.groups
                      .map((group, gIdx) => ({ group, gIdx }))
                      .filter(({ gIdx }) => gIdx > 0) // Only ship groups
                      .filter(({ group }) => group.cards.some(isShip))
                      .map(({ group, gIdx }) => {
                        const shipCard = group.cards.find(isShip) as ShipCard;
                        const crewCount =
                          group.cards.filter(isPersonnel).length;
                        return (
                          <button
                            key={gIdx}
                            className="orders-modal__beam-ship-btn"
                            onClick={() => handleSelectShipForBeam(gIdx)}
                          >
                            <CardSlot card={shipCard} size="thumb" />
                            <div className="orders-modal__beam-ship-info">
                              <span className="orders-modal__beam-ship-name">
                                {shipCard.name}
                              </span>
                              <span className="orders-modal__beam-ship-crew">
                                {crewCount} aboard
                              </span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                  <div className="orders-modal__beam-actions">
                    <button
                      className="orders-modal__beam-back"
                      onClick={() =>
                        setBeamSelectionState((prev) => ({
                          ...prev,
                          step: "selectPersonnel",
                        }))
                      }
                    >
                      Back
                    </button>
                    <button
                      className="orders-modal__beam-cancel"
                      onClick={handleCancelBeamSelection}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Skill picker modal */}
      <SkillPicker
        isOpen={skillPickerState.isOpen}
        onClose={() =>
          setSkillPickerState({
            isOpen: false,
            cardUniqueId: "",
            abilityId: "",
          })
        }
        onSelect={handleSkillSelected}
        title="Choose a skill to grant"
      />
    </div>
  );
}
