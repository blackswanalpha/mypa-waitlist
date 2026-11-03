import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isPossiblePhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";
import metadata from "libphonenumber-js/min/metadata";

import { TIMEZONE_REGION } from "./timezones";

export type { CountryCode };
export type Country = { code: CountryCode; name: string; dial: string; search: string };

/** Where a visitor lands when neither their timezone nor their locale names a region. */
export const FALLBACK_REGION: CountryCode = "KE";

// Names people type that Intl.DisplayNames does not use.
const ALIASES: Partial<Record<CountryCode, string>> = {
  GB: "uk united kingdom england scotland wales britain",
  US: "usa united states america",
  AE: "uae emirates",
  CD: "drc congo kinshasa",
  CG: "congo brazzaville",
  CI: "ivory coast",
  CZ: "czech republic",
  NL: "holland",
  KR: "korea",
  MM: "burma",
  VA: "vatican",
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

let all: Country[] | null = null;
let byCode: Map<string, Country> | null = null;

/** Every region libphonenumber-js can dial, sorted by English name. */
export function countries(): Country[] {
  if (all) return all;
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  all = getCountries()
    .map((code) => {
      const name = names.of(code) ?? code;
      return { code, name, dial: getCountryCallingCode(code), search: fold(`${name} ${ALIASES[code] ?? ""}`) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  byCode = new Map(all.map((c) => [c.code, c]));
  return all;
}

export function country(code: CountryCode): Country {
  countries();
  return byCode!.get(code)!;
}

/**
 * Filters the list for the picker's search box. A query of digits matches dial
 * codes ("254", "+254"), a two-letter query also matches the ISO code, and a
 * name matches from the start of any word before it matches anywhere.
 */
export function searchCountries(query: string): Country[] {
  const list = countries();
  const q = fold(query.trim());
  if (!q) return list;
  const digits = q.replace(/^\+/, "");
  if (/^\d+$/.test(digits)) {
    // Shortest code first, and within a shared code its main country first (+1 is the US).
    const main = (c: Country) => Number(MAIN[c.dial]?.[0] !== c.code);
    return list.filter((c) => c.dial.startsWith(digits)).sort((a, b) => a.dial.length - b.dial.length || main(a) - main(b));
  }
  const rank = (c: Country) => {
    if (c.code.toLowerCase() === q) return 0;
    if (c.search.startsWith(q)) return 1;
    if (c.search.includes(` ${q}`) || c.search.includes(`-${q}`) || c.search.includes(`(${q}`)) return 2;
    if (c.search.includes(q)) return 3;
    return -1;
  };
  return list
    .map((c) => [c, rank(c)] as const)
    .filter(([, r]) => r >= 0)
    .sort((a, b) => a[1] - b[1])
    .map(([c]) => c);
}

let guessed: CountryCode | null = null;

/** The visitor's region from their timezone, then their locale's region, then Kenya. Client only. */
export function detectRegion(): CountryCode {
  if (guessed) return guessed;
  const known = new Set<string>(getCountries());
  let found: string | undefined;
  try {
    found = TIMEZONE_REGION[Intl.DateTimeFormat().resolvedOptions().timeZone];
  } catch {}
  if (!found || !known.has(found)) {
    found = undefined;
    for (const tag of navigator.languages ?? [navigator.language]) {
      try {
        const region = new Intl.Locale(tag).region;
        if (region && known.has(region)) {
          found = region;
          break;
        }
      } catch {}
    }
  }
  guessed = (found as CountryCode | undefined) ?? FALLBACK_REGION;
  return guessed;
}

const MAIN = metadata.country_calling_codes as Record<string, CountryCode[]>;

/**
 * Reads what was typed into the number box. Digits stay digits; a leading "+"
 * or "00" starts an international number, and as soon as its calling code is
 * known the region moves to the picker (keeping the current one when it shares
 * that code, so Canada stays Canada on "+1") and the box keeps the rest.
 */
export function readInput(raw: string, region: CountryCode): { digits: string; region: CountryCode } {
  const trimmed = raw.trim();
  const international = trimmed.startsWith("+") || trimmed.replace(/\D/g, "").startsWith("00");
  const digits = trimmed.replace(/\D/g, "");
  if (!international) return { digits, region };
  const intl = trimmed.startsWith("+") ? digits : digits.slice(2);
  const typed = new AsYouType();
  typed.input(`+${intl}`);
  const code = typed.getCallingCode();
  if (!code) return { digits: `+${intl}`, region };
  const next =
    getCountryCallingCode(region) === code ? region : (typed.getCountry() ?? MAIN[code]?.[0] ?? region);
  return { digits: intl.slice(code.length), region: next };
}

/** The number box's text for these digits: national grouping where the region has one, else its international grouping without the code. */
export function formatDigits(digits: string, region: CountryCode): string {
  if (!digits || digits.startsWith("+")) return digits;
  const national = new AsYouType(region).input(digits);
  if (/\D/.test(national) || digits.length < 4) return national;
  const code = getCountryCallingCode(region);
  const intl = new AsYouType().input(`+${code}${digits}`);
  return intl.startsWith(`+${code}`) ? intl.slice(code.length + 1).trimStart() : digits;
}

export function isPossible(digits: string, region: CountryCode): boolean {
  return digits.startsWith("+") ? isPossiblePhoneNumber(digits) : isPossiblePhoneNumber(digits, region);
}

/** "+254 712 345678" — what the server stores. Undefined for an empty or unreadable number. */
export function toInternational(digits: string, region: CountryCode): string | undefined {
  if (!digits || digits === "+") return undefined;
  const parsed = digits.startsWith("+")
    ? parsePhoneNumberFromString(digits)
    : parsePhoneNumberFromString(digits, region);
  return parsed?.formatInternational();
}
