
import {AppError} from './appError.js';
export const errorHandler = (err, req, res, next) => {
    if(err instanceof AppError){
        return res.status(err.statusCode || 500).json({
            success:false, 
            message:err.message
        });
    }
    console.error(err);
    res.status(500).json({
        success:false, 
        message:err.message || "An unexpected error occurred"
    });
}