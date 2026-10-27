/**
 * Tester-program emails — pure string builders (no "use node"), also imported
 * by the admin Testers tab for its live preview. Light layout to match the
 * landing page; nothing in them rounds past 6px.
 *
 * Images are absolute https URLs under `{origin}/guide/` (rendered from
 * /testers/guide by scripts/build-guide-images.mjs). Never data URIs: Gmail
 * strips them, and they would push the HTML past Gmail's ~100KB clip.
 */

import { CONTACT_EMAIL } from "./templates";

export type TesterDevice = "samsung" | "android" | "iphone";

/** Where the guide images and the hosted guide live. Deliberately not SITE_URL. */
export const DEFAULT_PUBLIC_ORIGIN = "https://waitlist.mypa.computer";

const INK = "#0F172A";
const MUTED = "#475569";
const FAINT = "#64748B";
const LINE = "#E2E8F0";
const PAGE = "#F8FAFC";
const BLUE = "#1D4ED8";
const BLUE_BG = "#EFF6FF";
const BLUE_LINE = "#BFDBFE";
const AMBER = "#92400E";
const AMBER_BG = "#FFFBEB";
const AMBER_LINE = "#FDE68A";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function layout(preheader: string, inner: string, reason: string): string {
  return `<!doctype html>
<html>
  <head><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="light"/></head>
  <body style="margin:0;padding:0;background:${PAGE};font-family:${FONT};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};padding:28px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:94%;background:#FFFFFF;border:1px solid ${LINE};border-radius:6px;">
            <tr>
              <td style="padding:28px 32px 4px 32px;">
                <span style="font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:${INK};font-weight:700;">MyPA</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px 32px;color:${INK};font-size:16px;line-height:1.6;">
                ${inner}
              </td>
            </tr>
          </table>
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:94%;">
            <tr>
              <td style="padding:16px 8px;color:${FAINT};font-size:12px;line-height:1.5;">
                Questions? Reply to this email or write to
                <a href="mailto:${CONTACT_EMAIL}" style="color:${FAINT};">${CONTACT_EMAIL}</a>. A person reads every message.<br/>
                ${reason}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 8px 0;">
  <tr><td style="background:#000000;border-radius:6px;">
    <a href="${esc(href)}" style="display:inline-block;padding:14px 22px;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">${esc(label)}</a>
  </td></tr>
</table>`;
}

