
import mongoose from 'mongoose';

const clickBucketSchema = new mongoose.Schema({
  url_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Url', required: true },
  date:      { type: String, required: true },      
  total:     { type: Number, default: 0 },
  uniqueVisitors:{ type: Number },
  countries: { type: Map, of: Number, default: {} },
  devices:   { type: Map, of: Number, default: {} },
  browsers:  { type: Map, of: Number, default: {} },
  os:        { type: Map, of: Number, default: {} },
  referers:  { type: Map, of: Number, default: {} },
  hours:     { type: Map, of: Number, default: {} },
  expires_at:{ type: Date },                        // ← TTL field
});

clickBucketSchema.index({ url_id: 1, date: -1 });

clickBucketSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('ClickBucket', clickBucketSchema);