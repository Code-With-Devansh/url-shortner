(function () {
  var card     = document.querySelector('.card');
  var DEST     = decodeURIComponent(card.dataset.dest);
  var SHORT_ID = card.dataset.shortId;
  var TOTAL    = parseInt(card.dataset.total, 10);
  var CIRC     = 94.2;

  var remaining = TOTAL;
  var cancelled = false;
  var timer     = null;

  document.getElementById('dest-url').textContent = DEST;
  document.getElementById('dest-url').href        = DEST;
  document.getElementById('manual-link').href     = DEST;
  document.getElementById('ring-wrap').setAttribute('aria-label', TOTAL + ' seconds until redirect');

  var ring       = document.getElementById('ring');
  var countEl    = document.getElementById('count');
  var beaconPill = document.getElementById('beacon-pill');



  function doRedirect() {
    if (cancelled) return;
    clearInterval(timer);
    document.getElementById('btn-go').disabled     = true;
    document.getElementById('btn-cancel').disabled = true;
    window.location.replace(DEST);
  }

  function cancelRedirect() {
    cancelled = true;
    clearInterval(timer);
    document.getElementById('actions').style.display       = 'none';
    document.getElementById('cancelled-msg').style.display = 'block';
  }

  function tick() {
    remaining--;
    countEl.textContent = remaining;
    document.getElementById('ring-wrap').setAttribute('aria-label', remaining + ' seconds until redirect');
    ring.style.strokeDashoffset = CIRC * (1 - remaining / TOTAL);
    if (remaining <= 0) {
      clearInterval(timer);
      doRedirect();
    }
  }

  document.getElementById('btn-go').addEventListener('click', doRedirect);
  document.getElementById('btn-cancel').addEventListener('click', cancelRedirect);
  timer = setInterval(tick, 1000);
}());