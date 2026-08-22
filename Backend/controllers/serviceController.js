import Service from "../models/Service.js";
import {uploadToCloudinary,deleteFromCloudinary} from "../utils/cloudinary.js";


//helper function
//converts array like inputs into clean array
//empty or invalid it return empty array ie:[];
const parseJsonArrayField = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed;
      return typeof parsed === "string" ? [parsed] : [];
    } catch {
      return field
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
};

function normalizeSlotsToMap(slotStrings = []) {
  const map = {};
  slotStrings.forEach((raw) => {
    const m = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*•\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) {
      // fallback: keep raw in an "unspecified" bucket
      map["unspecified"] = map["unspecified"] || [];
      map["unspecified"].push(raw);
      return;
    }
    const [, day, monShort, year, hour, minute, ampm] = m;
    const monthIdx = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      .findIndex(x => x.toLowerCase() === monShort.toLowerCase());
    const mm = String(monthIdx + 1).padStart(2, "0");
    const dd = String(Number(day)).padStart(2, "0");
    const dateKey = `${year}-${mm}-${dd}`; // YYYY-MM-DD
    const timeStr = `${String(Number(hour)).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${ampm.toUpperCase()}`;
    map[dateKey] = map[dateKey] || [];
    map[dateKey].push(timeStr);
  });
  return map;
}

const slotMinutes = (value = "") => {
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const [, rawHour, rawMinute, suffix] = match;
  let hour = Number(rawHour) % 12;
  if (suffix.toUpperCase() === "PM") hour += 12;
  return hour * 60 + Number(rawMinute);
};

function normalizeSlotsInput(field) {
  if (!field) return {};
  let parsed = field;
  if (typeof field === "string") {
    try {
      parsed = JSON.parse(field);
    } catch {
      parsed = parseJsonArrayField(field);
    }
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const map = {};
    Object.entries(parsed).forEach(([date, values]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(values)) return;
      const slots = [...new Set(values
        .map((value) => String(value).trim().toUpperCase())
        .filter((value) => /^(0?[1-9]|1[0-2]):[0-5]\d\s(AM|PM)$/.test(value)))]
        .sort((first, second) => slotMinutes(first) - slotMinutes(second));
      if (slots.length) map[date] = slots;
    });
    return map;
  }

  return normalizeSlotsToMap(Array.isArray(parsed) ? parsed : []);
}


//converts into numbers
const sanitizePrice = (v) => Number(String(v ?? "0").replace(/[^\d.-]/g, "")) || 0;
const parseAvailability = (v) => {
  const s = String(v ?? "available").toLowerCase();
  return s === "available" || s === "true";
};

//to create a service
export async function createService(req,res) {
    try {
        const b = req.body || {};
    if (!b.name || !String(b.name).trim()) {
      return res.status(400).json({ success: false, message: "Service name is required" });
    }
    const instructions = [...new Set(parseJsonArrayField(b.instructions)
      .map((instruction) => String(instruction).trim())
      .filter(Boolean))];
    const slots = normalizeSlotsInput(b.slots);
    const numericPrice = sanitizePrice(b.price);
    if (numericPrice < 0) {
      return res.status(400).json({ success: false, message: "Service price cannot be negative" });
    }
    const available = parseAvailability(b.availability);

    let imageUrl = b.imageUrl || null;
    let imagePublicId = b.imagePublicId || null;
    if (req.file) {
      try {
        const up = await uploadToCloudinary(req.file.path, "services");
        imageUrl = up?.secure_url || null;
        imagePublicId = up?.public_id || null;
      } catch (err) {
        console.error("Cloudinary upload error:", err);
      }
    }

    const service=new Service({
        name:String(b.name).trim(),
        about:b.about || "",
        shortDescription:b.shortDescription ||"",
        price:numericPrice,
        available,
        instructions,
        slots,
        dates:Object.keys(slots).sort(),
        imageUrl,
        imagePublicId

    });

    const saved= await service.save();
    return res.status(201).json({
        success: true,
        data:saved,
        message:"Service Created"
    });
    } catch (err) {

        console.error("CreateService Error",err);
        return res.status(500).json({
            success:false,
            message:"Server Error"
        });
        
    }
    
}

