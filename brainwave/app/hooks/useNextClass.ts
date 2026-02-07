import { useMemo } from "react";

function parseStartDate(item: any) {
  const raw = item.time || item.start;
  if (!raw) return null;

  const date = new Date(raw);
  return isNaN(date.getTime()) ? null : date;
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
    if (!schedule?.length) {
      return { nextClass: null, countdown: null };
    }

    const now = new Date();

    const upcoming = schedule
      .map((item) => {
        const startDate = parseStartDate(item);
        if (!startDate) return null;
        return { ...item, startDate };
      })
      .filter(Boolean)
      .filter((item: any) => item.startDate > now)
      .sort((a: any, b: any) => a.startDate.getTime() - b.startDate.getTime());

    if (!upcoming.length) {
      return { nextClass: null, countdown: null };
    }

    const next = upcoming[0];

    return {
      nextClass: next,
      countdown: formatCountdown(next.startDate),
    };
  }, [schedule]);
}
