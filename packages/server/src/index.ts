import { GameServer } from "./server.js";

const PORT = parseInt(process.env.PORT || "8080", 10);

console.log("Starting Star Trek CCG WebSocket Server...");

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
