import express from "express";
import { ActivityLogController } from "../controllers/activityLogController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { courseRole } from "../middlewares/courseRole.js";
import { verifyAccessToken } from "../utils/jwt.js";

const router = express.Router();


function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (match) {
    try {
      const payload = verifyAccessToken(match[1]);
      req.user = {
        username: payload.sub,
        role: payload.role === "ta" ? "student" : payload.role,
      };
    } catch {
    }
  }
  next();
}

router.param("courseCode", courseRole.byCode);

router.post("/activity-logs/batch", optionalAuth, ActivityLogController.recordBatch);

router.get("/courses/:courseCode/activity-logs/config", authMiddleware, ActivityLogController.getCourseConfig);

router.put("/courses/:courseCode/activity-logs/config", authMiddleware, requireRole("teacher", "ta"), ActivityLogController.updateCourseConfig);

router.get("/courses/:courseCode/activity-logs", authMiddleware, requireRole("teacher", "ta"), ActivityLogController.getCourseLogs);

router.get("/courses/:courseCode/my-activity-logs", authMiddleware, ActivityLogController.getMyCourseLogs);

export default router;
