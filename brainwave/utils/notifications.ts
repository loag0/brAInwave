import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import * as Battery from "expo-battery";

// Battery optimization for Android
export async function isBatteryOptimizationEnabled(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  return await Battery.isBatteryOptimizationEnabledAsync();
}

let isBatteryDialogOpen = false;

export async function requestBatteryOptimizationExemption(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (isBatteryDialogOpen) return;

  isBatteryDialogOpen = true;
  try {
    await IntentLauncher.startActivityAsync(
      "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
      { data: `package:com.username0.brainwave` },
    );
  } catch (e: any) {
    if (__DEV__) console.error(e.message);
    await IntentLauncher.startActivityAsync(
      "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS",
    );
  } finally {
    isBatteryDialogOpen = false;
  }
}

export async function ensureBatteryOptimizationExemption(): Promise<void> {
  if (Platform.OS !== "android") return;
  const optimized = await isBatteryOptimizationEnabled();
  if (optimized) await requestBatteryOptimizationExemption();
}

// Notification permissions
export async function getNotificationPermissionStatus(): Promise<
  "granted" | "denied" | "undetermined"
> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as "granted" | "denied" | "undetermined";
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;
  if (existingStatus === "denied") return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function openAppSettings(): Promise<void> {
  await IntentLauncher.startActivityAsync(
    "android.settings.APP_NOTIFICATION_SETTINGS",
    { extra: { "android.provider.extra.APP_PACKAGE": "com.username0.brainwave" } }
  );
}

// Notification channel for android
export async function setupAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("high-priority", {
    name: "Urgent Reminders",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export function parseStartDate(item: any, referenceDate?: Date): Date | null {
  const raw = item.time || item.start;
  if (!raw) return null;
  const startTimeStr = raw.split("-")[0].trim();
  const base = referenceDate || new Date();

  try {
    let hours = 0;
    let minutes = 0;

    // Format: "0800", "1050" - 24h no colon
    const militaryMatch = startTimeStr.match(/^(\d{2})(\d{2})$/);
    // Format: "10:00 AM", "8:30 pm" - 12h with colon
    const colonMatch = startTimeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);

    if (militaryMatch) {
      hours = parseInt(militaryMatch[1], 10);
      minutes = parseInt(militaryMatch[2], 10);
    } else if (colonMatch) {
      let [, hourStr, minStr, modifier] = colonMatch;
      hours = parseInt(hourStr, 10);
      minutes = parseInt(minStr, 10);

      if (modifier) {
        if (modifier.toLowerCase() === "pm" && hours < 12) hours += 12;
        if (modifier.toLowerCase() === "am" && hours === 12) hours = 0;
      }
    } else {
      return null;
    }

    const target = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      hours,
      minutes,
      0,
    );

    return isNaN(target.getTime()) ? null : target;
  } catch (e: any) {
    if (__DEV__) console.log("parseStartDate error: ", e.message);
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
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 250, 250, 250],
        data: { taskId: item.id },
      },
      trigger: {
        type: "date",
        date: effectiveTrigger,
        channelId: "high-priority",
        allowWhileIdle: true,
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
