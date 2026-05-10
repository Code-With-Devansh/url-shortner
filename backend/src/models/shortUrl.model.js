import mongoose from 'mongoose';

const shortUrlSchema = new mongoose.Schema({
    full_url: { type: String, required: true },
    short_url: { type: String, required: true, unique: true , index: true},
    clicks: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isactive: { type: Boolean, default: true },
});

export const ShortUrlSchema = mongoose.model('ShortUrl', shortUrlSchema);