// import { Reader } from '@maxmind/geoip2-node';
// import { createWriteStream, existsSync } from 'fs';
// import { pipeline } from 'stream/promises';
// import https from 'https';
// import tar from 'tar';
// import path from 'path';

const DB_PATH = process.env.GEOIP_DB_PATH || './data/GeoLite2-Country.mmdb';
const LICENSE_KEY = process.env.MAXMIND_LICENSE_KEY;
const DOWNLOAD_URL = `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=${LICENSE_KEY}&suffix=tar.gz`;

let geoReader = null;

export async function initGeo() {
  if (!existsSync(DB_PATH)) {
    console.log('[geo] No database found, downloading...');
    await downloadDatabase();
  }
  await loadReader();
}

async function loadReader() {
  const newReader = await Reader.open(DB_PATH);
  geoReader = newReader; 
}

async function downloadDatabase() {
  const tmpPath = DB_PATH + '.tmp';

  await new Promise((resolve, reject) => {
    https.get(DOWNLOAD_URL, (res) => {
      res.pipe(
        tar.extract({
          cwd: path.dirname(DB_PATH),
          filter: (p) => p.endsWith('.mmdb'),
          strip: 1,                           
        })
      )
      .on('finish', resolve)
      .on('error', reject);
    }).on('error', reject);
  });
}

export function getCountry(ip) {
  if (!geoReader || !ip) return 'unknown';
  try {
    return geoReader.country(ip)?.country?.isoCode || 'unknown';
  } catch {
    return 'unknown';  
  }
}