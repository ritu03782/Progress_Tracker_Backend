import { Habit } from "../models/habit.model.js";
import { HabitLog } from "../models/habitLog.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { MS_DAY, startOfUTCDay, toDateKey } from "../utils/dateUtils.js";

// Accepts an optional "YYYY-MM-DD" (or any parseable date) and normalizes
// it to UTC midnight; defaults to today.
const parseDateParam = (value) => (value ? startOfUTCDay(new Date(value)) : startOfUTCDay());

// Builds { history (last 7 days, oldest->newest), completedToday, streak,
// completionRate } for one habit, purely from its logs — nothing is read
// from (or written to) the Habit document itself.
async function computeHabitStats(habitId, createdAt) {
  const today = startOfUTCDay();
  const lookbackStart = new Date(
    Math.max(today.getTime() - 364 * MS_DAY, startOfUTCDay(createdAt).getTime())
  );

  const logs = await HabitLog.find({
    habit: habitId,
    date: { $gte: lookbackStart, $lte: today },
  })
    .sort({ date: 1 })
    .lean();

  const completedSet = new Set(logs.filter((l) => l.completed).map((l) => toDateKey(l.date)));

  const history = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today.getTime() - i * MS_DAY);
    history.push(completedSet.has(toDateKey(day)));
  }

  const completedToday = completedSet.has(toDateKey(today));

  // Consecutive completed days ending today (or ending yesterday if
  // today hasn't been marked yet, so an in-progress day doesn't break it).
  let streak = 0;
  let cursor = completedToday ? today : new Date(today.getTime() - MS_DAY);
  while (completedSet.has(toDateKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - MS_DAY);
  }

  // Longest run anywhere in the lookback window — powers the Dashboard's
  // "Best: N Days" subtitle. Not just the current streak: an old, broken
  // streak can still be the best one ever.
  let bestStreak = 0;
  let running = 0;
  for (let day = new Date(lookbackStart); day <= today; day = new Date(day.getTime() + MS_DAY)) {
    if (completedSet.has(toDateKey(day))) {
      running++;
      bestStreak = Math.max(bestStreak, running);
    } else {
      running = 0;
    }
  }
  bestStreak = Math.max(bestStreak, streak);

  // Completion rate over a trailing window: since creation, capped at 30
  // days so an old habit's one bad week doesn't get diluted into invisibility.
  const daysSinceCreation = Math.floor((today - startOfUTCDay(createdAt)) / MS_DAY) + 1;
  const windowDays = Math.min(Math.max(daysSinceCreation, 1), 30);
  const windowStartKey = toDateKey(new Date(today.getTime() - (windowDays - 1) * MS_DAY));
  const todayKey = toDateKey(today);
  const completedInWindow = [...completedSet].filter(
    (key) => key >= windowStartKey && key <= todayKey
  ).length;
  const completionRate = Math.round((completedInWindow / windowDays) * 100);

  return { history, completedToday, streak, bestStreak, completionRate };
}

// Shapes a Habit doc + computed stats into exactly what the frontend's
// HabitCard/HabitDrawer/MotivationCard already expect (minus icon/color/bg,
// which the frontend re-attaches from `iconLabel` — see habitsService.js).
const shapeHabit = (habitDoc, stats) => ({
  id: habitDoc._id,
  title: habitDoc.title,
  description: habitDoc.description,
  category: habitDoc.category,
  iconLabel: habitDoc.iconLabel,
  target: habitDoc.target,
  reminder: habitDoc.reminder,
  notes: habitDoc.notes,
  completed: stats.completedToday,
  progress: stats.completedToday ? 100 : 0,
  streak: stats.streak,
  bestStreak: stats.bestStreak,
  completionRate: stats.completionRate,
  history: stats.history,
  createdAt: habitDoc.createdAt,
});

const getHabits = asyncHandler(async (req, res) => {
  const habits = await Habit.find({ user: req.user._id, archived: false }).sort({ createdAt: 1 });

  const shaped = await Promise.all(
    habits.map(async (h) => shapeHabit(h, await computeHabitStats(h._id, h.createdAt)))
  );

  return res.status(200).json(new ApiResponse(200, shaped, "Habits fetched successfully"));
});

const createHabit = asyncHandler(async (req, res) => {
  const { title, description, category, iconLabel, target, reminder, notes } = req.body;

  if (!title || !title.trim()) {
    throw new ApiError(400, "Habit title is required");
  }

  const habit = await Habit.create({
    user: req.user._id,
    title: title.trim(),
    description: description?.trim() || "",
    category: category?.trim() || "General",
    iconLabel: iconLabel || "Coding",
    target: target?.trim() || "1x / day",
    reminder: reminder?.trim() || "",
    notes: notes?.trim() || "",
  });

  const stats = await computeHabitStats(habit._id, habit.createdAt);
  return res
    .status(201)
    .json(new ApiResponse(201, shapeHabit(habit, stats), "Habit created successfully"));
});

