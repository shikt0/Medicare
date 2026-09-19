import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import { normalizeWeeklySchedule } from "../utils/weeklySchedule.js";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';


function parseScheduleInput(s) {
  return normalizeWeeklySchedule(s);
}


//this function will convert the doctor data into text
function normalizeDocForClient(raw = {}) {
  const doc = { ...raw };

  doc.schedule = normalizeWeeklySchedule(doc.schedule);

  doc.availability = doc.availability === undefined ? "Available" : doc.availability;
  doc.patients = doc.patients ?? "";
  doc.rating = doc.rating ?? 0;
  doc.fee = doc.fee ?? doc.fees ?? 0;

  return doc;
}


//to create a doctor

export async function createDoctor(req,res) {

    try{
        const body= req.body || {};
        if(!body.email || !body.password ||!body.name){
            return res.status(400).json({
                success: false,
                message: "name, email and password are required"
            })
        }

        const emailLC= (body.email || "").toLowerCase();
        if(await Doctor.findOne({email:emailLC})){
            return res.status(409).json({
                success:false,
                message:"email already in use"
            })
        }


        let imageUrl= body.imageUrl ||null;
        let imagePublicId = body.imagePublicId || null;
        if(req.file?.path){
            const uploaded =await uploadToCloudinary(req.file.path, "doctors");
            imageUrl=uploaded?.secure_url || uploaded?.url || imageUrl;
            imagePublicId= uploaded?.public_id || uploaded?.public_Id || imagePublicId;
        }


        const schedule= parseScheduleInput(body.schedule);
        const doc = new Doctor({
      email: emailLC,
      password: await bcrypt.hash(String(body.password), 12),
      name: body.name,
      specialization: body.specialization || "",
      imageUrl,
      imagePublicId,
      availability: body.availability || "Available",
      experience: body.experience || "",
      qualifications: body.qualifications || "",
      location: body.location || "",
      about: body.about || "",
      fee: body.fee !== undefined ? Number(body.fee) : 0,
      schedule,
      success: body.success || "",
      patients: body.patients || "",
      rating: body.rating !== undefined ? Number(body.rating) : 0,
    });


    await doc.save();
    const secret =process.env.JWT_SECRET;

    if(!secret){
        console.warn("JWT secret is not define");
        return res.status(500).json({
            success: false,
            message: "Server misconfigured"
        });
    }



    const token= jwt.sign({
        id: doc._id.toString(), email: doc.email,
        role: "doctor"
        },
       secret,{expiresIn:"7d"} );

    const out =normalizeDocForClient(doc.toObject());
    delete out.password;

    return res.status(201).json({
        success: true,
        data:out,
        token
    });

    }

    catch(err){
        console.error("CreateDoctor error: ", err);
        return res.status(500).json({
            success:false,
            message:"server error"
        })
    }
    
}


