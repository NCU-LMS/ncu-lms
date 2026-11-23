import { pool } from "../config/db.js";

export const DEFAULT_COURSE_CONFIG = {
  enabled: false,
  trackClicks: false,
  trackFileUploads: false,
  trackInputs: false,
  trackCopyViolations: false,
  inputIntervalSeconds: 30,
  studentVisible: false,
  anomalyDetectionEnabled: true,
  maxCharsPerSecond: 15,
  checkFrequencyAnomaly: true,
};

export const ActivityLogModel = {
  
  async insertBatch(logs) {
    if (!Array.isArray(logs) || logs.length === 0) return 0;

    const values = [];
    const placeholders = logs
      .map((log) => {
        values.push(
          log.courseCode || null,
          log.homeworkId || null,
          log.userId || null,
          log.userName || null,
          log.role || null,
          log.eventType || "UNKNOWN",
          (log.pageUrl || "").slice(0, 500),
          (log.targetElement || "").slice(0, 255),
          log.actionData ? JSON.stringify(log.actionData) : null,
          (log.ipAddress || "").slice(0, 64) || null,
          (log.userAgent || "").slice(0, 500) || null,
          log.clientTimestamp ? new Date(log.clientTimestamp) : new Date(),
        );
        return "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
      })
      .join(", ");

    const sql = `
      INSERT INTO user_activity_logs
        (course_code, homework_id, user_id, user_name, role, event_type, page_url, target_element, action_data, ip_address, user_agent, client_timestamp)
      VALUES ${placeholders}
    `;

    const [result] = await pool.query(sql, values);
    return result.affectedRows;
  },

  
  async getCourseConfig(courseCode) {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM course_activity_configs WHERE course_code = ? LIMIT 1",
        [courseCode],
      );
      if (!rows.length) {
        return { courseCode, ...DEFAULT_COURSE_CONFIG };
      }
      const row = rows[0];
      const seconds = Number(row.input_interval_seconds) ||
        (row.input_interval_minutes ? Number(row.input_interval_minutes) * 60 : 30);

      return {
        courseCode,
        enabled: Boolean(row.enabled),
        trackClicks: Boolean(row.track_clicks),
        trackFileUploads: Boolean(row.track_file_uploads),
        trackInputs: Boolean(row.track_inputs),
        trackCopyViolations: Boolean(row.track_copy_violations),
        inputIntervalSeconds: seconds,
        studentVisible: Boolean(row.student_visible),
        anomalyDetectionEnabled: row.anomaly_detection_enabled !== undefined ? Boolean(row.anomaly_detection_enabled) : true,
        maxCharsPerSecond: Number(row.max_chars_per_second) || 15,
        checkFrequencyAnomaly: row.check_frequency_anomaly !== undefined ? Boolean(row.check_frequency_anomaly) : true,
        updatedAt: row.updated_at,
      };
    } catch {
      return { courseCode, ...DEFAULT_COURSE_CONFIG };
    }
  },

  
  async updateCourseConfig(courseCode, newConfig) {
    const current = await this.getCourseConfig(courseCode);
    const updated = {
      enabled: newConfig.enabled !== undefined ? Boolean(newConfig.enabled) : current.enabled,
      trackClicks: newConfig.trackClicks !== undefined ? Boolean(newConfig.trackClicks) : current.trackClicks,
      trackFileUploads: newConfig.trackFileUploads !== undefined ? Boolean(newConfig.trackFileUploads) : current.trackFileUploads,
      trackInputs: newConfig.trackInputs !== undefined ? Boolean(newConfig.trackInputs) : current.trackInputs,
      trackCopyViolations: newConfig.trackCopyViolations !== undefined ? Boolean(newConfig.trackCopyViolations) : current.trackCopyViolations,
      inputIntervalSeconds: Math.max(1, Math.min(3600, Number(newConfig.inputIntervalSeconds) || current.inputIntervalSeconds)),
      studentVisible: newConfig.studentVisible !== undefined ? Boolean(newConfig.studentVisible) : current.studentVisible,
      anomalyDetectionEnabled: newConfig.anomalyDetectionEnabled !== undefined ? Boolean(newConfig.anomalyDetectionEnabled) : current.anomalyDetectionEnabled,
      maxCharsPerSecond: Math.max(1, Math.min(500, Number(newConfig.maxCharsPerSecond) || current.maxCharsPerSecond || 15)),
      checkFrequencyAnomaly: newConfig.checkFrequencyAnomaly !== undefined ? Boolean(newConfig.checkFrequencyAnomaly) : current.checkFrequencyAnomaly,
    };

    const sql = `
      INSERT INTO course_activity_configs
        (course_code, enabled, track_clicks, track_file_uploads, track_inputs, track_copy_violations, input_interval_seconds, student_visible, anomaly_detection_enabled, max_chars_per_second, check_frequency_anomaly)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        enabled = VALUES(enabled),
        track_clicks = VALUES(track_clicks),
        track_file_uploads = VALUES(track_file_uploads),
        track_inputs = VALUES(track_inputs),
        track_copy_violations = VALUES(track_copy_violations),
        input_interval_seconds = VALUES(input_interval_seconds),
        student_visible = VALUES(student_visible),
        anomaly_detection_enabled = VALUES(anomaly_detection_enabled),
        max_chars_per_second = VALUES(max_chars_per_second),
        check_frequency_anomaly = VALUES(check_frequency_anomaly),
        updated_at = CURRENT_TIMESTAMP
    `;
    await pool.query(sql, [
      courseCode,
      updated.enabled ? 1 : 0,
      updated.trackClicks ? 1 : 0,
      updated.trackFileUploads ? 1 : 0,
      updated.trackInputs ? 1 : 0,
      updated.trackCopyViolations ? 1 : 0,
      updated.inputIntervalSeconds,
      updated.studentVisible ? 1 : 0,
      updated.anomalyDetectionEnabled ? 1 : 0,
      updated.maxCharsPerSecond,
      updated.checkFrequencyAnomaly ? 1 : 0,
    ]);

    return { courseCode, ...updated };
  },

  
  async queryCourseLogs({ courseCode, homeworkId, userId, eventType, allowedEventTypes, search, startDate, endDate, onlyAnomalies, page = 1, limit = 20 }) {
    const whereClauses = ["course_code = ?"];
    const params = [courseCode];

    if (Array.isArray(allowedEventTypes)) {
      if (allowedEventTypes.length === 0) {
        return { total: 0, page: 1, limit, totalPages: 1, logs: [] };
      }
      whereClauses.push(`event_type IN (${allowedEventTypes.map(() => '?').join(',')})`);
      params.push(...allowedEventTypes);
    }

    if (homeworkId) {
      whereClauses.push("(homework_id = ? OR page_url LIKE ?)");
      params.push(homeworkId, `%/homework/${homeworkId}%`);
    }

    if (userId) {
      whereClauses.push("(user_id = ? OR user_id LIKE ? OR user_name LIKE ?)");
      params.push(userId, `%${userId}%`, `%${userId}%`);
    }

    if (eventType === "ANOMALY_ONLY" || onlyAnomalies === true || onlyAnomalies === "true") {
      whereClauses.push("(event_type = 'COPY_BLOCKED' OR action_data LIKE '%\"isAnomaly\":true%' OR action_data LIKE '%\"is_anomaly\":true%')");
    } else if (eventType) {
      whereClauses.push("event_type = ?");
      params.push(eventType);
    }

    if (search) {
      whereClauses.push("(target_element LIKE ? OR action_data LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (startDate) {
      whereClauses.push("created_at >= ?");
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push("created_at <= ?");
      params.push(endDate);
    }

    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

    const countSql = `SELECT COUNT(*) AS total FROM user_activity_logs ${whereSql}`;
    const [countRows] = await pool.query(countSql, params);
    const total = Number(countRows[0]?.total ?? 0);

    const offset = Math.max(0, (page - 1) * limit);
    const dataSql = `
      SELECT id, course_code, homework_id, user_id, user_name, role, event_type, page_url, target_element, action_data, ip_address, user_agent, client_timestamp, created_at
      FROM user_activity_logs
      ${whereSql}
      ORDER BY client_timestamp DESC, id DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(dataSql, [...params, Number(limit), Number(offset)]);

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
      logs: rows,
    };
  },

  
  async queryStudentCourseLogs({ courseCode, homeworkId, userId, allowedEventTypes, page = 1, limit = 30 }) {
    const whereClauses = [
      "course_code = ?",
      "user_id = ?",
    ];
    const params = [courseCode, userId];

    if (Array.isArray(allowedEventTypes)) {
      if (allowedEventTypes.length === 0) {
        return { total: 0, page: 1, limit, totalPages: 1, logs: [] };
      }
      whereClauses.push(`event_type IN (${allowedEventTypes.map(() => '?').join(',')})`);
      params.push(...allowedEventTypes);
    }

    if (homeworkId) {
      whereClauses.push("(homework_id = ? OR page_url LIKE ?)");
      params.push(homeworkId, `%/homework/${homeworkId}%`);
    }

    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

    const countSql = `SELECT COUNT(*) AS total FROM user_activity_logs ${whereSql}`;
    const [countRows] = await pool.query(countSql, params);
    const total = Number(countRows[0]?.total ?? 0);

    const offset = Math.max(0, (page - 1) * limit);
    const dataSql = `
      SELECT id, course_code, homework_id, user_id, event_type, page_url, target_element, action_data, client_timestamp, created_at
      FROM user_activity_logs
      ${whereSql}
      ORDER BY client_timestamp DESC, id DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(dataSql, [...params, Number(limit), Number(offset)]);

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
      logs: rows,
    };
  },
};
