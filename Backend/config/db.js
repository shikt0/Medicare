import mongoose from "mongoose";

export const connectDB = async (uri = process.env.MONGODB_URI) => {
    if (typeof uri !== 'string' || !uri.trim()) {
        throw Object.assign(new Error('MONGODB_URI is required'), { code: 'MONGODB_URI_MISSING' });
    }
    if (!/^mongodb(?:\+srv)?:\/\/\S+$/.test(uri.trim())) {
        throw Object.assign(new Error('MONGODB_URI must be a MongoDB connection string'), { code: 'MONGODB_URI_INVALID' });
    }
    return mongoose.connect(uri.trim());
};
