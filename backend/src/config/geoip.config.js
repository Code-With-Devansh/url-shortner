import { Reader } from "@maxmind/geoip2-node";
import { watch } from "fs";
import fs from "fs/promises";
import path from "path";
import logger from "../logger/index.js";

const DB_PATH = path.resolve("data/GeoLite2-Country.mmdb");

let readerPromise = null;
let watcherStarted = false;

const startWatcher = () => {
  if (watcherStarted) return;
  watcherStarted = true;

  try {
    watch(path.dirname(DB_PATH), (eventType, filename) => {
      if (filename === path.basename(DB_PATH)) {
        logger.info("GeoIP database file changed on disk, invalidating cached reader");
        readerPromise = null;
      }
    });
  } catch (err) {
    // dir might not exist yet on first boot - not fatal, just won't auto-reload
    logger.warn({ err }, "Could not start GeoIP file watcher");
  }
};

export const getGeoReader = () => {
  startWatcher();
  if (!readerPromise) {
    readerPromise = fs
      .readFile(DB_PATH)
      .then((buf) => Reader.openBuffer(buf))
      .catch((err) => {
        logger.error({ err }, "Failed to load GeoLite2 database");
        readerPromise = null; // allow retry on next call
        throw err;
      });
  }
  return readerPromise;
};