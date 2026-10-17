import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";

export function triggerSelectionHaptic(): void {
  try {
    if (Platform.OS === "web") return;
    Haptics.selectionAsync().catch(() => {
      Vibration.vibrate(10);
    });
  } catch {
    Vibration.vibrate(10);
  }
}

export function triggerLightHaptic(): void {
  try {
    if (Platform.OS === "web") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      Vibration.vibrate(15);
    });
  } catch {
    Vibration.vibrate(15);
  }
}

export function triggerMediumHaptic(): void {
  try {
    if (Platform.OS === "web") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
      Vibration.vibrate(25);
    });
  } catch {
    Vibration.vibrate(25);
  }
}

export function triggerSuccessHaptic(): void {
  try {
    if (Platform.OS === "web") return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
      Vibration.vibrate([0, 15, 60, 20]);
    });
  } catch {
    Vibration.vibrate([0, 15, 60, 20]);
  }
}
