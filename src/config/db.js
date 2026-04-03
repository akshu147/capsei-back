import { Pool } from "pg";
import dotenv from "dotenv";


dotenv.config(); // ✅ VERY IMPORTANT

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Neon ke liye required
  },
});

// connection test (sirf startup pe)
(async () => {
  try {
    await pool.query(`SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'drivers_vehicle_category_check';`);
    console.log("✅ PostgreSQL connected (Neon serverless)");
  } catch (err) {
    console.error("❌ PostgreSQL connection failed", err);
    process.exit(1);
  }
})();

export { pool };


// category → vehicle_type (DB me)
// id → vehicle_category (DB me)




