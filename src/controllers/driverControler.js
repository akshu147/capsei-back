import bcrypt from 'bcrypt'
import dotenv from 'dotenv'
dotenv.config()
import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'
import nodemailer from 'nodemailer'
import path from 'path'
import { extractTextFromImage } from '../utils/ocr.js'
import { extractAadhaar, extractDL } from '../utils/extrackData.js'
// Temporary memory store (production me DB use karna)
const sendotpfordriverregister = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // ✅ Case-insensitive check
    const existingDriver = await pool.query(
      'SELECT id FROM drivers WHERE LOWER(email) = LOWER($1)',
      [normalizedEmail]
    )

    if (existingDriver.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Driver already exists with this email'
      })
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const hashedOtp = await bcrypt.hash(otp, 10)

    await pool.query('DELETE FROM otps WHERE LOWER(email) = LOWER($1)', [
      normalizedEmail
    ])

    await pool.query(
      `INSERT INTO otps (email, otp_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
      [normalizedEmail, hashedOtp]
    )

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    })

    await transporter.sendMail({
      from: `"Capsei Driver Support" <${process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: 'Your Driver Registration OTP',
      html: `
        <h2>Driver Registration OTP</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP will expire in 5 minutes.</p>
      `
    })

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully'
    })
  } catch (error) {
    console.log('OTP Send Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    })
  }
}

const verifyDriverOtp = async (req, res) => {
  try {
    const { email, otp } = req.body

    const result = await pool.query(
      `SELECT * FROM otps 
       WHERE email = $1 
       AND expires_at > NOW()`,
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'OTP expired or not found'
      })
    }

    const otpRecord = result.rows[0]

    const isMatch = await bcrypt.compare(otp, otpRecord.otp_hash)

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      })
    }

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully'
    })
  } catch (error) {
    console.log('OTP Verify Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Verification failed'
    })
  }
}

const driverRegisterController = async (req, res) => {
  try {
    console.log('i love you')
    const { name, email, phone, password } = req.body

    // 1️⃣ Basic Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        message: 'All fields are required'
      })
    }

    const normalizedEmail = email.toLowerCase()

    // // 2️⃣ Check if driver already exists
    const existingDriver = await pool.query(
      'SELECT id FROM drivers WHERE email = $1 OR phone = $2',
      [normalizedEmail, phone]
    )

    if (existingDriver.rows.length > 0) {
      return res.status(409).json({
        message: 'Driver already exists with this email or phone'
      })
    }

    // // 3️⃣ Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // // 4️⃣ Insert into database
    const result = await pool.query(
      `INSERT INTO drivers (full_name, email, phone, password_hash)
   VALUES ($1, $2, $3, $4)
   RETURNING id, full_name, email, phone, created_at`,
      [name, normalizedEmail, phone, hashedPassword]
    )

    const driver = result.rows[0]

    // 5️⃣ Generate JWT
    const token = jwt.sign(
      { id: driver.id, role: driver.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    // // 6️⃣ Send httpOnly Cookie
    res.cookie('driverToken', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    })

    // // // 7️⃣ Success Response
    return res.status(201).json({
      message: 'Driver registered successfully'
      // driver
    })
  } catch (error) {
    console.error('Driver Register Error:', error.message)
    return res.status(500).json({
      message: 'Internal Server Error'
    })
  }
}

