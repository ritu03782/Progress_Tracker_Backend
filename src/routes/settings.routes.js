import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { exportUserData, deleteAccount } from "../controllers/settings.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/export-data").get(exportUserData);
router.route("/account").delete(deleteAccount);

export default router;
