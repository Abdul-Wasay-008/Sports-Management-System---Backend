import { Router } from "express";
import mongoose from "mongoose";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  const db =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: "ok",
    service: "sports-management-api",
    database: db,
  });
});