function panel(tone: "blue" | "amber", title: string, body: string): string {
  const [fg, bg, line] = tone === "blue" ? [BLUE, BLUE_BG, BLUE_LINE] : [AMBER, AMBER_BG, AMBER_LINE];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:${bg};border:1px solid ${line};border-radius:6px;">
  <tr><td style="padding:16px 18px;color:${fg};font-size:14px;line-height:1.6;">
    <div style="font-weight:700;font-size:15px;margin-bottom:6px;">${title}</div>
    ${body}
  </td></tr>
</table>`;
}

export type GuideStep = {
  id: string;
  title: string;
  /** Plain text; **double asterisks** mark the labels to tap. */
  body: string;
  /** File under /guide/, rendered from /testers/guide by scripts/build-guide-images.mjs. */
  image?: string;
  alt?: string;
};

/**
 * The install steps, shared by the approval email and the /testers/guide
 * page so the two can never disagree. `where` decides how step 1 points at
 * the invite button: it is in the email, not on the public page.
 */
export function guideSteps(
  device: TesterDevice,
  email: string,
  where: "email" | "page",
): GuideStep[] {
  const samsung = device === "samsung";
  const list: GuideStep[] = [
    {
      id: "invite",
      title: "Claim your tester spot",
      body: `Tap **Accept your tester invite** ${where === "email" ? "above" : "in your approval email"}. On the Firebase page, enter **${email}** and submit. Firebase emails you an invitation within a few minutes.`,
      image: "1-invite.png",
      alt: "The Firebase invite page with the email field filled in",
    },
    {
      id: "accept",
      title: "Accept the invitation on your Android phone",
      body: `Open the email from **Firebase App Distribution** on your phone and tap its button. **Sign in with Google** and accept. Remember which Google account you used. You’ll need the same one in step ${samsung ? 5 : 4}.`,
      image: "2-accept.png",
      alt: "Google's account chooser, accepting the invitation",
    },
  ];
  if (samsung) {
    list.push({
      id: "blocker-off",
      title: "Turn off Auto Blocker for now",
      body: "Samsung’s Auto Blocker stops apps that don’t come from the Galaxy Store or Play Store, test builds included. Open **Settings** → **Security and privacy** → **Auto Blocker** and switch it **off**. You’ll turn it back on in the last step.",
      image: "samsung-auto-blocker.png",
      alt: "Samsung Settings, Security and privacy, Auto Blocker switched off",
    });
  }
  list.push(
    {
      id: "app-tester",
      title: "Install Firebase App Tester",
      body: "After you accept, the page offers **Download App Tester**. Your browser will say it isn’t allowed to install unknown apps. Tap **Settings**, turn on **Allow from this source**, go back and tap **Install**.",
      image: "3-app-tester.png",
      alt: "Android's Allow from this source switch for the browser",
    },
    {
      id: "download",
      title: "Download MyPA in App Tester",
      body: "Open **App Tester** and sign in with the same Google account. Tap **MyPA**, then **Download**.",
      image: "4-download.png",
      alt: "Firebase App Tester listing MyPA with a Download button",
    },
    {
      id: "install",
      title: "Install and open MyPA",
      body: "Allow App Tester to install apps the same way (**Settings** → **Allow from this source**), then tap **Install**. If Google Play Protect asks, tap **Scan app** and let Google check it, or **More details** → **Install anyway**. MyPA is now on your home screen.",
      image: "5-install.png",
      alt: "Android's install prompt for MyPA",
    },
  );
  if (samsung) {
    list.push({
      id: "blocker-on",
      title: "Turn Auto Blocker back on",
      body: "Go back to **Settings** → **Security and privacy** → **Auto Blocker** and switch it **on**. MyPA keeps working. When we ship an update, switch it off for a minute while App Tester installs it.",
    });
  }
  return list;
}

/** "Why this is safe", in the email and on the guide page. */
export const SAFETY_POINTS = [
  "MyPA reaches you through **Firebase App Distribution**, Google’s official service for sharing apps with testers before they reach the Play Store.",
  "You sign in on Google’s own pages. We never see your password.",
  "The build is signed by MyPA and downloaded straight from Firebase, not from a file someone forwarded.",
  "Android warns about any app that doesn’t come from the Play Store. That warning is expected for a test build.",
  "You can uninstall MyPA any time, like any other app.",
];

/** Escape, then turn **label** into a bold span. */
function md(text: string): string {
  return esc(text).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${INK};">$1</strong>`);
}

