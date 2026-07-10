import mongoose from "mongoose";

const shortUrlSchema = new mongoose.Schema(
  {
    full_url: { type: String, required: true },
    short_url: { type: String, required: true, unique: true, index: true },
    clicks: { type: Number, default: 0 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
// sorting by creation date for a user (most common)
shortUrlSchema.index({ user: 1, createdAt: -1 });
// Sorting by clicks for a user
shortUrlSchema.index({ user: 1, clicks: -1 });


// Full-text search across originalUrl, shortCode, title
// Allows: db.urls.find({ $text: { $search: "github" } })
shortUrlSchema.index(
  { full_url : "text", short_url: "text" },
  {
    weights: { short_url: 10, full_url: 1 }, // short_url matches rank highest
    name: "url_text_search",
  }
);

// Filtering by isActive for a user (e.g. show only active links)
shortUrlSchema.index({ user: 1, isActive: 1, createdAt: -1 });
export const ShortUrlSchema = mongoose.models.ShortUrl || mongoose.model("ShortUrl", shortUrlSchema);
