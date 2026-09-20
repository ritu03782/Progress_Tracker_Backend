import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getRecentActivity } from "../controllers/dashboard.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/recent-activity").get(getRecentActivity);

export default router;
