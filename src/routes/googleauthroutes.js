import express from "express";
import passport from "passport";
import { googleAuthController } from "../controllers/auth.controller.js";

const googleRoutes = express.Router();

// 1️⃣ Redirect user to Google login
googleRoutes.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email", "phone"] })
);

// 2️⃣ Google callback
googleRoutes.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  googleAuthController
);

export default googleRoutes;
