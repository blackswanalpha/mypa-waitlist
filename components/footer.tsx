const CONTACT_EMAIL = "myexecpersonalassistant@gmail.com";

export function Footer() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto max-w-7xl px-6 pt-14 lg:px-12">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Say hello
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-1 inline-block min-h-11 py-1.5 break-words text-xl font-medium tracking-[-0.02em] text-foreground underline decoration-border underline-offset-[6px] transition-colors hover:decoration-foreground md:text-2xl"
          >
            {/* Wrap at the @ on narrow screens, never mid-word. */}
            {CONTACT_EMAIL.split("@")[0]}@<wbr />
            {CONTACT_EMAIL.split("@")[1]}
          </a>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-border/70 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>&copy; {new Date().getFullYear()} MyPA. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
