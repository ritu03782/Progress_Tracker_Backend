import mongoose, { Schema } from "mongoose";

const scheduleTaskSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    time: {
      type: String,
      trim: true,
      default: "Anytime",
    },
    priority: {
      type: String,
      enum: ["High", "Medium", "Low"],
      default: "Medium",
    },
    completed: {
      type: Boolean,
      default: false,
    },
    // The fix for the core bug: every task belongs to a specific day
    // (normalized to UTC midnight), so "Today's Schedule" only ever shows
    // tasks that actually belong to today, not every task ever created.
    date: {
      type: Date,
      required: true,
      index: true,
    },
    linkedGoal: {
      goalId: { type: Schema.Types.ObjectId, ref: "Goal", default: null },
      type: { type: String, enum: ["counter", "milestone"], default: null },
      milestoneId: { type: String, default: null },
      amount: { type: Number, default: 1 },
    },
  },
  { timestamps: true }
);

export const ScheduleTask = mongoose.model("ScheduleTask", scheduleTaskSchema);
