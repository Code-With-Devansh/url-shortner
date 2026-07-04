export const forgotPasswordTemplate = (name, email, link) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="dark light">
  <meta name="supported-color-schemes" content="dark light">
  <title>Reset your password — snip</title>
</head>
<body style="margin:0; padding:0; background-color:#0a0a0a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px; font-family:'SF Mono', Consolas, Menlo, 'Courier New', monospace; font-size:36px; font-weight:900; letter-spacing:-1px; line-height:1;">
              <span style="color:#aaff00;">[</span><span style="color:#ffffff;">snip</span><span style="color:#aaff00;">]</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td bgcolor="#111111" style="background-color:#111111; border:1px solid #2a2a2a; border-radius:6px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- Accent bar -->
                <tr>
                  <td height="3" bgcolor="#aaff00" style="background-color:#aaff00; line-height:3px; font-size:1px;">&nbsp;</td>
                </tr>

                <tr>
                  <td style="padding:40px 40px 36px;">

                    <!-- Icon: padlock, same solid-circle treatment as the verification email -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px;">
                      <tr>
                        <td width="56" height="56" align="center" valign="middle" bgcolor="#1a2400" style="background-color:#1a2400; border:1px solid #3d5200; border-radius:50%;">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="5" y="11" width="14" height="10" rx="2" stroke="#aaff00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M8 11V7a4 4 0 018 0v4" stroke="#aaff00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </td>
                      </tr>
                    </table>

                    <!-- Heading -->
                    <h1 style="margin:0 0 8px; font-family:'SF Mono', Consolas, Menlo, 'Courier New', monospace; font-size:22px; font-weight:900; color:#ffffff; letter-spacing:-0.5px; text-align:center;">
                      Reset your password
                    </h1>

                    <p style="margin:0 0 32px; font-family:'SF Mono', Consolas, Menlo, 'Courier New', monospace; font-size:13px; color:#a8a8a8; text-align:center; line-height:1.8; letter-spacing:0.03em;">
                      Hey <span style="color:#aaff00; font-weight:700;">${name}</span>, we got a request to reset<br/>
                      the password for <span style="color:#aaff00; font-weight:700;">${email}</span>.<br/>
                      Click below to choose a new one.
                    </p>

                    <!-- CTA Button -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 32px;">
                      <tr>
                        <td align="center" bgcolor="#aaff00" style="background-color:#aaff00; border-radius:4px;">
                          <a href="${link}" target="_blank" style="display:inline-block; padding:14px 36px; font-family:'SF Mono', Consolas, Menlo, 'Courier New', monospace; font-size:12px; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; color:#0a0a0a; text-decoration:none;">
                            Reset my password &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td height="1" bgcolor="#2a2a2a" style="background-color:#2a2a2a; font-size:1px; line-height:1px;">&nbsp;</td></tr>
                    </table>

                    <!-- Fallback URL -->
                    <p style="margin:24px 0 8px; font-family:'SF Mono', Consolas, Menlo, 'Courier New', monospace; font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:#888888;">
                      Or copy this link into your browser
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td bgcolor="#0a0a0a" style="background-color:#0a0a0a; border:1px solid #2a2a2a; border-radius:4px; padding:12px 16px; font-family:'SF Mono', Consolas, Menlo, 'Courier New', monospace; font-size:11px; color:#aaff00; word-break:break-all; line-height:1.6;">
                          ${link}
                        </td>
                      </tr>
                    </table>

                    <!-- Security notice: amber-ish tint via same green-tinted box, but wording flags non-action -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                      <tr>
                        <td bgcolor="#16210a" style="background-color:#16210a; border:1px solid #3d5200; border-radius:4px; padding:12px 16px; font-family:'SF Mono', Consolas, Menlo, 'Courier New', monospace; font-size:11px; color:#c8c8c8; letter-spacing:0.04em; line-height:1.7;">
                          &#9201; This link expires in <strong style="color:#aaff00; font-weight:700;">10 minutes</strong>. If you didn't request a password reset, you can safely ignore this email &mdash; your password won't change.
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px; font-family:'SF Mono', Consolas, Menlo, 'Courier New', monospace; font-size:10px; letter-spacing:0.15em; text-transform:uppercase; color:#777777; line-height:2;">
              &copy; 2025 snip &mdash; link shortener<br/>
              <a href="{{unsubscribe_url}}" style="color:#888888; text-decoration:none;">Unsubscribe</a>
              &nbsp;&middot;&nbsp;
              <a href="{{privacy_url}}" style="color:#888888; text-decoration:none;">Privacy Policy</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};