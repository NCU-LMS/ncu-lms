import { pool } from "../config/db.js";

export const siteAnnouncementsModel = {

  async getAnnouncements() {
    const [rows] = await pool.execute(
      `SELECT a.id, a.title, a.content, a.category, a.is_pinned, a.created_at
       FROM site_announcements a`
    );
    return rows;
  },

  async getById(id){
    const [rows] = await pool.execute(
      `SELECT a.title, a.content, a.category, a.is_pinned, a.created_at
       FROM site_announcements a
       WHERE id = ?`,
       [id]
    );
    return rows;
  },

  async create(title, content, category = 'notice', is_pinned = false, conn = pool) {
    return conn.execute(
      ` INSERT INTO site_announcements (title, content, category, is_pinned) VALUES (?, ?, ?, ?)`,
      [title, content, category, is_pinned]
    );
  },

  async update(announcementId, title, content, category, is_pinned) {
    const [result] = await pool.execute(
      `
      UPDATE site_announcements 
      SET title = ?, content = ?, category = ?, is_pinned = ? 
      WHERE id = ?
      `,
      [title, content, category, is_pinned, announcementId],
    );
    return result.affectedRows;
  },

  async delete(announcementId) {
    const [result] = await pool.execute(
      `DELETE FROM site_announcements WHERE id = ?`,
      [announcementId],
    );
    return result.affectedRows;
  },
};