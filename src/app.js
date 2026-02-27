
import express from "express"
import { userroutes } from "./routes/auth.routes.js"
import { rideroutes } from "./routes/ride.routes.js"
import googleRoutes from "./routes/googleauthroutes.js"
import { driverRoutes } from "./routes/driver.routes.js"

const allroutes = express.Router()

allroutes.use("/user", userroutes)
allroutes.use("/ride", rideroutes)
allroutes.use("/auth", googleRoutes)
allroutes.use("/driver", driverRoutes)

export { allroutes }