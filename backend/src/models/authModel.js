import { pool } from "../config/db.js";

function isMissingColumnError(err) {
  return err?.code === "ER_BAD_FIELD_ERROR" || err?.errno === 1054;
}

export const AuthModel = {
  async createAccount(username, passwordHash, email, role, conn = pool) {
    try {
      return await conn.execute(
        "INSERT INTO accounts (username, password_hash, email, role, must_change_password) VALUES (?, ?, ?, ?, 1)",
        [username, passwordHash, email ?? null, role],
      );
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
      return conn.execute(
        "INSERT INTO accounts (username, password_hash, email, role) VALUES (?, ?, ?, ?)",
        [username, passwordHash, email ?? null, role],
      );
    }
  },

  async findAccountByUsernameOrEmail(identifier) {
    const [rows] = await pool.execute(
      `SELECT * FROM accounts
       WHERE username = ? OR email = ?
       ORDER BY (username = ?) DESC, id ASC
       LIMIT 1`,
      [identifier, identifier, identifier],
    );
    return rows[0];
  },

  async findAccountByUsername(username) {
    const [rows] = await pool.execute("SELECT * FROM accounts WHERE username = ?", [username]);
    return rows[0];
  },

  async findAccountByEmail(email) {
    const [rows] = await pool.execute(
      "SELECT * FROM accounts WHERE email IS NOT NULL AND LOWER(email) = LOWER(?) LIMIT 1",
      [email],
    );
    return rows[0];
  },

  async getRoleByUsername(username) {
    const [rows] = await pool.execute("SELECT role FROM accounts WHERE username = ?", [username]);
    return rows[0]?.role;
  },

  async createStudent(name, studentId, conn = pool) {
    return conn.execute("INSERT INTO students (name, student_id) VALUES (?, ?)", [name, studentId]);
  },

  async createTeacher(name, teacherId, conn = pool) {
    return conn.execute("INSERT INTO teachers (name, teacher_id) VALUES (?, ?)", [name, teacherId]);
  },

  async createAdmin(name, adminId, conn = pool) {
    return conn.execute("INSERT INTO admins (name, admin_id) VALUES (?, ?)", [name, adminId]);
  },

  async countAdmins() {
    const [rows] = await pool.execute("SELECT COUNT(*) AS total FROM accounts WHERE role = 'admin'");
    return Number(rows[0]?.total ?? 0);
  },

  async getStudentById(studentId) {
    const [rows] = await pool.execute("SELECT * FROM students WHERE student_id = ?", [studentId]);
    return rows[0];
  },

  async getTeacherById(teacherId) {
    const [rows] = await pool.execute("SELECT * FROM teachers WHERE teacher_id = ?", [teacherId]);
    return rows[0];
  },

  async getAdminById(adminId) {
    const [rows] = await pool.execute("SELECT * FROM admins WHERE admin_id = ?", [adminId]);
    return rows[0];
  },

  async deletePasswordResetTokensForAccount(accountId) {
    await pool.execute("DELETE FROM password_reset_tokens WHERE account_id = ?", [accountId]);
  },

  async insertPasswordResetToken(accountId, tokenHash) {
    await pool.execute(
      "INSERT INTO password_reset_tokens (account_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))",
      [accountId, tokenHash],
    );
  },

  async findActivePasswordResetForAccount(accountId) {
    const [rows] = await pool.execute(
      `SELECT id, token_hash FROM password_reset_tokens
       WHERE account_id = ? AND expires_at > NOW() AND used_at IS NULL
       ORDER BY id DESC
       LIMIT 1`,
      [accountId],
    );
    return rows[0] || null;
  },

  /** 鎖住帳號那一列，讓同一帳號的寄信檢查與寫入紀錄不會被同時請求繞過 */
  async lockAccountRowForUpdate(accountId, conn) {
    const [rows] = await conn.execute(
      "SELECT id, reset_locked_at FROM accounts WHERE id = ? FOR UPDATE",
      [accountId],
    );
    return rows[0] || null;
  },

  /** 寄信頻率統計：最近一次寄送距今幾秒、今天（伺服器日期）已寄幾次 */
  async getPasswordResetEmailStats(accountId, conn = pool) {
    const [rows] = await conn.execute(
      `SELECT
         TIMESTAMPDIFF(SECOND, MAX(sent_at), NOW()) AS seconds_since_last,
         SUM(sent_at >= CURDATE()) AS sent_today
       FROM password_reset_email_log
       WHERE account_id = ? AND sent_at >= CURDATE() - INTERVAL 1 DAY`,
      [accountId],
    );
    const row = rows[0] || {};
    return {
      secondsSinceLast: row.seconds_since_last == null ? null : Number(row.seconds_since_last),
      sentToday: Number(row.sent_today ?? 0),
    };
  },

  async insertPasswordResetEmailLog(accountId, conn = pool) {
    const [result] = await conn.execute(
      "INSERT INTO password_reset_email_log (account_id) VALUES (?)",
      [accountId],
    );
    return result.insertId;
  },

  async deletePasswordResetEmailLog(id) {
    await pool.execute("DELETE FROM password_reset_email_log WHERE id = ?", [id]);
  },

  /**
   * 先佔用一次驗證機會：未鎖定且次數未滿才 +1，回傳是否成功。
   * 先加後驗，同時送出大量請求也最多只會有 maxAttempts 次真正比對驗證碼。
   */
  async reservePasswordResetAttempt(accountId, maxAttempts) {
    const [result] = await pool.execute(
      `UPDATE accounts SET reset_failed_attempts = reset_failed_attempts + 1
       WHERE id = ? AND reset_locked_at IS NULL AND reset_failed_attempts < ?`,
      [accountId, maxAttempts],
    );
    return result.affectedRows > 0;
  },

  /** 驗證碼錯誤：次數已達上限就鎖定，回傳鎖定後的狀態 */
  async lockPasswordResetIfExceeded(accountId, maxAttempts) {
    await pool.execute(
      `UPDATE accounts SET reset_locked_at = NOW()
       WHERE id = ? AND reset_locked_at IS NULL AND reset_failed_attempts >= ?`,
      [accountId, maxAttempts],
    );
    const [rows] = await pool.execute(
      "SELECT reset_failed_attempts, reset_locked_at FROM accounts WHERE id = ?",
      [accountId],
    );
    return {
      failedAttempts: Number(rows[0]?.reset_failed_attempts ?? 0),
      locked: rows[0]?.reset_locked_at != null,
    };
  },

  /** 重設成功或被解鎖時清除錯誤次數與鎖定 */
  async clearPasswordResetLock(accountId) {
    await pool.execute(
      "UPDATE accounts SET reset_failed_attempts = 0, reset_locked_at = NULL WHERE id = ?",
      [accountId],
    );
  },

  async markPasswordResetTokenUsed(id) {
    await pool.execute("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?", [id]);
  },

  async updateAccountPasswordById(accountId, passwordHash) {
    await pool.execute("UPDATE accounts SET password_hash = ? WHERE id = ?", [passwordHash, accountId]);
  },

  async setMustChangePassword(accountId, value) {
    try {
      await pool.execute("UPDATE accounts SET must_change_password = ? WHERE id = ?", [
        value ? 1 : 0,
        accountId,
      ]);
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
    }
  },

  async findOtherAccountByEmail(accountId, email) {
    const [rows] = await pool.execute(
      `SELECT id, username, email FROM accounts
       WHERE id <> ? AND (LOWER(email) = LOWER(?) OR username = ?)
       LIMIT 1`,
      [accountId, email, email],
    );
    return rows[0] || null;
  },

  async updateEmail(accountId, email) {
    await pool.execute("UPDATE accounts SET email = ? WHERE id = ?", [email, accountId]);
  },

  async updateAvatarUrl(accountId, avatarUrl) {
    try {
      await pool.execute("UPDATE accounts SET avatar_url = ? WHERE id = ?", [avatarUrl, accountId]);
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
    }
  },
};
