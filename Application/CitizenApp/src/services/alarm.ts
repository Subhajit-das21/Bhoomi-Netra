import { Platform, Vibration } from 'react-native';
import { SEVERITY } from '../domain/severity';
import type { Hazard, Severity } from '../domain/types';
import { directive } from '../domain/severity';

/**
 * Critical-escalation alarm.
 *
 * expo-haptics and expo-notifications are not installed and the npm registry is
 * unreachable from this environment, so this is built on React Native's core
 * `Vibration` API, which ships with the runtime and needs no native rebuild.
 *
 * That is not purely a workaround: for an escalation alarm, Vibration is the
 * right primitive. expo-haptics gives short UI taps (selection, impact) capped
 * around 100 ms, which is precisely what you do NOT want when the message is
 * "leave your house". Vibration.vibrate takes an arbitrary pattern and, on
 * Android, honours it exactly.
 *
 * Platform note: on Android the array is [wait, buzz, wait, buzz, ...] in ms.
 * On iOS, React Native's Vibration ignores the durations and fires a fixed
 * ~400 ms buzz per element, so the pattern is reduced to a repeat count that
 * produces a comparable rhythm.
 *
 * The notification path is a seam, not a fake: `deliverCriticalNotification`
 * has the shape expo-notifications' `scheduleNotificationAsync` expects, and
 * `onNotification` is where that module gets wired in. Until then the app
 * escalates in-app (takeover screen) plus vibration, and says so honestly in
 * Settings rather than implying a push arrived.
 */

export interface CriticalNotification {
  title: string;
  body: string;
  /** Bypasses Do Not Disturb on Android when mapped to a high-importance channel. */
  critical: true;
  data: { alertId: string; hazard: Hazard };
}

type NotificationSink = (n: CriticalNotification) => void | Promise<void>;

let sink: NotificationSink | null = null;

/**
 * Register the transport that actually presents a notification.
 * Wire expo-notifications here once it can be installed:
 *   onNotification(n => Notifications.scheduleNotificationAsync({ content: n, trigger: null }))
 */
export function onNotification(next: NotificationSink | null): void {
  sink = next;
}

/** True when a real notification transport is registered. Surfaced in Settings. */
export function hasNotificationTransport(): boolean {
  return sink !== null;
}

/** Fire the vibration pattern for a severity. No-op for `low`, which is silent. */
export function vibrateFor(severity: Severity): void {
  const pattern = SEVERITY[severity].vibration;
  if (pattern.length === 0) return;

  if (Platform.OS === 'android') {
    Vibration.vibrate(pattern);
    return;
  }

  // iOS: durations are ignored, so approximate the rhythm with buzz count.
  const buzzes = Math.ceil(pattern.length / 2);
  Vibration.vibrate(Array(buzzes).fill(400));
}

export function stopVibration(): void {
  Vibration.cancel();
}

/**
 * A single short buzz. Used to mark each second of the SOS hold.
 *
 * Not decoration: the SOS button is held for three seconds with a wet or shaking
 * thumb, often without looking at the screen, and a buzz per second is how the
 * user knows the hold is registering rather than that the phone has frozen.
 */
export function tick(): void {
  Vibration.vibrate(40);
}

/** Push the notification through the registered transport, if there is one. */
export async function deliverCriticalNotification(
  alertId: string,
  hazard: Hazard,
  headline: string,
): Promise<boolean> {
  if (!sink) return false;
  await sink({
    title: headline,
    body: directive(hazard, 'critical'),
    critical: true,
    data: { alertId, hazard },
  });
  return true;
}

/**
 * Called when an alert for the user's zone escalates to critical.
 * Vibrates immediately, then attempts the notification transport.
 */
export async function escalate(
  alertId: string,
  hazard: Hazard,
  headline: string,
): Promise<void> {
  vibrateFor('critical');
  await deliverCriticalNotification(alertId, hazard, headline);
}
