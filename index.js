import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "./src/config/passport.js";
import { pool } from "./src/config/db.js";
import { allroutes } from "./src/app.js";

// 👇 NEW
import http from "http";
import { Server } from "socket.io";

const app = express();

// 🔥 Required for Render
app.set("trust proxy", 1);

// ✅ CORS (IMPORTANT for socket too)
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
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ success: true, time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ================= SOCKET.IO START =================

// ❗ Express ko direct listen mat kar
const server = http.createServer(app);

// 👇 socket server
const io = new Server(server, {
  cors: {
    origin: "*", // production me apna domain daalna
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("🔥 Socket connected:", socket.id);

  // 👤 User joins ride
  socket.on("join-ride", (rideId) => {
    socket.join(rideId);
    console.log(`User joined ride: ${rideId}`);
  });

  // 🚗 Driver sends location
  socket.on("driver-location", (data) => {
    const { rideId, lat, lng } = data;

    // 👇 sirf us ride ke user ko bhejo
    io.to(rideId).emit("driver-location-update", { lat, lng });
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// ================= SOCKET.IO END =================


// ❗ IMPORTANT: app.listen ki jagah server.listen
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});