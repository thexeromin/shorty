import app from "./app.js";
import db from "./db.js";

const PORT = process.env.PORT || 3000;

const startServer = () => {
  const server = app.listen(PORT, () => {
    console.log(`Listening on port: ${PORT}`);
  });

  const shutdown = () => {
    console.log("Shutting down...");
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startServer();
