import { useState, useRef } from "react";
import type { Card, ShipCard, PersonnelCard } from "../../types/card";
import type { MissionDeployment } from "../../types/gameState";
import { isShip, isPersonnel } from "../../types/card";
import { CardSlot } from "../GameBoard/CardSlot";
import { checkStaffed, calculateRangeCost } from "../../logic/shipMovement";
import { calculateGroupStats } from "../../logic/missionChecker";
import { getNextZIndex } from "./DraggablePanel";
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
}

interface DestinationInfo {
  missionIndex: number;
  name: string;
  rangeCost: number;
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
}: OrdersModalProps) {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [zIndex, setZIndex] = useState(1000);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Bring to front on any click
    setZIndex(getNextZIndex());

    // Only drag from header
    if (!(e.target as HTMLElement).closest(".orders-modal__header")) return;

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

  const mission = missions[currentMissionIndex];
  if (!isOpen || !mission) return null;

  const group = mission.groups[currentGroupIndex];
  if (!group) return null;

  const cards = group.cards;
  const ship = cards.find(isShip) as ShipCard | undefined;
  const personnel = cards.filter(isPersonnel) as PersonnelCard[];
  const unstoppedPersonnel = personnel.filter((p) => p.status === "Unstopped");
  const stoppedPersonnel = personnel.filter((p) => p.status === "Stopped");

  // Calculate group stats
  const stats = calculateGroupStats(cards);
  const skillEntries = Object.entries(stats.skills).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  // Check if ship can move
  const isStaffed = ship ? checkStaffed(cards) : false;

  // Calculate valid destinations with range costs
  const validDestinations: DestinationInfo[] = [];
  if (ship && isStaffed) {
    const currentMission = mission.mission;
    missions.forEach((m, idx) => {
      if (idx === currentMissionIndex) return; // Can't move to current location

      const rangeCost = calculateRangeCost(currentMission, m.mission);
      if (ship.rangeRemaining >= rangeCost) {
        validDestinations.push({
          missionIndex: idx,
          name: m.mission.name,
          rangeCost,
        });
      }
    });
  }

  // Get other groups at this mission for beaming
  const otherGroups = mission.groups
    .map((g, idx) => ({ group: g, index: idx }))
    .filter(({ index }) => index !== currentGroupIndex);

  return (
    <div
      ref={containerRef}
      className="orders-modal"
      style={{ left: position.x, top: position.y, zIndex }}
      onMouseDown={handleMouseDown}
    >
      <div className="orders-modal__header">
        <h2 className="orders-modal__title">Execute Orders</h2>
        <button className="orders-modal__close" onClick={onClose}>
          ×
        </button>
      </div>
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
                    <span className="orders-modal__skill-count">×{count}</span>
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
                  <span className="orders-modal__dest-name">{dest.name}</span>
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
                    mission.mission.missionType === "Planet" && (
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
                        → Planet
                      </button>
                    )}

                  {otherGroups
                    .filter(({ index }) => index > 0)
                    .map(({ group: targetGroup, index }) => {
                      const targetShip = targetGroup.cards.find(isShip);
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
                          → {targetShip?.name || `Group ${index}`}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}

        {unstoppedPersonnel.length === 0 && (
          <div className="orders-modal__no-options">
            No unstopped personnel to beam
          </div>
        )}
      </div>
    </div>
  );
}
