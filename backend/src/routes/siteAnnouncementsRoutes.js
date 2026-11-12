import express from "express";
import { requireRole } from "../middlewares/requireRole.js";
import { siteAnnouncementsController } from "../controllers/siteAnnouncementsController.js";

const router = express.Router();


router.get("/site_announcements", siteAnnouncementsController.getAnnouncements);

router.post("/site_announcements/admin", requireRole("admin"), siteAnnouncementsController.create);
router.put("/site_announcements/admin/:id", requireRole("admin"), siteAnnouncementsController.update);
router.delete("/site_announcements/admin/:id", requireRole("admin"), siteAnnouncementsController.remove);

export default router;
