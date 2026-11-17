import { createPaymentConfirmationHandler } from "../utils/confirmCheckoutPayment.js";
import { getPaymentCurrency, paymentCurrencyExpression } from "../utils/paymentCurrency.js";
import { handleAppointmentSlotError, requireAppointmentSlotIndex } from "../utils/appointmentSlots.js";
import { escapeRegExp, isObjectId } from "../utils/validation.js";
import Appointment from "../models/Appointment.js";
import { evaluateCashPaymentOnCompletion } from "../utils/cashCompletion.js";
import { isWeeklySlotAvailable, normalizeTimeSlot, timeSlotMinutes, weekdayKeyForDate } from "../utils/weeklySchedule.js";
import Doctor from "../models/Doctor.js";
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { getAuth } from "@clerk/express";
import { clerkClient } from "@clerk/clerk-sdk-node";
dotenv.config();


const STRIPE_KEY=process.env.STRIPE_SECRET_KEY;
const FRONTEND_URL=process.env.FRONTEND_URL;
const MAJOR_ADMIN_ID=process.env.MAJOR_ADMIN_ID || null;
const stripe =STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;


//helpers

const safeNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const buildFrontendBase = (req) => {
  if (FRONTEND_URL) return FRONTEND_URL.replace(/\/$/, "");
  const origin = req.get("origin") || req.get("referer");
  if (origin) return origin.replace(/\/$/, "");
  const host = req.get("host");
  if (host) return `${req.protocol || "http"}://${host}`.replace(/\/$/, "");
  return null;
};

