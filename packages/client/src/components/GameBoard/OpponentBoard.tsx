import type { OpponentPublicState, Card, ShipCard } from "@stccg/shared";
import { isPersonnel, isShip } from "@stccg/shared";
import type { PersonnelCard } from "@stccg/shared";
import "./OpponentBoard.css";

interface OpponentBoardProps {
  opponentState: OpponentPublicState;
  isOpponentTurn: boolean;
}

/**
 * Displays the AI opponent's board (missions with deployed cards).
 * Read-only — no interactive controls.
 * Personnel are concealed (face-down); ships are visible.
 */
export function OpponentBoard({
  opponentState,
  isOpponentTurn,
}: OpponentBoardProps) {
  return (
    <div
      className={`opponent-board ${isOpponentTurn ? "opponent-board--active" : ""}`}
    >
      <div className="opponent-board__header">
        <span className="opponent-board__label">
          AI Opponent
          {isOpponentTurn && (
            <span className="opponent-board__thinking"> - Playing...</span>
          )}
        </span>
        <div className="opponent-board__stats">
          <span className="opponent-board__stat">
            Score: <strong>{opponentState.score}</strong>
          </span>
          <span className="opponent-board__stat">
            Deck: {opponentState.deckCount}
          </span>
          <span className="opponent-board__stat">
            Hand: {opponentState.handCount}
          </span>
          <span className="opponent-board__stat">
            Dilemmas: {opponentState.dilemmaPoolCount}
          </span>
        </div>
      </div>

      <div className="opponent-board__missions">
        {opponentState.missions.map((deployment, index) => {
          const mission = deployment.mission;
          const allCards = deployment.groups.flatMap((g) => g.cards);
          const personnel = allCards.filter(isPersonnel) as PersonnelCard[];
          const ships = allCards.filter(isShip) as ShipCard[];
          const stoppedCount = personnel.filter(
            (c) => c.status === "Stopped"
          ).length;
          const overcomeCount = deployment.dilemmas.filter(
            (d) => d.overcome
          ).length;

          return (
            <div
              key={mission.uniqueId || index}
              className={`opponent-mission ${mission.completed ? "opponent-mission--completed" : ""} ${mission.missionType === "Headquarters" ? "opponent-mission--hq" : ""}`}
            >
              <div className="opponent-mission__name" title={mission.name}>
                {mission.name}
              </div>
              <div className="opponent-mission__type">
                {mission.missionType}
                {mission.score ? ` (${mission.score}pts)` : ""}
              </div>

              {/* Ship cards (visible) */}
              {ships.length > 0 && (
                <div className="opponent-mission__cards">
                  {ships.map((ship) => (
                    <img
                      key={ship.uniqueId}
                      src={ship.jpg}
                      alt={ship.name}
                      title={ship.name}
                      className="opponent-mission__card opponent-mission__card--ship"
                    />
                  ))}
                </div>
              )}

              {/* Personnel (concealed — face-down) */}
              {personnel.length > 0 && (
                <div className="opponent-mission__crew">
                  <div className="opponent-mission__cards">
                    {personnel.map((p) => (
                      <ConcealedPersonnel key={p.uniqueId} card={p} />
                    ))}
                  </div>
                  {stoppedCount > 0 && (
                    <span className="opponent-mission__stopped">
                      {stoppedCount} stopped
                    </span>
                  )}
                </div>
              )}

              {deployment.dilemmas.length > 0 && (
                <div className="opponent-mission__dilemmas">
                  {overcomeCount > 0 && (
                    <span className="opponent-mission__dilemmas-overcome">
                      {overcomeCount} beneath
                    </span>
                  )}
                  {overcomeCount > 0 &&
                    deployment.dilemmas.length - overcomeCount > 0 && (
                      <span className="opponent-mission__dilemmas-sep">
                        {" / "}
                      </span>
                    )}
                  {deployment.dilemmas.length - overcomeCount > 0 && (
                    <span className="opponent-mission__dilemmas-placed">
                      {deployment.dilemmas.length - overcomeCount} on mission
                    </span>
                  )}
                </div>
              )}
              {mission.completed && (
                <div className="opponent-mission__complete-badge">Done</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A single concealed personnel card (face-down with stopped indicator) */
function ConcealedPersonnel({ card }: { card: Card }) {
  const isStopped =
    isPersonnel(card) && (card as PersonnelCard).status === "Stopped";
  return (
    <div
      className={`opponent-mission__card opponent-mission__card--personnel ${isStopped ? "opponent-mission__card--stopped" : ""}`}
      title={isStopped ? "Personnel (Stopped)" : "Personnel"}
    >
      <img
        src="images/card-back.jpg"
        alt="Face-down personnel"
        className="opponent-mission__card-img"
      />
      {isStopped && <div className="opponent-mission__stopped-badge">S</div>}
    </div>
  );
}
