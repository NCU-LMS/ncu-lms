import { pool } from "../config/db.js";
import { AnnouncementModel } from "../models/announcementModel.js";
import { CourseModel } from "../models/courseModel.js";
import { AuthModel } from "../models/authModel.js";
import { NotificationModel } from "../models/notificationModel.js";
import { NotificationService, previewText, wantsNotification } from "../services/notificationService.js";

function parseAttachments(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.file_path) : [];
  } catch {
    return [];
  }
}

function filesToAttachments(files) {
  return (files || []).map((file) => ({
    file_name: Buffer.from(file.originalname || "附件", "latin1").toString("utf8"),
    file_path: `/uploads/${file.filename}`,
  }));
}

function parseKeepList(raw) {
  if (raw == null || raw === "") return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : null;
  } catch {
    return null;
  }
}

function mergeAttachments(existingRaw, keepRaw, files) {
  const previous = parseAttachments(existingRaw);
  const keepPaths = parseKeepList(keepRaw);
  const kept = keepPaths
    ? previous.filter((item) => keepPaths.includes(String(item.file_path)))
    : previous;
  return [...kept, ...filesToAttachments(files)];
}

function asBool(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value).trim().toLowerCase();
  if (["true", "1", "on", "yes"].includes(text)) return true;
  if (["false", "0", "off", "no"].includes(text)) return false;
  return fallback;
}

export const AnnouncementService = {
  async getAnnouncements(courseCode, studentIdentifier) {
    const course = await CourseModel.findCourseByCode(courseCode);
    if (!course) throw new Error("找不到課程");

    let studentDbId = null;
    if (studentIdentifier) {
      const student = await AuthModel.getStudentById(studentIdentifier);
      if (student) studentDbId = student.id;
    }

    let rows;
    if (studentDbId) {
      rows = await AnnouncementModel.getForStudent(course.id, studentDbId);
    } else {
      rows = await AnnouncementModel.getForCourse(course.id);
    }

    const announcements = rows.map((item) => {
      const { attachments_json, ...rest } = item;
      return { ...rest, attachments: parseAttachments(attachments_json), isNew: !item.is_read };
    });

    return { 
      course_code: courseCode, 
      course_id: course.id, 
      student_id: studentDbId, 
      announcements 
    };
  },

  async markAsRead(studentIdentifier, announcementId) {
    const student = await AuthModel.getStudentById(studentIdentifier);
    if (!student) throw new Error("找不到學生");

    await AnnouncementModel.markAsRead(student.id, announcementId);
    await NotificationModel.markAsReadByRef(student.id, "announcement", announcementId);
  },

  async createAnnouncement(courseCode, teacherIdentifier, { title, content, isPinned, notify, files }) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    let emailPayload = null;

    try {
      const course = await CourseModel.findCourseByCode(courseCode, connection);
      if (!course) throw new Error("找不到課程");

      let finalTeacherId;
      const teacher = await AuthModel.getTeacherById(teacherIdentifier);

      // 如果發文者是老師，直接用老師的 ID
      if (teacher) {
        finalTeacherId = teacher.id;
      } else {
        // 如果發文者是助教(在 teachers 表找不到)，則代入這門課主負責老師的 ID
        const courseTeachers = await CourseModel.getCourseTeachers(course.id, connection);
        if (courseTeachers.length > 0) {
          finalTeacherId = courseTeachers[0].id; 
        } else {
          throw new Error("找不到這門課的授課老師，因此助教無法代發公告");
        }
      }

      const attachments = filesToAttachments(files);
      const [result] = await AnnouncementModel.create(
        course.id,
        finalTeacherId,
        title,
        content,
        asBool(isPinned, false),
        teacherIdentifier,
        JSON.stringify(attachments),
        connection,
      );

      // 站內通知寫入同一筆交易；信箱在提交成功後才寄。預設要通知。
      if (wantsNotification(notify)) {
        emailPayload = await NotificationService.notifyByCourseCode({
          courseCode,
          type: "announcement",
          refId: result.insertId,
          headline: `新公告：${title}`,
          message: previewText(content, 100),
          excludeUsername: teacher ? null : teacherIdentifier,
          linkPath: `/course/${course.course_code}?announcement=${result.insertId}`,
          conn: connection,
        });
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    NotificationService.sendEmailPayload(emailPayload);
  },

  async updateAnnouncement(courseCode, announcementId, actorUsername, { title, content, isPinned, notify, keepAttachments, files }) {
    const course = await CourseModel.findCourseByCode(courseCode);
    if (!course) throw new Error("找不到課程");
    if (!title) throw new Error("缺少標題");

    const existing = await AnnouncementModel.findInCourse(announcementId, course.id);
    if (!existing) throw new Error("找不到公告");

    const attachments = mergeAttachments(existing.attachments_json, keepAttachments, files);
    const affected = await AnnouncementModel.update(
      announcementId,
      course.id,
      title,
      content,
      asBool(isPinned, false),
      JSON.stringify(attachments),
    );
    if (!affected) throw new Error("找不到公告");

    if (!wantsNotification(notify)) return;

    try {
      await AnnouncementModel.clearReads(announcementId);
      const teacher = actorUsername ? await AuthModel.getTeacherById(actorUsername) : null;
      await NotificationService.notifyByCourseCode({
        courseCode,
        type: "announcement",
        refId: announcementId,
        headline: `公告已更新：${title}`,
        message: previewText(content, 100),
        excludeUsername: teacher ? null : actorUsername,
        linkPath: `/course/${course.course_code}?announcement=${announcementId}`,
      });
    } catch (notifyError) {
      console.error("[notify] 公告更新通知失敗", notifyError?.message || notifyError);
    }
  },

  async deleteAnnouncement(courseCode, announcementId) {
    const course = await CourseModel.findCourseByCode(courseCode);
    if (!course) throw new Error("找不到課程");
    const affected = await AnnouncementModel.remove(announcementId, course.id);
    if (!affected) throw new Error("找不到公告");
  },
};