import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getContests,
  createContest,
  updateContest,
  deleteContest,
  logResult,
  reopenToUpcoming,
} from "../controllers/contest.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/").get(getContests).post(createContest);
router.route("/:id").patch(updateContest).delete(deleteContest);
router.route("/:id/log-result").patch(logResult);
router.route("/:id/reopen").patch(reopenToUpcoming);

export default router;
