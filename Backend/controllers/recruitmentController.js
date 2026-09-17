import Applicant, { APPLICANT_STATUSES } from '../models/Applicant.js'
import JobOpening, { JOB_ROLES, JOB_STATUSES } from '../models/JobOpening.js'
import { EMPLOYMENT_TYPES } from '../models/Staff.js'
import { cleanString, isObjectId, pagination } from '../utils/validation.js'

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

function jobValues(body) {
  const deadline = new Date(body?.deadline)
  return {
    title: cleanString(body?.title, 180),
    department: cleanString(body?.department, 120),
    role: cleanString(body?.role).toLowerCase(),
    employmentType: cleanString(body?.employmentType).toLowerCase(),
    description: cleanString(body?.description, 5000),
    requirements: cleanString(body?.requirements, 3000),
    qualification: cleanString(body?.qualification, 1000),
    numberOfPositions: Number(body?.numberOfPositions) || 1,
    deadline: Number.isNaN(deadline.getTime()) ? null : deadline,
  }
}

function validateJob(values) {
  if (!values.title || !values.department || !values.description || !values.deadline) return 'Title, department, description, and deadline are required'
  if (!JOB_ROLES.includes(values.role)) return 'Invalid job role'
  if (!EMPLOYMENT_TYPES.includes(values.employmentType)) return 'Invalid employment type'
  if (values.numberOfPositions < 1 || values.numberOfPositions > 1000) return 'Number of positions must be between 1 and 1000'
  return ''
}

export async function listPublicJobs(req, res) {
  try {
    const items = await JobOpening.find({ status: 'open', deadline: { $gte: new Date() } }).sort({ createdAt: -1 }).lean()
    return res.json({ success: true, data: items })
  } catch (error) {
    console.error('listPublicJobs error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load job openings' })
  }
}

export async function getPublicJob(req, res) {
  if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid job identifier' })
  const job = await JobOpening.findOne({ _id: req.params.id, status: 'open', deadline: { $gte: new Date() } }).lean()
  if (!job) return res.status(404).json({ success: false, message: 'Open job not found' })
  return res.json({ success: true, data: job })
}

export async function listManagedJobs(req, res) {
  try {
    const filter = {}
    if (req.query.status) filter.status = cleanString(req.query.status).toLowerCase()
    if (filter.status && !JOB_STATUSES.includes(filter.status)) return res.status(400).json({ success: false, message: 'Invalid job status' })
    const items = await JobOpening.find(filter).sort({ createdAt: -1 }).lean()
    return res.json({ success: true, data: items })
  } catch (error) {
    console.error('listManagedJobs error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load managed job openings' })
  }
}

export async function createJob(req, res) {
  try {
    const values = jobValues(req.body)
    const message = validateJob(values)
    if (message) return res.status(400).json({ success: false, message })
    const job = await JobOpening.create({ ...values, createdBy: req.actor.id, updatedBy: req.actor.id })
    return res.status(201).json({ success: true, data: job, message: 'Job opening published' })
  } catch (error) {
    if (error?.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message })
    console.error('createJob error:', error)
    return res.status(500).json({ success: false, message: 'Unable to publish the job opening' })
  }
}

export async function updateJob(req, res) {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid job identifier' })
    const values = jobValues(req.body)
    const message = validateJob(values)
    if (message) return res.status(400).json({ success: false, message })
    const job = await JobOpening.findByIdAndUpdate(req.params.id, { $set: { ...values, updatedBy: req.actor.id } }, { new: true, runValidators: true })
    if (!job) return res.status(404).json({ success: false, message: 'Job opening not found' })
    return res.json({ success: true, data: job, message: 'Job opening updated' })
  } catch (error) {
    if (error?.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message })
    console.error('updateJob error:', error)
    return res.status(500).json({ success: false, message: 'Unable to update the job opening' })
  }
}

export async function updateJobStatus(req, res) {
  const status = cleanString(req.body?.status).toLowerCase()
  if (!isObjectId(req.params.id) || !JOB_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid job or status' })
  const job = await JobOpening.findByIdAndUpdate(req.params.id, { $set: { status, updatedBy: req.actor.id } }, { new: true })
  if (!job) return res.status(404).json({ success: false, message: 'Job opening not found' })
  return res.json({ success: true, data: job, message: `Job opening ${status}` })
}

export async function applyForJob(req, res) {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid job identifier' })
    const job = await JobOpening.findOne({ _id: req.params.id, status: 'open', deadline: { $gte: new Date() } })
    if (!job) return res.status(404).json({ success: false, message: 'This job is no longer accepting applications' })
    const data = {
      jobId: job._id,
      name: cleanString(req.body?.name, 120),
      email: cleanString(req.body?.email, 180).toLowerCase(),
      phone: cleanString(req.body?.phone, 40),
      qualification: cleanString(req.body?.qualification, 1000),
      experience: cleanString(req.body?.experience, 2000),
      cvUrl: cleanString(req.body?.cvUrl, 1000),
    }
    if (!data.name || !data.phone || !data.cvUrl || !EMAIL_PATTERN.test(data.email)) {
      return res.status(400).json({ success: false, message: 'Name, valid email, phone, and CV link are required' })
    }
    const applicant = await Applicant.create(data)
    return res.status(201).json({ success: true, data: applicant, message: 'Application submitted' })
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: 'You have already applied for this job' })
    if (error?.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message })
    console.error('applyForJob error:', error)
    return res.status(500).json({ success: false, message: 'Unable to submit the application' })
  }
}

export async function listApplicants(req, res) {
  try {
    const filter = {}
    if (req.query.jobId) {
      if (!isObjectId(req.query.jobId)) return res.status(400).json({ success: false, message: 'Invalid job identifier' })
      filter.jobId = req.query.jobId
    }
    if (req.query.status) {
      const status = cleanString(req.query.status).toLowerCase()
      if (!APPLICANT_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid applicant status' })
      filter.status = status
    }
    const { page, limit, skip } = pagination(req.query)
    const [items, total] = await Promise.all([
      Applicant.find(filter).populate('jobId', 'title department role status').sort({ appliedAt: -1 }).skip(skip).limit(limit).lean(),
      Applicant.countDocuments(filter),
    ])
    return res.json({ success: true, data: items, meta: { page, limit, total, count: items.length } })
  } catch (error) {
    console.error('listApplicants error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load applicants' })
  }
}

export async function updateApplicantStatus(req, res) {
  const status = cleanString(req.body?.status).toLowerCase()
  if (!isObjectId(req.params.id) || !APPLICANT_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid applicant or status' })
  const applicant = await Applicant.findByIdAndUpdate(req.params.id, { $set: { status, reviewedBy: req.actor.id } }, { new: true, runValidators: true })
  if (!applicant) return res.status(404).json({ success: false, message: 'Applicant not found' })
  return res.json({ success: true, data: applicant, message: `Applicant marked ${status}` })
}
