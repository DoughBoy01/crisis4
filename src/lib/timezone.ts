export const TIMEZONE_OPTIONS = [
  { value: "Europe/London", label: "London", offset: "GMT+0/+1" },
  { value: "Europe/Paris", label: "Paris / Berlin", offset: "GMT+1/+2" },
  { value: "America/New_York", label: "New York", offset: "GMT-5/-4" },
  { value: "America/Chicago", label: "Chicago", offset: "GMT-6/-5" },
  { value: "America/Denver", label: "Denver", offset: "GMT-7/-6" },
  { value: "America/Los_Angeles", label: "Los Angeles", offset: "GMT-8/-7" },
  { value: "America/Toronto", label: "Toronto", offset: "GMT-5/-4" },
  { value: "Asia/Dubai", label: "Dubai", offset: "GMT+4" },
  { value: "Asia/Kolkata", label: "Mumbai / Delhi", offset: "GMT+5:30" },
  { value: "Asia/Singapore", label: "Singapore", offset: "GMT+8" },
  { value: "Asia/Tokyo", label: "Tokyo", offset: "GMT+9" },
  { value: "Australia/Sydney", label: "Sydney", offset: "GMT+10/+11" },
  { value: "Pacific/Auckland", label: "Auckland", offset: "GMT+12/+13" },
] as const;

export type TimezoneValue = (typeof TIMEZONE_OPTIONS)[number]["value"] | string;

export function formatInTimezone(
  isoOrDate: string | Date | null | undefined,
  timezone: string,
  opts: Intl.DateTimeFormatOptions = {}
): string {
  if (!isoOrDate) return "";
  try {
    const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-GB", { timeZone: timezone, ...opts });
  } catch {
    return "";
  }
}

export function formatTimeInTz(
  isoOrDate: string | Date | null | undefined,
  timezone: string
): string {
  return formatInTimezone(isoOrDate, timezone, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDateTimeInTz(
  isoOrDate: string | Date | null | undefined,
  timezone: string
): string {
  return formatInTimezone(isoOrDate, timezone, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function getTzAbbreviation(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find(p => p.type === "timeZoneName")?.value ?? timezone;
  } catch {
    return timezone;
  }
}

export function getCurrentTimeInTz(timezone: string): string {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function getCurrentDateInTz(timezone: string): string {
  return new Date().toLocaleDateString("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function convertGmtTimeStringToTz(
  gmtTimeStr: string,
  timezone: string
): string {
  try {
    const clean = gmtTimeStr.replace(/\s*GMT\s*/, "").trim();
    const [h, m] = clean.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return gmtTimeStr;
    const now = new Date();
    const gmtDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0)
    );
    const tzAbbr = getTzAbbreviation(timezone);
    const localTime = formatTimeInTz(gmtDate, timezone);
    return `${localTime} ${tzAbbr}`;
  } catch {
    return gmtTimeStr;
  }
}

export function getTimezoneLabel(value: string): string {
  const found = TIMEZONE_OPTIONS.find(t => t.value === value);
  return found ? `${found.label} (${found.offset})` : value;
}
