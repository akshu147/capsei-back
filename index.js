import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "./src/config/passport.js";
import { pool } from "./src/config/db.js";
import { allroutes } from "./src/app.js";

const app = express();

// 🔥 VERY IMPORTANT (for Render / Railway / production)
app.set("trust proxy", 1);

// ✅ CORS
const allowedOrigins = [
  "http://localhost:3000",
  "https://capsei-front-bdwr.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps / Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));
// f
app.use(express.json());

// ✅ Session (Production Safe)
app.use(session({
  secret: process.env.SESSION_SECRET || "secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,          // HTTPS required
    sameSite: "none"       // cross-site cookie allow
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

// ✅ Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
