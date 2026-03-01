import { useMemo } from "react";
import { parseStartDate, parseDurationMinutes } from "@/utils/notifications";

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
