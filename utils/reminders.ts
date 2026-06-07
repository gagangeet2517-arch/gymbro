import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { ReminderConfig } from '../context/UserProfileContext';

// Show reminders even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.status === 'granted';
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

function dailyTrigger(c: ReminderConfig): Notifications.NotificationTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: c.hour,
    minute: c.minute,
  };
}

function longTermTrigger(c: ReminderConfig): Notifications.NotificationTriggerInput {
  if (c.interval === 'daily') return dailyTrigger(c);
  if (c.interval === 'weekly') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: new Date().getDay() + 1, // expo: 1 = Sunday … 7 = Saturday
      hour: c.hour,
      minute: c.minute,
    };
  }
  // Monthly: expo has no cross-platform monthly calendar trigger, so approximate
  // with a repeating ~30-day interval.
  return {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: 30 * 24 * 60 * 60,
    repeats: true,
  };
}

/**
 * Cancel any previously scheduled reminders and reschedule based on the current
 * config. Returns false if a reminder is enabled but permission was denied.
 * This app only schedules these two reminders, so cancelling all is safe.
 */
export async function syncReminders(
  daily: ReminderConfig,
  longTerm: ReminderConfig
): Promise<boolean> {
  const wantsAny = daily.enabled || longTerm.enabled;

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!wantsAny) return true;

  const granted = await ensurePermission();
  if (!granted) return false;
  await ensureAndroidChannel();

  if (daily.enabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'gymbro',
        body: (daily.message ?? '').trim() || "Time to log today's workout and meals 💪",
      },
      trigger: dailyTrigger(daily),
    });
  }

  if (longTerm.enabled) {
    const goal = (longTerm.message ?? '').trim();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: goal ? 'Your goal' : 'Check in on your goal',
        body: goal
          ? `${goal} — how's it going? 📈`
          : 'How is your progress? Open gymbro and review where you stand. 📈',
      },
      trigger: longTermTrigger(longTerm),
    });
  }

  return true;
}
