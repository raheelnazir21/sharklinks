/**
 * dateUtils.ts — Dynamic Client-side Hybrid Timezone Utility.
 * Converts server-side UTC timestamps (including timezone-naive strings) into 
 * timezone-aware local Date objects matching the user's active geographic timezone 
 * (e.g. China Standard Time, Pakistan Standard Time, etc.).
 */

export function parseLocalValue(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  let dateStr = value.trim();
  
  // If it is a date-time string containing separator '-' and ':' but lacking UTC/offset designators,
  // we append 'Z' to tell the browser JS engine it is UTC time, preventing it from being treated as local time.
  if (
    dateStr.includes("-") && 
    dateStr.includes(":") &&
    !dateStr.endsWith("Z") && 
    !dateStr.includes("+") && 
    !/-\d{2}:\d{2}$/.test(dateStr) // checks if it already has timezone offset like -05:00
  ) {
    // Replace space separator with standard ISO 'T'
    dateStr = dateStr.replace(" ", "T");
    dateStr = `${dateStr}Z`;
  }
  
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a timestamp dynamically to the user's local timezone (e.g. Nov 29, 2026, 7:00 PM).
 */
export function formatLocalDateTime(value?: string | Date | null): string {
  if (!value) return "No Date";
  const dateObj = parseLocalValue(value);
  if (!dateObj) return "Invalid Date";
  
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(dateObj);
}

/**
 * Returns a human-readable relative time string (e.g., "3 minutes ago", "2 hours ago")
 * based on the user's active local timezone.
 */
export function formatRelativeTime(value?: string | Date | null): string {
  if (!value) return "Just now";
  const dateObj = parseLocalValue(value);
  if (!dateObj) return "Just now";
  
  const diff = Date.now() - dateObj.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
