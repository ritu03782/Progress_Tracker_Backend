import { Note } from "../models/note.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { startOfUTCDay } from "../utils/dateUtils.js";

const shapeNote = (doc, dateFallback) => ({
  id: doc?._id || null,
  date: doc?.date || dateFallback,
  text: doc?.text || "",
  mood: doc?.mood || "",
  updatedAt: doc?.updatedAt || null,
});

// Returns an empty draft (200, not 404) when no note exists yet for that
// day — "no note written" is a normal state, not an error.
const getNote = asyncHandler(async (req, res) => {
  const targetDate = req.query.date ? startOfUTCDay(new Date(req.query.date)) : startOfUTCDay();
  const note = await Note.findOne({ user: req.user._id, date: targetDate });
  return res.status(200).json(new ApiResponse(200, shapeNote(note, targetDate), "Note fetched successfully"));
});

// Single upsert — create-or-update, since the UI has one explicit Save
// button rather than separate create/edit flows.
const saveNote = asyncHandler(async (req, res) => {
  const { date, text, mood } = req.body;

  if (!date) {
    throw new ApiError(400, "date is required");
  }

  const targetDate = startOfUTCDay(new Date(date));

  const note = await Note.findOneAndUpdate(
    { user: req.user._id, date: targetDate },
    { $set: { text: text ?? "", mood: mood ?? "" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return res.status(200).json(new ApiResponse(200, shapeNote(note, targetDate), "Note saved successfully"));
});

export { getNote, saveNote };
