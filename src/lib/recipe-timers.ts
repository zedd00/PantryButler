/**
 * Detect a duration (in minutes) mentioned in a cooking instruction.
 * Supports "25 minutes", "25-30 minutes", "25 to 30 minutes", hours and seconds,
 * e.g. "1 hour 15 minutes". Returns the largest duration found, or 0 if none.
 */
export function detectTimerMinutes(instruction: string): number {
  if (!instruction) return 0;

  const pattern = /(\d+(?:\.\d+)?)\s*(?:[-–—]\s*(\d+(?:\.\d+)?)\s*|\bto\s+(\d+(?:\.\d+)?)\s*)?(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;
  const matches = [...instruction.matchAll(pattern)];
  if (matches.length === 0) return 0;

  let best = 0;
  for (const m of matches) {
    const first = parseFloat(m[1]);
    const second = m[2] ? parseFloat(m[2]) : m[3] ? parseFloat(m[3]) : first;
    const value = Math.min(first, second);
    const unit = (m[4] || '').toLowerCase();
    let minutes = 0;
    if (unit.startsWith('hour')) minutes = value * 60;
    else if (unit.startsWith('min')) minutes = value;
    else minutes = Math.ceil(value / 60);
    best = Math.max(best, minutes);
  }
  return best;
}
