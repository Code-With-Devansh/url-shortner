// Per-IP rate limiters (loginLimiter, redirectLimiter, etc.) protect
// against ONE client sending too much. They do nothing when the load
// comes from many distinct, legitimate clients at once - a link going
// viral across thousands of different visitors, for example. No single
// IP ever crosses its own threshold, so those limiters never fire, yet
// the aggregate volume can still overwhelm the process.
//
// This middleware tracks total in-flight requests across ALL clients and
// sheds load past a threshold, independent of who's sending it. It's a
// backstop for the shape of failure per-IP limiting can't see, not a
// replacement for it - keep both.
//
// This is in-process state (a plain counter), not Redis-backed - that's
// deliberate. Its entire job is to protect THIS process's event loop and
// THIS process's downstream connections (Mongo pool, Redis pool), so it
// needs to reflect this process's actual concurrent load, not a
// cluster-wide count. If you run N processes behind nginx, each gets its
// own independent ceiling, which is what you want - the limit should
// scale with however many processes you actually run.
let inFlight = 0;

/**
 * @param {object} opts
 * @param {number} opts.maxConcurrent  max requests this process will work
 *   on at once before shedding load. Size this from observed behavior:
 *   watch in-flight count under real/synthetic load and set the ceiling
 *   comfortably above your normal peak, low enough to leave headroom
 *   before latency cascades.
 * @param {string} [opts.code]
 */
export const concurrencyLimiter = ({ maxConcurrent, code = "SERVER_BUSY" }) => {
  return (req, res, next) => {
    if (inFlight >= maxConcurrent) {
      res.setHeader("Retry-After", "1");
      return res.status(503).json({
        success: false,
        code,
        message: "Server is under heavy load. Please retry shortly.",
      });
    }

    inFlight++;
    // decrement exactly once, regardless of how the response ends
    // (success, error, client disconnect) - 'finish' and 'close' together
    // cover the normal-completion and dropped-connection cases.
    let decremented = false;
    const decrement = () => {
      if (!decremented) {
        decremented = true;
        inFlight--;
      }
    };
    res.on("finish", decrement);
    res.on("close", decrement);

    next();
  };
};

// exposed for the /api/health endpoint or metrics - lets you actually see
// current load rather than guessing, including from the outside via curl.
export const getInFlightCount = () => inFlight;