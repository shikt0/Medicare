import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { clerkMiddleware } from '@clerk/express'
import { connectDB } from './config/db.js';
import doctorRouter from './routes/doctorRouter.js';
import serviceRouter from './routes/serviceRouter.js';
import appointmentRouter from './routes/appointementRounter.js';
import serviceAppointmentRouter from './routes/serviceAppointmentRouter.js';
import contactRouter from './routes/contactRouter.js';
import doctorPortalRouter from './routes/doctorPortalRouter.js';
import authRouter from './routes/authRouter.js';
import staffRouter from './routes/staffRouter.js';
import shiftRouter from './routes/shiftRouter.js';
import labRouter from './routes/labRouter.js';
import recruitmentRouter from './routes/recruitmentRouter.js';
import applicantRouter from './routes/applicantRouter.js';
import announcementRouter from './routes/announcementRouter.js';
import freelancerRouter from './routes/freelancerRouter.js';
import dashboardRouter from './routes/dashboardRouter.js';



const app= express();
const port=4000;

const allowedOrigins=[
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    process.env.FRONTEND_URL?.replace(/\/$/, ""),
].filter(Boolean)


//middlewares

app.use(cors(
    {
        origin: function(origin,callback){
            if(!origin) return callback(null, true);
            if(allowedOrigins.includes(origin.replace(/\/$/, ""))){
                return callback(null, true)
            }

            return callback(new Error("Not allowed by cors"));

        },
        credentials: true, 
        methods:["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
        allowedHeaders:["Content-Type", "Authorization"]
    }
));
app.use(clerkMiddleware());
app.use(express.json({limit:"20mb"}));
app.use(express.urlencoded({limit: "20mb",extended:true}));
app.use("/api/appointments",appointmentRouter);
app.use("/api/service-appointments", serviceAppointmentRouter);
app.use("/api/contact", contactRouter);
app.use("/api/doctor-portal", doctorPortalRouter);
app.use("/api/auth", authRouter);
app.use("/api/staff", staffRouter);
app.use("/api/shifts", shiftRouter);
app.use("/api/lab-tests", labRouter);
app.use("/api/jobs", recruitmentRouter);
app.use("/api/applicants", applicantRouter);
app.use("/api/announcements", announcementRouter);
app.use("/api/freelancer-assignments", freelancerRouter);
app.use("/api/dashboard", dashboardRouter);

//DB

connectDB();

//Routes

app.use("/api/doctors",doctorRouter);
app.use("/api/services",serviceRouter);

app.get('/', (req,res)=>{
    res.send("API working");
});

app.listen(port,()=>{
    console.log(`Server started on http://localhost:${port}`);
})
