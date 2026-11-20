import { ActivityLogService } from "../services/activityLogService.js";

export const ActivityLogController = {
  
  async recordBatch(req, res, next) {
    try {
      let rawLogs = req.body;
      if (typeof rawLogs === "string") {
        try {
          rawLogs = JSON.parse(rawLogs);
        } catch {
          return res.status(400).json({ message: "無效的 JSON 格式" });
        }
      }

      const logs = Array.isArray(rawLogs) ? rawLogs : Array.isArray(rawLogs?.logs) ? rawLogs.logs : [];
      const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "";

      const result = await ActivityLogService.recordBatchLogs(logs, req.user, clientIp);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  
  async getCourseConfig(req, res, next) {
    try {
      const { courseCode } = req.params;
      const config = await ActivityLogService.getCourseConfig(courseCode);
      return res.status(200).json(config);
    } catch (err) {
      next(err);
    }
  },

  
  async updateCourseConfig(req, res, next) {
    try {
      const { courseCode } = req.params;
      const updated = await ActivityLogService.updateCourseConfig(courseCode, req.body || {});
      return res.status(200).json({ message: "課程作業追蹤設定已更新", config: updated });
    } catch (err) {
      next(err);
    }
  },

  
  async getCourseLogs(req, res, next) {
    try {
      const { courseCode } = req.params;
      const { homeworkId, userId, eventType, search, startDate, endDate, page = 1, limit = 20 } = req.query;

      const result = await ActivityLogService.getCourseLogs(courseCode, {
        homeworkId,
        userId,
        eventType,
        search,
        startDate,
        endDate,
        page: parseInt(page, 10) || 1,
        limit: Math.min(100, parseInt(limit, 10) || 20),
      });

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  
  async getMyCourseLogs(req, res, next) {
    try {
      const { courseCode } = req.params;
      const { homeworkId, page = 1, limit = 30 } = req.query;
      const username = req.user?.username;

      if (!username) {
        return res.status(401).json({ message: "未登入" });
      }

      const result = await ActivityLogService.getMyCourseLogs(
        courseCode,
        homeworkId,
        username,
        parseInt(page, 10) || 1,
        Math.min(50, parseInt(limit, 10) || 30),
      );

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};
