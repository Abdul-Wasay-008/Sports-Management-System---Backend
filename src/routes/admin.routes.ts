import { Router } from "express";
import {
  adminCreateGameHandler,
  adminCreateResultHandler,
  adminCreateStudentHandler,
  adminDeleteGameHandler,
  adminDeleteResultHandler,
  adminDeleteStudentHandler,
  adminGameRegistrationsHandler,
  adminListGamesHandler,
  adminListResultsHandler,
  adminListStudentsHandler,
  adminLookupsHandler,
  adminOverviewHandler,
  adminSetStudentStatusHandler,
  adminStatsHandler,
  adminUpdateGameHandler,
  adminUpdateResultHandler,
  adminUpdateStudentHandler,
} from "../controllers/admin.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/overview", adminOverviewHandler);
adminRouter.get("/students", adminListStudentsHandler);
adminRouter.post("/students", adminCreateStudentHandler);
adminRouter.patch("/students/:id", adminUpdateStudentHandler);
adminRouter.patch("/students/:id/status", adminSetStudentStatusHandler);
adminRouter.delete("/students/:id", adminDeleteStudentHandler);

adminRouter.get("/games", adminListGamesHandler);
adminRouter.post("/games", adminCreateGameHandler);
adminRouter.patch("/games/:id", adminUpdateGameHandler);
adminRouter.delete("/games/:id", adminDeleteGameHandler);
adminRouter.get("/games/:id/registrations", adminGameRegistrationsHandler);

adminRouter.get("/stats", adminStatsHandler);
adminRouter.get("/lookups", adminLookupsHandler);

adminRouter.get("/results", adminListResultsHandler);
adminRouter.post("/results", adminCreateResultHandler);
adminRouter.patch("/results/:id", adminUpdateResultHandler);
adminRouter.delete("/results/:id", adminDeleteResultHandler);
