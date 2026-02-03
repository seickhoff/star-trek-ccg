import type { Card, PersonnelCard } from "../../types/card";
import { isPersonnel, isShip } from "../../types/card";
import { DraggablePanel } from "./DraggablePanel";
import { CardSlot } from "../GameBoard/CardSlot";
import { calculateGroupStats } from "../../logic/missionChecker";
import "./GroupViewer.css";

interface GroupViewerProps {
  cards: Card[];
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onCardClick?: (card: Card) => void;
}

/**
 * Modal for viewing group details and stats
 */
export function GroupViewer({
  cards,
  title,
  isOpen,
  onClose,
  onCardClick,
}: GroupViewerProps) {
  const stats = calculateGroupStats(cards);

  // Get unstopped personnel count
  const personnel = cards.filter(isPersonnel) as PersonnelCard[];
  const unstopped = personnel.filter((p) => p.status === "Unstopped").length;
  const stopped = personnel.filter((p) => p.status === "Stopped").length;

  // Convert skills object to sorted array
  const skillEntries = Object.entries(stats.skills).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <DraggablePanel
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      width="400px"
    >
      <div className="group-viewer">
        {/* Stats summary */}
        <div className="group-viewer__stats">
          <div className="group-viewer__stat-row">
            <span className="group-viewer__stat-label">Personnel:</span>
            <span className="group-viewer__stat-value">
              {unstopped} ready{stopped > 0 && `, ${stopped} stopped`}
            </span>
          </div>

          <div className="group-viewer__stat-row">
            <span className="group-viewer__stat-label">Integrity:</span>
            <span className="group-viewer__stat-value">{stats.integrity}</span>
          </div>

          <div className="group-viewer__stat-row">
            <span className="group-viewer__stat-label">Cunning:</span>
            <span className="group-viewer__stat-value">{stats.cunning}</span>
          </div>

          <div className="group-viewer__stat-row">
            <span className="group-viewer__stat-label">Strength:</span>
            <span className="group-viewer__stat-value">{stats.strength}</span>
          </div>
        </div>

        {/* Skills */}
        <div className="group-viewer__skills">
          <div className="group-viewer__skills-title">Skills:</div>
          <div className="group-viewer__skills-list">
            {skillEntries.length === 0 ? (
              <span className="group-viewer__no-skills">No skills</span>
            ) : (
              skillEntries.map(([skill, count]) => (
                <span key={skill} className="group-viewer__skill">
                  {skill}
                  {count > 1 && (
                    <span className="group-viewer__skill-count">×{count}</span>
                  )}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Cards */}
        <div className="group-viewer__cards">
          <div className="group-viewer__cards-title">Cards:</div>
          <div className="group-viewer__cards-grid">
            {cards.map((card) => (
              <div key={card.uniqueId} className="group-viewer__card">
                <CardSlot
                  card={card}
                  size="thumb"
                  onClick={() => onCardClick?.(card)}
                />
                <div className="group-viewer__card-info">
                  <span className="group-viewer__card-name">{card.name}</span>
                  {isPersonnel(card) && (
                    <span
                      className={`group-viewer__card-status group-viewer__card-status--${(card as PersonnelCard).status.toLowerCase()}`}
                    >
                      {(card as PersonnelCard).status}
                    </span>
                  )}
                  {isShip(card) && (
                    <span className="group-viewer__card-type">Ship</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DraggablePanel>
  );
}
