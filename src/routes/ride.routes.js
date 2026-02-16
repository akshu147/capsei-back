import express from "express"
import { calculateprice } from "../controllers/ride.controller.js"

const rideroutes = express.Router()

rideroutes.post("/calculate-price", calculateprice)

export { rideroutes }