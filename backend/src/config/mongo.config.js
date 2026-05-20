import mongoose from 'mongoose';
import logger from '../logger/index.js';
export const connectDB = async ()=>{
    try {
        await mongoose.connect(process.env.MONGO_URI);
        logger.info("MongoDB connected successfully");
    } catch (error) {
        logger.error("MongoDB connection error:", error);
        process.exit(1); 
    }
}