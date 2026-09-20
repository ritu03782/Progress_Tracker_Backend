import { User } from "../models/user.model.js";
import { Habit } from "../models/habit.model.js";
import { HabitLog } from "../models/habitLog.model.js";
import { Problem } from "../models/problem.model.js";
import { WeakTopic } from "../models/weakTopic.model.js";
import { Subject } from "../models/subject.model.js";
import { Goal } from "../models/goal.model.js";
import { Project } from "../models/project.model.js";
import { Application } from "../models/application.model.js";
import { Contest } from "../models/contest.model.js";
import { ScheduleTask } from "../models/scheduleTask.model.js";
import { Note } from "../models/note.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
};

// Dumps every piece of data this user has across every tracker, as one
// JSON document. The frontend turns this into a downloadable file —
// nothing is written to disk here.
const exportUserData = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [habits, habitLogs, problems, weakTopics, subjects, goals, projects, applications, contests, scheduleTasks, notes] =
    await Promise.all([
      Habit.find({ user: userId }).lean(),
      HabitLog.find({ user: userId }).lean(),
      Problem.find({ user: userId }).lean(),
      WeakTopic.find({ user: userId }).lean(),
      Subject.find({ user: userId }).lean(),
      Goal.find({ user: userId }).lean(),
      Project.find({ user: userId }).lean(),
      Application.find({ user: userId }).lean(),
      Contest.find({ user: userId }).lean(),
      ScheduleTask.find({ user: userId }).lean(),
      Note.find({ user: userId }).lean(),
    ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    profile: req.user,
    habits,
    habitLogs,
    dsaProblems: problems,
    weakTopics,
    subjects,
    goals,
    projects,
    applications,
    contests,
    scheduleTasks,
    notes,
  };

  return res.status(200).json(new ApiResponse(200, exportPayload, "Data exported successfully"));
});

// Deletes the account and every piece of data tied to it, across every
// collection, then logs the user out. Not wrapped in a DB transaction
// (out of scope for this app's scale) — each collection's deletion is
// independent and idempotent, so a partial failure just means retrying
// is safe, not corrupting.
const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  await Promise.all([
    Habit.deleteMany({ user: userId }),
    HabitLog.deleteMany({ user: userId }),
    Problem.deleteMany({ user: userId }),
    WeakTopic.deleteMany({ user: userId }),
    Subject.deleteMany({ user: userId }),
    Goal.deleteMany({ user: userId }),
    Project.deleteMany({ user: userId }),
    Application.deleteMany({ user: userId }),
    Contest.deleteMany({ user: userId }),
    ScheduleTask.deleteMany({ user: userId }),
    Note.deleteMany({ user: userId }),
  ]);

  await User.findByIdAndDelete(userId);

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Account deleted successfully"));
});

export { exportUserData, deleteAccount };
