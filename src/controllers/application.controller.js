import { Application } from "../models/application.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const STAGES = ["Applied", "OA", "Interview", "Offer"];

const DEFAULT_NEXT_TITLES = {
  OA: "Online Assessment",
  Interview: "Interview Round",
  Offer: "Offer received",
};

// Sends every raw field the frontend needs to DERIVE the timeline and
// next-step badge itself (same pattern as DSA/Subjects/Projects) — the
// backend never computes "today" relative to a stored date.
const shapeApplication = (doc) => ({
  id: doc._id,
  company: doc.company,
  role: doc.role,
  status: doc.status,
  rejectedFromStage: doc.rejectedFromStage,
  appliedDate: doc.appliedDate,
  stageDates: {
    oa: doc.stageDates?.oa || null,
    interview: doc.stageDates?.interview || null,
    offer: doc.stageDates?.offer || null,
  },
  expectedCTC: doc.expectedCTC,
  jobType: doc.jobType,
  location: doc.location,
  department: doc.department,
  experience: doc.experience,
  batch: doc.batch,
  jobId: doc.jobId,
  jobDescriptionUrl: doc.jobDescriptionUrl,
  nextStep: {
    title: doc.nextStep?.title || "",
    date: doc.nextStep?.date || null,
    time: doc.nextStep?.time || "",
  },
  notes: doc.notes,
  resources: doc.resources.map((r) => ({ id: r._id, label: r.label, url: r.url })),
  createdAt: doc.createdAt,
});

const getApplications = asyncHandler(async (req, res) => {
  const applications = await Application.find({ user: req.user._id }).sort({ createdAt: -1 });
  return res
    .status(200)
    .json(new ApiResponse(200, applications.map(shapeApplication), "Applications fetched successfully"));
});

const createApplication = asyncHandler(async (req, res) => {
  const {
    company, role, status, appliedDate, expectedCTC, jobType, location,
    department, experience, batch, jobId, jobDescriptionUrl, notes,
  } = req.body;

  if (!company || !company.trim()) throw new ApiError(400, "Company name is required");
  if (!role || !role.trim()) throw new ApiError(400, "Role is required");
  if (!appliedDate) throw new ApiError(400, "Applied date is required");

  const initialStatus = [...STAGES, "Rejected"].includes(status) ? status : "Applied";

  const application = await Application.create({
    user: req.user._id,
    company: company.trim(),
    role: role.trim(),
    status: initialStatus,
    // If created directly as "Rejected", we have no way to know how far
    // it actually got — default to "Applied" as the safest assumption.
    // The user can Reopen + Advance afterward if it got further than that.
    rejectedFromStage: initialStatus === "Rejected" ? "Applied" : null,
    appliedDate: new Date(appliedDate),
    expectedCTC: expectedCTC?.trim() || "",
    jobType: jobType?.trim() || "Internship",
    location: location?.trim() || "",
    department: department?.trim() || "",
    experience: experience?.trim() || "",
    batch: batch?.trim() || "",
    jobId: jobId?.trim() || "",
    jobDescriptionUrl: jobDescriptionUrl?.trim() || "",
    notes: notes?.trim() || "",
    nextStep: initialStatus === "Applied" ? { title: "Awaiting response", date: null, time: "" } : {},
  });

  return res
    .status(201)
    .json(new ApiResponse(201, shapeApplication(application), "Application added successfully"));
});

// Deliberately does not accept `status` here — status only ever changes
// via advanceStage/rejectApplication/reopenApplication below, so the
// stageDates/timeline can never fall out of sync with it.
const updateApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    company, role, appliedDate, expectedCTC, jobType, location,
    department, experience, batch, jobId, jobDescriptionUrl, notes,
  } = req.body;

  const application = await Application.findOne({ _id: id, user: req.user._id });
  if (!application) throw new ApiError(404, "Application not found");

  if (company !== undefined) application.company = company.trim();
  if (role !== undefined) application.role = role.trim();
  if (appliedDate !== undefined) application.appliedDate = new Date(appliedDate);
  if (expectedCTC !== undefined) application.expectedCTC = expectedCTC.trim();
  if (jobType !== undefined) application.jobType = jobType.trim();
  if (location !== undefined) application.location = location.trim();
  if (department !== undefined) application.department = department.trim();
  if (experience !== undefined) application.experience = experience.trim();
  if (batch !== undefined) application.batch = batch.trim();
  if (jobId !== undefined) application.jobId = jobId.trim();
  if (jobDescriptionUrl !== undefined) application.jobDescriptionUrl = jobDescriptionUrl.trim();
  if (notes !== undefined) application.notes = notes.trim();

  await application.save();

  return res
    .status(200)
    .json(new ApiResponse(200, shapeApplication(application), "Application updated successfully"));
});

const deleteApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const application = await Application.findOneAndDelete({ _id: id, user: req.user._id });
  if (!application) throw new ApiError(404, "Application not found");
  return res.status(200).json(new ApiResponse(200, { id }, "Application deleted successfully"));
});

// Moves the application forward to a later stage — can skip ahead (e.g.
// Applied -> Interview directly, if OA was waived). Records the real date
// and refreshes what "next step" means for the new stage.
const advanceStage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { stage, date, nextStepTitle, nextStepDate, nextStepTime } = req.body;

  if (!STAGES.includes(stage)) {
    throw new ApiError(400, "stage must be one of Applied, OA, Interview, Offer");
  }

  const application = await Application.findOne({ _id: id, user: req.user._id });
  if (!application) throw new ApiError(404, "Application not found");

  if (application.status === "Rejected") {
    throw new ApiError(400, "Reopen the application before advancing its stage");
  }

  const currentIndex = STAGES.indexOf(application.status);
  const targetIndex = STAGES.indexOf(stage);
  if (targetIndex <= currentIndex) {
    throw new ApiError(400, "Can only advance to a later stage");
  }

  const stageDate = date ? new Date(date) : new Date();
  if (stage === "OA") application.stageDates.oa = stageDate;
  if (stage === "Interview") application.stageDates.interview = stageDate;
  if (stage === "Offer") application.stageDates.offer = stageDate;

  application.status = stage;

  application.nextStep =
    stage === "Offer"
      ? { title: "Offer received", date: null, time: "" }
      : {
          title: nextStepTitle?.trim() || DEFAULT_NEXT_TITLES[stage] || "",
          date: nextStepDate ? new Date(nextStepDate) : null,
          time: nextStepTime?.trim() || "",
        };

  await application.save();

  return res.status(200).json(new ApiResponse(200, shapeApplication(application), "Application stage updated"));
});

// Marks rejected, remembering how far it got so the timeline stays accurate.
const rejectApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const application = await Application.findOne({ _id: id, user: req.user._id });
  if (!application) throw new ApiError(404, "Application not found");

  if (application.status !== "Rejected") {
    application.rejectedFromStage = application.status;
    application.status = "Rejected";
    application.nextStep = { title: "Process closed", date: null, time: "" };
    await application.save();
  }

  return res.status(200).json(new ApiResponse(200, shapeApplication(application), "Application marked as rejected"));
});

// Undoes a rejection, restoring whatever stage it was at before.
const reopenApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const application = await Application.findOne({ _id: id, user: req.user._id });
  if (!application) throw new ApiError(404, "Application not found");

  if (application.status === "Rejected") {
    application.status = application.rejectedFromStage || "Applied";
    application.rejectedFromStage = null;
    await application.save();
  }

  return res.status(200).json(new ApiResponse(200, shapeApplication(application), "Application reopened"));
});

export {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  advanceStage,
  rejectApplication,
  reopenApplication,
};
