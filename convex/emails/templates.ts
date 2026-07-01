/**
 * Branded HTML email templates — pure string builders (no "use node").
 * Colours approximate the site's oklch tokens as email-safe hex:
 *   bg #201f1b · card #2a2925 · text #e7e2d6 · muted #a8a297
 *   primary (terracotta) #c4673e · accent (fern) #3f9152
 */

const BG = "#201f1b";
const CARD = "#2a2925";
const TEXT = "#e7e2d6";
const MUTED = "#a8a297";
const PRIMARY = "#c4673e";
const ACCENT = "#3f9152";
const BORDER = "#3a3833";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function wrap(previewTitle: string, inner: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewTitle)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:92%;background:${CARD};border:1px solid ${BORDER};border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <span style="font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:${ACCENT};font-weight:600;">MyPA</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px 32px;color:${TEXT};font-size:16px;line-height:1.6;">
                ${inner}
              </td>
            </tr>
          </table>
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:92%;">
            <tr>
              <td style="padding:18px 8px;color:${MUTED};font-size:12px;line-height:1.5;">
                You're receiving this because you interacted with MyPA's early-access page.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function waitlistConfirmationHtml(name: string): string {
  const safeName = escapeHtml(name || "there");
  return wrap(
    "You're on the MyPA waitlist",
    `
    <h1 style="margin:0 0 16px 0;font-size:26px;font-weight:600;color:${TEXT};">
      You're on the list, ${safeName}.
    </h1>
    <p style="margin:0 0 16px 0;color:${TEXT};">
      Thanks for joining the MyPA early-access waitlist. We're building a calm,
      voice-first personal assistant — just say <strong style="color:${PRIMARY};">"Hey MyPA"</strong>
      and it plans, schedules, and gets things done.
    </p>
    <p style="margin:0 0 8px 0;color:${MUTED};">
      We'll email you the moment your spot is ready. No spam — just your invite.
    </p>
    `,
  );
}

export function feedbackThanksHtml(name?: string): string {
  const safeName = escapeHtml(name || "there");
  return wrap(
    "Thanks for your feedback",
    `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:600;color:${TEXT};">
      Thank you, ${safeName}.
    </h1>
    <p style="margin:0 0 16px 0;color:${TEXT};">
      Your feedback just landed with the MyPA team. Early input like yours
      directly shapes what we build next.
    </p>
    <p style="margin:0;color:${MUTED};">We read every note. Talk soon.</p>
    `,
  );
}

export function contactThanksHtml(name: string): string {
  const safeName = escapeHtml(name || "there");
  return wrap(
    "We got your message",
    `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:600;color:${TEXT};">
      Got it, ${safeName}.
    </h1>
    <p style="margin:0 0 16px 0;color:${TEXT};">
      Thanks for reaching out to MyPA. A human will get back to you shortly.
    </p>
    <p style="margin:0;color:${MUTED};">We typically reply within 1–2 business days.</p>
    `,
  );
}

export function adminNotifyHtml(opts: {
  type: string;
  name?: string;
  email?: string;
  rows?: Array<{ label: string; value: string }>;
}): string {
  const rows = (opts.rows ?? [])
    .map(
      (r) => `
      <tr>
        <td style="padding:6px 12px 6px 0;color:${MUTED};font-size:13px;vertical-align:top;white-space:nowrap;">${escapeHtml(r.label)}</td>
        <td style="padding:6px 0;color:${TEXT};font-size:14px;">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join("");

  return wrap(
    `New ${opts.type.toLowerCase()} submission`,
    `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:${TEXT};">
      New ${escapeHtml(opts.type)} submission
    </h1>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${rows}
    </table>
    <p style="margin:20px 0 0 0;color:${MUTED};font-size:13px;">
      View it in the admin dashboard.
    </p>
    `,
  );
}
