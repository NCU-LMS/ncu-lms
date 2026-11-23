import express from "express";
import { ActivityLogController } from "../controllers/activityLogController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { courseRole, requireCourseStaff, requireCourseMember } from "../middlewares/courseRole.js";

const router = express.Router();

router.param("courseCode", courseRole.byCode);

router.post("/activity-logs/batch", authMiddleware, ActivityLogController.recordBatch);
router.get("/courses/:courseCode/activity-logs/config", authMiddleware, requireCourseMember(), ActivityLogController.getCourseConfig);
router.put("/courses/:courseCode/activity-logs/config", authMiddleware, requireCourseStaff(), ActivityLogController.updateCourseConfig);
router.get("/courses/:courseCode/activity-logs", authMiddleware, requireCourseStaff(), ActivityLogController.getCourseLogs);
router.get("/courses/:courseCode/my-activity-logs", authMiddleware, requireCourseMember(), ActivityLogController.getMyCourseLogs);

export default router;
