import { Router } from "express";
import {
  teamManagerDashboardHandler,
  teamManagerDemoQueueHandler,
  teamManagerNotificationReadHandler,
  teamManagerNotificationsHandler,
  teamManagerRegistrationDecisionHandler,
} from "../controllers/team-manager.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireTeamManager } from "../middleware/team-manager.middleware.js";

export const teamManagerRouter = Router();

teamManagerRouter.use(requireAuth, requireTeamManager);

teamManagerRouter.get("/dashboard", teamManagerDashboardHandler);
teamManagerRouter.get("/demo-queue", teamManagerDemoQueueHandler);
teamManagerRouter.get("/notifications", teamManagerNotificationsHandler);
teamManagerRouter.patch("/notifications/:id/read", teamManagerNotificationReadHandler);
teamManagerRouter.patch("/registrations/:id/decision", teamManagerRegistrationDecisionHandler);
