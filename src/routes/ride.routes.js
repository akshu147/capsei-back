import express from "express"
import { bookRideController, calculateprice } from "../controllers/ride.controller.js"
import { authMiddleware } from "../middlewares/auth.middleware.js"

const rideroutes = express.Router()

rideroutes.post("/calculate-price", calculateprice)
rideroutes.post("/book-ride", authMiddleware,bookRideController)

export { rideroutes }