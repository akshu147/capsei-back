import express from "express"
import { userlogin, userregister } from  "../controllers/auth.controller.js"
const userroutes = express.Router()
userroutes.post("/register", userregister)
userroutes.post("/userlogin", userlogin)
export {userroutes}