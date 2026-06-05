import { ValidationError } from "../utils/appError.js";

const ALLOWED_SORT_FIELDS = ["createdAt", "clicks"];
const ALLOWED_ORDERS = ["asc", "desc"];
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// ─── Cursor Encoding / Decoding ───────────────────────────────────────────────
// The cursor is a base64-encoded JSON object: { id, value }
// - id     → _id of the last document on the previous page (always present)
// - value  → the sort field value of that document (used for keyset comparison)
//
// Encoding as base64 makes it opaque to the client — they must not construct
// or manipulate it. This is intentional.

export const encodeCursor = ({ id, value }) =>
  Buffer.from(JSON.stringify({ id, value })).toString("base64url");

export const decodeCursor = (cursor) => {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    return null; // treat invalid cursor as "start from beginning"
  }
};

export const parseUrlQueryParams = (query) => {
  const errors = [];

  // ── limit ──
  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 10) {
    limit = DEFAULT_LIMIT;
  } else if (limit > MAX_LIMIT) {
    errors.push(`limit must be between 1 and ${MAX_LIMIT}`);
  }

  // ── sortBy ──
  const sortBy = ALLOWED_SORT_FIELDS.includes(query.sortBy)
    ? query.sortBy
    : "createdAt";

  // ── order ──
  const order = ALLOWED_ORDERS.includes(query.order) ? query.order : "desc";

  // ── cursor ──
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  // ── search ──
  const search =
    typeof query.search === "string" && query.search.trim().length > 0
      ? query.search.trim().replace(/[<>]/g, "")
      : null;

  // ── isActive filter ──
  // Accepted values: "true" | "false" | undefined (means "all")
  let isActive = undefined;
  if (query.isActive === "true") isActive = true;
  else if (query.isActive === "false") isActive = false;

  // ── expiresAt filter ──
  // Accepted values: "expired" | "active" | undefined (means "all")
  const expiryFilter =
    query.expiryFilter === "expired" || query.expiryFilter === "active"
      ? query.expiryFilter
      : null;

  if (errors.length > 0) {
    throw new ValidationError(errors.join(", "));
  }

  return { limit, sortBy, order, cursor, search, isActive, expiryFilter };
};