//to get doctor
export const getDoctors = async (req, res) => {
  try {
    const adminView = req.adminView === true;
    const { q = "", limit: limitRaw = 200, page: pageRaw = 1 } = req.query;
    const limit = Math.min(500, Math.max(1, parseInt(limitRaw, 10) || 200));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const skip = (page - 1) * limit;

    const match = {};
    if (q && typeof q === "string" && q.trim()) {
      const re = new RegExp(q.trim(), "i");
      match.$or = [{ name: re }, { specialization: re }, { speciality: re }, { email: re }];
    }

    const docs = await Doctor.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "appointments",
          localField: "_id",
          foreignField: "doctorId",
          as: "appointments",
        },
      },
      {
        $addFields: {
          appointmentsTotal: { $size: "$appointments" },
          appointmentsCompleted: {
            $size: {
              $filter: { input: "$appointments", as: "a", cond: { $in: ["$$a.status", ["Confirmed", "Completed"]] } }
            }
          },
          appointmentsCanceled: {
            $size: {
              $filter: { input: "$appointments", as: "a", cond: { $eq: ["$$a.status", "Canceled"] } }
            }
          },
          earnings: {
            $sum: {
              $map: {
                input: {
                  $filter: { input: "$appointments", as: "a", cond: { $in: ["$$a.status", ["Confirmed", "Completed"]] } }
                },
                as: "p",
                in: { $ifNull: ["$$p.fees", 0] }
              }
            }
          }
        }
      },
      { $project: { appointments: 0, password: 0 } },
      { $sort: { name: 1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    const normalized = docs.map((d) => ({
      _id: d._id,
      id: d._id,
      name: d.name || "",
      specialization: d.specialization || d.speciality || "",
      fee: d.fee ?? d.fees ?? d.consultationFee ?? 0,
      imageUrl: d.imageUrl || d.image || d.avatar || null,
      availability: d.availability ?? "Available",
      schedule: normalizeWeeklySchedule(d.schedule),
      patients: d.patients ?? "",
      rating: d.rating ?? 0,
      about: d.about ?? "",
      experience: d.experience ?? "",
      qualifications: d.qualifications ?? "",
      location: d.location ?? "",
      success: d.success ?? "",
      ...(adminView ? {
        email: d.email || '',
        appointmentsTotal: d.appointmentsTotal || 0,
        appointmentsCompleted: d.appointmentsCompleted || 0,
        appointmentsCanceled: d.appointmentsCanceled || 0,
        earnings: d.earnings || 0,
      } : {}),
    }));

    const total = await Doctor.countDocuments(match);
    return res.json({ success: true, data: normalized, doctors: normalized, meta: { page, limit, total } });
  } catch (err) {
    console.error("getDoctors:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// to get doctor by id to fetch one doctor

export async function getDoctorById(req,res) {

    try {
        const{id}=req.params;
        const doc= await Doctor.findById(id).select("-password -email").lean();
        if(!doc)
            return res.status(404).json({
        success:false,
    message:"doctor not found"
});

    const today = new Date();
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 42);
    const dateKey = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    const bookedAppointments = await Appointment.find({
      doctorId: doc._id,
      date: { $gte: dateKey(today), $lte: dateKey(horizon) },
      status: { $ne: "Canceled" },
    }).select("date time").lean();
    const bookedSlots = bookedAppointments.reduce((output, appointment) => {
      output[appointment.date] = [...new Set([...(output[appointment.date] || []), appointment.time])];
      return output;
    }, {});

    return res.json({success:true,data:{...normalizeDocForClient(doc),bookedSlots}});
    } catch (err) {
    console.error("getDoctorById Erros:", err);
    return res.status(500).json({ success: false, message: "Server     error" });
  }
    
}

//to update a doctor
export async function updateDoctor(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const isAdmin = req.actor?.role === 'admin'
    const isOwnerDoctor = req.actor?.role === 'doctor'
      && String(req.doctor?._id || req.doctor?.id) === String(id)
    if (!isAdmin && !isOwnerDoctor) {
      return res.status(403).json({ success: false, message: "Not authorized to update this doctor" });
    }

    const existing = await Doctor.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: "Doctor not found" });

    if (req.file?.path) {
      const uploaded = await uploadToCloudinary(req.file.path, "doctors");
      if (uploaded) {
        const previousPublicId = existing.imagePublicId;
        existing.imageUrl = uploaded.secure_url || uploaded.url || existing.imageUrl;
        existing.imagePublicId = uploaded.public_id || uploaded.publicId || existing.imagePublicId;
        if (previousPublicId && previousPublicId !== existing.imagePublicId) {
          deleteFromCloudinary(previousPublicId).catch((e) => console.warn("deleteFromCloudinary warning:", e?.message || e));
        }
      }
    } else if (body.imageUrl) {
      existing.imageUrl = body.imageUrl;
    }

    if (body.schedule !== undefined) existing.schedule = parseScheduleInput(body.schedule);

    const updatable = ["name", "specialization", "experience", "qualifications", "location", "about", "fee", "availability", "success", "patients", "rating"];
    updatable.forEach((k) => { if (body[k] !== undefined) existing[k] = body[k]; });

    if (body.email && body.email !== existing.email) {
      const other = await Doctor.findOne({ email: body.email.toLowerCase() });
      if (other && other._id.toString() !== id) return res.status(409).json({ success: false, message: "Email already in use" });
      existing.email = body.email.toLowerCase();
    }

    if (body.password) existing.password = await bcrypt.hash(String(body.password), 12);

    await existing.save();

    const out = normalizeDocForClient(existing.toObject());
    delete out.password;
    return res.json({ success: true, data: out });
  } catch (err) {
    console.error("updateDoctor error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

//to delete a doctor
export async function deleteDoctor(req,res) {

    try {
        
        const {id}=req.params;
        const existing =await Doctor.findById(id);
        if(!existing) return res.status(404).json({
            success:false,
            message:"doctor not found"
        });

        if(existing.imagePublicId){
            try{
                await deleteFromCloudinary(existing.imagePublicId);
            }
            catch(e){
                console.warn("DeleteFromCloudinary warning: ",e?.message || e);
            }
        }

        await Doctor.findByIdAndDelete(id);
        return res.json({
            success:true,
            message: "Doctor Removed"
        });
    } 
    
    
    catch (err) {
    console.error("updateDoctor error:", err);
    return res.status(500).json({ success: false, message: "Server     error" });
  }
    
}

//to toggle availability
export async function toggleAvailability(req,res) {

    try{
       const { id } = req.params;
   

    if (!req.doctor || String(req.doctor._id || req.doctor.id) !== String(id)) {
      return res.status(403).json({ success: false, message: "Not authorized to update this doctors availability" });
    }

    const doc= await Doctor.findById(id);
    if(!doc)
        return res.status(404).json({
    success:false,
message: "doctor not found"});



            if(typeof doc.availability === "boolean") doc.availability =!doc.availability;
            else doc.availability =doc.availability ==="Available" ?
            "Unavailable" : "Available";

            await doc.save();
            const out= normalizeDocForClient(doc.toObject());
            delete out.password;
            return res.json({
                success:true,
                data:out
            });
    }

    catch (err) {
    console.error("Toggleavailability error:", err);
    return res.status(500).json({ success: false, message: "Server     error" });
  }
    
}


//to login the doctor

export async function doctorLogin(req, res) {
    try {
        const { email, password } = req.body || {};

        if (!email?.trim() || !password) return res.status(400).json({
            success: false,
            message: "Email and password are required"
        });

        const doc = await Doctor.findOne({email: email.trim().toLowerCase()}).select("+password");
        if(!doc) return res.status(401).json({
            success:false,
            message:"Invalid Creds"
        });



        const storedPassword = String(doc.password || '')
        const passwordMatches = storedPassword.startsWith('$2')
          ? await bcrypt.compare(String(password), storedPassword)
          : storedPassword === String(password)

        if(!passwordMatches) return res.status(401).json({
            success:false,
            message:"Invalid Creds"
        });

        if (!storedPassword.startsWith('$2')) {
          doc.password = await bcrypt.hash(String(password), 12)
          await doc.save()
        }

        const secret = process.env.JWT_SECRET;
        if(!secret) return res.status(500).json({
            success: false,
            message: "Server misconfigured"
        });

        const token= jwt.sign({
        id: doc._id.toString(), email: doc.email,
        role: "doctor"
        },
       secret,{expiresIn:"7d"} );

       const out =doc.toObject();
       delete out.password;
       return res.json({
        success:true,
        token,
        data: out
       });

    }

    catch (err) {
    console.error("loginDoctor error:", err);
    return res.status(500).json({ success: false, message: "Server     error" });
  }
    
}
