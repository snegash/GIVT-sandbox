// server/index.js — GIVT API entry point.
import "dotenv/config";
import express from "express";
import cors from "cors";
import router from "./routes.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", router);

// JSON error handler (last).
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`GIVT API listening on http://localhost:${port}`));
