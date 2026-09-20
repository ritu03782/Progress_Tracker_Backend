import { ScheduleTask } from "../models/scheduleTask.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { startOfUTCDay } from "../utils/dateUtils.js";

const shapeTask = (doc) => ({
  id: doc._id,
  title: doc.title,
  time: doc.time,
  priority: doc.priority,
  completed: doc.completed,
  date: doc.date,
  linkedGoal: doc.linkedGoal?.goalId
    ? {
        goalId: doc.linkedGoal.goalId,
        type: doc.linkedGoal.type,
        milestoneId: doc.linkedGoal.milestoneId,
        amount: doc.linkedGoal.amount,
      }
    : null,
  createdAt: doc.createdAt,
});

// Defaults to today when no ?date= is given — this is the actual fix:
// the query is scoped by date, so tasks from other days never show up.
const getSchedule = asyncHandler(async (req, res) => {
  const targetDate = req.query.date ? startOfUTCDay(new Date(req.query.date)) : startOfUTCDay();

  const tasks = await ScheduleTask.find({ user: req.user._id, date: targetDate }).sort({ createdAt: 1 });

  return res.status(200).json(new ApiResponse(200, tasks.map(shapeTask), "Schedule fetched successfully"));
});

const createTask = asyncHandler(async (req, res) => {
  const { title, time, priority, date, linkedGoalId, linkedGoalType, linkedMilestoneId, linkedAmount } = req.body;

  if (!title || !title.trim()) {
    throw new ApiError(400, "Task title is required");
  }

  const task = await ScheduleTask.create({
    user: req.user._id,
    title: title.trim(),
    time: time?.trim() || "Anytime",
    priority: ["High", "Medium", "Low"].includes(priority) ? priority : "Medium",
    date: date ? startOfUTCDay(new Date(date)) : startOfUTCDay(),
    linkedGoal: linkedGoalId
      ? {
          goalId: linkedGoalId,
          type: linkedGoalType || "counter",
          milestoneId: linkedMilestoneId || null,
          amount: Number(linkedAmount) || 1,
        }
      : undefined,
  });

  return res.status(201).json(new ApiResponse(201, shapeTask(task), "Task added successfully"));
});

const toggleTask = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const task = await ScheduleTask.findOne({ _id: id, user: req.user._id });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  task.completed = !task.completed;
  await task.save();

  return res.status(200).json(new ApiResponse(200, shapeTask(task), "Task updated successfully"));
});

const deleteTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const task = await ScheduleTask.findOneAndDelete({ _id: id, user: req.user._id });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }
  return res.status(200).json(new ApiResponse(200, { id }, "Task deleted successfully"));
});

export { getSchedule, createTask, toggleTask, deleteTask };
