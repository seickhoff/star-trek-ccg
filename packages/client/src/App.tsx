import { GameBoardWrapper } from "./components/GameBoardWrapper";
import { ConnectionScreen } from "./components/ConnectionScreen";
import { useWebSocket } from "./hooks/useWebSocket";
import { useConnectionStore } from "./store/connectionStore";

function App() {
  const { connect, sendAction, gameState } = useWebSocket();
  const { connected } = useConnectionStore();

  if (!connected || !gameState) {
    return <ConnectionScreen onConnect={connect} />;
  }

  return <GameBoardWrapper serverState={gameState} sendAction={sendAction} />;
}

export default App;
