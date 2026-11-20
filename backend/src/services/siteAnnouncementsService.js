import { pool } from "../config/db.js";
import { siteAnnouncementsModel } from "../models/siteAnnouncementsModel.js";

export const siteAnnouncementsService = {
  // 1. 取得所有公告列表
  async getAnnouncements() {
    try {

      const announcements = await siteAnnouncementsModel.getAnnouncements();
      return announcements;
    } catch (error) {
      throw error;
    }
  },

  // 2. 新建公告（含基本欄位驗證）
  async createAnnouncement(body) {
    const { title, content, category, is_pinned } = body;
    if (!title || !content) {
      const err = new Error("公告標題與內容不得為空");
      err.status = 400;
      throw err;
    }

    try {
      const newId = await siteAnnouncementsModel.create(
        title,
        content,
        category,
        is_pinned
      );
      return newId;
    } catch (error) {
      throw error;
    }
  },

  // 3. 更新公告
  async updateAnnouncement(id, body) {
    const { title, content, category, is_pinned } = body;
    try {
      const existing = await siteAnnouncementsModel.getById(id);
      if (!existing) {
        const err = new Error("找不到指定的公告");
        err.status = 404;
        throw err;
      }

      await siteAnnouncementsModel.update(
        id,
        title,
        content,
        category,
        is_pinned
      );
    } catch (error) {
      throw error;
    }
  },

  // 4. 刪除公告（檢查是否存在）
  async deleteAnnouncement(id) {
    try {
      const existing = await siteAnnouncementsModel.getById(id);
      if (!existing) {
        const err = new Error("找不到指定的公告");
        err.status = 404;
        throw err;
      }

      await siteAnnouncementsModel.delete(id);
    } catch (error) {
      throw error;
    }
  }
};