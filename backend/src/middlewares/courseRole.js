import { pool } from "../config/db.js";

/**
 * 助教是課程層級的身分（enrollments.role = 'ta'），帳號本身仍是 student。
 * 這裡依「這個請求屬於哪一門課」，把該課助教的 req.user.role 換成 "ta"，
 * 既有的 requireRole("teacher", "ta") 等檢查因此不必改，但助教權限只在自己帶的課有效。
 *
 * 用法：router.param("courseCode", courseRole.byCode)
 */
async function isCourseTa(username, { courseCode, courseId }) {
  const byId = courseId != null;
  const [rows] = await pool.execute(
    `SELECT 1 FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN courses c ON c.id = e.course_id
     WHERE s.student_id = ? AND e.role = 'ta' AND ${byId ? "c.id = ?" : "c.course_code = ?"}
     LIMIT 1`,
    [username, byId ? courseId : courseCode],
  );
  return rows.length > 0;
}

async function firstRow(sql, id) {
  const [rows] = await pool.execute(sql, [id]);
  return rows[0] || null;
}

function courseRoleParam(resolveCourse) {
  return async (req, _res, next, value) => {
    try {
      if (req.user?.role === "student") {
        const course = await resolveCourse(value);
        if (course && (await isCourseTa(req.user.username, course))) {
          req.user.role = "ta";
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const courseRole = {
  byCode: courseRoleParam((courseCode) => ({ courseCode })),

  // homeworks.course_id 存的是課程代碼
  byHomework: courseRoleParam(async (hwId) => {
    const row = await firstRow("SELECT course_id FROM homeworks WHERE id = ?", hwId);
    return row && { courseCode: row.course_id };
  }),

  bySubmission: courseRoleParam(async (submissionId) => {
    const row = await firstRow(
      `SELECT h.course_id FROM homework_submissions hs
       JOIN homeworks h ON h.id = hs.homework_id
       WHERE hs.id = ?`,
      submissionId,
    );
    return row && { courseCode: row.course_id };
  }),

  byDiscussionRoom: courseRoleParam(async (roomId) => {
    const row = await firstRow("SELECT course_id FROM discussion_rooms WHERE id = ?", roomId);
    return row && { courseId: row.course_id };
  }),

  byThread: courseRoleParam(async (threadId) => {
    const row = await firstRow(
      `SELECT r.course_id FROM threads t
       JOIN discussion_rooms r ON r.id = t.room_id
       WHERE t.id = ?`,
      threadId,
    );
    return row && { courseId: row.course_id };
  }),

  byAnnouncement: courseRoleParam(async (announcementId) => {
    const row = await firstRow("SELECT course_id FROM announcements WHERE id = ?", announcementId);
    return row && { courseId: row.course_id };
  }),
};

export async function isCourseStaffUser(user, courseCode) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!courseCode) return false;

  const [teacherRows] = await pool.execute(
    `SELECT 1 FROM teacher_courses tc
     JOIN teachers t ON t.id = tc.teacher_id
     JOIN courses c ON c.id = tc.course_id
     WHERE t.teacher_id = ? AND c.course_code = ?
     LIMIT 1`,
    [user.username, courseCode],
  );
  if (teacherRows.length > 0) return true;

  const [taRows] = await pool.execute(
    `SELECT 1 FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN courses c ON c.id = e.course_id
     WHERE s.student_id = ? AND e.role = 'ta' AND c.course_code = ?
     LIMIT 1`,
    [user.username, courseCode],
  );
  if (taRows.length > 0) return true;

  return false;
}

export async function isCourseMemberUser(user, courseCode) {
  if (!user) return false;
  if (await isCourseStaffUser(user, courseCode)) return true;

  const [studentRows] = await pool.execute(
    `SELECT 1 FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN courses c ON c.id = e.course_id
     WHERE s.student_id = ? AND e.role != 'dropped' AND c.course_code = ?
     LIMIT 1`,
    [user.username, courseCode],
  );
  return studentRows.length > 0;
}

export function requireCourseStaff() {
  return async (req, res, next) => {
    try {
      const courseCode = req.params.courseCode;
      if (!courseCode) {
        return res.status(400).json({ message: "缺少課程代碼" });
      }
      const isStaff = await isCourseStaffUser(req.user, courseCode);
      if (!isStaff) {
        return res.status(403).json({ message: "權限不足：您不是此課程的授課教師或助教" });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireCourseMember() {
  return async (req, res, next) => {
    try {
      const courseCode = req.params.courseCode;
      if (!courseCode) {
        return res.status(400).json({ message: "缺少課程代碼" });
      }
      const isMember = await isCourseMemberUser(req.user, courseCode);
      if (!isMember) {
        return res.status(403).json({ message: "權限不足：您未參與此課程" });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
