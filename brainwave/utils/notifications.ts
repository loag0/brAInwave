import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import * as Battery from "expo-battery";
import { PermissionResponse } from "expo-notifications";

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
  const permissions = (await Notifications.getPermissionsAsync()) as PermissionResponse;

  if(__DEV__) console.log("Notification permissions: ", permissions);
  
  if (permissions.granted) return "granted";
  if (!permissions.canAskAgain) return "denied";
  return "undetermined";
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const permissions = (await Notifications.getPermissionsAsync()) as PermissionResponse;
  if(__DEV__) console.log("Notification permissions: ", permissions);

  if (permissions.granted) return true;
  if (!permissions.canAskAgain) return false;

  const request = (await Notifications.requestPermissionsAsync()) as PermissionResponse;
  return request.granted;
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

/**
 * Parses a time range string like "0800 - 0950" or "09:00 - 10:30 AM" and returns the exact duration in minutes. Falls back to parseDurationMinutes
*/
export function parseDurationFromTimeRange(timeStr: string, fallbackDuration?: string): number {
  if (!timeStr || !timeStr.includes("-")) {
    return parseDurationMinutes(fallbackDuration);
  }

  const parts = timeStr.split("-").map((s) => s.trim());
  if (parts.length < 2) return parseDurationMinutes(fallbackDuration);

  const parseMinutes = (t: string): number | null => {
    // "0800", "0950" — military no colon
    const mil = t.match(/^(\d{2})(\d{2})$/);
    if (mil) return parseInt(mil[1]) * 60 + parseInt(mil[2]);
    // "10:30", "10:30 AM/PM"
    const col = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (col) {
      let h = parseInt(col[1]);
      const m = parseInt(col[2]);
      const mod = col[3]?.toLowerCase();
      if (mod === "pm" && h < 12) h += 12;
      if (mod === "am" && h === 12) h = 0;
      return h * 60 + m;
    }
    return null;
  };

  const startMins = parseMinutes(parts[0]);
  const endMins = parseMinutes(parts[1]);

  if (startMins === null || endMins === null) return parseDurationMinutes(fallbackDuration);

  const diff = endMins - startMins;
  return diff > 0 ? diff : parseDurationMinutes(fallbackDuration);
}

export function formatTimeTo24h(timeStr: string): string {
  if (!timeStr) return "";

  // Extract start time only from a range like "0800 - 0950" or "10:00 - 11:00"
  const raw = timeStr.includes("-") ? timeStr.split("-")[0].trim() : timeStr;

  // Military format "0800" → "08:00"
  const milMatch = raw.match(/^(\d{2})(\d{2})$/);
  if (milMatch) {
    return `${milMatch[1]}:${milMatch[2]}`;
  }

  const match = raw.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!match) return raw;

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