function steps(list: GuideStep[], origin: string): string {
  return list
    .map(
      (s, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
  <tr>
    <td width="36" valign="top" style="width:36px;padding-top:1px;">
      <div style="width:26px;height:26px;line-height:26px;text-align:center;background:${INK};color:#FFFFFF;font-size:13px;font-weight:700;border-radius:6px;">${i + 1}</div>
    </td>
    <td valign="top">
      <div style="font-size:16px;font-weight:700;color:${INK};">${esc(s.title)}</div>
      <div style="margin-top:4px;font-size:15px;line-height:1.6;color:${MUTED};">${md(s.body)}</div>
      ${
        s.image
          ? `<img src="${esc(origin)}/guide/${s.image}" width="456" alt="${esc(s.alt ?? s.title)}" style="display:block;margin-top:12px;width:100%;max-width:456px;height:auto;border:1px solid ${LINE};border-radius:6px;"/>`
          : ""
      }
    </td>
  </tr>
</table>`,
    )
    .join("");
}

const b = (s: string) => `<strong style="color:${INK};">${s}</strong>`;

/** Sent the moment someone joins: confirms the address and says what happens next. */
export function testerReceivedHtml(opts: {
  position: number;
  slots: number;
  device: TesterDevice;
}): string {
  const inTesterRange = opts.position <= opts.slots;
  const lead = inTesterRange
    ? `<p style="margin:0 0 12px 0;">You&rsquo;re <strong>#${opts.position}</strong> on the list, inside the first ${opts.slots}. Those first ${opts.slots} people become MyPA&rsquo;s early testers.</p>
       <p style="margin:0 0 12px 0;color:${MUTED};">We approve testers by hand. When your spot is approved you&rsquo;ll get a second email with your invite and a picture-by-picture guide to installing the app. It takes about five minutes.</p>`
    : `<p style="margin:0 0 12px 0;">You&rsquo;re <strong>#${opts.position}</strong> on the list. All ${opts.slots} early-tester spots are taken, so you&rsquo;re on the waitlist for the next round.</p>
       <p style="margin:0 0 12px 0;color:${MUTED};">When new tester spots open we&rsquo;ll email you before we announce them anywhere else.</p>`;
  const iphone =
    opts.device === "iphone"
      ? panel(
          "amber",
          "The test build is Android-only for now",
          "You told us you use an iPhone. We&rsquo;ll keep your place and email you when the iOS build is ready to test.",
        )
      : "";
  return layout(
    "Your place on the MyPA tester list is saved.",
    `<h1 style="margin:0 0 14px 0;font-size:24px;line-height:1.25;color:${INK};">You&rsquo;re on the list.</h1>
     ${lead}
     ${iphone}
     <p style="margin:0;color:${MUTED};">Thanks for wanting to try MyPA early.<br/>The MyPA team</p>`,
    "You're receiving this because you joined the MyPA tester list at waitlist.mypa.computer.",
  );
}

/**
 * Sent when an admin approves a tester: why it is safe, the Firebase invite,
 * and the install steps. Samsung phones get the Auto Blocker steps around the
 * install; everything else is identical.
 */
export function testerGuideHtml(opts: {
  device: TesterDevice;
  inviteLink: string;
  email: string;
  origin?: string;
}): string {
  const origin = (opts.origin ?? DEFAULT_PUBLIC_ORIGIN).replace(/\/$/, "");
  const samsung = opts.device === "samsung";
  const guideUrl = `${origin}/testers/guide${samsung ? "?phone=samsung" : ""}`;

  const list = guideSteps(opts.device, opts.email, "email");
  const safety = panel(
    "blue",
    "Why this is safe",
    `<ul style="margin:0;padding:0 0 0 18px;">${SAFETY_POINTS.map(
      (p, i) => `<li style="margin:0 0 ${i === SAFETY_POINTS.length - 1 ? 0 : 4}px 0;">${md(p).replace(/color:#0F172A;/g, `color:${BLUE};`)}</li>`,
    ).join("")}</ul>`,
  );

  return layout(
    "You're approved as a MyPA early tester. Your invite and install guide are inside.",
    `<h1 style="margin:0 0 14px 0;font-size:24px;line-height:1.25;color:${INK};">You&rsquo;re in. Welcome to the MyPA tester group.</h1>
     <p style="margin:0 0 4px 0;">Your tester spot is approved. You&rsquo;ll get MyPA on your Android phone before anyone else, and what you tell us shapes the app.</p>
     ${button(opts.inviteLink, "Accept your tester invite")}
     <p style="margin:0 0 4px 0;font-size:14px;color:${FAINT};">Prefer a bigger screen? <a href="${esc(guideUrl)}" style="color:${BLUE};">Open the install guide in your browser</a>.</p>
     ${safety}
     <h2 style="margin:28px 0 16px 0;font-size:18px;color:${INK};">Install in ${list.length === 7 ? "seven" : "five"} steps</h2>
     ${steps(list, origin)}
     <p style="margin:8px 0 0 0;color:${MUTED};">New builds show up in App Tester with an ${b("Update")} button. Stuck on a step? Reply to this email with a screenshot and we&rsquo;ll walk you through it.</p>
     <p style="margin:16px 0 0 0;color:${MUTED};">Thank you for testing,<br/>The MyPA team</p>`,
    "You're receiving this because you joined the MyPA tester list and your spot was approved.",
  );
}
