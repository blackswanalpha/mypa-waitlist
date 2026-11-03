"use client";

import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Popover } from "radix-ui";
import { Check, ChevronDown, Search, X } from "lucide-react";

import {
  FALLBACK_REGION,
  country,
  detectRegion,
  formatDigits,
  readInput,
  searchCountries,
  type CountryCode,
} from "@/lib/phone/countries";
import { cn } from "@/lib/utils";

const noop = () => () => {};
const MAX_DIGITS = 15; // E.164

/** A 3:2 flag from public/flags, on a muted tile so a slow load never shows a hole. */
function Flag({ code, eager }: { code: CountryCode; eager?: boolean }) {
  return (
    // The hairline is an outline, not a ring: the page carries no box-shadows.
    <span className="relative inline-block h-3.5 w-[21px] shrink-0 overflow-hidden rounded-[2px] bg-muted outline -outline-offset-1 outline-black/10">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVGs; next/image adds nothing here */}
      <img
        src={`/flags/${code}.svg`}
        alt=""
        width={21}
        height={14}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </span>
  );
}

/** Puts the caret after the nth digit of the formatted text. */
function caretAfter(text: string, n: number) {
  if (n <= 0) return text.startsWith("+") ? 1 : 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i]) && ++seen === n) return i + 1;
  }
  return text.length;
}

/**
 * The phone number as one control: the country's flag and dial code on the
 * left, which opens a searchable list, and the number on the right, grouped as
 * it is typed. Pasting or autofilling "+44 7700 900123" moves the code into the
 * picker. Until the visitor picks, the country is a guess from their timezone.
 */
