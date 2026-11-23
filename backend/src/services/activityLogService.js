import { ActivityLogModel, DEFAULT_COURSE_CONFIG } from "../models/activityLogModel.js";

function parseCourseAndHomework(pageUrl) {
  if (!pageUrl || typeof pageUrl !== "string") return {};
  const courseMatch = pageUrl.match(/\/course\/([^/?#]+)/i);
  const courseCode = courseMatch ? decodeURIComponent(courseMatch[1]) : null;

  const hwMatch = pageUrl.match(/\/homework\/([^/?#]+)/i);
  let homeworkId = hwMatch ? decodeURIComponent(hwMatch[1]) : null;
  if (homeworkId === "create" || homeworkId === "edit") homeworkId = null;

  return { courseCode, homeworkId };
}

function resolveAllowedEventTypes(config) {
  if (!config || !config.enabled) return [];
  const allowed = [];
  if (config.trackInputs) allowed.push("INPUT_SNAPSHOT");
  if (config.trackCopyViolations) allowed.push("COPY_BLOCKED");
  if (config.trackFileUploads) allowed.push("FILE_UPLOAD");
  if (config.trackClicks) allowed.push("BUTTON_CLICK");
  return allowed;
}


export function evaluateLogAnomaly(log, config) {
  if (!config || config.anomalyDetectionEnabled === false) {
    return { isAnomaly: false, anomalyReasons: [] };
  }

  const reasons = [];

  if (log.event_type === "COPY_BLOCKED") {
    reasons.push("違規嘗試複製/貼上已被系統攔截");
  }

  if (log.event_type === "INPUT_SNAPSHOT") {
    let actionData = log.action_data;
    if (typeof actionData === "string") {
      try {
        actionData = JSON.parse(actionData);
      } catch {
        actionData = null;
      }
    }

    if (actionData) {
      const lengthDiff = Number(actionData.lengthDiff) || 0;
      const durationMs = Number(actionData.durationMs) || 0;
      const durationSec = durationMs > 0 ? durationMs / 1000 : 0;
      const speed = Number(actionData.speedCharsPerSec) ||
        (durationSec > 0 && lengthDiff > 0 ? Number((lengthDiff / durationSec).toFixed(1)) : 0);
      const maxSpeed = Number(config.maxCharsPerSecond) || 15;

      if (lengthDiff > 5 && speed > maxSpeed) {
        reasons.push(`打字速度異常 (${speed} 字/秒，超過上限 ${maxSpeed} 字/秒)`);
      }

      if (lengthDiff >= 50 && (durationMs <= 1500 || Number(actionData.inputCount) <= 2)) {
        reasons.push(`字數短時間暴增 (${lengthDiff} 字，疑似外部貼上或腳本注入)`);
      }

      if (config.checkFrequencyAnomaly !== false) {
        if (actionData.uniformFrequency) {
          reasons.push("輸入間隔頻率過於固定 (各字元輸入間隔近乎相同，疑似自動化腳本)");
        } else if (
          actionData.keystrokeStdDev !== null &&
          actionData.keystrokeStdDev !== undefined &&
          Number(actionData.keystrokeStdDev) < 15 &&
          Number(actionData.inputCount) >= 4
        ) {
          reasons.push(`打字節奏標準差極低 (${actionData.keystrokeStdDev}ms，疑似機器人規律輸入)`);
        }
      }
    }
  }

  return {
    isAnomaly: reasons.length > 0,
    anomalyReasons: reasons,
  };
}

export const ActivityLogService = {
  
  async recordBatchLogs(rawLogs, currentUser, clientIp) {
    if (!currentUser || !currentUser.username) {
      return { success: false, message: "未登入", count: 0 };
    }
    if (!Array.isArray(rawLogs) || rawLogs.length === 0) {
      return { success: true, count: 0 };
    }

    const batch = rawLogs.slice(0, 50);

    const sanitizedLogs = [];
    const courseConfigsCache = new Map();

    for (const item of batch) {
      if (!item || typeof item !== "object") continue;

      const pageUrl = String(item.pageUrl || "");
      const { courseCode: parsedCourse, homeworkId: parsedHw } = parseCourseAndHomework(pageUrl);
      const courseCode = item.courseCode || parsedCourse || null;
      const homeworkId = item.homeworkId || parsedHw || null;

      if (!courseCode) continue;

      let config = DEFAULT_COURSE_CONFIG;
      if (!courseConfigsCache.has(courseCode)) {
        const cfg = await ActivityLogModel.getCourseConfig(courseCode);
        courseConfigsCache.set(courseCode, cfg);
      }
      config = courseConfigsCache.get(courseCode);

      if (config.enabled === false) continue;

      const type = String(item.eventType || "").toUpperCase();
      if (type === "BUTTON_CLICK" && !config.trackClicks) continue;
      if (type === "FILE_UPLOAD" && !config.trackFileUploads) continue;
      if (type === "INPUT_SNAPSHOT" && !config.trackInputs) continue;
      if (type === "COPY_BLOCKED" && !config.trackCopyViolations) continue;

      sanitizedLogs.push({
        courseCode,
        homeworkId,
        userId: currentUser.username,
        userName: currentUser.name || null,
        role: currentUser.role || "student",
        eventType: type || "CUSTOM",
        pageUrl,
        targetElement: item.targetElement ? String(item.targetElement).slice(0, 255) : null,
        actionData: item.actionData || null,
        ipAddress: clientIp,
        userAgent: item.userAgent ? String(item.userAgent).slice(0, 500) : null,
        clientTimestamp: item.clientTimestamp || new Date().toISOString(),
      });
    }

    if (sanitizedLogs.length === 0) {
      return { success: true, count: 0 };
    }

    const count = await ActivityLogModel.insertBatch(sanitizedLogs);
    return { success: true, count };
  },

  
  async getCourseConfig(courseCode) {
    return ActivityLogModel.getCourseConfig(courseCode);
  },

  
  async updateCourseConfig(courseCode, newConfig) {
    return ActivityLogModel.updateCourseConfig(courseCode, newConfig);
  },

  
  async getCourseLogs(courseCode, filters) {
    const config = await ActivityLogModel.getCourseConfig(courseCode);
    const allowedEventTypes = resolveAllowedEventTypes(config);

    if (allowedEventTypes.length === 0) {
      return {
        total: 0,
        page: 1,
        limit: filters.limit || 20,
        totalPages: 1,
        logs: [],
        config,
      };
    }

    const result = await ActivityLogModel.queryCourseLogs({
      ...filters,
      courseCode,
      allowedEventTypes,
    });

    let logs = (result.logs || []).map((log) => {
      const anomalyInfo = evaluateLogAnomaly(log, config);
      return {
        ...log,
        is_anomaly: anomalyInfo.isAnomaly,
        anomaly_reasons: anomalyInfo.anomalyReasons,
      };
    });

    if (filters.onlyAnomalies === true || filters.onlyAnomalies === "true" || filters.eventType === "ANOMALY_ONLY") {
      logs = logs.filter((l) => l.is_anomaly);
    }

    return {
      ...result,
      total: (filters.onlyAnomalies === true || filters.onlyAnomalies === "true" || filters.eventType === "ANOMALY_ONLY")
        ? logs.length
        : result.total,
      logs,
      config,
    };
  },

  
  async getMyCourseLogs(courseCode, homeworkId, username, page = 1, limit = 30) {
    const config = await ActivityLogModel.getCourseConfig(courseCode);
    if (!config.studentVisible || !config.enabled) {
      return {
        studentVisible: false,
        message: "授課老師目前未開放學生查看作業操作歷程",
        total: 0,
        logs: [],
        config,
      };
    }

    const allowedEventTypes = resolveAllowedEventTypes(config);
    if (allowedEventTypes.length === 0) {
      return {
        studentVisible: true,
        total: 0,
        page: 1,
        limit,
        totalPages: 1,
        logs: [],
        config,
      };
    }

    const result = await ActivityLogModel.queryStudentCourseLogs({
      courseCode,
      homeworkId,
      userId: username,
      allowedEventTypes,
      page,
      limit,
    });

    const logs = (result.logs || []).map((log) => {
      const anomalyInfo = evaluateLogAnomaly(log, config);
      return {
        ...log,
        is_anomaly: anomalyInfo.isAnomaly,
        anomaly_reasons: anomalyInfo.anomalyReasons,
      };
    });

    return {
      studentVisible: true,
      ...result,
      logs,
      config,
    };
  },
};
