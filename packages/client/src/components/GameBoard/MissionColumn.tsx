import type {
  Card,
  PersonnelCard,
  ShipCard,
  MissionDeployment,
  GrantedSkill,
} from "@stccg/shared";
import { isPersonnel, isShip } from "@stccg/shared";
import { CardSlot } from "./CardSlot";
import { checkMission, calculateGroupStats } from "@stccg/shared";
import "./MissionColumn.css";

interface MissionColumnProps {
  deployment: MissionDeployment;
  missionIndex: number;
  isHeadquarters: boolean;
  onCardClick?: (card: Card) => void;
  onGroupClick?: (missionIndex: number, groupIndex: number) => void;
  onAttemptMission?: (missionIndex: number, groupIndex: number) => void;
  onDilemmasClick?: (missionIndex: number) => void;
  canAttempt?: boolean;
  grantedSkills?: GrantedSkill[];
}

/**
 * Display a single mission column with all deployed cards
 * Shows mission card, personnel groups, and dilemmas
 */
export function MissionColumn({
  deployment,
  missionIndex,
  isHeadquarters,
  onCardClick,
  onGroupClick,
  onAttemptMission,
  onDilemmasClick,
  canAttempt = false,
  grantedSkills = [],
}: MissionColumnProps) {
  const { mission, groups, dilemmas } = deployment;

  // Calculate group stats for display
  const getGroupSummary = (
    cards: Card[]
  ): { personnel: number; ships: number; stopped: number } => {
    const personnel = cards.filter(isPersonnel);
    const ships = cards.filter(isShip);
    const stopped = personnel.filter(
      (p) => (p as PersonnelCard).status === "Stopped"
    ).length;
    return { personnel: personnel.length, ships: ships.length, stopped };
  };

  return (
    <div
      className={`mission-column ${isHeadquarters ? "mission-column--headquarters" : ""} ${mission.completed ? "mission-column--completed" : ""}`}
    >
      {/* Mission card area */}
      <div className="mission-column__mission">
        <CardSlot
          card={mission}
          size="small"
          orientation="landscape"
          onClick={() => onCardClick?.(mission)}
        />

        {/* Mission info overlay */}
        <div className="mission-column__mission-info">
          <span className="mission-column__mission-name">{mission.name}</span>
          {mission.score && (
            <span className="mission-column__mission-score">
              {mission.score} pts
            </span>
          )}
          {mission.completed && (
            <span className="mission-column__completed-badge">✓</span>
          )}
        </div>

        {/* Dilemmas at mission (overcome + placed on mission) */}
        {dilemmas.length > 0 &&
          (() => {
            const overcomeCount = dilemmas.filter((d) => d.overcome).length;
            const placedCount = dilemmas.length - overcomeCount;
            return (
              <div
                className="mission-column__dilemma-badge"
                onClick={(e) => {
                  e.stopPropagation();
                  onDilemmasClick?.(missionIndex);
                }}
                title={`${overcomeCount} overcome, ${placedCount} placed on mission (click to view)`}
              >
                {overcomeCount > 0 && (
                  <>
                    <span className="mission-column__dilemma-badge-count">
                      {overcomeCount}
                    </span>
                    <span className="mission-column__dilemma-badge-label">
                      overcome
                    </span>
                  </>
                )}
                {placedCount > 0 && (
                  <>
                    <span className="mission-column__dilemma-badge-count mission-column__dilemma-badge-count--placed">
                      {placedCount}
                    </span>
                    <span className="mission-column__dilemma-badge-label">
                      placed
                    </span>
                  </>
                )}
              </div>
            );
          })()}
      </div>

      {/* Personnel/Ship deployment area */}
      <div className="mission-column__personnel">
        {groups.map((group, groupIndex) => {
          // Space missions have no planet surface — personnel are always aboard ships
          if (groupIndex === 0 && mission.missionType === "Space") return null;

          const summary = getGroupSummary(group.cards);
          const stats = calculateGroupStats(group.cards, grantedSkills);
          const isShipGroup = groupIndex > 0;

          // Find the ship in ship groups
          const shipCard = isShipGroup ? group.cards.find(isShip) : null;

          // Format skills for display
          const skillsList = Object.entries(stats.skills)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([skill, count]) =>
              count > 1 ? `${skill} x${count}` : skill
            );

          return (
            <div
              key={groupIndex}
              className={`mission-column__group ${isShipGroup ? "mission-column__group--ship" : "mission-column__group--planet"}`}
              onClick={() => onGroupClick?.(missionIndex, groupIndex)}
            >
              {/* Group header */}
              <div className="mission-column__group-header">
                {isShipGroup && shipCard ? (
                  <span className="mission-column__ship-name">
                    {shipCard.name}
                    <span className="mission-column__ship-range">
                      ({(shipCard as ShipCard).rangeRemaining}/
                      {(shipCard as ShipCard).range})
                    </span>
                  </span>
                ) : (
                  <span className="mission-column__group-label">
                    {isHeadquarters ? "HQ" : "Away Team"}
                  </span>
                )}

                {summary.personnel > 0 && (
                  <span className="mission-column__group-count">
                    {summary.personnel - summary.stopped}/{summary.personnel}
                  </span>
                )}
              </div>

              {/* Cards in group */}
              <div className="mission-column__cards">
                {group.cards.length === 0 ? (
                  <div className="mission-column__empty">Empty</div>
                ) : (
                  group.cards.map((card) => (
                    <CardSlot
                      key={card.uniqueId}
                      card={card}
                      size="thumb"
                      onClick={() => onCardClick?.(card)}
                      showStatus={true}
                    />
                  ))
                )}
              </div>

              {/* Stats summary */}
              {stats.unstoppedPersonnel > 0 && (
                <div className="mission-column__stats">
                  <div className="mission-column__stats-attributes">
                    <span className="mission-column__stat mission-column__stat--integrity">
                      I:{stats.integrity}
                    </span>
                    <span className="mission-column__stat mission-column__stat--cunning">
                      C:{stats.cunning}
                    </span>
                    <span className="mission-column__stat mission-column__stat--strength">
                      S:{stats.strength}
                    </span>
                  </div>
                  {skillsList.length > 0 && (
                    <div className="mission-column__stats-skills">
                      {skillsList.join(", ")}
                    </div>
                  )}
                </div>
              )}

              {/* Attempt mission button */}
              {canAttempt &&
                !mission.completed &&
                summary.personnel > summary.stopped &&
                mission.missionType !== "Headquarters" &&
                // Planet missions: must be on planet (group 0)
                // Space missions: must be on a ship (group > 0)
                ((mission.missionType === "Planet" && groupIndex === 0) ||
                  (mission.missionType === "Space" && groupIndex > 0)) &&
                (() => {
                  const meetsRequirements = checkMission(
                    group.cards,
                    mission,
                    grantedSkills
                  );
                  return (
                    <button
                      className={`mission-column__attempt-btn ${!meetsRequirements ? "mission-column__attempt-btn--disabled" : ""}`}
                      disabled={!meetsRequirements}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (meetsRequirements) {
                          onAttemptMission?.(missionIndex, groupIndex);
                        }
                      }}
                      title={
                        !meetsRequirements ? "Requirements not met" : undefined
                      }
                    >
                      Attempt Mission
                    </button>
                  );
                })()}
            </div>
          );
        })}

        {/* Show empty state if no groups */}
        {groups.length === 0 && (
          <div className="mission-column__empty-personnel">
            No cards deployed
          </div>
        )}
      </div>
    </div>
  );
}
