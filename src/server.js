import { createApp } from "./app.js";
import { openDb } from "./db.js";

const PORT = Number(process.env.PORT) || 4000;
const DB_PATH = process.env.DB_PATH || "shorty.db";
const BASE_URL = process.env.BASE_URL || "";

const db = openDb(DB_PATH);
const app = createApp(db, { baseUrl: BASE_URL });

const server = app.listen(PORT, () => {
  console.log(`Shorty listening on http://localhost:${PORT}`);
});

let shuttingDown = false;

const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${signal} received, shutting down...`);

  server.close(() => {
    db.close();
    process.exit(0);
  });

  // Don't hang forever on open keep-alive connections.
  setTimeout(() => {
    try {
      db.close();
    } catch {
      // Already closed.
    }
    process.exit(1);
  }, 5000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
