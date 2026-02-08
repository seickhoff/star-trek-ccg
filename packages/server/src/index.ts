import { configureShuffle } from "@stccg/shared";
import { shuffle as cryptoShuffle } from "./game/RNG.js";
import { GameServer } from "./server.js";

// Inject crypto-secure shuffle into shared logic (dilemmaResolver, etc.)
configureShuffle(cryptoShuffle);

const PORT = parseInt(process.env.PORT || "8080", 10);

console.log("Starting Star Trek CCG 2E WebSocket Server...");

const server = new GameServer({ port: PORT });

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  server.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nShutting down server...");
  server.close();
  process.exit(0);
});

console.log(`Server ready. Waiting for connections on port ${PORT}...`);
