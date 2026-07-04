// utils/pendingAuth.js
//
// Holds { email, password, sessionToken } in memory while a user waits on
// the "check your email" screen, so we can:
//   1) know which sessionToken to open the verify-status SSE stream with, and
//   2) automatically log them in the moment verification completes.
//
// Deliberately a plain module-level variable, not redux/localStorage/
// sessionStorage: a plaintext password shouldn't be serializable, inspectable
// in devtools, or written to disk. It's lost on refresh/tab-close by design —
// if that happens, the person just logs in normally once their email is
// verified.

let pending = null;

export const setPendingAuth = (data) => {
  pending = { ...pending, ...data };
};

export const getPendingAuth = () => pending;

export const clearPendingAuth = () => {
  pending = null;
};
