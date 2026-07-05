import { isIP } from "net";

// Guards against untrusted/malformed req.ip values (e.g. objects, empty strings)
// corrupting downstream keys - same class of bug as the ipKeyGenerator Redis issue.
export const safeIp = (ip) => {
  if (typeof ip !== "string") return "unknown";
  const trimmed = ip.trim();
  if (!trimmed || !isIP(trimmed)) return "unknown";
  return trimmed;
};