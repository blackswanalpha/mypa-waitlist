/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";

/**
 * Illustrated phone screens for the tester install guide. Each one is drawn
 * at 456×288 CSS px, the width the approval email shows images at, and
 * scripts/build-guide-images.mjs screenshots them at 2x into public/guide/.
 * They are illustrations: labels follow Android and Firebase, but a phone's
 * own skin will differ a little.
 */

const BLUE = "#1A73E8";

function Shot({ file, children, side }: { file: string; children: ReactNode; side?: ReactNode }) {
  return (
    <div
      data-shot={file}
      className="relative mx-auto flex h-[288px] w-full max-w-[456px] justify-center gap-6 overflow-hidden rounded-[6px] border border-slate-200 bg-slate-100 px-4 pt-6"
    >
      {side}
      <div className="h-[330px] w-[228px] shrink-0 rounded-t-[26px] border-[6px] border-b-0 border-slate-900 bg-white">
        <div className="flex h-5 items-center justify-between px-4 text-[9px] font-semibold text-slate-700">
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-3 rounded-[2px] bg-slate-700" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
          </span>
        </div>
        <div className="h-[calc(100%-20px)] overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

/** The ring and dot that say "tap here". */
function Tap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-[6px] outline outline-2 outline-offset-2 outline-[#F59E0B] ${className}`}>
      {children}
      <span className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full border-2 border-white bg-[#F59E0B]/90" />
    </div>
  );
}

function Url({ host }: { host: string }) {
  return (
    <div className="mx-2.5 mb-2 flex h-6 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 text-[9px] text-slate-600">
      <span className="h-2 w-2 rounded-[2px] border border-slate-500" />
      {host}
    </div>
  );
}

function AppIcon({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/lime-puzzle.webp"
      alt=""
      width={size}
      height={size}
      className="rounded-[8px] border border-slate-200 bg-white object-contain p-0.5"
      style={{ width: size, height: size }}
    />
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`flex h-[18px] w-8 items-center rounded-full px-0.5 ${on ? "justify-end bg-[#1A73E8]" : "justify-start bg-slate-300"}`}>
      <span className="h-3.5 w-3.5 rounded-full bg-white" />
    </span>
  );
}

function Caption({ lines }: { lines: string[] }) {
  return (
    <div className="hidden w-[150px] shrink-0 self-center pb-10 text-left sm:block">
      {lines.map((l, i) => (
        <p key={l} className={`text-[11.5px] leading-snug ${i === 0 ? "font-semibold text-slate-900" : "mt-1 text-slate-600"}`}>
          {l}
        </p>
      ))}
    </div>
  );
}

export function InviteShot() {
  return (
    <Shot file="1-invite.png" side={<Caption lines={["Firebase invite page", "Enter the email you joined with, then submit."]} />}>
      <Url host="appdistribution.firebase.dev" />
      <div className="flex flex-col items-center px-4 pt-3 text-center">
        <AppIcon size={44} />
        <p className="mt-2 text-[13px] font-semibold text-slate-900">MyPA</p>
        <p className="mt-0.5 text-[9.5px] leading-snug text-slate-500">You’ve been invited to test this app</p>
        <div className="mt-4 w-full text-left">
          <p className="mb-1 text-[8.5px] font-medium text-slate-600">Email</p>
          <div className="flex h-7 items-center rounded-[4px] border border-slate-300 px-2 text-[10px] text-slate-900">
            you@gmail.com
          </div>
        </div>
        <Tap className="mt-3 w-full">
          <div className="flex h-7 items-center justify-center rounded-[4px] text-[10px] font-semibold text-white" style={{ background: BLUE }}>
            Submit
          </div>
        </Tap>
      </div>
    </Shot>
  );
}

export function AcceptShot() {
  return (
    <Shot file="2-accept.png" side={<Caption lines={["Sign in with Google", "Pick the account you’ll also use in App Tester."]} />}>
      <Url host="accounts.google.com" />
      <div className="px-4 pt-2">
        <p className="text-[15px] font-bold">
          <span style={{ color: "#4285F4" }}>G</span>
          <span style={{ color: "#EA4335" }}>o</span>
          <span style={{ color: "#FBBC05" }}>o</span>
          <span style={{ color: "#4285F4" }}>g</span>
          <span style={{ color: "#34A853" }}>l</span>
          <span style={{ color: "#EA4335" }}>e</span>
        </p>
        <p className="mt-2 text-[13px] font-medium text-slate-900">Choose an account</p>
        <p className="text-[9.5px] text-slate-500">to continue to Firebase App Distribution</p>
        <Tap className="mt-3">
          <div className="flex items-center gap-2 rounded-[4px] border border-slate-200 px-2 py-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-semibold text-white">Y</span>
            <div className="text-left">
              <p className="text-[10px] font-medium text-slate-900">Your Name</p>
              <p className="text-[9px] text-slate-500">you@gmail.com</p>
            </div>
          </div>
        </Tap>
        <div className="mt-2 flex items-center gap-2 px-2 py-2 text-[10px] text-slate-600">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-[11px]">+</span>
          Use another account
        </div>
      </div>
    </Shot>
  );
}

export function AppTesterShot() {
  return (
    <Shot file="3-app-tester.png" side={<Caption lines={["Install unknown apps", "Allow your browser once, then go back and tap Install."]} />}>
      <div className="px-3 pt-2">
        <p className="text-[9px] text-slate-500">← Settings</p>
        <p className="mt-1 text-[14px] font-medium text-slate-900">Install unknown apps</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-[conic-gradient(#EA4335_0_33%,#FBBC05_0_66%,#34A853_0)]">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-[#4285F4]" />
          </span>
          <div>
            <p className="text-[11px] font-medium text-slate-900">Chrome</p>
            <p className="text-[9px] text-slate-500">Version 130</p>
          </div>
        </div>
        <Tap className="mt-4">
          <div className="flex items-center justify-between rounded-[4px] bg-slate-50 px-2.5 py-2.5">
            <p className="text-[10.5px] font-medium text-slate-900">Allow from this source</p>
            <Toggle on />
          </div>
        </Tap>
        <p className="mt-3 text-[8.5px] leading-snug text-slate-500">
          Your phone and personal data are more vulnerable to attack by unknown apps.
        </p>
      </div>
    </Shot>
  );
}

export function DownloadShot() {
  return (
    <Shot file="4-download.png" side={<Caption lines={["Firebase App Tester", "Open MyPA, then tap Download."]} />}>
      <div className="flex items-center gap-2 bg-[#FFA000] px-3 py-2.5">
        <span className="h-4 w-3 rounded-[2px] bg-[#FFCA28]" />
        <p className="text-[12px] font-semibold text-white">App Tester</p>
      </div>
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2.5">
          <AppIcon size={38} />
          <div>
            <p className="text-[12px] font-semibold text-slate-900">MyPA</p>
            <p className="text-[9px] text-slate-500">com.mypa.app · Android</p>
          </div>
        </div>
        <div className="mt-3 rounded-[4px] border border-slate-200 p-2.5">
          <p className="text-[10px] font-medium text-slate-900">Latest release</p>
          <p className="text-[9px] text-slate-500">Shared with you · Internal Testers</p>
          <Tap className="mt-2.5">
            <div className="flex h-7 items-center justify-center rounded-[4px] text-[10px] font-semibold text-white" style={{ background: BLUE }}>
              Download
            </div>
          </Tap>
        </div>
      </div>
    </Shot>
  );
}

export function InstallShot() {
  return (
    <Shot file="5-install.png" side={<Caption lines={["Install", "If Play Protect asks, Scan app is the safe choice."]} />}>
      <div className="relative h-full bg-slate-900/45 px-3 pt-10">
        <div className="rounded-[8px] bg-white p-3.5">
          <div className="flex items-center gap-2">
            <AppIcon size={28} />
            <p className="text-[12px] font-semibold text-slate-900">MyPA</p>
          </div>
          <p className="mt-2.5 text-[10.5px] text-slate-700">Do you want to install this app?</p>
          <div className="mt-4 flex items-center justify-end gap-4 text-[10.5px] font-semibold" style={{ color: BLUE }}>
            <span>Cancel</span>
            <Tap>
              <span className="block px-2 py-1">Install</span>
            </Tap>
          </div>
        </div>
      </div>
    </Shot>
  );
}

export function SamsungShot() {
  return (
    <Shot
      file="samsung-auto-blocker.png"
      side={<Caption lines={["Samsung only", "Settings › Security and privacy › Auto Blocker"]} />}
    >
      <div className="bg-[#F6F6F6] px-3 pb-6 pt-3">
        <p className="text-[9px] text-slate-500">‹ Security and privacy</p>
        <p className="mt-2 text-[17px] font-semibold text-slate-900">Auto Blocker</p>
        <Tap className="mt-3">
          <div className="flex items-center justify-between rounded-[14px] bg-white px-3 py-3">
            <p className="text-[12px] font-semibold text-slate-900">Off</p>
            <Toggle on={false} />
          </div>
        </Tap>
        <p className="mt-3 px-1 text-[8.5px] leading-snug text-slate-500">
          Auto Blocker blocks apps from unauthorized sources. Turn it back on after MyPA is installed.
        </p>
      </div>
    </Shot>
  );
}

export const SHOTS: Record<string, () => ReactNode> = {
  "1-invite.png": InviteShot,
  "2-accept.png": AcceptShot,
  "samsung-auto-blocker.png": SamsungShot,
  "3-app-tester.png": AppTesterShot,
  "4-download.png": DownloadShot,
  "5-install.png": InstallShot,
};
