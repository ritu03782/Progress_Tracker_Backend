import mongoose, { Schema } from "mongoose";

const resourceSchema = new Schema({
  label: { type: String, trim: true },
  url: { type: String, trim: true },
});

const STAGES = ["Applied", "OA", "Interview", "Offer"];

const applicationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    // Canonical current stage. "Rejected" is a terminal state layered on
    // top of wherever the pipeline had reached — see rejectedFromStage.
    status: {
      type: String,
      enum: [...STAGES, "Rejected"],
      default: "Applied",
    },
    // Snapshot of `status` at the moment it was set to "Rejected" — this
    // is what lets the Timeline correctly show "got to Interview, then
    // rejected" instead of losing that history the moment status flips.
    rejectedFromStage: {
      type: String,
      enum: STAGES,
      default: null,
    },
    appliedDate: {
      type: Date,
      required: true,
    },
    // Real dates for each later stage, set automatically when advancing.
    stageDates: {
      oa: { type: Date, default: null },
      interview: { type: Date, default: null },
      offer: { type: Date, default: null },
    },
    expectedCTC: { type: String, trim: true, default: "" },
    jobType: { type: String, trim: true, default: "Internship" },
    location: { type: String, trim: true, default: "" },
    department: { type: String, trim: true, default: "" },
    experience: { type: String, trim: true, default: "" },
    batch: { type: String, trim: true, default: "" },
    jobId: { type: String, trim: true, default: "" },
    jobDescriptionUrl: { type: String, trim: true, default: "" },
    // Describes the pending action for the CURRENT stage (e.g. status=OA,
    // nextStep={title:"Online Assessment", date: <when>}) — updated every
    // time the stage advances.
    nextStep: {
      title: { type: String, trim: true, default: "" },
      date: { type: Date, default: null },
      time: { type: String, trim: true, default: "" },
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    resources: [resourceSchema],
  },
  { timestamps: true }
);

export const Application = mongoose.model("Application", applicationSchema);
