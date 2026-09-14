import { Contest } from "../models/contest.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// solved/totalProblems are computed from the problems checklist, never
// stored separately — asking the user to type "5 solved" AND check 5
// boxes would be the same duplicated-data bug fixed elsewhere.
const shapeContest = (doc) => {
  const problems = doc.problems.map((p) => ({
    id: p._id,
    label: p.label,
    name: p.name,
    points: p.points,
    solved: p.solved,
  }));

  return {
    id: doc._id,
    name: doc.name,
    platform: doc.platform,
    type: doc.type,
    status: doc.status,
    date: doc.date,
    startTime: doc.startTime,
    duration: doc.duration,
    registrationLink: doc.registrationLink,
    rank: doc.rank,
    totalParticipants: doc.totalParticipants,
    ratingChange: doc.ratingChange,
    score: doc.score,
    penalty: doc.penalty,
    percentage: doc.percentage,
    notes: doc.notes,
    problems,
    solved: problems.filter((p) => p.solved).length,
    totalProblems: problems.length,
    createdAt: doc.createdAt,
  };
};

const getContests = asyncHandler(async (req, res) => {
  const contests = await Contest.find({ user: req.user._id }).sort({ date: -1 });
  return res
    .status(200)
    .json(new ApiResponse(200, contests.map(shapeContest), "Contests fetched successfully"));
});

const createContest = asyncHandler(async (req, res) => {
  const { name, platform, type, date, startTime, duration, registrationLink } = req.body;

  if (!name || !name.trim()) throw new ApiError(400, "Contest name is required");
  if (!date) throw new ApiError(400, "Date is required");

  const contest = await Contest.create({
    user: req.user._id,
    name: name.trim(),
    platform: platform || "LeetCode",
    type: ["Rated", "Unrated"].includes(type) ? type : "Rated",
    status: "Upcoming",
    date: new Date(date),
    startTime: startTime?.trim() || "TBD",
    duration: duration?.trim() || "TBD",
    registrationLink: registrationLink?.trim() || "",
  });

  return res.status(201).json(new ApiResponse(201, shapeContest(contest), "Contest added successfully"));
});

// Deliberately does not touch status/result fields/problems — those only
// ever change via logResult/reopenToUpcoming below.
const updateContest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, platform, type, date, startTime, duration, registrationLink, notes } = req.body;

  const contest = await Contest.findOne({ _id: id, user: req.user._id });
  if (!contest) throw new ApiError(404, "Contest not found");

  if (name !== undefined) contest.name = name.trim();
  if (platform !== undefined) contest.platform = platform;
  if (type !== undefined && ["Rated", "Unrated"].includes(type)) contest.type = type;
  if (date !== undefined) contest.date = new Date(date);
  if (startTime !== undefined) contest.startTime = startTime.trim();
  if (duration !== undefined) contest.duration = duration.trim();
  if (registrationLink !== undefined) contest.registrationLink = registrationLink.trim();
  if (notes !== undefined) contest.notes = notes.trim();

  await contest.save();
  return res.status(200).json(new ApiResponse(200, shapeContest(contest), "Contest updated successfully"));
});

const deleteContest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const contest = await Contest.findOneAndDelete({ _id: id, user: req.user._id });
  if (!contest) throw new ApiError(404, "Contest not found");
  return res.status(200).json(new ApiResponse(200, { id }, "Contest deleted successfully"));
});

// The core missing feature: converts an Upcoming contest into a
// Participated one (or corrects an already-logged result — this is
// idempotent, safe to call again). Full overwrite of result fields +
// problems each time, since result-logging is a single atomic action,
// not an incremental edit.
const logResult = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rank, totalParticipants, ratingChange, score, penalty, percentage, notes, problems } = req.body;

  const contest = await Contest.findOne({ _id: id, user: req.user._id });
  if (!contest) throw new ApiError(404, "Contest not found");

  contest.status = "Participated";
  contest.rank = rank !== undefined ? Number(rank) : contest.rank;
  contest.totalParticipants = totalParticipants !== undefined ? Number(totalParticipants) : contest.totalParticipants;
  contest.ratingChange = ratingChange !== undefined ? Number(ratingChange) : contest.ratingChange;
  contest.score = score !== undefined ? Number(score) : contest.score;
  contest.penalty = penalty !== undefined ? Number(penalty) : contest.penalty;
  contest.percentage = percentage !== undefined ? Number(percentage) : contest.percentage;
  if (notes !== undefined) contest.notes = notes.trim();

  if (Array.isArray(problems)) {
    contest.problems = problems
      .filter((p) => p && (p.label?.trim() || p.name?.trim()))
      .map((p) => ({
        label: p.label?.trim() || "",
        name: p.name?.trim() || "",
        points: Number(p.points) || 0,
        solved: Boolean(p.solved),
      }));
  }

  await contest.save();
  return res.status(200).json(new ApiResponse(200, shapeContest(contest), "Contest result logged"));
});

// Safety valve for a mistakenly-logged result — reverts to Upcoming,
// clearing result fields (the problems checklist is kept, since re-doing
// it would be annoying and it's harmless while status is Upcoming).
const reopenToUpcoming = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const contest = await Contest.findOne({ _id: id, user: req.user._id });
  if (!contest) throw new ApiError(404, "Contest not found");

  contest.status = "Upcoming";
  contest.rank = null;
  contest.totalParticipants = null;
  contest.ratingChange = null;
  contest.score = null;
  contest.penalty = null;
  contest.percentage = null;

  await contest.save();
  return res.status(200).json(new ApiResponse(200, shapeContest(contest), "Contest reverted to Upcoming"));
});

export { getContests, createContest, updateContest, deleteContest, logResult, reopenToUpcoming };
