import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getNote, saveNote } from "../controllers/note.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/").get(getNote).patch(saveNote);

export default router;
