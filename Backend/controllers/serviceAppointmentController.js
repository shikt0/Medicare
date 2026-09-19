import ServiceAppointment from "../models/serviceAppointment.js";
import Service from "../models/Service.js";
import Staff from "../models/Staff.js";
import AssignmentCursor from "../models/AssignmentCursor.js";
import { roundRobinItem } from "../utils/roundRobin.js";
import { evaluateCashPaymentOnCompletion } from "../utils/cashCompletion.js";
import Stripe from 'stripe';
import { getAuth } from "@clerk/express";

const stripeKey = process.env.STRIPE_SECRET_KEY || null;
const stripe = stripeKey? new Stripe(stripeKey,{apiVersion: "2026-08-05"}) :null;

//helpers
const SERVICE_APPOINTMENT_STATUSES = ["Pending", "Confirmed", "Rescheduled", "Completed", "Canceled"];
const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded"];
const escapeRegExp = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function parseTimeString(timeStr) {
  const match = String(timeStr || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  return { hour, minute, ampm: match[3].toUpperCase() };
}

const buildFrontendBase = (req) => {
  const env = process.env.FRONTEND_URL;
  if (env) return env.replace(/\/$/, "");
  const origin = req.get("origin") || req.get("referer") || null;
  return origin ? origin.replace(/\/$/, "") : null;
};

function resolveClerkUserId(req) {
  try {
    if (req.actor?.authType === 'clerk') return req.actor.id;
    const auth = req.auth || {};
    const candidate = auth?.userId || auth?.user_id || auth?.user?.id || req.user?.id || null;
    if (candidate) return candidate;
    try {
      const serverAuth = getAuth ? getAuth(req) : null;
      return serverAuth?.userId || null;
    } catch (e) {
      return null;
    }
  } catch (e) {
    return null;
  }
}

async function getNextPathologistAssignment() {
  const pathologists = await Staff.find({ role: "pathologist", status: "active" })
    .sort({ employeeId: 1, _id: 1 })
    .select("name employeeId")
    .lean();

  if (!pathologists.length) return null;

  const cursor = await AssignmentCursor.findOneAndUpdate(
    { _id: "service-pathologist" },
    { $inc: { sequence: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  const sequence = Number(cursor?.sequence || 1);
  const pathologist = roundRobinItem(pathologists, sequence);

  return {
    assignedPathologist: pathologist._id,
    assignedPathologistName: pathologist.name || "Pathologist",
    assignedPathologistEmployeeId: pathologist.employeeId || "",
    assignedAt: new Date(),
    assignmentSequence: sequence,
  };
}

//service appointment


export const CreateServiceAppointment = async (req,res) => {
    try {
        const body=req.body || {};
        const clerkUserId = resolveClerkUserId(req);
        if(!clerkUserId) return res.status(401).json({
            success:false,
            message:"Authentication is req to create service appointment"
        });

         const {
      serviceId,
      serviceName: serviceNameFromBody,
      patientName,
      mobile,
      age,
      gender,
      paymentMethod = "Online",
      email,
      meta = {},
      notes = "",
      serviceImageUrl: serviceImageUrlFromBody,
      serviceImagePublicId: serviceImagePublicIdFromBody,
    } = body;

  if (!serviceId) return res.status(400).json({ success: false, message: "serviceId is required" });
    if (!patientName || !String(patientName).trim()) return res.status(400).json({ success: false, message: "patientName is required" });
    if (!mobile || !String(mobile).trim()) return res.status(400).json({ success: false, message: "mobile is required" });

    const svc = await Service.findById(serviceId).lean();
    if (!svc) return res.status(404).json({ success: false, message: "Service not found" });
    const numericAmount = Number(svc.price || 0);
    const assignment = await getNextPathologistAssignment();

    let resolvedServiceName = serviceNameFromBody || (svc && (svc.name || svc.title)) || "Service";
    const svcImageUrlFromDB = svc && (String(svc.imageUrl || svc.image || svc.image?.url || svc.profileImage?.url || "").trim() || "");
    const svcImagePublicIdFromDB = svc && (String(svc.imagePublicId || svc.image?.publicId || svc.profileImage?.publicId || "").trim() || "");
    const finalServiceImageUrl = (svcImageUrlFromDB && svcImageUrlFromDB.length) ? svcImageUrlFromDB : ((serviceImageUrlFromBody && String(serviceImageUrlFromBody).trim()) || "");
    const finalServiceImagePublicId = (svcImagePublicIdFromDB && svcImagePublicIdFromDB.length) ? svcImagePublicIdFromDB : ((serviceImagePublicIdFromBody && String(serviceImagePublicIdFromBody).trim()) || "");

    const base = {
      serviceId,
      serviceName: resolvedServiceName,
      serviceImage: { url: finalServiceImageUrl, publicId: finalServiceImagePublicId },
      patientName: String(patientName).trim(),
      mobile: String(mobile).trim(),
      age: age ? Number(age) : undefined,
      gender: gender || "",
      fees: numericAmount,
      createdBy: clerkUserId,
      notes: notes || "",
      requestedAt: new Date(),
      ...(assignment || {}),
    };

    // Free appointment
    if (numericAmount === 0) {
      const created = await ServiceAppointment.create({ ...base, status: "Pending", payment: { method: "Cash", status: "Paid", amount: 0, paidAt: new Date() } });
      return res.status(201).json({ success: true, appointment: created });
    }

    // Cash booking
    if (paymentMethod === "Cash") {
      const created = await ServiceAppointment.create({ ...base, status: "Pending", payment: { method: "Cash", status: "Pending", amount: numericAmount, meta } });
      return res.status(201).json({ success: true, appointment: created, checkoutUrl: null });
    }

    // Online booking (Stripe)
    if (!stripe) return res.status(500).json({ success: false, message: "Stripe not configured on server" });
    const frontendBase = buildFrontendBase(req);
    if (!frontendBase) return res.status(500).json({ success: false, message: "Frontend base URL not available. Set FRONTEND_URL or provide Origin header." });

    const successUrl = `${frontendBase}/service-appointment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendBase}/service-appointment/cancel`;

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: email ? String(email) : undefined,
        line_items: [
          {
            price_data: {
              currency: "inr",
              product_data: {
                name: `Service: ${String(resolvedServiceName).slice(0, 60)}`,
                description: "24/7 service request with automatic pathologist assignment",
              },
              unit_amount: Math.round(numericAmount * 100),
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          serviceId: String(serviceId),
          serviceName: String(resolvedServiceName).slice(0, 200),
          patientName: base.patientName,
          mobile: base.mobile,
          clerkUserId: base.createdBy || "",
          serviceImageUrl: finalServiceImageUrl ? String(finalServiceImageUrl).slice(0, 200) : "",
        },
      });
    } catch (stripeErr) {
      console.error("Stripe create session error:", stripeErr);
      const message = stripeErr?.raw?.message || stripeErr?.message || "Stripe error";
      return res.status(502).json({ success: false, message: `Payment provider error: ${message}` });
    }

    try {
      const created = await ServiceAppointment.create({
        ...base,
        status: "Confirmed",
        payment: { method: "Online", status: "Pending", amount: numericAmount, sessionId: session.id || "" },
      });
      return res.status(201).json({ success: true, appointment: created, checkoutUrl: session.url || null });
    } catch (dbErr) {
      console.error("DB error saving service appointment after stripe session:", dbErr);
      return res.status(500).json({ success: false, message: "Failed to create appointment record" });
    }
  } catch (err) {
    console.error("createServiceAppointment unexpected:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


//to confirm service payment
export const confirmServicePayment = async (req,res) => {
    try {
        const session_id = req.query.session_id || req.query.session_Id;
        if(!session_id) return res.status(400).json({
            success:false,
            message:"session id req"
        });

        if(!stripe) return res.status(500).json({
            success:false,
            message:"Stripe is not configed"
        });

        let session;
        try {
            session= await stripe.checkout.sessions.retrieve(session_id);
        } catch (err) {
            console.error("Stripe error:", err);
            return res.status(404).json({
                success:false,
                message:"stripe session not found"
            });



            
        }

        if(!session) return res.status(404).json({
            success:false,
            message:"invalid session"
        });
        if(session.payment_status!=="paid") return res.status(400).json({
            success:false,
            message:"payment not completed"
        });

        let appt = await ServiceAppointment.findOneAndUpdate(
      { "payment.sessionId": session_id },
      {
        $set: {
          "payment.status": "Paid",
          "payment.providerId": session.payment_intent || "",
          "payment.paidAt": new Date(),
          status: "Confirmed",
        },
      },
      { new: true }
    );

    if (!appt && session.metadata?.appointmentId) {
      appt = await ServiceAppointment.findOneAndUpdate(
        { _id: session.metadata.appointmentId },
        {
          $set: {
            "payment.status": "Paid",
            "payment.providerId": session.payment_intent || "",
            "payment.paidAt": new Date(),
            status: "Confirmed",
          },
        },
        { new: true }
      );
    }

    if (!appt) return res.status(404).json({ success: false, message: "Service appointment not found" });
    return res.json({ success: true, appointment: appt});

    } catch (err) {
    console.error("confirmServicePayment error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
    
}

//to getServiceAppointment
export const getServiceAppointment= async (req,res) => {

    try {
        const { serviceId, mobile, status, page: pageRaw = 1, limit: limitRaw = 50, search = "" } = req.query;
    const limit = Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const skip = (page - 1) * limit;

    const filter = req.actor?.role === "pathologist"
      ? { assignedPathologist: req.actor.staffId }
      : {};
    if (serviceId) filter.serviceId = serviceId;
    if (mobile) filter.mobile = mobile;
    if (status) filter.status = status;
    if (search) {
      const re = new RegExp(escapeRegExp(String(search).trim()), "i");
      filter.$or = [{ patientName: re }, { mobile: re }, { serviceName: re }, { notes: re }, { assignedPathologistName: re }];
    }

    const appointment = await ServiceAppointment.find(filter)
    .populate("serviceId", "name image imageUrl imageSmall")
    .populate("assignedPathologist", "name employeeId email imageUrl")
    .sort({requestedAt:-1,createdAt:-1})
    .skip(skip).limit(limit).lean();

    const total= await ServiceAppointment.countDocuments(filter);
    return res.json({
        success:true,
        appointment,
        meta:{page, limit, total,count: appointment.length}

    });
    } catch (err) {
    console.error("getService Appointment error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
    
}

//getServiceAppointmentById

export const getServiceAppointmentById= async (req,res) => {
    try {
        const {id} = req.params;
        const appt = await ServiceAppointment.findById(id)
          .populate("assignedPathologist", "name employeeId email imageUrl")
          .lean();

        if(!appt) return res.status(404).json({
            success:false,
            message:"not found the appointment"
        });
        if (req.actor?.role === "pathologist" && String(appt.assignedPathologist?._id || appt.assignedPathologist || "") !== String(req.actor.staffId || "")) {
          return res.status(404).json({ success: false, message: "Not found" });
        }
        return res.json({success:true, data:appt});
    } catch (err) {
    console.error("getService AppointmentBy Id error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
    
}

//to update an appointment

export const updateServiceAppointment= async (req,res) => {
    try {
      const {id} =req.params;
      const body= req.body || {};
      const updates ={};

      const existing = await ServiceAppointment.findById(id).select("assignedPathologist status fees payment").lean();
      if (!existing) return res.status(404).json({ success: false, message: "Not found" });
      const isPathologist = req.actor?.role === "pathologist";
      if (isPathologist && String(existing.assignedPathologist || "") !== String(req.actor.staffId || "")) {
        return res.status(404).json({ success: false, message: "Not found" });
      }


    if (body.status !== undefined) {
      const status = String(body.status).trim();
      if (!SERVICE_APPOINTMENT_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid appointment status" });
      }
      if (isPathologist && !["Pending", "Confirmed", "Completed"].includes(status)) {
        return res.status(403).json({ success: false, message: "Pathologists cannot set this status" });
      }
      updates.status = status;
      if (status === "Completed" && existing.status !== "Completed") {
        const cashDecision = evaluateCashPaymentOnCompletion(existing, body.cashPaymentReceived);
        if (!cashDecision.ok) {
          return res.status(400).json({ success: false, message: cashDecision.message });
        }
        if (cashDecision.requiresDecision) {
          updates["payment.status"] = cashDecision.paymentStatus;
          updates["payment.amount"] = cashDecision.amount;
          updates["payment.paidAt"] = cashDecision.paidAt;
          updates["payment.meta.cashReceived"] = cashDecision.cashPaymentReceived;
          updates["payment.meta.cashConfirmedAt"] = cashDecision.confirmedAt;
          updates["payment.meta.cashConfirmedBy"] = req.actor?.staffId || req.actor?.id || req.actor?.role || "staff";
        }
      }
    }
    if (body.notes !== undefined) {
      const notes = String(body.notes).trim();
      if (notes.length > 1000) {
        return res.status(400).json({ success: false, message: "Notes cannot exceed 1000 characters" });
      }
      updates.notes = notes;
    }
    if (!isPathologist && body.payment !== undefined) updates.payment = body.payment;
    if (!isPathologist && body["payment.status"] !== undefined) {
      const paymentStatus = String(body["payment.status"]).trim();
      if (!PAYMENT_STATUSES.includes(paymentStatus)) {
        return res.status(400).json({ success: false, message: "Invalid payment status" });
      }
      updates["payment.status"] = paymentStatus;
      if (paymentStatus === "Paid") updates["payment.paidAt"] = new Date();
    }

    if (!isPathologist && body.rescheduledTo) {
      const { date, time } = body.rescheduledTo || {};
      updates.rescheduledTo = {};
      if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ success: false, message: "rescheduledTo.date must be YYYY-MM-DD" });
        updates.rescheduledTo.date = date;
        updates.date = date;
      }
      if (time) {
        const parsed = parseTimeString(String(time));
        if (!parsed) return res.status(400).json({ success: false, message: "rescheduledTo.time couldn't be parsed" });
        updates.rescheduledTo.hour = parsed.hour;
        updates.rescheduledTo.minute = parsed.minute;
        updates.rescheduledTo.ampm = parsed.ampm;
        updates.hour = parsed.hour;
        updates.minute = parsed.minute;
        updates.ampm = parsed.ampm;
        updates.time = `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")} ${parsed.ampm}`;
      }
      if (!body.status) updates.status = "Rescheduled";
    }

    if (updates.payment) {
      const method = updates.payment.method || updates.payment?.method;
      if (method && String(method).toLowerCase() === "online") updates.status = updates.status || "Confirmed";
      if (updates.payment.status && updates.payment.status === "Paid") {
        updates.status = "Confirmed";
        if (updates.payment.paidAt === undefined) updates.payment.paidAt = new Date();
      }
    }


    const updated = await ServiceAppointment.findByIdAndUpdate(id,{$set:updates},{
      new: true, runValidators:true,
    });

    if(!updated) return res.status(404).json({
      success: false,
      message:"Not found"
    });

    return res.json({success:true, data:updated});

        
    } catch (err) {
    console.error("updateServiceAppointment error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
    
    
}


// cancel service appointment

export const cancelServiceAppointment= async (req,res) => {
  try {
    const {id}=req.params;
    const appt =await ServiceAppointment.findById(id);

     if (!appt) return res.status(404).json({ success: false, message: "Not found" });
    if (req.actor?.role === 'patient' && appt.createdBy !== req.actor.id) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    if (appt.status === "Completed") return res.status(400).json({ success: false, message: "Cannot cancel a completed appointment" });

    appt.status = "Canceled";
    if (appt.payment) appt.payment.status = appt.payment.status === "Paid" ? "Refunded" : "Pending";

    await appt.save();
    return res.json({success:true,data:appt});
  } catch (err) {
    console.error("cancelServiceAppointment error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
  
}


// to get statistics

export const getServiceAppointmentStats= async (req,res) => {
  try {
    if (req.actor?.role === "pathologist") {
      const filter = { assignedPathologist: req.actor.staffId };
      const [totalAppointments, pending, confirmed, rescheduled, completedRows, canceled] = await Promise.all([
        ServiceAppointment.countDocuments(filter),
        ServiceAppointment.countDocuments({ ...filter, status: "Pending" }),
        ServiceAppointment.countDocuments({ ...filter, status: "Confirmed" }),
        ServiceAppointment.countDocuments({ ...filter, status: "Rescheduled" }),
        ServiceAppointment.find({ ...filter, status: "Completed", "payment.status": "Paid" }).select("fees").lean(),
        ServiceAppointment.countDocuments({ ...filter, status: "Canceled" }),
      ]);
      const completed = completedRows.length;
      const earning = completedRows.reduce((sum, item) => sum + Number(item.fees || 0), 0);
      return res.json({
        success: true,
        services: [],
        totalServices: 0,
        summary: { totalAppointments, pending, confirmed, rescheduled, completed, canceled, earning },
      });
    }

    const services = await Service.aggregate([
      {
        $lookup: { from: "serviceappointments", localField: "_id", foreignField: "serviceId", as: "appointments" },
      },
      {
        $addFields: {
          totalAppointments: { $size: "$appointments" },
          pending: { $size: { $filter: { input: "$appointments", as: "a", cond: { $eq: ["$$a.status", "Pending"] } } } },
          confirmed: { $size: { $filter: { input: "$appointments", as: "a", cond: { $eq: ["$$a.status", "Confirmed"] } } } },
          rescheduled: { $size: { $filter: { input: "$appointments", as: "a", cond: { $eq: ["$$a.status", "Rescheduled"] } } } },
          completed: { $size: { $filter: { input: "$appointments", as: "a", cond: { $eq: ["$$a.status", "Completed"] } } } },
          canceled: { $size: { $filter: { input: "$appointments", as: "a", cond: { $eq: ["$$a.status", "Canceled"] } } } },
          earning: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$appointments",
                    as: "a",
                    cond: { $and: [{ $eq: ["$$a.status", "Completed"] }, { $eq: ["$$a.payment.status", "Paid"] }] },
                  },
                },
                as: "completedAppointment",
                in: { $ifNull: ["$$completedAppointment.fees", "$price"] },
              },
            },
          },
        },
      },
      { $project: { name: 1, price: 1, available: { $literal: true }, image: "$imageUrl", totalAppointments: 1, pending: 1, confirmed: 1, rescheduled: 1, completed: 1, canceled: 1, earning: 1 } },
      { $sort: { totalAppointments: -1, name: 1 } },
    ]);
    const summary = services.reduce((total, service) => ({
      totalAppointments: total.totalAppointments + Number(service.totalAppointments || 0),
      pending: total.pending + Number(service.pending || 0),
      confirmed: total.confirmed + Number(service.confirmed || 0),
      rescheduled: total.rescheduled + Number(service.rescheduled || 0),
      completed: total.completed + Number(service.completed || 0),
      canceled: total.canceled + Number(service.canceled || 0),
      earning: total.earning + Number(service.earning || 0),
    }), { totalAppointments: 0, pending: 0, confirmed: 0, rescheduled: 0, completed: 0, canceled: 0, earning: 0 });
    return res.json({
      success:true,
      services,
      totalServices:services.length,
      summary,
    });
  } catch (err) {
    console.error("getlServiceAppointmentStats error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
  
}

// get appointment by patients

export const getServiceAppointmentByPatient = async (req,res) => {
  try {
    const resolvedCreatedBy=req.actor?.id || resolveClerkUserId(req);
    if(!resolvedCreatedBy) return res.json({
      success:true,
      data:[]
    });

    const filter ={createdBy:resolvedCreatedBy};

    const list= await ServiceAppointment.find(filter).sort({createdAt:-1}).lean();
    return res.json({
      success:true,
      data: list
    });


  } catch (err) {
    console.error("getServiceAppointmentByPatient error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
  
}
export default {
  CreateServiceAppointment,
  confirmServicePayment,
  getServiceAppointment,
  updateServiceAppointment,
  cancelServiceAppointment,
  getServiceAppointmentStats,
  getServiceAppointmentByPatient,
  getServiceAppointmentById,
}
    
