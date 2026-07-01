import config from "../config/index.js";
import Counter from "../models/counter.model.js";

const RANGE_SIZE = config.rangeSize;

export async function claimRange() {
  const counter = await Counter.findOneAndUpdate(
    { _id: "id-range" },
    {
      $inc: {
        nextStart: RANGE_SIZE,
      },
    },
    {
      new: false,     // value before increment
      upsert: true,
      lean:true
    }
  );

  const start = counter?.nextStart ?? 0;

  return {
    start,
    end: start + RANGE_SIZE - 1,
  };
}