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

const CONTACT_EMAIL = "hello@mypa.computer";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function wrap(
  previewTitle: string,
  inner: string,
  opts?: { receivingReason?: string; showUnsubscribe?: boolean },
): string {
  const reason =
    opts?.receivingReason ??
    "You're receiving this because you interacted with MyPA's early-access page.";
  const unsubscribe = opts?.showUnsubscribe
    ? ` If you'd rather not hear from us, just reply with
        &ldquo;unsubscribe&rdquo; — no hard feelings, ever.`
    : "";
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
                Questions or thoughts? Just hit reply, or write to
                <a href="mailto:${CONTACT_EMAIL}" style="color:${MUTED};">${CONTACT_EMAIL}</a>
                — a human reads everything.<br/>
                ${reason}${unsubscribe}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Shared sign-off block. */
function signOff(): string {
  return `
    <p style="margin:20px 0 0 0;color:${TEXT};">
      With gratitude,<br/>
      <strong>The MyPA team</strong>
    </p>`;
}

/** Numbered "what happens next" row — keeps the flow methodical and scannable. */
function step(n: number, title: string, body: string): string {
  return `
    <tr>
      <td style="padding:10px 14px 10px 0;vertical-align:top;">
        <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:50%;background:${PRIMARY};color:#fff;font-size:13px;font-weight:600;">${n}</span>
      </td>
      <td style="padding:10px 0;vertical-align:top;">
        <strong style="color:${TEXT};font-size:15px;">${title}</strong><br/>
        <span style="color:${MUTED};font-size:14px;line-height:1.5;">${body}</span>
      </td>
    </tr>`;
}

export function waitlistConfirmationHtml(name: string): string {
  const safeName = escapeHtml(name || "there");
  return wrap(
    "Welcome to MyPA — your spot on the list is saved",
    `
    <h1 style="margin:0 0 16px 0;font-size:26px;font-weight:600;color:${TEXT};">
      Welcome, ${safeName} — we're so glad you're here.
    </h1>
    <p style="margin:0 0 16px 0;color:${TEXT};">
      Thank you for joining the MyPA early-access list. It takes a little
      faith to sign up for something before the world has heard of it, and we
      don't take that lightly — <strong style="color:${PRIMARY};">your spot is
      saved</strong>.
    </p>
    <p style="margin:0 0 16px 0;color:${TEXT};">
      We're building a calm, voice-first personal assistant. Just say
      <strong style="color:${PRIMARY};">&ldquo;Hey MyPA&rdquo;</strong> and it
      plans your day, schedules what matters, and quietly gets things done —
      so you can be present for the rest of your life.
    </p>
    <p style="margin:0 0 8px 0;color:${TEXT};font-weight:600;">
      Here's exactly what happens next:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${step(1, "Your place is reserved", "You're locked in. No further action needed from you.")}
      ${step(2, "We keep you posted", "The occasional update when there's something genuinely worth sharing — never noise.")}
      ${step(3, "You get your invite", "The moment your spot opens, your personal invite lands in this inbox.")}
    </table>
    ${signOff()}
    `,
    {
      receivingReason:
        "You're receiving this because you joined the MyPA early-access waitlist.",
    },
  );
}

export function feedbackThanksHtml(name?: string): string {
  const safeName = escapeHtml(name || "there");
  return wrap(
    "Thank you — your feedback just shaped MyPA",
    `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:600;color:${TEXT};">
      Thank you, ${safeName}. This genuinely helps.
    </h1>
    <p style="margin:0 0 16px 0;color:${TEXT};">
      Your note just landed with the MyPA team — and we mean the actual
      people building the product, not a ticket queue. At this stage,
      feedback like yours doesn't get filed away;
      <strong style="color:${PRIMARY};">it decides what we build next</strong>.
    </p>
    <p style="margin:0 0 16px 0;color:${TEXT};">
      We read every word, we discuss it as a team, and where it changes
      MyPA you'll be able to tell. Thank you for caring enough to write —
      early voices like yours are the ones a product remembers.
    </p>
    ${signOff()}
    `,
    {
      receivingReason:
        "You're receiving this because you shared feedback on MyPA's early-access page.",
    },
  );
}

export function contactThanksHtml(name: string): string {
  const safeName = escapeHtml(name || "there");
  return wrap(
    "We've got your message — MyPA",
    `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:600;color:${TEXT};">
      We've got it, ${safeName} — thank you for reaching out.
    </h1>
    <p style="margin:0 0 16px 0;color:${TEXT};">
      Your message is safely with the MyPA team, and a real person is going
      to read it — carefully. Here's what you can expect from us:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${step(1, "We read it properly", "No skimming. Your message gets the attention it deserves.")}
      ${step(2, "We reply personally", `Usually within 1–2 business days, from a human at ${CONTACT_EMAIL}.`)}
    </table>
    <p style="margin:16px 0 0 0;color:${TEXT};">
      Thanks for taking the time to write to us — conversations like this
      one are how MyPA gets better.
    </p>
    ${signOff()}
    `,
    {
      receivingReason:
        "You're receiving this because you contacted the MyPA team.",
    },
  );
}

/**
 * One-off appreciation / progress-update campaign, sent to everyone who has
 * ever touched the early-access page (waitlist signups, feedback senders,
 * contact messages). `source` picks the opening line that matches how we
 * know them.
 */
export function appreciationHtml(
  name: string | undefined,
  source: "waitlist" | "feedback" | "contact",
): string {
  const safeName = escapeHtml(name || "there");
  const opener = {
    waitlist:
      "you raised your hand early and joined our waitlist — before there was anything to download, install, or show off",
    feedback:
      "you took the time to share your honest thoughts with us — the kind of input most people never bother to give",
    contact:
      "you reached out and started a conversation with us — and conversations are exactly how this product is being shaped",
  }[source];

  return wrap(
    "A heartfelt thank-you from the MyPA team",
    `
    <h1 style="margin:0 0 16px 0;font-size:26px;font-weight:600;color:${TEXT};">
      ${safeName}, we owe you a proper thank-you.
    </h1>
    <p style="margin:0 0 16px 0;color:${TEXT};">
      Some time ago, ${opener}. We've been heads-down building since, and we
      realised we never stopped to say it plainly:
      <strong style="color:${PRIMARY};">thank you for believing in MyPA.</strong>
    </p>
    <p style="margin:0 0 16px 0;color:${TEXT};">
      If it's been a while, here's the one-line refresher: MyPA is a calm,
      voice-first personal assistant. You say
      <strong style="color:${PRIMARY};">&ldquo;Hey MyPA&rdquo;</strong> and it
      plans, schedules, and gets things done — so your day runs itself and
      you get to live it.
    </p>
    <p style="margin:0 0 8px 0;color:${TEXT};font-weight:600;">
      Where things stand, honestly:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${step(1, "We're building toward launch", "The core experience — voice, planning, scheduling — is coming together every week.")}
      ${step(2, "Early access opens in waves", "We're inviting people gradually so every single person gets a great first experience.")}
      ${step(3, "You're already on our minds", "When your wave opens, the invite comes straight to this inbox. Nothing for you to do.")}
    </table>
    <p style="margin:16px 0 0 0;color:${TEXT};">
      Products get built by teams, but they get <em>willed into existence</em>
      by early believers. That's you. We're grateful, and we intend to make
      the wait worth it.
    </p>
    ${signOff()}
    `,
    {
      receivingReason:
        "You're receiving this one-time note because you joined the MyPA waitlist or wrote to us via the early-access page.",
      showUnsubscribe: true,
    },
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
