import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import * as tar from "tar";
import logger from "../logger/index.js";

const EDITION_ID = "GeoLite2-Country";
const DEST_DIR = process.env.GEOIP_DEST_DIR || path.resolve("data");
const DEST_FILE = path.join(DEST_DIR, `${EDITION_ID}.mmdb`);

const download = async (url, destPath, accountId, licenseKey) => {
  const auth = Buffer.from(`${accountId}:${licenseKey}`).toString("base64");
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });

  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText} (${url})`);
  }

  const fileStream = createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    res.body.pipeTo(
      new WritableStream({
        write(chunk) {
          fileStream.write(chunk);
        },
        close() {
          fileStream.end();
          resolve();
        },
        abort(err) {
          fileStream.destroy();
          reject(err);
        },
      }),
    );
  });
};

const findMmdbFile = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  const match = entries.find((e) => e.isFile() && e.name === `${EDITION_ID}.mmdb`);
  if (!match) return null;
  const parent = match.parentPath || match.path;
  return path.join(parent, match.name);
};

const run = async () => {
  const { MAXMIND_ACCOUNT_ID, MAXMIND_LICENSE_KEY } = process.env;
  if (!MAXMIND_ACCOUNT_ID || !MAXMIND_LICENSE_KEY) {
    throw new Error("Missing MAXMIND_ACCOUNT_ID or MAXMIND_LICENSE_KEY");
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "geoip-"));

  try {
    logger.info(`Starting GeoIP update for ${EDITION_ID}`);

    const archivePath = path.join(tmpDir, `${EDITION_ID}.tar.gz`);
    const shaPath = `${archivePath}.sha256`;
    const baseUrl = `https://download.maxmind.com/geoip/databases/${EDITION_ID}/download?suffix=tar.gz`;

    await download(baseUrl, archivePath, MAXMIND_ACCOUNT_ID, MAXMIND_LICENSE_KEY);
    await download(`${baseUrl}.sha256`, shaPath, MAXMIND_ACCOUNT_ID, MAXMIND_LICENSE_KEY);

    const expectedSha = (await fs.readFile(shaPath, "utf8")).split(" ")[0].trim();
    const actualSha = crypto.createHash("sha256").update(await fs.readFile(archivePath)).digest("hex");

    if (expectedSha !== actualSha) {
      throw new Error(`Checksum mismatch: expected ${expectedSha}, got ${actualSha}`);
    }
    logger.info("GeoIP archive checksum verified");

    await tar.x({ file: archivePath, cwd: tmpDir });

    const extractedMmdb = await findMmdbFile(tmpDir);
    if (!extractedMmdb) {
      throw new Error("Could not locate .mmdb file inside extracted archive");
    }

    await fs.mkdir(DEST_DIR, { recursive: true });
    const newFile = `${DEST_FILE}.new`;
    await fs.copyFile(extractedMmdb, newFile);
    await fs.rename(newFile, DEST_FILE); // atomic on same filesystem

    logger.info(`GeoIP database updated at ${DEST_FILE}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
};

run()
  .then(() => {
    logger.info("GeoIP update job completed");
    process.exit(0);
  })
  .catch((err) => {
    logger.error({ err }, "GeoIP update job failed");
    process.exit(1);
  });