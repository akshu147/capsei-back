import app from "express"
import {userroutes} from "./routes/auth.routes.js"
import {rideroutes} from "./routes/ride.routes.js"
import googleRoutes from "./routes/googleauthroutes.js"
const allroutes = app.Router()
allroutes.use("/user", userroutes)
allroutes.use("/ride", rideroutes)
allroutes.use("/auth",googleRoutes)
export {allroutes}