import mongoose from "mongoose";


const serviceAppointmentSchema = new mongoose.Schema({
    createdBy:{
        type:String,
        default:null,
        index:true
    },
    patientName: {
    type: String,
      required: true,
        trim: true,
    },

  mobile: {
    type: String,
      required: true,
        trim: true,
    },

  age: {
    type: Number,
      min: 0,
    },

  gender: {
    type: String,
      enum: ["Male", "Female", "Other", ""],
      default: "",
    },

  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
        required: true,
    },

  serviceName: {
    type: String,
      required: true,
    },

  serviceImage: {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
  },

  notes: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: "",
  },

  fees: {
    type: Number,
      required: true,
        min: 0,
    },

  requestedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },

  assignedPathologist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    default: null,
    index: true,
  },

  assignedPathologistName: { type: String, trim: true, default: "" },
  assignedPathologistEmployeeId: { type: String, trim: true, default: "" },
  assignedAt: { type: Date, default: null },
  assignmentSequence: { type: Number, default: null },

  // Optional legacy fields keep historical scheduled bookings readable.
  date: {
    type: String,
      default: "",
    },

  hour: {
    type: Number,
      default: null,
    },

  minute: {
    type: Number,
      default: null,
    },

  ampm: {
    type: String,
      enum: ["AM", "PM", ""],
      default: "",
    },

  status: {
    type: String,
      enum: ["Pending", "Confirmed", "Rescheduled", "Completed", "Canceled"],
      default: "Pending",
      index: true,
    },

  rescheduledTo: {
    date: { type: String },
    hour: { type: Number },
    minute: { type: Number },
    ampm: { type: String, enum: ["AM", "PM"] },
  },

  payment: {
    method: {
      type: String,
        enum: ["Cash", "Online"],
        default: "Cash",
      },

    status: {
      type: String,
     enum: ["Pending", "Paid", "Failed", "Refunded"],
        default: "Pending",
      },

    amount: {
      type: Number,
        required: true,
      },

    providerId: {
      type: String,
        default: "",
      },

    paidAt: {
      type: Date,
        default: null,
      },

    sessionId: {
      type: String,
        default: "",
        index: true,
      },

    meta: {
      type: mongoose.Schema.Types.Mixed,
        default: { },
    },
  },
},
{
    timestamps:true
});

serviceAppointmentSchema.index({serviceId:1});
serviceAppointmentSchema.index({assignedPathologist:1,status:1,requestedAt:-1});

const ServiceAppointment= mongoose.models.ServiceAppointment || 
mongoose.model("ServiceAppointment", serviceAppointmentSchema);

export default ServiceAppointment;
