export function buildRedirectPage(shortId, encodedUrl) {
  const fullUrl = decodeURIComponent(encodedUrl);
  return `<!DOCTYPE html>
<html>
  <head>
    <title>Redirecting...</title>
    <meta http-equiv="refresh" content="0;url=${fullUrl}" />
  </head>
  <body>
    <script>
      const beaconSent = navigator.sendBeacon('/api/clicks/${shortId}');
      window.location.replace('${fullUrl}');
    </script>
    <p>Redirecting to <a href="${fullUrl}">${fullUrl}</a>...</p>
  </body>
</html>`;
}