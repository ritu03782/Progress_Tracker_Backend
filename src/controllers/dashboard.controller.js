import { HabitLog } from "../models/habitLog.model.js";
import { Problem } from "../models/problem.model.js";
import { Subject } from "../models/subject.model.js";
import { Project } from "../models/project.model.js";
import { Application } from "../models/application.model.js";
import { Contest } from "../models/contest.model.js";
import { Goal } from "../models/goal.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const PER_SOURCE_LIMIT = 5;
const RESULT_LIMIT = 8;

// NOTE on what this feed actually is: most trackers only store the single
// MOST RECENT timestamp for an item (lastStudiedAt, lastUpdatedAt), not a
// full history of every event. So this is "the latest event per source,
// merged and sorted" — not a perfect infinite activity log. If you
// complete three Subject topics in one day, only the latest shows here,
// since that's genuinely all the data that exists.
const getRecentActivity = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [habitLogs, problems, subjects, projects, applications, contests, goals] = await Promise.all([
    HabitLog.find({ user: userId, completed: true })
      .sort({ updatedAt: -1 })
      .limit(PER_SOURCE_LIMIT)
      .populate("habit", "title"),
    Problem.find({ user: userId, status: "Solved", solvedAt: { $ne: null } })
      .sort({ solvedAt: -1 })
      .limit(PER_SOURCE_LIMIT),
    Subject.find({ user: userId, lastStudiedAt: { $ne: null } })
      .sort({ lastStudiedAt: -1 })
      .limit(PER_SOURCE_LIMIT),
    Project.find({ user: userId, lastUpdatedAt: { $ne: null } })
      .sort({ lastUpdatedAt: -1 })
      .limit(PER_SOURCE_LIMIT),
    Application.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(PER_SOURCE_LIMIT),
    Contest.find({ user: userId, status: "Participated" })
      .sort({ updatedAt: -1 })
      .limit(PER_SOURCE_LIMIT),
    Goal.find({ user: userId, completedAt: { $ne: null } })
      .sort({ completedAt: -1 })
      .limit(PER_SOURCE_LIMIT),
  ]);

  const items = [];

  habitLogs.forEach((log) => {
    if (!log.habit) return; // habit may have been deleted since this log was written
    items.push({
      type: "habit",
      title: `Completed ${log.habit.title}`,
      description: "Daily habit marked complete",
      timestamp: log.updatedAt,
    });
  });

  problems.forEach((p) => {
    items.push({
      type: "dsa",
      title: `Solved ${p.name}`,
      description: `${p.difficulty} · ${p.platform}`,
      timestamp: p.solvedAt,
    });
  });

  subjects.forEach((s) => {
    items.push({
      type: "subject",
      title: `Studied ${s.name}`,
      description: "Subject topic marked complete",
      timestamp: s.lastStudiedAt,
    });
  });

  projects.forEach((p) => {
    items.push({
      type: "project",
      title: `Updated ${p.name}`,
      description: "Project task progress updated",
      timestamp: p.lastUpdatedAt,
    });
  });

  applications.forEach((a) => {
    items.push({
      type: "application",
      title: `Applied to ${a.company}`,
      description: a.role,
      timestamp: a.createdAt,
    });
  });

  contests.forEach((c) => {
    items.push({
      type: "contest",
      title: `Logged result for ${c.name}`,
      description: c.rank ? `Rank ${c.rank}` : c.platform,
      timestamp: c.updatedAt,
    });
  });

  goals.forEach((g) => {
    items.push({
      type: "goal",
      title: `Completed goal: ${g.title}`,
      description: "Goal reached 100%",
      timestamp: g.completedAt,
    });
  });

  const sorted = items
    .filter((i) => i.timestamp)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, RESULT_LIMIT);

  return res.status(200).json(new ApiResponse(200, sorted, "Recent activity fetched successfully"));
});

export { getRecentActivity };
