import mongoose, { Schema } from "mongoose";

const problemSchema = new Schema({
  label: { type: String, trim: true, default: "" }, // e.g. "A", "B", "1"
  name: { type: String, trim: true, default: "" },
  points: { type: Number, default: 0 },
  solved: { type: Boolean, default: false },
});

const contestSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    // Matches a `label` in the frontend's platformOptions array — icon/
    // color re-attached client-side, never stored here.
    platform: { type: String, trim: true, default: "LeetCode" },
    type: { type: String, enum: ["Rated", "Unrated"], default: "Rated" },
    status: { type: String, enum: ["Upcoming", "Participated"], default: "Upcoming" },
    date: { type: Date, required: true },
    startTime: { type: String, trim: true, default: "TBD" },
    duration: { type: String, trim: true, default: "TBD" },
    registrationLink: { type: String, trim: true, default: "" },

    // --- Result fields — only meaningful once status === "Participated".
    // These come from the contest platform itself after the fact, so
    // they're manually entered, not computed. ---
    rank: { type: Number, default: null },
    totalParticipants: { type: Number, default: null },
    ratingChange: { type: Number, default: null },
    score: { type: Number, default: null },
    penalty: { type: Number, default: null },
    percentage: { type: Number, default: null },

    notes: { type: String, trim: true, default: "" },
    problems: [problemSchema],
  },
  { timestamps: true }
);

export const Contest = mongoose.model("Contest", contestSchema);
