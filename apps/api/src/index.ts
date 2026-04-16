/**
 * Application entry point.
 * Initializes the Express server, registers middleware, mounts route modules,
 * and connects to the database before starting to listen for requests.
 */
import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { AppDataSource } from "./data-source";
import employeesRouter from "./routes/employees";
import shiftsRouter from "./routes/schedule";
import schedulesRouter from "./routes/schedules";
import chatRouter from "./routes/chat";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// CORS_ORIGIN accepts a single origin or a comma-separated list (e.g. for staging + prod).
const corsOrigin = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigin.length === 1 ? corsOrigin[0] : corsOrigin }));
app.use(express.json({ limit: "1mb" }));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Route modules
app.use("/employees", employeesRouter);
app.use("/shifts", shiftsRouter);
app.use("/schedules", schedulesRouter);
app.use("/chat", chatRouter);

// Initialize database and start server
AppDataSource.initialize()
  .then(() => {
    console.log("Database connected");
    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err instanceof Error ? { message: err.message, stack: err.stack } : err);
    process.exit(1);
  });

export default app;
