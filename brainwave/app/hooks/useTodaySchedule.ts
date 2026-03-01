import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db as firestore } from "../../firebaseConfig";

export function useTodaySchedule(
  plans: any[] = [],
  timetables: any[] = [],
  userId?: string,
  isLoading?: boolean,
) {
  const [schedule, setSchedule] = useState<any[]>([]);

  useEffect(() => {
    if (!userId || isLoading) {
      console.log("Waiting for auth/loading...");
      return;
    }

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

    console.log("Checking schedule for:", todayISO);

    // --- 1️⃣ check AI-generated plan for today ---
    const todaysPlan = plans.find((p) => {
      if (!p) return false;
      return (
        p.id === todayISO ||
        p.date === todayISO ||
        p.date?.split("T")[0] === todayISO
      );
    });

    if (todaysPlan?.tasks?.length > 0) {
      setSchedule(
        todaysPlan.tasks.map((t: any) => ({ ...t, isAiGenerated: true })),
      );
      return;
    }

    // --- 2️⃣ fallback to weekly timetable from Firestore ---
    if (timetables.length === 0) {
      console.log("No timetables available in LocalDB");
      setSchedule([]);
      return;
    }

    const unsubTimetable = onSnapshot(
      doc(firestore, "users", userId, "data", "timetable"),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const weeklyTemplate = data.weekly_template || {};
          const dayData = weeklyTemplate[todayName.toLowerCase()] || [];

          if (dayData.length > 0) {
            console.log("Fallback success: Found timetable for", todayName);
            setSchedule(
              dayData.map((c: any) => ({ ...c, isAiGenerated: false })),
            );
          } else {
            console.log("No plan and no timetable entry for today");
            setSchedule([]);
          }
        } else {
          console.log("Timetable document not found in Firestore");
          setSchedule([]);
        }
      },
      (error) => {
        console.error("Timetable fetch error: ", error);
        setSchedule([]);
      },
    );

    return () => unsubTimetable();
  }, [plans, timetables, userId, isLoading]);

  return schedule;
}
