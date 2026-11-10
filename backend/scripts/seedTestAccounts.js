import bcrypt from "bcryptjs";
import { pool } from "../src/config/db.js";
import { AuthModel } from "../src/models/authModel.js";
import { CourseModel } from "../src/models/courseModel.js";
import { CourseService } from "../src/services/courseService.js";
import { ensureSchema } from "../src/utils/ensureSchema.js";

// 僅供本機開發 / 測試使用，請勿在正式環境執行
const PASSWORD = "12345678";

const TEST_ACCOUNTS = [
  { role: "admin", username: "admin01", name: "測試管理員" },
  { role: "teacher", username: "teacher01", name: "測試老師一" },
  { role: "teacher", username: "teacher02", name: "測試老師二" },
  ...[1, 2, 3, 4, 5].map((n) => ({
    role: "student",
    username: `student0${n}`,
    name: `測試學生${n}`,
  })),
];

const TEST_COURSES = [
  { code: "TEST101", name: "測試課程一", teacher: "teacher01" },
  { code: "TEST102", name: "測試課程二", teacher: "teacher02" },
];
const TA_USERNAME = "student01";

const createProfile = (role, name, username) => {
  if (role === "admin") return AuthModel.createAdmin(name, username);
  if (role === "teacher") return AuthModel.createTeacher(name, username);
  return AuthModel.createStudent(name, username);
};

const seedAccounts = async (passwordHash) => {
  for (const { role, username, name } of TEST_ACCOUNTS) {
    // 可重複執行：已存在的帳號直接略過
    if (await AuthModel.findAccountByUsername(username)) {
      console.log(`略過（已存在）：${username}`);
      continue;
    }

    await AuthModel.createAccount(username, passwordHash, `${username}@example.com`, role);
    await createProfile(role, name, username);

    // 測試帳號不需要強制首次登入改密碼
    const account = await AuthModel.findAccountByUsername(username);
    await AuthModel.setMustChangePassword(account.id, false);

    console.log(`建立完成：${role.padEnd(7)} ${username}（${name}）`);
  }
};

const seedCourses = async () => {
  const students = TEST_ACCOUNTS.filter((a) => a.role === "student");

  for (const { code, name, teacher } of TEST_COURSES) {
    if (await CourseModel.findCourseByCode(code)) {
      console.log(`略過（課程已存在）：${code}`);
      continue;
    }

    const courseId = await CourseService.createCourse({
      teacher_id: teacher,
      course_name: name,
      course_code: code,
      description: "測試用課程",
      academic_year: "114-1",
    });

    // 助教是課程層級身分，存在 enrollments.role
    for (const { username } of students) {
      const student = await AuthModel.getStudentById(username);
      await CourseModel.enrollStudent(student.id, courseId, pool, username === TA_USERNAME ? "ta" : "student");
    }

    console.log(`課程建立完成：${code} ${name}（${teacher}，學生 ${students.length} 位，助教 ${TA_USERNAME}）`);
  }
};

const seedTestAccounts = async () => {
  try {
    await ensureSchema();
    await seedAccounts(await bcrypt.hash(PASSWORD, 10));
    await seedCourses();
    console.log(`完成。所有測試帳號密碼：${PASSWORD}`);
  } catch (error) {
    console.error("建立測試資料失敗：", error?.message || error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

seedTestAccounts();
