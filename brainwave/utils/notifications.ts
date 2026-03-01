import * as Notifications from "expo-notifications";

export function parseStartDate(item: any) {
  const raw = item.time || item.start;
  if (!raw) return null;

  const startTimeStr = raw.split("-")[0].trim();
  const now = new Date();

  try {
    // Matches HH:mm, H:mm, HH:mm AM/PM, etc.
    const timeMatch = startTimeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (!timeMatch) return null;

    let [, hourStr, minStr, modifier] = timeMatch;
    let hours = parseInt(hourStr, 10);
    const minutes = parseInt(minStr, 10);

    if (modifier) {
      if (modifier.toLowerCase() === "pm" && hours < 12) hours += 12;
      if (modifier.toLowerCase() === "am" && hours === 12) hours = 0;
    }

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
    console.log("parseStartDate error: ", e.message);
    return null;
  }
}

export function parseDurationMinutes(durationStr?: string): number {
  if (!durationStr) return 60; // Default 1 hour
  const match = durationStr.match(/(\d+)/);
  if (!match) return 60;
  const val = parseInt(match[1]);
  if (durationStr.toLowerCase().includes("hour")) return val * 60;
  return val;
}

export function formatTimeTo24h(timeStr: string): string {
  if (!timeStr) return "";
  // Check if it's a range like "09:00 - 10:00"
  if (timeStr.includes("-")) {
    return timeStr
      .split("-")
      .map((s) => formatTimeTo24h(s.trim()))
      .join(" - ");
  }

  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!match) return timeStr;

  let [, hourStr, minStr, modifier] = match;
  let hours = parseInt(hourStr, 10);
  const minutes = minStr;

  if (modifier) {
    if (modifier.toLowerCase() === "pm" && hours < 12) hours += 12;
    if (modifier.toLowerCase() === "am" && hours === 12) hours = 0;
  }

  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

export async function ensureNotificationPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    const res = await Notifications.requestPermissionsAsync();
    return res.status === "granted";
  }
  return true;
}

export async function scheduleDailyNotifications(
  schedule: any[],
  leadMinutes: number,
) {
  if (!schedule?.length) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();

  for (const item of schedule) {
    const startDate = parseStartDate(item);
    if (!startDate) continue;

    const triggerTime = new Date(startDate.getTime() - leadMinutes * 60 * 1000);

    // Only schedule if it's in the future
    if (triggerTime > now) {
      const taskName = item.task || item.subject || "Next activity";

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Upcoming activity",
          body: `${taskName} starts in ${leadMinutes} minutes`,
          sound: true,
          data: { taskId: item.id },
        },
        trigger: {
          type: "date",
          date: triggerTime,
        } as Notifications.DateTriggerInput,
      });
    }
  }
}

export async function scheduleNextClassNotification(
  classItem: any,
  leadMinutes: number,
) {
  if (!classItem) return;
  await scheduleDailyNotifications([classItem], leadMinutes);
}

export function sortTasksByTime(tasks: any[]) {
  return [...tasks].sort((a, b) => {
    const timeA = parseStartDate(a);
    const timeB = parseStartDate(b);

    if (!timeA) return 1;
    if (!timeB) return -1;

    return timeA.getTime() - timeB.getTime();
  });
}
