import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("DB CONNECTED");
    } catch (error) {
        console.error("MongoDB connection error:", error);
    }
};