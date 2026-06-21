export async function loadReader() {
  const newReader = await Reader.open(DB_PATH);
  geoReader = newReader; 
}

export async function downloadDatabase() {
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