export function buildRedirectPage(shortId, encodedUrl) {
  const fullUrl = decodeURIComponent(encodedUrl);
  const TOTAL = 5;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirecting…</title>
  <link rel="stylesheet" href="/static/redirect.css">
</head>
<body>
  <div class="card"
    data-dest="${encodeURIComponent(fullUrl)}"
    data-short-id="${shortId}"
    data-total="${TOTAL}"
  >
    <div class="service-row">
      <div class="service-dot"></div>
      <span class="service-name">snipi &rarr; destination</span>
    </div>

    <div class="dest-row">
      <span class="dest-arrow">&rarr;</span>
      <div>
        <div class="dest-label">redirecting to</div>
        <a id="dest-url" class="dest-url" href="#"></a>
      </div>
    </div>

    <hr>

    <div class="actions" id="actions">
      <div class="countdown-ring" id="ring-wrap">
        <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
          <circle class="ring-bg" cx="18" cy="18" r="15"/>
          <circle class="ring-fill" id="ring" cx="18" cy="18" r="15"/>
        </svg>
        <div class="countdown-num" id="count" aria-live="polite">5</div>
      </div>
      <button class="btn-go" id="btn-go">&rarr; go now</button>
      <button class="btn-cancel" id="btn-cancel">cancel</button>
    </div>

    <div class="cancelled-msg" id="cancelled-msg">
      &times; redirect cancelled &mdash;
      <a id="manual-link" href="#">click here to continue manually</a>
    </div>
  </div>

  <script src="/static/redirect.js"></script>
</body>
</html>`;
}
