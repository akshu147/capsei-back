import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "./src/config/passport.js";
import { pool } from "./src/config/db.js";
import { allroutes } from "./src/app.js";

const app = express();

// 🔥 Required for Render
app.set("trust proxy", 1);

// ✅ Simple & Clean CORS
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// ✅ Session
app.use(session({
  secret: process.env.SESSION_SECRET || "secretkey",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,        // Render uses HTTPS
    sameSite: "none"     // Required for cross-domain cookies
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// ✅ Routes
app.use("/api", allroutes);

// ✅ Health check
app.get("/home", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ success: true, time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
