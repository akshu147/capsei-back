import express from 'express'

import {
  driverRegister2ndstep,
  driverRegisterController,
  sendotpfordriverregister,
  verifyDriverOtp,
  updateDriverStatus,
  updateDriverLocation,
  getDriverStatus,
  driverLoginController
} from '../controllers/allcontrolers.js'
import { upload } from '../config/multer.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'
const uploadDriverDocs = upload.fields([
  { name: 'license', maxCount: 1 },
  { name: 'registrationCertificate', maxCount: 1 },
  { name: 'AadharCard', maxCount: 1 },
  { name: 'photo', maxCount: 1 }
])

const driverRoutes = express.Router()
driverRoutes.post('/send-otp', sendotpfordriverregister)
driverRoutes.post('/verify-otp', verifyDriverOtp)
driverRoutes.post('/register-driver', driverRegisterController)
driverRoutes.post(
  '/register-driver-2ndstep',
  authMiddleware, // ✅ pehle auth check
  uploadDriverDocs, // ✅ phir file upload
  driverRegister2ndstep
)
driverRoutes.post("/driver-login", authMiddleware, driverLoginController)
driverRoutes.get('/get-driver-status', authMiddleware, getDriverStatus)
driverRoutes.post('/update-driver-status', authMiddleware, updateDriverStatus)
driverRoutes.post("/update-driver-location", updateDriverLocation)


export { driverRoutes }
