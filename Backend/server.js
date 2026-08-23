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



const app= express();
const port=4000;

const allowedOrigins=[
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
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
