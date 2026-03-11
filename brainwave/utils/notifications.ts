import * as Notifications from "expo-notifications";
import { Linking } from "react-native";

// Notification Handler - taken from _layout.tsx
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function getNotificationPermissionStatus(): Promise<
  "granted" | "denied" | "undetermined"
> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as "granted" | "denied" | "undetermined";
}

//Requests notification permission from the OS.
export async function ensureNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;
  if (existingStatus === "denied") return false; // Can't prompt again on iOS

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// Opens the device's app settings page so the user can manually enable notifications
export function openAppSettings(): void {
  Linking.openSettings();
}

export function parseStartDate(item: any, referenceDate?: Date): Date | null {
  const raw = item.time || item.start;
  if (!raw) return null;
  const startTimeStr = raw.split("-")[0].trim();
  const base = referenceDate || new Date();

  try {
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
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
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
  if (!durationStr) return 60;
  const match = durationStr.match(/(\d+)/);
  if (!match) return 60;
  const val = parseInt(match[1]);
  const lower = durationStr.toLowerCase();
  if (lower.includes("hour")) return val * 60;
  if (lower.includes("min")) return val;
  return val;
}

export function formatTimeTo24h(timeStr: string): string {
  if (!timeStr) return "";

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

const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function getNextOccurrence(dayName: string, now: Date): Date {
  const targetDay = DAY_NAME_TO_INDEX[dayName.toLowerCase()];
  if (targetDay === undefined) return now;

  const result = new Date(now);
  const currentDay = now.getDay();
  let daysAhead = targetDay - currentDay;
  if (daysAhead < 0) daysAhead += 7;
  result.setDate(now.getDate() + daysAhead);
  return result;
}

export async function scheduleDailyNotifications(
  schedule: any[],
  leadMinutes: number,
): Promise<void> {
  if (!schedule?.length) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();

  for (const item of schedule) {
    const referenceDate = item.day
      ? getNextOccurrence(item.day, now)
      : new Date(now);

    const startDate = parseStartDate(item, referenceDate);
    if (!startDate) continue;

    const triggerTime = new Date(startDate.getTime() - leadMinutes * 60 * 1000);

    const effectiveTrigger =
      triggerTime <= now && item.day
        ? new Date(triggerTime.getTime() + 7 * 24 * 60 * 60 * 1000)
        : triggerTime;

    if (effectiveTrigger <= now) continue;

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
        date: effectiveTrigger,
      } as Notifications.DateTriggerInput,
    });
  }
}

export async function scheduleNextClassNotification(
  classItem: any,
  leadMinutes: number,
): Promise<void> {
  if (!classItem) return;
  await scheduleDailyNotifications([classItem], leadMinutes);
}

export function sortTasksByTime(tasks: any[]): any[] {
  return [...tasks].sort((a, b) => {
    const timeA = parseStartDate(a);
    const timeB = parseStartDate(b);
    if (!timeA) return 1;
    if (!timeB) return -1;
    return timeA.getTime() - timeB.getTime();
  });
}
