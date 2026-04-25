import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin.length ? env.corsOrigin : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.isProd ? "combined" : "dev"));

  app.use("/api", apiRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}
