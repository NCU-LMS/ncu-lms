import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { pool } from "../config/db.js";
import { AuthModel } from "../models/authModel.js";
import { signAccessToken } from "../utils/jwt.js";
import { sendPasswordResetEmail } from "../utils/mailer.js";
import { parseRosterExcel } from "../utils/rosterExcel.js";

// accounts are only ever created by an admin; there is no self sign-up
const ROLE_CREATION_MATRIX = {
  admin: ["admin", "teacher", "student"],
};

function normalizeEmail(raw, { required = false } = {}) {
  const email = String(raw ?? "").trim();
  if (!email) {
    if (required) throw new Error("請填寫信箱");
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) {
    throw new Error("請輸入有效的信箱");
  }
  return email;
}

async function assertEmailAvailable(accountId, email) {
  const taken = await AuthModel.findOtherAccountByEmail(accountId ?? 0, email);
  if (!taken) return;
  if (String(taken.email || "").toLowerCase() === email.toLowerCase()) {
    throw new Error("此信箱已被使用");
  }
  throw new Error("此信箱與其他帳號相同，請改用別的信箱");
}

function validateAccountInput({ username, password, confirmPassword, name }) {
  const u = String(username ?? "").trim();
  if (!u) throw new Error("帳號不可為空");
  if (u.length > 64) throw new Error("帳號過長");

  if (!password || typeof password !== "string") throw new Error("請提供密碼");
  if (password.length < 8) throw new Error("密碼長度至少 8 個字元");
  if (password.length > 128) throw new Error("密碼過長");

  if (confirmPassword != null && confirmPassword !== password) {
    throw new Error("兩次輸入的密碼不相符");
  }

  if (!String(name ?? "").trim()) throw new Error("請填寫姓名");
}

// fill in the corresponding names
async function createProfileForRole(role, name, username, conn) {
  if (role === "student") {
    await AuthModel.createStudent(name, username, conn);
  } else if (role === "teacher") {
    await AuthModel.createTeacher(name, username, conn);
  } else if (role === "admin") {
    await AuthModel.createAdmin(name, username, conn);
  }
}

function validateNewPassword(password, confirmPassword) {
  if (!password || typeof password !== "string") throw new Error("請提供密碼");
  if (password.length < 8) throw new Error("密碼長度至少 8 個字元");
  if (password.length > 128) throw new Error("密碼過長");
  if (confirmPassword != null && confirmPassword !== password) {
    throw new Error("兩次輸入的密碼不相符");
  }
}

function hashPasswordResetToken(token) {
  return crypto.createHash("sha256").update(String(token), "utf8").digest("hex");
}

// 忘記密碼安全限制
const RESET_MAX_FAILED_ATTEMPTS = 3; // 驗證碼累計輸錯 3 次即鎖定，需由老師／助教解鎖
const RESET_EMAIL_INTERVAL_SECONDS = 15 * 60; // 每次寄信至少間隔 15 分鐘
const RESET_EMAIL_DAILY_LIMIT = 3; // 每個帳號每天最多寄 3 次
const RESET_LOCKED_MESSAGE =
  `驗證碼已輸錯 ${RESET_MAX_FAILED_ATTEMPTS} 次，忘記密碼功能已鎖定，請聯絡授課老師或助教解鎖`;

function generateResetCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function mapDbError(e, context) {
  if (e?.code === "ER_DUP_ENTRY" || e?.errno === 1062) {
    return new Error("帳號已被使用");
  }
  if (e?.code === "ER_BAD_FIELD_ERROR" || e?.errno === 1054) {
    return new Error(
      "資料庫結構尚未更新，請在伺服器執行：node scripts/initDB.js（或手動為 accounts 表新增 must_change_password 欄位）",
    );
  }
  if (e?.code === "ER_NO_SUCH_TABLE" || e?.errno === 1146) {
    return new Error("資料庫表尚未建立，請在伺服器執行：node scripts/initDB.js");
  }
  console.error(`[${context}]`, e);
  const msg = typeof e?.message === "string" ? e.message : "";
  if (msg.includes("Unknown column")) {
    return new Error("資料庫結構與程式不符，請執行 node scripts/initDB.js 更新資料庫");
  }
  return new Error(msg || "建立帳號失敗，請稍後再試");
}

