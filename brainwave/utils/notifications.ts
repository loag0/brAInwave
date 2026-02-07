import * as Notifications from "expo-notifications";

export async function ensureNotificationPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    const res = await Notifications.requestPermissionsAsync();
    return res.status === "granted";
  }
  return true;
}

export async function scheduleNextClassNotification(
  classItem: any,
  leadMinutes: number,
) {
  if (!classItem?.start) return;

  const startTime = new Date(classItem.start);
  const triggerTime = new Date(startTime.getTime() - leadMinutes * 60 * 1000);

  // already passed → don't schedule
  if (triggerTime <= new Date()) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Next class incoming",
      body: `${classItem.subject} starts in ${leadMinutes} minutes`,
      sound: true,
    },
    trigger: {
        type: 'date',
        date: triggerTime,
    } as Notifications.DateTriggerInput
  });
}