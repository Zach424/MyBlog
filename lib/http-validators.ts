import { createHash } from "node:crypto";

export const PUBLIC_CONDITIONAL_CACHE_CONTROL =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

const ENTITY_TAG = /^(?:W\/)?"[\x21\x23-\x7e\x80-\xff]*"$/u;
const IMF_FIXDATE =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/u;
const RFC850_DATE =
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT$/u;
const ASCTIME_DATE =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}| \d) (\d{2}):(\d{2}):(\d{2}) (\d{4})$/u;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const LONG_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

interface DateParts {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  weekday: number;
  year: number;
}

interface ConditionalResponseOptions {
  lastModified?: string;
}

function monthIndex(value: string) {
  return MONTHS.indexOf(value as (typeof MONTHS)[number]);
}

function daysInMonth(year: number, month: number) {
  if (month === 1) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }
  return [3, 5, 8, 10].includes(month) ? 30 : 31;
}

function timestampFromParts(parts: DateParts) {
  if (
    parts.month < 0 ||
    parts.day < 1 ||
    parts.day > daysInMonth(parts.year, parts.month) ||
    parts.hour > 23 ||
    parts.minute > 59 ||
    parts.second > 60
  ) {
    return undefined;
  }

  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month, parts.day);
  date.setUTCHours(parts.hour, parts.minute, Math.min(parts.second, 59), 0);
  if (date.getUTCDay() !== parts.weekday) return undefined;

  return date.getTime() + (parts.second === 60 ? 1_000 : 0);
}

function parseHttpDate(value: string) {
  const imf = value.match(IMF_FIXDATE);
  if (imf) {
    return timestampFromParts({
      weekday: SHORT_WEEKDAYS.indexOf(imf[1] as (typeof SHORT_WEEKDAYS)[number]),
      day: Number(imf[2]),
      month: monthIndex(imf[3]),
      year: Number(imf[4]),
      hour: Number(imf[5]),
      minute: Number(imf[6]),
      second: Number(imf[7]),
    });
  }

  const rfc850 = value.match(RFC850_DATE);
  if (rfc850) {
    const currentYear = new Date().getUTCFullYear();
    let year = Math.floor(currentYear / 100) * 100 + Number(rfc850[4]);
    if (year - currentYear > 50) year -= 100;
    return timestampFromParts({
      weekday: LONG_WEEKDAYS.indexOf(
        rfc850[1] as (typeof LONG_WEEKDAYS)[number],
      ),
      day: Number(rfc850[2]),
      month: monthIndex(rfc850[3]),
      year,
      hour: Number(rfc850[5]),
      minute: Number(rfc850[6]),
      second: Number(rfc850[7]),
    });
  }

  const asctime = value.match(ASCTIME_DATE);
  if (asctime) {
    return timestampFromParts({
      weekday: SHORT_WEEKDAYS.indexOf(
        asctime[1] as (typeof SHORT_WEEKDAYS)[number],
      ),
      day: Number(asctime[3].trim()),
      month: monthIndex(asctime[2]),
      year: Number(asctime[7]),
      hour: Number(asctime[4]),
      minute: Number(asctime[5]),
      second: Number(asctime[6]),
    });
  }

  return undefined;
}

function normalizeLastModified(value: string) {
  const timestamp = parseHttpDate(value);
  if (timestamp === undefined || new Date(timestamp).toUTCString() !== value) {
    throw new TypeError("lastModified must be a canonical IMF-fixdate");
  }
  if (timestamp > Date.now()) {
    throw new RangeError("lastModified cannot be in the future");
  }
  return { timestamp, value };
}

function parseEntityTagList(value: string) {
  const tags: string[] = [];
  let start = 0;
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      tags.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (quoted) return undefined;
  tags.push(value.slice(start).trim());
  return tags.length > 0 && tags.every((tag) => ENTITY_TAG.test(tag))
    ? tags
    : undefined;
}

export function createSha256Etag(body: string) {
  return `"sha256-${createHash("sha256").update(body, "utf8").digest("hex")}"`;
}

export function matchesIfNoneMatch(value: string | null, etag: string) {
  if (value === null) return false;
  const normalized = value.trim();
  if (normalized === "*") return true;
  const tags = parseEntityTagList(normalized);
  const expected = etag.replace(/^W\//u, "");
  return tags?.some((tag) => tag.replace(/^W\//u, "") === expected) ?? false;
}

export function matchesIfModifiedSince(
  value: string | null,
  lastModifiedTimestamp: number,
) {
  if (value === null) return false;
  const timestamp = parseHttpDate(value);
  return timestamp !== undefined && lastModifiedTimestamp <= timestamp;
}

export function createSha256ConditionalResponse(
  request: Request,
  body: string,
  headersInit: HeadersInit,
  options: ConditionalResponseOptions = {},
) {
  const etag = createSha256Etag(body);
  const headers = new Headers(headersInit);
  headers.set("etag", etag);
  const lastModified = options.lastModified
    ? normalizeLastModified(options.lastModified)
    : undefined;
  if (lastModified) headers.set("last-modified", lastModified.value);

  const ifNoneMatch = request.headers.get("if-none-match");
  const notModified =
    ifNoneMatch !== null
      ? matchesIfNoneMatch(ifNoneMatch, etag)
      : lastModified !== undefined &&
        (request.method === "GET" || request.method === "HEAD") &&
        matchesIfModifiedSince(
          request.headers.get("if-modified-since"),
          lastModified.timestamp,
        );

  return notModified
    ? new Response(null, { status: 304, headers })
    : new Response(body, { headers });
}
