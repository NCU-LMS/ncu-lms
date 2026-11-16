import express from "express";
import { siteAnnouncementsController } from "../controllers/siteAnnouncementsController.js";

const router = express.Router();

router.get("/", siteAnnouncementsController.getAnnouncements);

export default router;
