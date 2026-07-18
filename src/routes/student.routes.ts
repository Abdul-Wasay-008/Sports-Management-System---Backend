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
import { requireSportsWeekActive } from "../middleware/sports-week.middleware.js";

export const studentRouter = Router();

studentRouter.use(requireAuth);

studentRouter.get("/dashboard", dashboardHandler);
studentRouter.get("/games", gamesHandler);
// Demo slots and registration require an active sports week
studentRouter.get("/games/:id/demo-slots", requireSportsWeekActive, demoSlotsHandler);
studentRouter.post("/games/:id/register-demo", requireSportsWeekActive, registerDemoHandler);
studentRouter.get("/games/:id", gameDetailsHandler);
studentRouter.post("/games/:id/register", requireSportsWeekActive, registerGameHandler);
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
