import express from 'express'
import cors from 'cors'
import session from 'express-session'
import passport from './src/config/passport.js'
import { pool } from './src/config/db.js'
import { allroutes } from './src/app.js'

import http from 'http'
import { Server } from 'socket.io'

const app = express()

// 🔥 Required for Render / proxies
app.set('trust proxy', 1)

// ================= CORS =================
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true
  })
)

app.use(express.json())

// ================= SESSION =================
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'secretkey',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      sameSite: 'none'
    }
  })
)

app.use(passport.initialize())
app.use(passport.session())

// ================= ROUTES =================
app.use('/api', allroutes)

// ================= HEALTH CHECK =================
app.get('/home', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()')
    res.json({ success: true, time: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ================= SOCKET.IO =================
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true
  }
})

// 🔥 MEMORY STORE (IMPORTANT)
const drivers = {}  // { driverId: { lat, lng } }
const users = {}    // optional future use

// 🔥 socket logic
io.on('connection', socket => {
  console.log('🔥 Socket connected:', socket.id)

  // ================= GET ALL DRIVERS =================
  socket.on('getDrivers', () => {
    socket.emit('allDrivers', drivers)
  })

  // ================= DRIVER LOCATION =================
  socket.on('driverLocation', async data => {
    try {
      const { driverId, lat, lng } = data

      if (!driverId || !lat || !lng) {
        console.log('❌ Invalid driverLocation data')
        return
      }

      // ✅ SAVE in memory
      drivers[driverId] = { lat, lng }

      // 🔥 (optional DB update)
      // await pool.query(
      //   "UPDATE drivers SET lat=$1, lng=$2 WHERE id=$3",
      //   [lat, lng, driverId]
      // )

      // ✅ SEND TO ALL CLIENTS
      io.emit('driverLocationUpdate', {
        driverId,
        lat,
        lng
      })

      console.log('📍 Location stored + sent:', driverId, lat, lng)

    } catch (err) {
      console.log('❌ Socket error:', err.message)
    }
  })

  // ================= DISCONNECT =================
  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id)
  })
})

// ================= START SERVER =================
const PORT = process.env.PORT || 4000

server.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`)
})