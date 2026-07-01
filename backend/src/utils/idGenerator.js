import { claimRange } from "../dao/counter.dao.js";

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const PREFETCH_THRESHOLD = 100;

class IdGenerator {
  constructor() {
    this.current = null;
    this.rangeEnd = null;
    this.nextRange = null;
    this.claimPromise = null;
    this.initPromise = null;
  }

  async initialize() {
    if (this.current !== null) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const range = await claimRange();
        this.current = range.start;
        this.rangeEnd = range.end;
      })();
    }
    await this.initPromise;
  }

  async generateId() {
    if (this.current === null) {
      throw new Error("IdGenerator not initialized");
    }
    if (this.current > this.rangeEnd) {
      await this.switchToNextRange();
    }
    if (
      !this.nextRange &&
      !this.claimPromise &&
      this.rangeEnd - this.current <= PREFETCH_THRESHOLD
    ) {
      this.prefetchNextRange();
    }

    const id = this.current++;
    return this.toBase62(id);
  }
  async prefetchNextRange() {
    this.claimPromise = (async () => {
      try {
        this.nextRange = await claimRange();
      } finally {
        this.claimPromise = null;
      }
    })();
  }
  async switchToNextRange() {
    // No prefetched range yet.
    if (!this.nextRange) {
      if (!this.claimPromise) {
        this.prefetchNextRange();
      }

      await this.claimPromise;
    }
    this.current = this.nextRange.start;
    this.rangeEnd = this.nextRange.end;
    this.nextRange = null;
  }

  toBase62(num) {
    if (num === 0) return "0";

    let result = "";

    while (num > 0) {
      result = BASE62[num % 62] + result;
      num = Math.floor(num / 62);
    }

    return result;
  }
}

export default new IdGenerator();
