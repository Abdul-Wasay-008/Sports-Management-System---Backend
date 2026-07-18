import { Router } from "express";
import { adminRouter } from "./admin.routes.js";
import { authRouter } from "./auth.routes.js";
import { healthRouter } from "./health.routes.js";
import { studentRouter } from "./student.routes.js";
import { teamManagerRouter } from "./team-manager.routes.js";
import { publicSportsWeekStatusHandler } from "../controllers/sports-week-settings.controller.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/student", studentRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/team-manager", teamManagerRouter);

// Public endpoint — no auth required
apiRouter.get("/sports-week/status", publicSportsWeekStatusHandler);
