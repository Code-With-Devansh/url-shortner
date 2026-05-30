export const emailVerificationTemplate = (name, email, link)=>{
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify your email — snip</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background-color: #0a0a0a;
      font-family: 'JetBrains Mono', monospace;
      color: #f0f0f0;
      padding: 40px 16px;
      -webkit-font-smoothing: antialiased;
    }

    .wrapper {
      max-width: 520px;
      margin: 0 auto;
    }

    /* Logo */
    .logo {
      text-align: center;
      margin-bottom: 32px;
    }
    .logo-text {
      font-size: 36px;
      font-weight: 900;
      letter-spacing: -1px;
      line-height: 1;
    }
    .logo-bracket { color: #aaff00; }
    .logo-word    { color: #ffffff; }

    /* Card */
    .card {
      background: #111111;
      border: 1px solid #222222;
      border-radius: 6px;
      overflow: hidden;
      position: relative;
    }
    .card-accent {
      height: 3px;
      background: #aaff00;
      width: 100%;
    }
    .card-body {
      padding: 40px 40px 36px;
    }

    /* Icon circle */
    .icon-wrap {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(170,255,0,0.08);
      border: 1px solid rgba(170,255,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }

    /* Headings */
    .heading {
      font-size: 22px;
      font-weight: 900;
      color: #f0f0f0;
      letter-spacing: -0.5px;
      text-align: center;
      margin-bottom: 8px;
    }
    .subtext {
      font-size: 12px;
      color: #555555;
      text-align: center;
      line-height: 1.8;
      letter-spacing: 0.03em;
      margin-bottom: 32px;
    }
    .subtext span {
      color: #aaff00;
    }

    /* Button */
    .btn-wrap {
      text-align: center;
      margin-bottom: 32px;
    }
    .btn {
      display: inline-block;
      background: #aaff00;
      color: #0a0a0a;
      text-decoration: none;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      padding: 14px 36px;
      border-radius: 4px;
    }

    /* Divider */
    .divider {
      height: 1px;
      background: #1e1e1e;
      margin: 0 0 24px;
    }

    /* URL fallback */
    .fallback-label {
      font-size: 10px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #444444;
      margin-bottom: 8px;
    }
    .fallback-url {
      background: #0a0a0a;
      border: 1px solid #1e1e1e;
      border-radius: 4px;
      padding: 12px 16px;
      font-size: 11px;
      color: #aaff00;
      word-break: break-all;
      line-height: 1.6;
    }

    /* Expiry notice */
    .notice {
      margin-top: 24px;
      padding: 12px 16px;
      background: rgba(170,255,0,0.04);
      border: 1px solid rgba(170,255,0,0.1);
      border-radius: 4px;
      font-size: 11px;
      color: #555555;
      letter-spacing: 0.04em;
      line-height: 1.7;
    }
    .notice strong { color: #aaff00; font-weight: 700; }

    /* Footer */
    .footer {
      margin-top: 24px;
      text-align: center;
      font-size: 10px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #333333;
      line-height: 2;
    }
    .footer a { color: #444444; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">

    <!-- Logo -->
    <div class="logo">
      <div class="logo-text">
        <span class="logo-bracket">[</span>
        <span class="logo-word">snip</span>
        <span class="logo-bracket">]</span>
      </div>
    </div>

    <!-- Card -->
    <div class="card">
      <div class="card-accent"></div>
      <div class="card-body">

        <!-- Icon -->
        <div class="icon-wrap">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              stroke="#aaff00" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <!-- Heading -->
        <h1 class="heading">Verify your email</h1>
        <p class="subtext">
          Hey <span>${name}</span>, thanks for signing up.<br/>
          Click the button below to verify<br/>
          <span>${email}</span> and activate your account.
        </p>

        <!-- CTA Button -->
        <div class="btn-wrap">
          <a href="${verificationLink}" class="btn">Verify my email →</a>
        </div>

        <div class="divider"></div>

        <!-- Fallback URL -->
        <p class="fallback-label">Or copy this link into your browser</p>
        <div class="fallback-url">${verificationLink}</div>

        <!-- Expiry notice -->
        <div class="notice">
          ⏱ This link expires in <strong>10 minutes</strong>. If you didn't create a
          [snip] account, you can safely ignore this email.
        </div>

      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>© 2025 snip — link shortener</p>
      <p style="margin-top:4px">
        <a href="{{unsubscribe_url}}">Unsubscribe</a>
        &nbsp;·&nbsp;
        <a href="{{privacy_url}}">Privacy Policy</a>
      </p>
    </div>

  </div>
</body>
</html>`
}