export const AuthService = {
// creating a single account from a logged in admin
  async createManagedAccount(creatorRole, { username, password, name, role, confirmPassword, email }) {
    const allowedTargets = ROLE_CREATION_MATRIX[creatorRole] ?? [];
    const targetRole = String(role ?? "").trim();
    if (!allowedTargets.includes(targetRole)) {
      throw new Error("權限不足，無法建立此身份的帳號");
    }

    const trimmedUsername = String(username ?? "").trim();
    validateAccountInput({
      username: trimmedUsername,
      password,
      confirmPassword,
      name,
    });
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail) await assertEmailAvailable(0, normalizedEmail);

    const passwordHash = await bcrypt.hash(password, 10);
    try {
      await AuthModel.createAccount(trimmedUsername, passwordHash, normalizedEmail, targetRole);
      await createProfileForRole(targetRole, name, trimmedUsername);
    } catch (e) {
      throw mapDbError(e, "createManagedAccount");
    }

    return { username: trimmedUsername, role: targetRole };
  },

  /** admin batch-creates accounts from a roster Excel; existing accounts are left untouched */
  async importAccounts(fileBuffer, initialPassword) {
    validateNewPassword(initialPassword);
    const { title, rows, problems } = await parseRosterExcel(fileBuffer);

    // every imported account starts with the same password, so one hash is enough
    const passwordHash = await bcrypt.hash(initialPassword, 10);

    const created = [];
    const skipped = [];
    const failed = [...problems];

    for (const row of rows) {
      // 名單上註記「助教」的人也是學生帳號；助教身分之後由授課老師在課程的學生名冊指定
      const accountRole = row.role === "teacher" ? "teacher" : "student";
      const summary = { rowNumber: row.rowNumber, username: row.username, name: row.name, role: accountRole };

      if (await AuthModel.findAccountByUsername(row.username)) {
        skipped.push({ ...summary, reason: "帳號已存在" });
        continue;
      }
      if (row.email) {
        try {
          normalizeEmail(row.email);
        } catch (e) {
          failed.push({ ...summary, reason: e.message });
          continue;
        }
        const emailOwner = await AuthModel.findAccountByUsernameOrEmail(row.email);
        if (emailOwner) {
          failed.push({ ...summary, reason: `信箱已被帳號 ${emailOwner.username} 使用` });
          continue;
        }
      }

      // account and profile row go in together so a failure never leaves a half-created account
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await AuthModel.createAccount(row.username, passwordHash, row.email, accountRole, connection);
        await createProfileForRole(accountRole, row.name, row.username, connection);
        await connection.commit();
        created.push(summary);
      } catch (e) {
        await connection.rollback();
        failed.push({ ...summary, reason: mapDbError(e, "importAccounts").message });
      } finally {
        connection.release();
      }
    }

    return { title, created, skipped, failed };
  },

  async login(username, password) {
    const identifier = String(username ?? "").trim();
    if (!identifier || !password) throw new Error("請輸入帳號與密碼");

    const account = await AuthModel.findAccountByUsernameOrEmail(identifier);
    if (!account) throw new Error("帳號或信箱錯誤");

    const isMatch = await bcrypt.compare(password, account.password_hash);
    if (!isMatch) throw new Error("密碼錯誤");

    const token = signAccessToken(account.username, account.role);
    return {
      username: account.username,
      role: account.role,
      token,
      mustChangePassword: Boolean(account.must_change_password),
    };
  },

  async getUserInfo(username) {
    const account = await AuthModel.findAccountByUsername(username);
    if (!account) throw new Error("找不到使用者");

    const role = account.role;
    let userData;
    if (role === "student") {
      userData = await AuthModel.getStudentById(username);
    } else if (role === "admin") {
      userData = await AuthModel.getAdminById(username);
    } else {
      userData = await AuthModel.getTeacherById(username);
    }

    return {
      role,
      username: account.username,
      email: account.email || null,
      avatar_url: account.avatar_url || null,
      must_change_password: Boolean(account.must_change_password),
      user: userData || null,
    };
  },

  async updateEmail(username, rawEmail) {
    const email = normalizeEmail(rawEmail, { required: true });

    const account = await AuthModel.findAccountByUsername(username);
    if (!account) throw new Error("找不到使用者");

    await assertEmailAvailable(account.id, email);
    await AuthModel.updateEmail(account.id, email);
    return { message: "信箱已更新", email };
  },

  /** 忘記密碼：寄出信箱驗證碼（限制寄送頻率；已鎖定的帳號不再寄送） */
  async requestPasswordReset({ email }) {
    const normalized = normalizeEmail(email, { required: true });
    const account = await AuthModel.findAccountByEmail(normalized);
    if (!account) throw new Error("找不到此信箱對應的帳號");

    const code = generateResetCode();
    let logId;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      // 鎖住帳號列，避免同時送出多個請求繞過頻率限制
      const locked = await AuthModel.lockAccountRowForUpdate(account.id, connection);
      if (locked?.reset_locked_at) throw new Error(RESET_LOCKED_MESSAGE);

      const { secondsSinceLast, sentToday } = await AuthModel.getPasswordResetEmailStats(
        account.id,
        connection,
      );
      if (sentToday >= RESET_EMAIL_DAILY_LIMIT) {
        throw new Error(`今日驗證信已寄送 ${RESET_EMAIL_DAILY_LIMIT} 次，已達上限，請明天再試`);
      }
      if (secondsSinceLast != null && secondsSinceLast < RESET_EMAIL_INTERVAL_SECONDS) {
        const waitMinutes = Math.ceil((RESET_EMAIL_INTERVAL_SECONDS - secondsSinceLast) / 60);
        throw new Error(`驗證信寄送過於頻繁，請於 ${waitMinutes} 分鐘後再試（每次間隔 15 分鐘）`);
      }

      logId = await AuthModel.insertPasswordResetEmailLog(account.id, connection);
      await connection.commit();
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }

    await AuthModel.deletePasswordResetTokensForAccount(account.id);
    await AuthModel.insertPasswordResetToken(account.id, hashPasswordResetToken(code));

    const sent = await sendPasswordResetEmail({
      to: account.email,
      code,
      username: account.username,
    });
    if (!sent) {
      // 沒寄出去就不算一次，也不留下可用的驗證碼
      await AuthModel.deletePasswordResetEmailLog(logId);
      await AuthModel.deletePasswordResetTokensForAccount(account.id);
      throw new Error("系統尚未設定寄信功能，請聯絡管理員");
    }

    return { message: "驗證碼已寄出，請至信箱查收，並於 15 分鐘內在本頁完成重設" };
  },

  async resetPasswordWithCode({ email, code, password, confirmPassword }) {
    const normalized = normalizeEmail(email, { required: true });
    const rawCode = String(code ?? "").trim();
    if (!/^\d{6}$/.test(rawCode)) throw new Error("請輸入 6 位數驗證碼");

    validateNewPassword(password, confirmPassword);

    const account = await AuthModel.findAccountByEmail(normalized);
    if (!account) throw new Error("找不到此信箱對應的帳號");
    if (account.reset_locked_at) throw new Error(RESET_LOCKED_MESSAGE);

    const row = await AuthModel.findActivePasswordResetForAccount(account.id);
    if (!row) throw new Error("驗證碼已過期或尚未申請，請重新寄送驗證碼");

    // 先佔用一次機會再比對，同時大量送出也無法超過次數上限
    const reserved = await AuthModel.reservePasswordResetAttempt(account.id, RESET_MAX_FAILED_ATTEMPTS);
    if (!reserved) {
      await AuthModel.lockPasswordResetIfExceeded(account.id, RESET_MAX_FAILED_ATTEMPTS);
      throw new Error(RESET_LOCKED_MESSAGE);
    }

    const expected = Buffer.from(row.token_hash, "utf8");
    const actual = Buffer.from(hashPasswordResetToken(rawCode), "utf8");
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      const { failedAttempts, locked } = await AuthModel.lockPasswordResetIfExceeded(
        account.id,
        RESET_MAX_FAILED_ATTEMPTS,
      );
      if (locked) {
        await AuthModel.deletePasswordResetTokensForAccount(account.id);
        throw new Error(RESET_LOCKED_MESSAGE);
      }
      const remaining = Math.max(RESET_MAX_FAILED_ATTEMPTS - failedAttempts, 0);
      throw new Error(`驗證碼不正確，再輸錯 ${remaining} 次將鎖定，需請授課老師或助教解鎖`);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await AuthModel.updateAccountPasswordById(account.id, passwordHash);
    await AuthModel.markPasswordResetTokenUsed(row.id);
    await AuthModel.deletePasswordResetTokensForAccount(account.id);
    await AuthModel.clearPasswordResetLock(account.id);
    await AuthModel.setMustChangePassword(account.id, false);

    return { message: "密碼已重設，請使用新密碼登入" };
  },

  /** 解除忘記密碼鎖定（權限由呼叫端檢查），並清掉舊驗證碼 */
  async unlockPasswordReset(accountId) {
    await AuthModel.clearPasswordResetLock(accountId);
    await AuthModel.deletePasswordResetTokensForAccount(accountId);
  },

  /** 管理員依帳號解鎖（老師、管理員帳號被鎖時用） */
  async unlockPasswordResetByUsername(username) {
    const account = await AuthModel.findAccountByUsername(String(username ?? "").trim());
    if (!account) throw new Error("找不到使用者");
    await this.unlockPasswordReset(account.id);
    return { message: `已解除 ${account.username} 的忘記密碼鎖定` };
  },

  /** 登入後變更密碼（含首次強制變更） */
  async changePassword(username, { password, confirmPassword, currentPassword }) {
    validateNewPassword(password, confirmPassword);

    const account = await AuthModel.findAccountByUsername(username);
    if (!account) throw new Error("找不到使用者");

    const mustChange = Boolean(account.must_change_password);
    if (!mustChange) {
      if (!currentPassword) throw new Error("請輸入目前密碼");
      const ok = await bcrypt.compare(currentPassword, account.password_hash);
      if (!ok) throw new Error("目前密碼不正確");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await AuthModel.updateAccountPasswordById(account.id, passwordHash);
    await AuthModel.setMustChangePassword(account.id, false);

    return { message: "密碼已更新", mustChangePassword: false };
  },

  async updateAvatar(username, avatarUrl) {
    const account = await AuthModel.findAccountByUsername(username);
    if (!account) throw new Error("找不到使用者");
    await AuthModel.updateAvatarUrl(account.id, avatarUrl);
    return { avatar_url: avatarUrl };
  },
};
