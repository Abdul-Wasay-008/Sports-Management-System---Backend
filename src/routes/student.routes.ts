import { Router } from "express";
import {
  committeeHandler,
  dashboardHandler,
  demoSlotsHandler,
  departmentTeamManagersHandler,
  departmentTrendsHandler,
  gameDetailsHandler,
  gameCategoriesHandler,
  gameManagersHandler,
  gamesHandler,
  myRegistrationsHandler,
  myStatsHandler,
  notificationsHandler,
  registerDemoHandler,
  registerGameHandler,
  resultsHandler,
  resultsStandingsHandler,
  rulesHandler,
  scheduleHandler,
  statsHandler,
} from "../controllers/student.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const studentRouter = Router();

studentRouter.use(requireAuth);

studentRouter.get("/dashboard", dashboardHandler);
studentRouter.get("/games", gamesHandler);
studentRouter.get("/games/:id/demo-slots", demoSlotsHandler);
studentRouter.post("/games/:id/register-demo", registerDemoHandler);
studentRouter.get("/games/:id", gameDetailsHandler);
studentRouter.post("/games/:id/register", registerGameHandler);
studentRouter.get("/registrations", myRegistrationsHandler);
studentRouter.get("/schedule", scheduleHandler);
studentRouter.get("/rules", rulesHandler);
studentRouter.get("/committee", committeeHandler);
studentRouter.get("/game-managers", gameManagersHandler);
studentRouter.get("/team-managers", departmentTeamManagersHandler);
studentRouter.get("/game-categories", gameCategoriesHandler);
studentRouter.get("/results", resultsHandler);
studentRouter.get("/results/standings", resultsStandingsHandler);
studentRouter.get("/stats", statsHandler);
studentRouter.get("/me/stats", myStatsHandler);
studentRouter.get("/department-trends", departmentTrendsHandler);
studentRouter.get("/notifications", notificationsHandler);
