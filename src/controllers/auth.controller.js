import bcrypt from 'bcrypt'
import dotenv from "dotenv"
import { pool } from '../config/db.js'
import jwt from "jsonwebtoken"
dotenv.config()
const userregister = async (req, res) => {
  try {
    console.log("i love you")
    const { name, email, phone, password, conditionstatus } = req.body

    // 1️⃣ Validation
    if (!name || !email || !phone || !password || conditionstatus !== true) {
      return res.status(400).json({
        error: 'All fields are required and terms must be accepted'
      })
    }

    // 2️⃣ Check existing user
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR phone = $2',
      [email, phone]
    )

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' })
    }

    // 3️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // 4️⃣ Insert user
    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password, conditionstatus)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, phone, conditionstatus, created_at`,
      [name, email, phone, hashedPassword, conditionstatus]
    )

    // 5️⃣ Final response
    return res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0]
    })

  } catch (err) {
    console.error('Registration error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}



const userlogin = async (req, res) => {
  try {
    const { email, password } = req.body

    // 1️⃣ Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" })
    }

    // 2️⃣ Check user exists
    const userQuery = await pool.query(
      "SELECT id, email, password, name FROM users WHERE email = $1",
      [email.toLowerCase()]
    )

    if (userQuery.rowCount === 0) {
      return res.status(404).json({ message: "User not found" })
    }

    const user = userQuery.rows[0]

    // 3️⃣ Compare password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    // 4️⃣ Generate JWT
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    )

    // 5️⃣ Success
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Internal server error hai" })
  }
}

const googleAuthController = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(
        "http://localhost:3000/login?error=google_failed"
      );
    }

    const { googleId, name, email } = req.user;

    if (!email) {
      return res.redirect(
        "http://localhost:3000/login?error=no_email"
      );
    }

    const safeEmail = email.toLowerCase();

    // 1️⃣ Check user
    const userQuery = await pool.query(
      "SELECT id, name, email FROM users WHERE email = $1",
      [safeEmail]
    );

    let user;

    if (userQuery.rows.length > 0) {
      user = userQuery.rows[0];

      await pool.query(
        "UPDATE users SET google_id = $1 WHERE id = $2",
        [googleId, user.id]
      );
    } else {
      const newUser = await pool.query(
        `INSERT INTO users (name, email, google_id, conditionstatus)
         VALUES ($1, $2, $3, true)
         RETURNING id, name, email`,
        [name, safeEmail, googleId]
      );

      user = newUser.rows[0];
    }

    // 2️⃣ JWT
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
  

    // 3️⃣ 🔥 REDIRECT TO FRONTEND
    return res.redirect(
      `http://localhost:3000?token=${token}`
    );

  } catch (error) {
    console.error("Google login error:", error);
    return res.redirect(
      "http://localhost:3000/login?error=server_error"
    );
  }
};



export { userregister, userlogin, googleAuthController }


