import type { Card, MissionDeployment, GrantedSkill } from "@stccg/shared";
import { CardSlot } from "./CardSlot";
import { MissionColumn } from "./MissionColumn";
import "./MissionTabs.css";

interface MissionTabsProps {
  missions: MissionDeployment[];
  headquartersIndex: number;
  selectedIndex: number;
  onSelectMission: (index: number) => void;
  onCardClick?: (card: Card) => void;
  onGroupClick?: (missionIndex: number, groupIndex: number) => void;
  onAttemptMission?: (missionIndex: number, groupIndex: number) => void;
  onDilemmasClick?: (missionIndex: number) => void;
  canAttempt?: boolean;
  grantedSkills?: GrantedSkill[];
}

export function MissionTabs({
  missions,
  headquartersIndex,
  selectedIndex,
  onSelectMission,
  onCardClick,
  onGroupClick,
  onAttemptMission,
  onDilemmasClick,
  canAttempt = false,
  grantedSkills = [],
}: MissionTabsProps) {
  const safeIndex = Math.min(selectedIndex, missions.length - 1);
  const selected = missions[safeIndex];

  if (!selected) return null;

  return (
    <div className="mission-tabs">
      {/* Mission card strip — 5 equal-width mission card images */}
      <div className="mission-tabs__strip">
        {missions.map((deployment, index) => {
          const isActive = index === safeIndex;

          return (
            <div
              key={deployment.mission.uniqueId || index}
              className={`mission-tabs__card ${isActive ? "mission-tabs__card--active" : ""}`}
              onClick={() => {
                if (isActive) {
                  onCardClick?.(deployment.mission);
                } else {
                  onSelectMission(index);
                }
              }}
            >
              <CardSlot
                card={deployment.mission}
                size="thumb"
                orientation="landscape"
                dimmed={!isActive}
                showStatus={false}
              />
              {deployment.mission.completed && (
                <span className="mission-tabs__card-label">✓</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail: single mission at full width */}
      <div className="mission-tabs__detail">
        <MissionColumn
          deployment={selected}
          missionIndex={safeIndex}
          isHeadquarters={safeIndex === headquartersIndex}
          onCardClick={onCardClick}
          onGroupClick={onGroupClick}
          onAttemptMission={onAttemptMission}
          onDilemmasClick={onDilemmasClick}
          canAttempt={canAttempt}
          grantedSkills={grantedSkills}
          compact
        />
      </div>
    </div>
  );
}
