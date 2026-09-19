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

//converts into numbers
const sanitizePrice = (v) => Number(String(v ?? "0").replace(/[^\d.-]/g, "")) || 0;

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
    const numericPrice = sanitizePrice(b.price);
    if (numericPrice < 0) {
      return res.status(400).json({ success: false, message: "Service price cannot be negative" });
    }
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
        instructions,
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
            data:list.map((service) => ({ ...service, available: true, availability: "Available" }))
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
            data:{ ...service, available: true, availability: "Available" }
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
    if (b.instructions !== undefined) {
      updateData.instructions = [...new Set(parseJsonArrayField(b.instructions)
        .map((instruction) => String(instruction).trim())
        .filter(Boolean))];
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