const driverRegister2ndstep = async (req, res) => {
  try {
    console.log('USER ID:', req.user?.id)
    const driverId = req.user?.id
    const data = { ...req.body }
    console.log(data)
    const files = req.files
    const documents = {
      license: files?.license?.[0]?.filename || null,
      registrationCertificate:
        files?.registrationCertificate?.[0]?.filename || null,
      AadharCard: files?.AadharCard?.[0]?.filename || null,
      photo: files?.photo?.[0]?.filename || null
    }

    // ✅ Basic check only
    if (!documents.license || !documents.AadharCard) {
      return res.status(400).json({
        message: 'License and Aadhaar are required'
      })
    }

    // 💾 DB SAVE (IMPORTANT)
    await pool.query(
      `UPDATE drivers
       SET vehicle_type=$1,
           vehicle_number=$2,
           vehicle_model=$3,
           license_number=$4,
           aadhar_number=$5,
           documents=$6
       WHERE id=$7`,
      [
        data.vehicleType,
        data.vehicleNumber,
        data.vehicleModel,
        data.licenseNumber,   // 👉 direct user input
        data.aadharNumber,    // 👉 direct user input
        JSON.stringify(documents), // 👉 files ka data
        driverId
      ]
    );

    res.status(200).json({
      message: 'Driver registered successfully'
    })
  } catch (err) {
    console.log('ERROR:', err)

    res.status(500).json({
      message: 'Internal Server Error'
    })
  }
}
const driverLoginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ❌ validation
    if (!phone || !password) {
      return res.status(400).json({
        message: "Phone and password are required"
      });
    }

    // 🔍 driver find karo
    const result = await pool.query(
      `SELECT * FROM drivers WHERE phone = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Driver not found"
      });
    }

    const driver = result.rows[0];

    // 🔐 password check
    const isMatch = await bcrypt.compare(password, driver.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    // 🎟️ JWT token generate
    const token = jwt.sign(
      {
        id: driver.id,
        role: "driver"
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ response
    res.status(200).json({
      message: "Login successful",
      token,
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        vehicle_type: driver.vehicle_type,
        is_online: driver.is_online
      }
    });

  } catch (err) {
    console.error("Driver Login Error:", err);
    res.status(500).json({
      message: "Internal server error"
    });
  }
};

const getDriverStatus = async (req, res) => {
  try {
    const driverId = req.user.id;

    const result = await pool.query(
      `SELECT is_online FROM drivers WHERE id = $1`,
      [driverId]
    );

    res.json({
      is_online: result.rows[0].is_online
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching status" });
  }
};
const updateDriverStatus = async (req, res) => {
  try {
    const driverId = req.user.id; // 🔥 middleware se

    const { is_online, lat, lng } = req.body;

    // ❌ validation
    if (typeof is_online !== "boolean") {
      return res.status(400).json({
        message: "is_online must be true or false"
      });
    }

    // 🧠 Query build (location optional)
    let query = "";
    let values = [];

    if (lat && lng) {
      query = `
        UPDATE drivers
        SET 
          is_online = $1,
          location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
        WHERE id = $4
        RETURNING *;
      `;
      values = [is_online, lng, lat, driverId]; // ⚠️ lng first, lat second
    } else {
      query = `
        UPDATE drivers
        SET is_online = $1
        WHERE id = $2
        RETURNING *;
      `;
      values = [is_online, driverId];
    }

    const result = await pool.query(query, values);

    res.status(200).json({
      message: `Driver is now ${is_online ? "ONLINE" : "OFFLINE"}`,
      driver: result.rows[0]
    });

  } catch (err) {
    console.error("Driver Status Error:", err);
    res.status(500).json({
      message: "Internal server error"
    });
  }
};
const updateDriverLocation = async (req, res) => {
  try {
    const driverId = req.user.id
    const { lat, lng, accuracy } = req.body
    console.log(req.body, "bhosiya")
    

    // ❌ validation
    if (!lat || !lng) {
      return res.status(400).json({
        message: "Latitude and Longitude required"
      })
    }


    // ❌ optional: accuracy check
    if (accuracy && accuracy > 200) {
      return res.status(400).json({
        message: "Location not accurate enough"
      })
    }

    // ✅ update only location
    // const query = `
    //   UPDATE drivers
    //   SET 
    //     location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
    //     last_updated = NOW()
    //   WHERE id = $3
    //   RETURNING id, is_online, location;
    // `

    // const values = [lng, lat, driverId] // ⚠️ lng first

    // const result = await pool.query(query, values)

    res.status(200).json({
      message: "Location updated"
      // driver: result.rows[0]
    })

  } catch (err) {
    console.error("Location Update Error:", err)
    res.status(500).json({
      message: "Internal server error"
    })
  }
}

export {
  sendotpfordriverregister,
  driverRegisterController,
  verifyDriverOtp,
  driverRegister2ndstep,
  getDriverStatus,
  updateDriverStatus,
  updateDriverLocation,
  driverLoginController
}