export function PhoneField({
  digits,
  picked,
  onDigits,
  onPick,
  onBlur,
  inputRef,
  invalid,
  describedBy,
  listening,
}: {
  digits: string;
  picked: CountryCode | "";
  onDigits: (digits: string) => void;
  onPick: (code: CountryCode) => void;
  onBlur?: () => void;
  inputRef?: (el: HTMLInputElement | null) => void;
  invalid?: boolean;
  describedBy?: string;
  listening: { onFocus: () => void; onInput: () => void };
}) {
  const detected = useSyncExternalStore(noop, detectRegion, () => null);
  const ready = !!(picked || detected);
  const region = (picked || detected || FALLBACK_REGION) as CountryCode;
  const current = country(region);
  const display = formatDigits(digits, region);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchCountries(query), [query]);

  const number = useRef<HTMLInputElement | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const caret = useRef<number | null>(null);
  const toNumber = useRef(false);
  const setNumber = useCallback(
    (el: HTMLInputElement | null) => {
      number.current = el;
      inputRef?.(el);
    },
    [inputRef],
  );
  const listId = useId();

  // Restore the caret after the number is regrouped.
  useLayoutEffect(() => {
    if (caret.current === null || !number.current) return;
    number.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [display]);

  const keepInView = (index: number, center = false) => {
    const box = list.current;
    const row = box?.children[index] as HTMLElement | undefined;
    if (!box || !row) return;
    if (center) {
      box.scrollTop = row.offsetTop - box.clientHeight / 2 + row.offsetHeight / 2;
    } else if (row.offsetTop < box.scrollTop) {
      box.scrollTop = row.offsetTop - 4;
    } else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight + 4;
    }
  };

  const move = (index: number) => {
    const next = Math.max(0, Math.min(results.length - 1, index));
    setActive(next);
    keepInView(next);
  };

  const choose = (code: CountryCode) => {
    onPick(code);
    toNumber.current = true;
    setOpen(false);
    // Focus now, not after the exit animation, so a fast typist's next digits land in the number.
    number.current?.focus();
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    let raw = el.value;
    const at = el.selectionStart ?? raw.length;
    let before = raw.slice(0, at).replace(/\D/g, "").length;

    // Deleting a space or bracket the grouping added deletes the digit beside it instead.
    const kind = (e.nativeEvent as InputEvent).inputType;
    const plain = raw.replace(/\D/g, "");
    if (kind?.startsWith("delete") && plain === display.replace(/\D/g, "") && raw.length < display.length) {
      const drop = kind === "deleteContentForward" ? before : before - 1;
      if (drop >= 0) {
        const kept = plain.slice(0, drop) + plain.slice(drop + 1);
        raw = raw.startsWith("+") ? `+${kept}` : kept;
        before = drop;
      }
    }

    const read = readInput(raw, region);
    const capped = read.digits.startsWith("+")
      ? `+${read.digits.slice(1, MAX_DIGITS + 1)}`
      : read.digits.slice(0, MAX_DIGITS);
    if (read.region !== region) onPick(read.region);
    const text = formatDigits(capped, read.region);
    caret.current = read.region !== region ? text.length : caretAfter(text, before);
    onDigits(capped);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setQuery("");
          setActive(Math.max(0, searchCountries("").findIndex((c) => c.code === region)));
          listening.onInput();
        }
        setOpen(next);
      }}
    >
      <Popover.Anchor asChild>
        <div
          data-open={open || undefined}
          className={cn(
            "flex h-12 w-full min-w-0 items-center rounded-[8px] border bg-background",
            "transition-[border-color,box-shadow] duration-200 ease-out",
            "focus-within:border-foreground/60 focus-within:ring-4 focus-within:ring-secondary",
            "data-open:border-foreground/60 data-open:ring-4 data-open:ring-secondary",
            invalid ? "border-destructive/60" : "border-input hover:border-foreground/30",
          )}
        >
          <Popover.Trigger
            type="button"
            aria-label={ready ? `Country code: ${current.name}, +${current.dial}` : "Country code"}
            className={cn(
              // 44px to touch, a 40px tint to see.
              "group relative isolate ml-1 flex h-11 shrink-0 items-center gap-1.5 pr-1.5 pl-2 text-[15px] text-foreground outline-none",
              "before:absolute before:inset-x-0 before:inset-y-0.5 before:-z-10 before:rounded-[5px] before:transition-colors before:duration-150 before:ease-out",
              "hover:before:bg-secondary focus-visible:before:bg-secondary data-[state=open]:before:bg-secondary",
            )}
          >
            <span
              className={cn(
                "flex items-center gap-2 transition-opacity duration-200 ease-out",
                ready ? "opacity-100" : "opacity-0",
              )}
            >
              <Flag code={region} eager />
              <span className="tabular-nums">+{current.dial}</span>
            </span>
            <ChevronDown
              className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
              strokeWidth={2}
              aria-hidden
            />
          </Popover.Trigger>
          <span aria-hidden className="ml-1 h-5 w-px shrink-0 bg-input" />
          <input
            ref={setNumber}
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Phone (optional)"
            value={display}
            onChange={onChange}
            onBlur={onBlur}
            onFocus={listening.onFocus}
            onInput={listening.onInput}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className="h-full min-w-0 flex-1 bg-transparent pr-4 pl-3 text-[15px] text-foreground tabular-nums outline-none placeholder:text-muted-foreground"
          />
        </div>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const content = e.currentTarget as HTMLElement | null;
            content?.querySelector("input")?.focus({ preventScroll: true });
            requestAnimationFrame(() => keepInView(active, true));
          }}
          onCloseAutoFocus={(e) => {
            if (!toNumber.current) return;
            e.preventDefault();
            toNumber.current = false;
            number.current?.focus();
          }}
          className={cn(
            "z-50 flex w-[max(var(--radix-popover-trigger-width),20rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden",
            // The page carries no shadows; the panel separates on its border alone.
            "rounded-[12px] border border-input bg-popover text-popover-foreground",
            "origin-(--radix-popover-content-transform-origin) duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-100",
            "motion-reduce:animate-none",
          )}
        >
          <div className="relative flex h-11 shrink-0 items-center border-b border-border">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
            <input
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={results[active] ? `${listId}-${results[active].code}` : undefined}
              aria-label="Search countries"
              placeholder="Search country or code"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                if (list.current) list.current.scrollTop = 0;
              }}
              onInput={listening.onInput}
              onKeyDown={(e) => {
                const step = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 }[e.key];
                if (step) {
                  e.preventDefault();
                  move(active + step);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (results[active]) choose(results[active].code);
                }
              }}
              className="h-full w-full bg-transparent pr-10 pl-10 text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={(e) => {
                  setQuery("");
                  setActive(0);
                  (e.currentTarget.previousElementSibling as HTMLInputElement | null)?.focus();
                }}
                className="absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-[6px] text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>

          {results.length ? (
            <ul
              ref={list}
              id={listId}
              role="listbox"
              aria-label="Countries"
              className="max-h-[min(18rem,calc(var(--radix-popover-content-available-height)-3rem))] overflow-y-auto overscroll-contain p-1"
            >
              {results.map((c, i) => {
                const selected = c.code === region;
                return (
                  <li
                    key={c.code}
                    id={`${listId}-${c.code}`}
                    role="option"
                    aria-selected={selected}
                    data-active={i === active || undefined}
                    onPointerMove={() => i !== active && setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(c.code)}
                    className={cn(
                      "flex h-10 cursor-pointer items-center gap-3 rounded-[8px] px-2.5 text-[14px] select-none",
                      "data-active:bg-secondary",
                      selected ? "font-medium text-foreground" : "text-foreground/90",
                    )}
                  >
                    <Flag code={c.code} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="text-[13px] font-normal text-muted-foreground tabular-nums">+{c.dial}</span>
                    <Check
                      className={cn("h-4 w-4 shrink-0 text-foreground", selected ? "opacity-100" : "opacity-0")}
                      strokeWidth={2.25}
                      aria-hidden
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              No country matches “{query.trim()}”
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
