import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
const app=express();
app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true,
}));
app.use(express.json({limit:"16kb"}));
app.use(express.urlencoded({extended:true , limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

//routes import;
import userRouter from './routes/user.routes.js'
import habitRouter from './routes/habit.routes.js'
import problemRouter from './routes/problem.routes.js'
import weakTopicRouter from './routes/weakTopic.routes.js'
import subjectRouter from './routes/subject.routes.js'
import goalRouter from './routes/goal.routes.js'
import projectRouter from './routes/project.routes.js'
import applicationRouter from './routes/application.routes.js'
import contestRouter from './routes/contest.routes.js'
import scheduleTaskRouter from './routes/scheduleTask.routes.js'
import dashboardRouter from './routes/dashboard.routes.js'
import noteRouter from './routes/note.routes.js'
import settingsRouter from './routes/settings.routes.js'
import { errorHandler } from "./middlewares/error.middleware.js";

//routes declaration
app.use("/api/v1/users",userRouter)
app.use("/api/v1/habits",habitRouter)
app.use("/api/v1/problems",problemRouter)
app.use("/api/v1/weak-topics",weakTopicRouter)
app.use("/api/v1/subjects",subjectRouter)
app.use("/api/v1/goals",goalRouter)
app.use("/api/v1/projects",projectRouter)
app.use("/api/v1/applications",applicationRouter)
app.use("/api/v1/contests",contestRouter)
app.use("/api/v1/schedule",scheduleTaskRouter)
app.use("/api/v1/dashboard",dashboardRouter)
app.use("/api/v1/notes",noteRouter)
app.use("/api/v1/settings",settingsRouter)

// error handler — must be registered AFTER all routes
app.use(errorHandler)

export default app;
