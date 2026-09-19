import mongoose from 'mongoose'

const assignmentCursorSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0, min: 0 },
}, { timestamps: true })

const AssignmentCursor = mongoose.models.AssignmentCursor
  || mongoose.model('AssignmentCursor', assignmentCursorSchema)

export default AssignmentCursor
