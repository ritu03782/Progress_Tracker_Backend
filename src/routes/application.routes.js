import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  advanceStage,
  rejectApplication,
  reopenApplication,
} from "../controllers/application.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/").get(getApplications).post(createApplication);
router.route("/:id").patch(updateApplication).delete(deleteApplication);
router.route("/:id/advance").patch(advanceStage);
router.route("/:id/reject").patch(rejectApplication);
router.route("/:id/reopen").patch(reopenApplication);

export default router;
