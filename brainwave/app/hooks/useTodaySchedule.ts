import { useEffect, useState } from "react";
import { sortTasksByTime } from "@/utils/notifications";

export function useTodaySchedule(
  plans: any[] = [],
  timetables: any[] = [],
  userId?: string,
  isLoading?: boolean,
) {
  const [schedule, setSchedule] = useState<any[]>([]);

  useEffect(() => {
    if (!userId || isLoading) return;

    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const now = new Date();
    const todayName = days[now.getDay()];
    const offset = now.getTimezoneOffset() * 60000;
    const todayISO = new Date(now.getTime() - offset)
      .toISOString()
      .split("T")[0];

    // 1. Check for AI-generated plan for today in LocalDB/Supabase
    const todaysPlan = plans.find((p) => {
      if (!p) return false;
      return (
        p.id === todayISO ||
        p.date === todayISO ||
        p.date?.split("T")[0] === todayISO
      );
    });

    if (todaysPlan?.tasks?.length > 0) {
      const sorted = sortTasksByTime(
        todaysPlan.tasks.map((t: any) => ({ ...t, isAiGenerated: true })),
      );
      setSchedule(sorted);
      return;
    }

    // 2. Fallback to weekly timetable from LocalDB
    if (timetables.length === 0) {
      setSchedule([]);
      return;
    }

    // Use most recently uploaded timetable
    const latestTimetable = timetables[0];
    const weeklyTemplate = latestTimetable?.structuredData || {};
    const dayData = weeklyTemplate[todayName.toLowerCase()] || [];

    if (dayData.length > 0) {
      const sorted = sortTasksByTime(
        dayData.map((c: any) => ({ ...c, isAiGenerated: false })),
      );
      setSchedule(sorted);
    } else {
      setSchedule([]);
    }
  }, [plans, timetables, userId, isLoading]);

  return schedule;
}
