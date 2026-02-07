import { useEffect, useState } from "react";

export function useTodaySchedule(
  plans: any[],
  timetables: any[],
  userId?: string,
  isLoading?: boolean,
) {
  const [schedule, setSchedule] = useState<any[]>([]);

  useEffect(() => {
    if (!userId || isLoading) return;

    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];

    const jsDay = new Date().getDay();
    const shiftedIndex = jsDay === 0 ? 6 : jsDay - 1;
    const todayName = days[shiftedIndex];
    const todayISO = new Date().toISOString().split("T")[0];

    // 1️⃣ prefer AI plan
    const todaysPlan = plans.find(
      (p) => p.date === todayISO || p.id === todayISO,
    );

    if (todaysPlan?.tasks?.length) {
      setSchedule(todaysPlan.tasks);
      return;
    }

    // 2️⃣ fallback to timetable
    const activeTimetable = timetables[0];
    if (activeTimetable?.structuredData?.[todayName]) {
      setSchedule(activeTimetable.structuredData[todayName]);
    } else {
      setSchedule([]);
    }
  }, [plans, timetables, userId, isLoading]);

  return schedule;
}