//to get all the service
export async function getServices(req,res) {
    try {
        const list = await Service.find().sort({createdAt:-1}).lean();
        return res.status(200).json({
            success:true,
            data:list
        });
    } catch (err) {

        console.error("GetCreateService Error",err);
        return res.status(500).json({
            success:false,
            message:"Server Error"
        });
        
    }
    
}


//get service by id

export async function getServiceById(req,res) {
    try {
        const {id}= req.params;
        const service= await Service.findById(id).lean();
        if(!service) return res.status(404).json({
            success:false,
            message:"Service not found"
        });

        return res.status(200).json({
            success:true,
            data:service
        });
    } catch (err) {

        console.error("GetCreateServiceById Error",err);
        return res.status(500).json({
            success:false,
            message:"Server Error"
        });
        
    }
    
}

//to update service

export async function updateService(req,res) {

    try {

        const {id}= req.params;
        const existing =await Service.findById(id);
        if(!existing) return res.status(404).json({
            success:false,
            message:"Service not found"
        });


        const b=req.body || {};
        const updateData={};

        // to update each field, if already exist

    if (b.name !== undefined) {
      const name = String(b.name).trim();
      if (!name) {
        return res.status(400).json({ success: false, message: "Service name is required" });
      }
      updateData.name = name;
    }
    if (b.about !== undefined) updateData.about = b.about;
    if (b.shortDescription !== undefined) updateData.shortDescription = b.shortDescription;
    if (b.price !== undefined) {
      const numericPrice = sanitizePrice(b.price);
      if (numericPrice < 0) {
        return res.status(400).json({ success: false, message: "Service price cannot be negative" });
      }
      updateData.price = numericPrice;
    }
    if (b.availability !== undefined) updateData.available = parseAvailability(b.availability);
    if (b.instructions !== undefined) {
      updateData.instructions = [...new Set(parseJsonArrayField(b.instructions)
        .map((instruction) => String(instruction).trim())
        .filter(Boolean))];
    }
    if (b.slots !== undefined) {
      updateData.slots = normalizeSlotsInput(b.slots);
      updateData.dates = Object.keys(updateData.slots).sort();
    }
    if (b.imageUrl !== undefined) updateData.imageUrl = b.imageUrl || null;
    if (b.imagePublicId !== undefined) updateData.imagePublicId = b.imagePublicId || null;

    if (req.file) {
      try {
        const up = await uploadToCloudinary(req.file.path, "services");
        if (up?.secure_url) {
          updateData.imageUrl = up.secure_url;
          updateData.imagePublicId = up.public_id || null;
          if (existing.imagePublicId) {
            try {
              await deleteFromCloudinary(existing.imagePublicId);
            } catch (err) {
              console.warn("Cloudinary delete failed:", err?.message || err);
            }
          }
        }
      } catch (err) {
        console.error("Cloudinary upload error:", err);
      }
    }

    const updated= await Service.findByIdAndUpdate(id,updateData,{
        new:true,
        runValidators: true
    });
    return res.status(200).json({
        success:true,
        data:updated,
        message:"Service Updated"
    });
        
    } catch (err) {

        console.error("updateService Error",err);
        return res.status(500).json({
            success:false,
            message:"Server Error"
        });
        
    }
    
}

//delete service

export async function deleteService(req,res) {

   try {
         const {id}=req.params;
    const existing =await Service.findById(id);
        if(!existing) return res.status(404).json({
            success:false,
            message:"Service not found"
        });

        if(existing.imagePublicId){
            try {
                await deleteFromCloudinary(existing.imagePublicId);
            } catch (err) {
                console.warn("Failed to delete image from cloudinary",
                    err.message ||err
                )
                
            }

        }

        await existing.deleteOne();
        return res.status(200).json({
            success:true,
            message:"Service Deleted"
        });
   } catch (err) {

        console.error("DeleteService Error",err);
        return res.status(500).json({
            success:false,
            message:"Server Error"
        });
        
    }
    
}
