import mongoose, { Schema } from "mongoose";

const noteSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Normalized to UTC midnight — one note per user per calendar day,
    // matching how the DateNavigator lets you browse day by day.
    date: {
      type: Date,
      required: true,
    },
    text: {
      type: String,
      trim: true,
      default: "",
    },
    mood: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

noteSchema.index({ user: 1, date: 1 }, { unique: true });

export const Note = mongoose.model("Note", noteSchema);
