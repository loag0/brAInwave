import { useMemo } from "react";

function parseStartDate(item: any) {
  const raw = item.time || item.start;
  if (!raw) return null;

  const startTimeStr = raw.split("-")[0].trim();
  const now = new Date();

  try {
    // Extract time digits and AM/PM modifier robustly (e.g., "1:21PM" or "1:21 PM")
    const timeMatch = startTimeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (!timeMatch) return null;

    let [, hourStr, minStr, modifier] = timeMatch;
    let hours = parseInt(hourStr, 10);
    const minutes = parseInt(minStr, 10);

    // Handle AM/PM
    if (modifier?.toLowerCase() === "pm" && hours < 12) hours += 12;
    if (modifier?.toLowerCase() === "am" && hours === 12) hours = 0;

    // Create date based on LOCAL time, not UTC
    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes || 0,
      0,
    );

    return isNaN(target.getTime()) ? null : target;
  } catch (e: any) {
    console.log("useNextClass date error: ", e.message);
    return null;
  }
}

function formatCountdown(target: Date) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return "now";

  const hrs = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function parseDurationMinutes(durationStr?: string): number {
  if (!durationStr) return 60; // default 1 hour
  const str = durationStr.toLowerCase();
  let total = 0;

  const hrMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour)/);
  if (hrMatch) total += parseFloat(hrMatch[1]) * 60;

  const minMatch = str.match(/(\d+)\s*(?:min|m(?!o))/);
  if (minMatch) total += parseInt(minMatch[1], 10);

  return total > 0 ? total : 60;
}

export function useNextClass(schedule: any[]) {
  return useMemo(() => {
    if (!schedule?.length) return { nextClass: null, countdown: null };

    const now = new Date();

    const upcoming = schedule
      .map((item) => {
        const startDate = parseStartDate(item);
        if (!startDate) return null;

        const durationMins = parseDurationMinutes(item.duration);
        const endDate = new Date(startDate.getTime() + durationMins * 60000);

        return { ...item, startDate, endDate };
      })
      .filter((item): item is any => item !== null)
      // Only keep classes that haven't formally ended
      .filter((item) => {
        return item.endDate > now;
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    if (!upcoming.length) return { nextClass: null, countdown: null };

    const next = upcoming[0];

    // If the class has already started but hasn't ended yet
    const isOngoing = next.startDate <= now && next.endDate > now;

    return {
      nextClass: next,
      countdown: isOngoing ? "Started" : formatCountdown(next.startDate),
    };
  }, [schedule]);
}
