import { siteAnnouncementsService } from "../services/siteAnnouncementsService.js";

// 統一處理錯誤：
// - 有 status 的是 Service 主動丟出的預期錯誤（驗證失敗、找不到），訊息可以直接回給前端
// - 其餘視為意外錯誤（例如資料庫斷線），只記在伺服器 log，回給前端通用訊息
const handleError = (res, error, fallbackMessage) => {
  if (error.status) {
    return res.status(error.status).json({ message: error.message });
  }
  console.error("[SiteAnnouncements]", error);
  return res.status(500).json({ message: fallbackMessage });
};

export const siteAnnouncementsController = {
  async getAnnouncements(req, res) {
    try {
      console.log("[Debug] 1. 進入 getAnnouncements Controller");
      const announcements = await siteAnnouncementsService.getAnnouncements();
      console.log("[Debug] 2. 從 Service 拿到資料：", announcements);
      res.json({ announcements });
    } catch (error) {
      handleError(res, error, "系統發生異常，請稍後再試");
    }
  },
 
  async create(req, res) {
    try {
      await siteAnnouncementsService.createAnnouncement(req.body);
      res.status(201).json({ message: "公告新增成功" });
    } catch (error) {
      handleError(res, error, "公告新增失敗");
    }
  },
 
  async update(req, res) {
    try {
      const { id } = req.params;
      await siteAnnouncementsService.updateAnnouncement(id, req.body);
      res.json({ message: "公告已更新" });
    } catch (error) {
      handleError(res, error, "公告更新失敗");
    }
  },
 
  async remove(req, res) {
    try {
      const { id } = req.params;
      await siteAnnouncementsService.deleteAnnouncement(id);
      res.json({ message: "公告已刪除" });
    } catch (error) {
      handleError(res, error, "公告刪除失敗");
    }
  },
};
 