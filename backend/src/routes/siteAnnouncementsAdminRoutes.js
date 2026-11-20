import express from "express";
import { requireRole } from "../middlewares/requireRole.js";
import { siteAnnouncementsController } from "../controllers/siteAnnouncementsController.js";

const router = express.Router();

router.post("/", requireRole("admin"), siteAnnouncementsController.create);
router.put("/:id", requireRole("admin"), siteAnnouncementsController.update);
router.delete("/:id", requireRole("admin"), siteAnnouncementsController.remove);

export default router;