function resolveClerkUserId(req) {
  try {
    if (req.actor?.authType === 'clerk') return req.actor.id;
    const auth = req.auth || {};
    const fromReq = auth?.userId || auth?.user_id || auth?.user?.id || req.user?.id || null;
    if (fromReq) return fromReq;
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

//get appointment

export const getAppointment= async (req,res) => {
    try {
         const { doctorId, mobile, status, search = "", limit: limitRaw = 50, page: pageRaw = 1, patientClerkId, createdBy } = req.query;
    const limit = Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const skip = (page - 1) * limit;

    const filter = {};
    if (doctorId) filter.doctorId = doctorId;
    if (mobile) filter.mobile = mobile;
    if (status) filter.status = status;
    if (patientClerkId) filter.createdBy = patientClerkId;
    if (createdBy) filter.createdBy = createdBy;
    if (search) {
      const re = new RegExp(escapeRegExp(search), "i");
      filter.$or = [{ patientName: re }, { mobile: re }, { doctorName: re }, { speciality: re }, { notes: re }];
    }

    const items =await Appointment.find(filter).sort({ createdAt:-1}).skip(skip).limit(limit).populate("doctorId","name specialization owner imageUrl image").lean();
    const total = await Appointment.countDocuments(filter);
    return res.json({
        success:true,
        appointment: items,
        meta:{page,limit,total,count:items.length}
    })
    } catch (err) {

        console.error("GetAppointments error: ",err);
        return res.status(500).json({
            success:false,
            message:"Server Error"
        });
        
    }
    
}

//getAppointment by patients

export const getAppointmentByPatient= async (req,res) => {

    try {
        const resolvedCreatedBy=req.actor?.id || resolveClerkUserId(req);
        if(!resolvedCreatedBy){
            return res.status(401).json({
                success: false,
                message:"Authentication required."
            });
        }

        const filter={createdBy:resolvedCreatedBy};

        const appointments= await Appointment.find(filter).sort({
            date:1,
            time:1
        }).lean();
        return res.json({
            success:true,
            appointments
        });

    } catch (err) {

        console.error("GetAppointmentById error: ",err);
        return res.status(500).json({
            success:false,
            message:"Server Error"
        });
        
    }
    
}

//to create appointment
export const createAppointment= async (req,res) => {

    try {
        const {
      doctorId,
      patientName,
      mobile,
      age = "",
      gender = "",
      date,
      time,
      fee,
      fees,
      notes = "",
      email,
      paymentMethod,
      owner: ownerFromBody = null,
      doctorName: doctorNameFromBody,
      speciality: specialityFromBody,
      doctorImageUrl: doctorImageUrlFromBody,
      doctorImagePublicId: doctorImagePublicIdFromBody,
    } = req.body || {};

    const clerkUserId=resolveClerkUserId(req);
    if(!clerkUserId) return res.status(401).json({
        success:false,
        message:"Authentication required"
    });

    if(!doctorId || !String(patientName || '').trim() || !String(mobile || '').trim() || !date || !time){
        return res.status(400).json({
            success:false,
            message:"Doctor, patient name, mobile, date, and time are required"
        });


    }

    if (!isObjectId(doctorId)) return res.status(400).json({ success: false, message: "Invalid doctor ID" });
    if (age !== '' && age != null && (!Number.isFinite(Number(age)) || Number(age) < 0 || Number(age) > 150)) {
      return res.status(400).json({ success: false, message: "Age must be between 0 and 150" });
    }
    if (String(notes).length > 1000) return res.status(400).json({ success: false, message: "Notes cannot exceed 1000 characters" });
    if (paymentMethod !== undefined && !['Cash', 'Online'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: "Choose Cash or Online payment" });
    }
    const requestedDate = String(date).trim();
    const requestedTime = normalizeTimeSlot(time);
    if (!weekdayKeyForDate(requestedDate) || !requestedTime) {
      return res.status(400).json({ success: false, message: "Choose a valid appointment date and time" });
    }
    if (requestedDate < localDateKey()) {
      return res.status(400).json({ success: false, message: "Appointment date cannot be in the past" });
    }
    const now = new Date();
    if (requestedDate === localDateKey(now) && timeSlotMinutes(requestedTime) <= now.getHours() * 60 + now.getMinutes()) {
      return res.status(400).json({ success: false, message: "Appointment time must be in the future" });
    }

    const doctor = await Doctor.findById(doctorId).lean();
    if(!doctor) return res.status(404).json({ success:false, message: "Doctor not found" });
    if (String(doctor.availability || "Available").toLowerCase() !== "available") {
      return res.status(409).json({ success: false, message: "This doctor is not accepting appointments right now" });
    }
    if (!isWeeklySlotAvailable(doctor.schedule, requestedDate, requestedTime)) {
      return res.status(409).json({ success: false, message: "This time is no longer in the doctor's weekly schedule" });
    }

    const numericFee= safeNumber(doctor.fee ?? fee ?? fees ?? 0);
    if(numericFee=== null || numericFee<0){
      return res.status(400).json({ success:false, message:"Fees must be a valid number" });
    }

    await requireAppointmentSlotIndex(Appointment.collection);
    const existingBooking= await Appointment.findOne({
      doctorId,
      date: requestedDate,
      time: requestedTime,
      status: {$ne: "Canceled"},
    }).lean();
    if(existingBooking){
      return res.status(409).json({ success:false, message:"This appointment time has already been booked" });
    }




    // Resolve owner, names, images, etc.
    let resolvedOwner = doctor.owner || null;
    if (!resolvedOwner) resolvedOwner = MAJOR_ADMIN_ID || String(doctorId);

    const doctorName = (doctor.name && String(doctor.name).trim()) || (doctorNameFromBody && String(doctorNameFromBody).trim()) || "";
    const speciality =
      (doctor.specialization && String(doctor.specialization).trim()) ||
      (doctor.speciality && String(doctor.speciality).trim()) ||
      (specialityFromBody && String(specialityFromBody).trim()) ||
      "";

    const doctorImageUrl =
      (doctor.imageUrl && String(doctor.imageUrl).trim()) ||
      (doctor.image && String(doctor.image).trim()) ||
      (doctor.avatarUrl && String(doctor.avatarUrl).trim()) ||
      (doctor.profileImage && doctor.profileImage.url && String(doctor.profileImage.url).trim()) ||
      (doctorImageUrlFromBody && String(doctorImageUrlFromBody).trim()) ||
      "";

    const doctorImagePublicId =
      (doctor.imagePublicId && String(doctor.imagePublicId).trim()) ||
      (doctor.profileImage && doctor.profileImage.publicId && String(doctor.profileImage.publicId).trim()) ||
      (doctorImagePublicIdFromBody && String(doctorImagePublicIdFromBody).trim()) ||
      "";

    const doctorImage = { url: doctorImageUrl, publicId: doctorImagePublicId };

    const currency = getPaymentCurrency();
    const base = {
      doctorId: String(doctor._id || doctorId),
      doctorName,
      speciality,
      doctorImage,
      patientName: String(patientName).trim(),
      mobile: String(mobile).trim(),
      age: age !== '' && age != null ? Number(age) : undefined,
      gender: gender ? String(gender) : "",
      date: requestedDate,
      time: requestedTime,
      fees: numericFee,
      status: "Pending",
      payment: { method: paymentMethod === "Cash" ? "Cash" : "Online", status: "Pending", amount: numericFee, currency },
      notes: notes || "",
      createdBy: clerkUserId,
      owner: resolvedOwner,
      sessionId: null,
    };

    // Free appointment
    if (numericFee === 0) {
      const created = await Appointment.create({
        ...base,
        status: "Confirmed",
        payment: { ...base.payment, status: "Paid", amount: 0 },
        paidAt: new Date(),
      });
      return res.status(201).json({ success: true, appointment: created, checkoutUrl: null });
    }

    // Cash payment
    if (paymentMethod === "Cash") {
      const created = await Appointment.create({
        ...base,
        status: "Pending",
        payment: { ...base.payment, method: "Cash", status: "Pending", amount: numericFee },
      });
      return res.status(201).json({ success: true, appointment: created, checkoutUrl: null });
    }

    // Online: Stripe
    if (!stripe) return res.status(500).json({ success: false, message: "Stripe not configured on server" });

    const frontBase = buildFrontendBase(req);
    if (!frontBase) {
      return res.status(500).json({ success: false, message: "Frontend URL could not be determined. Set FRONTEND_URL or send Origin header." });
    }

    const successUrl = `${frontBase}/appointment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontBase}/appointment/cancel`;

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: email || undefined,
        line_items: [
          {
            price_data: {
              currency,
              product_data: { name: `Appointment - ${String(patientName).slice(0, 40)}` },
              unit_amount: Math.round(numericFee * 100),
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          doctorId: String(doctorId),
          doctorName: doctorName || "",
          speciality: speciality || "",
          patientName: base.patientName,
          mobile: base.mobile,
          clerkUserId: clerkUserId || "",
        },
      });
    } catch (stripeErr) {
      console.error("Stripe create session error:", stripeErr);
      const message = stripeErr?.raw?.message || stripeErr?.message || "Stripe error";
      return res.status(502).json({ success: false, message: `Payment provider error: ${message}` });
    }

    try {
      const created = await Appointment.create({
        ...base,
        sessionId: session.id,
        payment: { ...base.payment, providerId: session.payment_intent || session.paymentIntent || null },
        status: "Pending",
      });
      return res.status(201).json({ success: true, appointment: created, checkoutUrl: session.url || null });
    } catch (dbErr) {
      try { await stripe.checkout.sessions.expire(session.id); } catch { console.warn('Unable to expire checkout after appointment creation failed'); }
      if (handleAppointmentSlotError(dbErr, res)) return;
      console.error("DB error saving appointment after stripe session:", dbErr);
      return res.status(500).json({ success: false, message: "Failed to create appointment record" });
    }
  } catch (err) {
    if (handleAppointmentSlotError(err, res)) return;
    console.error("createAppointment unexpected:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


//confirm payment online
export const confirmPayment = createPaymentConfirmationHandler({
  model: Appointment,
  getStripe: () => stripe,
  sessionPath: 'sessionId',
  paidAtPath: 'paidAt',
});

//update appointment

export const updateAppointment= async (req,res) => {
  try {
    const {id}= req.params;
    if (!isObjectId(id)) return res.status(400).json({ success: false, message: "Invalid appointment ID" });
    const body =req.body || {};
    const appt= await Appointment.findById(id);

    if(!appt) return res.status(404).json({
      success:false,
      message:"Appointment not found"
    });
    const terminal = appt.status === "Completed" || appt.status === "Canceled";
    if (terminal && body.status && body.status !== appt.status) {
      return res.status(400).json({ success: false, message: "Cannot change status of a completed/canceled appointment" });
    }

    const update = {};
    if (body.status !== undefined && !["Pending", "Confirmed", "Completed", "Canceled", "Rescheduled"].includes(body.status)) {
      return res.status(400).json({ success: false, message: "Invalid appointment status" });
    }
    if (body.notes !== undefined && String(body.notes).length > 1000) {
      return res.status(400).json({ success: false, message: "Notes cannot exceed 1000 characters" });
    }
    if (body.status) update.status = body.status;
    if (body.notes !== undefined) update.notes = body.notes;

    if (body.status === "Completed" && appt.status !== "Completed") {
      const cashDecision = evaluateCashPaymentOnCompletion(appt, body.cashPaymentReceived);
      if (!cashDecision.ok) {
        return res.status(400).json({ success: false, message: cashDecision.message });
      }
      if (cashDecision.requiresDecision) {
        update["payment.status"] = cashDecision.paymentStatus;
        update["payment.amount"] = cashDecision.amount;
        update.paidAt = cashDecision.paidAt;
        update["payment.meta.cashReceived"] = cashDecision.cashPaymentReceived;
        update["payment.meta.cashConfirmedAt"] = cashDecision.confirmedAt;
        update["payment.meta.cashConfirmedBy"] = req.actor?.id || "admin";
      }
    }

    if (body.date !== undefined || body.time !== undefined) {
      if (!body.date || !body.time) {
        return res.status(400).json({ success: false, message: "Both date and time are required to reschedule" });
      }
      if (appt.status === "Completed" || appt.status === "Canceled") {
        return res.status(400).json({ success: false, message: "Cannot reschedule completed/canceled appointment" });
      }
      const date = String(body.date).trim();
      const time = normalizeTimeSlot(body.time);
      if (!weekdayKeyForDate(date) || !time) {
        return res.status(400).json({ success: false, message: "Choose a valid appointment date and time" });
      }
      const now = new Date();
      if (date < localDateKey(now) || (date === localDateKey(now) && timeSlotMinutes(time) <= now.getHours() * 60 + now.getMinutes())) {
        return res.status(400).json({ success: false, message: "Appointment time must be in the future" });
      }
      const doctor = await Doctor.findById(appt.doctorId).lean();
      if (!doctor || String(doctor.availability || 'Available').toLowerCase() !== 'available' || !isWeeklySlotAvailable(doctor.schedule, date, time)) {
        return res.status(409).json({ success: false, message: "This time is not available in the doctor's schedule" });
      }
      await requireAppointmentSlotIndex(Appointment.collection);
      const conflict = await Appointment.findOne({ _id: { $ne: id }, doctorId: appt.doctorId, date, time, status: { $ne: "Canceled" } }).lean();
      if (conflict) return res.status(409).json({ success: false, message: "This appointment time has already been booked" });
      update.date = date;
      update.time = time;
      update.status = "Rescheduled";
      update.rescheduledTo = { date, time };
    }


    const updated =await Appointment.findByIdAndUpdate(id,update,
      {new:true, runValidators:true}
    ).populate({path:"doctorId",select:"name imageUrl"}).lean();

    return res.json({
      success:true,
      appointment:updated
    });
  } catch (err) {
    if (handleAppointmentSlotError(err, res)) return;
    console.error("update appointment Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
  
}

//cancel appointment
export const cancelAppointment = async (req,res) => {
  try {
    const {id}= req.params;
    if (!isObjectId(id)) return res.status(400).json({ success: false, message: "Invalid appointment ID" });
    const appt= await Appointment.findById(id);

    if(!appt) return res.status(404).json({
      success:false,
      message:"Appointment not found"
    });

    if (req.actor?.role === 'patient' && appt.createdBy !== req.actor.id) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    if (appt.status === "Completed") {
      return res.status(400).json({ success: false, message: "Cannot cancel a completed appointment" });
    }

    if (appt.status === "Canceled") {
      return res.json({ success: true, appointment: appt });
    }

    appt.status ="Canceled";
    await appt.save();
    return res.json({
      success:true,
      appointment:appt
    });
  } catch (err) {
    console.error("cancelAppointment Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
  
  
}


//get stats

export const getStats= async (req,res) => {
  try {
    const total = await Appointment.countDocuments();
    const paidAgg = await Appointment.aggregate([
      { $match: { status: "Completed", "payment.status": "Paid" } },
      { $group: { _id: paymentCurrencyExpression(), total: { $sum: "$fees" } } },
    ]);
    const revenueByCurrency = { bdt: 0, inr: 0 };
    paidAgg.forEach((row) => { revenueByCurrency[row._id] = Number(row.total || 0); });
    const revenue = Object.values(revenueByCurrency).reduce((total, amount) => total + amount, 0);

    const groupedStatuses = await Appointment.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const statusCounts = {
      Pending: 0,
      Confirmed: 0,
      Completed: 0,
      Canceled: 0,
      Rescheduled: 0,
    };
    groupedStatuses.forEach((item) => {
      if (Object.prototype.hasOwnProperty.call(statusCounts, item._id)) {
        statusCounts[item._id] = item.count;
      }
    });

    const sevenDaysAgo= new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recent = await Appointment.countDocuments({createdAt:{$gte:sevenDaysAgo}});

    return res.json({
      success:true,
      stats:{total,revenue,revenueByCurrency,currency:getPaymentCurrency(),recentLast7Days:recent,statusCounts}
    });

  } catch (err) {
    console.error("getStats Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
  
  
}

//getAppointment by doctor


export const getAppointmentByDoctor =async (req,res) => {
  try {
    const {doctorId}=req.params;
    if(!doctorId) return res.status(400).json({
      success:false,
      message: "Doctor id req"
    });

    if (req.actor?.role === 'doctor' && req.actor.id !== String(doctorId)) {
      return res.status(403).json({ success: false, message: "You can only view your own appointments" });
    }

     const { mobile, status, search = "", limit: limitRaw = 50, page: pageRaw = 1 } = req.query;
    const limit = Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const skip = (page - 1) * limit;

    const filter = { doctorId };
    if (mobile) filter.mobile = mobile;
    if (status) filter.status = status;
    if (search) {
      const re = new RegExp(escapeRegExp(search), "i");
      filter.$or = [{ patientName: re }, { mobile: re }, { notes: re }];
    }


    const items= await Appointment.find(filter)
      .sort({date:1,time:1})
      .skip(skip)
      .limit(limit)
      .populate("doctorId","name specialization owner imageUrl image")
      .lean();

    const total= await Appointment.countDocuments(filter);
    return res.json({
      success:true,
      appointments:items,
      meta:{ page, limit, total, count:items.length}
    });
  } catch (err) {
    console.error("getAppointmentByDoctor Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
  
}

// to get register user count


export async function getRegisteredUserCount(req,res) {
  try {
    const totalUsers= await clerkClient.users.getCount();

    return res.json({
      success:true,
      totalUsers
    });
  } catch (err) {
    console.error("getRegisteredUserCount Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
  
  
}


export default {
  getAppointment,
  getAppointmentByPatient,
  createAppointment,
  confirmPayment,
  updateAppointment,
  cancelAppointment,
  getStats,
  getAppointmentByDoctor,
  getRegisteredUserCount
};
