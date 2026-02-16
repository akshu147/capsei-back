import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "./src/config/passport.js";
import { pool } from "./src/config/db.js";
import { allroutes } from "./src/app.js";

const app = express();

// 🔥 Render / Production
app.set("trust proxy", 1);

// ✅ Allowed Origins
const allowedOrigins = [
  "http://localhost:3000",
  "https://capsei-front-bdwr.vercel.app"
];

// ✅ CORS CONFIG (Store in variable)
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

// 👇 USE SAME OPTIONS EVERYWHERE
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());

// ✅ Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    sameSite: "none"
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// ✅ Routes
app.use("/api", allroutes);

// ✅ Health check
app.get("/home", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.json({ success: true, time: result.rows[0] });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
