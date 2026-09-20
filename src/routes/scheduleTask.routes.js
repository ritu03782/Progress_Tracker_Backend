import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getSchedule, createTask, toggleTask, deleteTask } from "../controllers/scheduleTask.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/").get(getSchedule).post(createTask);
router.route("/:id/toggle").patch(toggleTask);
router.route("/:id").delete(deleteTask);

export default router;
