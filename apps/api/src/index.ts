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

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/employees", employeesRouter);
app.use("/shifts", shiftsRouter);
app.use("/schedules", schedulesRouter);
app.use("/chat", chatRouter);

AppDataSource.initialize()
  .then(() => {
    console.log("Database connected");
    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });

export default app;
