import jwt from 'jsonwebtoken';
import Doctor from '../models/Doctor.js';


const JWT_SECRET=process.env.JWT_SECRET;

export default async function doctorAuth(req,res,next) {

    const authHeader =req.headers.authorization;
    if(!JWT_SECRET){
        return res.status(500).json({
            success:false,
            message:"Server misconfigured"
        });
    }


    //check token

    if(!authHeader ||!authHeader.startsWith("Bearer ")){
        return res.status(401).json({
            success: false,
            message: "doctor not authorized, token missing"
            
        });
    }

    const token = authHeader.split(" ")[1];

    try{
        //verify token

        const payload =jwt.verify(token,JWT_SECRET);
        if(payload.role && payload.role!== "doctor"){
            return res.status(403).json({
                success: false,
            message :  "access Denied ( not a doctor"
            });
      }

      //fetch doctor
      const doctor= await Doctor.findById(payload.id).select("-password");

      if(!doctor){
        return res.status(401).json({
            success: false,
            message: "Doctor not found"
        });
      }

      //attach doc to req
      req.doctor=doctor;
      next();
        
    }
    catch(err){
        console.error("Doctor JWT verification failed",err);
        return res.status(401).json({
            success:false,
            message: "token invalid or expired"
        })

    }
    
}
