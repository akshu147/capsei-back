import bcrypt from 'bcrypt'
import dotenv from "dotenv"
dotenv.config()
import jwt from "jsonwebtoken"
import { pool } from "../config/db.js"

import nodemailer from "nodemailer"

// Temporary memory store (production me DB use karna)
const driverOtpStore = {}

const sendotpfordriverregister = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      })
    }

    // 🔥 Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    // ⏳ Expiry 10 minutes
    const expiry = Date.now() + 10 * 60 * 1000

    driverOtpStore[email] = {
      otp,
      expiry
    }

    // 📩 Nodemailer Transport
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    })

    // ✉️ Email Options
    const mailOptions = {
      from: `"Capsei Driver Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Driver Registration OTP",
      html: `
        <h2>Driver Registration OTP</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
      `
    }

    await transporter.sendMail(mailOptions)

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully"
    })

  } catch (error) {
    console.log("OTP Send Error:", error)

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP"
    })
  }
}


const driverRegisterController = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body

    // 1️⃣ Basic Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        message: "All fields are required"
      })
    }

    const normalizedEmail = email.toLowerCase()

    // 2️⃣ Check if driver already exists
    const existingDriver = await pool.query(
      "SELECT id FROM drivers WHERE email = $1 OR phone = $2",
      [normalizedEmail, phone]
    )

    if (existingDriver.rows.length > 0) {
      return res.status(409).json({
        message: "Driver already exists with this email or phone"
      })
    }

    // 3️⃣ Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // 4️⃣ Insert into database
    const result = await pool.query(
      `INSERT INTO drivers (name, email, phone, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, phone, role, created_at`,
      [name, normalizedEmail, phone, hashedPassword, "driver"]
    )

    const driver = result.rows[0]

    // 5️⃣ Generate JWT
    const token = jwt.sign(
      { id: driver.id, role: driver.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    )

    // 6️⃣ Send httpOnly Cookie
    res.cookie("driverToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    })

    // 7️⃣ Success Response
    return res.status(201).json({
      message: "Driver registered successfully",
      driver
    })

  } catch (error) {
    console.error("Driver Register Error:", error)
    return res.status(500).json({
      message: "Internal Server Error"
    })
  }
}

export {sendotpfordriverregister, driverRegisterController }