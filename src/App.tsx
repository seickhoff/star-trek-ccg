import { cardDatabase, defaultDeck, DECK_STATS } from "./data";

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>Star Trek CCG 2E</h1>
        <p>Solitaire Edition</p>
      </header>

      <main className="main">
        <section className="info-panel">
          <h2>Game Ready</h2>
          <p>
            Card Database: <strong>{Object.keys(cardDatabase).length}</strong>{" "}
            cards loaded
          </p>
          <p>
            Default Deck: <strong>{defaultDeck.length}</strong> cards
          </p>
          <ul>
            <li>Missions: {DECK_STATS.missions}</li>
            <li>Personnel: {DECK_STATS.personnel}</li>
            <li>Ships: {DECK_STATS.ships}</li>
            <li>Dilemmas: {DECK_STATS.dilemmas.total}</li>
          </ul>
        </section>

        <p className="status">
          Phase 1 Complete - TypeScript types and data ported successfully.
        </p>
      </main>
    </div>
  );
}

export default App;
