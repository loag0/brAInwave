import { useMemo } from "react";

function parseStartDate(item: any) {
  const raw = item.time || item.start;
  if (!raw) return null;

  const startTimeStr = raw.split("-")[0].trim();
  const now = new Date();

  try {
    // Split "12:00 PM" or "12:00"
    let [time, modifier] = startTimeStr.split(" ");
    let [hours, minutes] = time.split(":").map((n: any) => parseInt(n, 10));

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

export function useNextClass(schedule: any[]) {
  return useMemo(() => {
    if (!schedule?.length) return { nextClass: null, countdown: null };

    const now = new Date();

    const upcoming = schedule
      .map((item) => {
        const startDate = parseStartDate(item);
        if (!startDate) return null;
        return { ...item, startDate };
      })
      .filter((item): item is any => item !== null)
      // Change: Include classes that started up to 10 mins ago
      // so you don't lose the "Current" class immediately.
      .filter((item) => {
        const fiftyMinutesAgo = new Date(now.getTime() - 50 * 60000);
        return item.startDate > fiftyMinutesAgo;
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    if (!upcoming.length) return { nextClass: null, countdown: null };

    const next = upcoming[0];

    // If the class has already started but is in our 10-min window
    const isOngoing = next.startDate <= now;

    return {
      nextClass: next,
      countdown: isOngoing ? "Started" : formatCountdown(next.startDate),
    };
  }, [schedule]);
}
