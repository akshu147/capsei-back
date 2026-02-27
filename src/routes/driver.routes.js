import express from "express"
import { driverRegisterController, sendotpfordriverregister } from "../controllers/allcontrolers.js"

const driverRoutes = express.Router()
driverRoutes.post("/send-otp", sendotpfordriverregister)

driverRoutes.post("/register-driver", driverRegisterController) 

export { driverRoutes }