const updateHabit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, category, iconLabel, target, reminder, notes } = req.body;

  const habit = await Habit.findOne({ _id: id, user: req.user._id });
  if (!habit) {
    throw new ApiError(404, "Habit not found");
  }

  if (title !== undefined) habit.title = title.trim();
  if (description !== undefined) habit.description = description.trim();
  if (category !== undefined) habit.category = category.trim();
  if (iconLabel !== undefined) habit.iconLabel = iconLabel;
  if (target !== undefined) habit.target = target.trim();
  if (reminder !== undefined) habit.reminder = reminder.trim();
  if (notes !== undefined) habit.notes = notes.trim();

  await habit.save();

  const stats = await computeHabitStats(habit._id, habit.createdAt);
  return res
    .status(200)
    .json(new ApiResponse(200, shapeHabit(habit, stats), "Habit updated successfully"));
});

const deleteHabit = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const habit = await Habit.findOneAndDelete({ _id: id, user: req.user._id });
  if (!habit) {
    throw new ApiError(404, "Habit not found");
  }

  await HabitLog.deleteMany({ habit: id });

  return res.status(200).json(new ApiResponse(200, { id }, "Habit deleted successfully"));
});

// Flips (or explicitly sets) completion for one habit on one date.
// - No `completed` in body -> flips the existing value (or creates a
//   completed=true log if none exists yet). Used by "Mark Complete".
// - `completed:false` + `skipReason` -> explicitly marks the day skipped,
//   regardless of current state. Used by "Skip Today".
const toggleHabitCompletion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { date, completed, skipReason } = req.body;

  const habit = await Habit.findOne({ _id: id, user: req.user._id });
  if (!habit) {
    throw new ApiError(404, "Habit not found");
  }

  const targetDate = parseDateParam(date);
  let log = await HabitLog.findOne({ habit: id, date: targetDate });

  const nextCompleted = completed !== undefined ? Boolean(completed) : !(log?.completed);

  if (log) {
    log.completed = nextCompleted;
    if (skipReason !== undefined) log.skipReason = skipReason;
    if (nextCompleted) log.skipReason = "";
    await log.save();
  } else {
    log = await HabitLog.create({
      habit: id,
      user: req.user._id,
      date: targetDate,
      completed: nextCompleted,
      skipReason: nextCompleted ? "" : skipReason || "",
    });
  }

  const stats = await computeHabitStats(habit._id, habit.createdAt);
  return res
    .status(200)
    .json(new ApiResponse(200, shapeHabit(habit, stats), "Habit updated successfully"));
});

// Powers MissedTaskCard — habits with no completed log for the given date
// (defaults to yesterday), excluding ones the user has already dismissed
// via "Ignore" or "Reschedule".
const resolveMissedDate = (dateQuery) =>
  dateQuery ? parseDateParam(dateQuery) : parseDateParam(new Date(Date.now() - MS_DAY));

const getMissedHabits = asyncHandler(async (req, res) => {
  const targetDate = resolveMissedDate(req.query.date);

  const habits = await Habit.find({ user: req.user._id, archived: false });
  const logs = await HabitLog.find({ user: req.user._id, date: targetDate });
  const logMap = new Map(logs.map((l) => [String(l.habit), l]));

  const missed = habits
    .filter((h) => {
      const log = logMap.get(String(h._id));
      return (!log || !log.completed) && !log?.dismissed;
    })
    .map((h) => ({
      id: h._id,
      title: h.title,
      description: logMap.get(String(h._id))?.skipReason || "Not completed",
      category: h.category,
    }));

  return res.status(200).json(new ApiResponse(200, missed, "Missed habits fetched successfully"));
});

// "Ignore" -> dismiss the notice as-is.
// "Reschedule" -> dismiss it AND record that the user intends to make it
// up today, by tagging the missed day's skipReason.
const dismissMissedHabit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { date, action } = req.body;

  if (!["ignore", "reschedule"].includes(action)) {
    throw new ApiError(400, "action must be 'ignore' or 'reschedule'");
  }

  const habit = await Habit.findOne({ _id: id, user: req.user._id });
  if (!habit) {
    throw new ApiError(404, "Habit not found");
  }

  const targetDate = resolveMissedDate(date);
  const setFields = { dismissed: true };
  if (action === "reschedule") {
    setFields.skipReason = "Rescheduled for today";
  }

  const log = await HabitLog.findOneAndUpdate(
    { habit: id, date: targetDate },
    {
      $set: setFields,
      $setOnInsert: { user: req.user._id, completed: false },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      { id: habit._id, date: toDateKey(targetDate), dismissed: log.dismissed, skipReason: log.skipReason },
      action === "reschedule" ? "Habit rescheduled" : "Habit dismissed"
    )
  );
});

// Powers ConsistencyCalendar — one completion % per day for the whole year,
// across ALL of the user's habits.
const getHeatmap = asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));

  const totalHabits = await Habit.countDocuments({ user: req.user._id, archived: false });

  const grouped = await HabitLog.aggregate([
    {
      $match: {
        user: req.user._id,
        date: { $gte: yearStart, $lte: yearEnd },
      },
    },
    {
      $group: {
        _id: "$date",
        completedCount: { $sum: { $cond: ["$completed", 1, 0] } },
      },
    },
  ]);

  const data = grouped.map((g) => ({
    date: toDateKey(g._id),
    completion: totalHabits > 0 ? Math.round((g.completedCount / totalHabits) * 100) : 0,
    completedHabits: g.completedCount,
    totalHabits,
  }));

  return res.status(200).json(new ApiResponse(200, data, "Heatmap data fetched successfully"));
});

export {
  getHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  toggleHabitCompletion,
  getMissedHabits,
  dismissMissedHabit,
  getHeatmap,
  computeHabitStats,
};
