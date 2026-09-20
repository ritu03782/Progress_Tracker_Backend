import {Router} from "express"
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updatePreferences,
    updateUserAvatar
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router=Router();

// Public routes
router.route("/register").post(
    upload.single("avatar"),
    registerUser
)
router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);

// Protected routes
router.route("/logout").post(verifyJWT,logoutUser);
router.route("/me").get(verifyJWT,getCurrentUser);
router.route("/change-password").post(verifyJWT,changeCurrentPassword);
router.route("/update-account").patch(verifyJWT,updateAccountDetails);
router.route("/preferences").patch(verifyJWT,updatePreferences);
router.route("/update-avatar").patch(verifyJWT,upload.single("avatar"),updateUserAvatar);

export default router;
