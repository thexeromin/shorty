import express from "express";

const app = express();

app.use(express.urlencoded({ extended: true }));

app.get("/status", (req, res) => {
  res.send("Working...\n");
});

export default app;
