import { useEffect, useRef } from "react";
import { Platform, PermissionsAndroid, Alert } from "react-native";
import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  requestPermission,
  getInitialNotification,
  onNotificationOpenedApp,
  registerDeviceForRemoteMessages,
  AuthorizationStatus,
  type RemoteMessage,
} from "@react-native-firebase/messaging";
import { useRouter } from "expo-router";
import { updatePushTokenApi } from "../config/api";

type UsePushNotificationsOptions = {
  authToken?: string | null;
  userId?: string | null;
  onNotificationReceived?: (notification: RemoteMessage) => void;
};

/**
 * Production-ready hook for Firebase Push Notifications (FCM).
 * Prompts for notification permission on initial app launch (including Android 13/14+),
 * fetches the device token, and synchronizes with backend upon login.
 */
export function usePushNotifications({
  authToken,
  userId,
  onNotificationReceived,
}: UsePushNotificationsOptions = {}) {
  const router = useRouter();
  const currentTokenRef = useRef<string | null>(null);
  const syncedTokenRef = useRef<string | null>(null);

  // 1. Request notification permissions across Android (13+) and iOS
  const requestUserPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === "android") {
        // Android 13+ (API level 33+) requires runtime POST_NOTIFICATIONS
        if (Number(Platform.Version) >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          console.log("[FCM] Android POST_NOTIFICATIONS result:", granted);
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true;
      }

      // iOS permission request
      const messagingInstance = getMessaging();
      const authStatus = await requestPermission(messagingInstance, {
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      });

      return (
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL
      );
    } catch (error) {
      console.error("[FCM] Failed to request notification permission:", error);
      return false;
    }
  };

  // 2. Register FCM Device Token with the backend
  const syncTokenWithBackend = async (fcmToken: string) => {
    if (!authToken || !userId) {
      console.log("[FCM] Token stored locally; awaiting user login before backend sync.");
      return;
    }

    if (syncedTokenRef.current === fcmToken) {
      return;
    }

    try {
      await updatePushTokenApi(authToken, fcmToken);
      syncedTokenRef.current = fcmToken;
      console.log("[FCM] Device push token successfully registered with backend for user:", userId);
    } catch (err) {
      console.error("[FCM] Failed to register push token with backend:", err);
    }
  };

  // 3. Handle navigation when user interacts with a notification
  const handleNotificationNavigation = (remoteMessage: RemoteMessage | null) => {
    if (!remoteMessage || !remoteMessage.data) return;

    const { screen, ...extraData } = remoteMessage.data;

    if (screen && typeof screen === "string") {
      try {
        console.log(`[FCM] Navigating to: ${screen}`, extraData);
        router.push(screen as any);
      } catch (navError) {
        console.error(`[FCM] Error navigating to ${screen}:`, navError);
      }
    }
  };

  // Run on startup: prompt permission and retrieve token immediately
  useEffect(() => {
    let isMounted = true;
    const messagingInstance = getMessaging();

    const initialize = async () => {
      // Small timeout allows activity window and splash screen to settle
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!isMounted) return;

      const hasPermission = await requestUserPermission();
      if (!hasPermission || !isMounted) {
        console.log("[FCM] Notification permission was not granted.");
        return;
      }

      try {
        if (Platform.OS === "ios") {
          await registerDeviceForRemoteMessages(messagingInstance);
        }

        const token = await getToken(messagingInstance);
        if (token && isMounted) {
          console.log("[FCM] Device Token obtained:", token);
          currentTokenRef.current = token;
          await syncTokenWithBackend(token);
        }
      } catch (tokenErr) {
        console.error("[FCM] Error retrieving device token:", tokenErr);
      }
    };

    initialize();

    // 4. Token Refresh Listener
    const unsubscribeTokenRefresh = onTokenRefresh(
      messagingInstance,
      async (newToken: string) => {
        console.log("[FCM] Token refreshed by Firebase:", newToken);
        currentTokenRef.current = newToken;
        await syncTokenWithBackend(newToken);
      }
    );

    // 5. Foreground Message Listener (App active)
    const unsubscribeForeground = onMessage(
      messagingInstance,
      (remoteMessage: RemoteMessage) => {
        console.log("[FCM] Foreground notification received:", remoteMessage);

        if (onNotificationReceived) {
          onNotificationReceived(remoteMessage);
        }

        const title = remoteMessage.notification?.title || "Notification";
        const body = remoteMessage.notification?.body || "";

        Alert.alert(title, body, [
          { text: "Dismiss", style: "cancel" },
          {
            text: "View",
            onPress: () => handleNotificationNavigation(remoteMessage),
          },
        ]);
      }
    );

    // 6. Background -> App Open Click Listener
    const unsubscribeNotificationOpened = onNotificationOpenedApp(
      messagingInstance,
      (remoteMessage: RemoteMessage) => {
        console.log("[FCM] App opened from background by notification:", remoteMessage);
        handleNotificationNavigation(remoteMessage);
      }
    );

    // 7. Quit-State -> App Open Click (Cold start)
    getInitialNotification(messagingInstance)
      .then((remoteMessage: RemoteMessage | null) => {
        if (remoteMessage && isMounted) {
          console.log("[FCM] App launched from quit state by notification:", remoteMessage);
          handleNotificationNavigation(remoteMessage);
        }
      })
      .catch((err: unknown) => {
        console.error("[FCM] Error checking initial notification:", err);
      });

    return () => {
      isMounted = false;
      unsubscribeTokenRefresh();
      unsubscribeForeground();
      unsubscribeNotificationOpened();
    };
  }, []);

  // Sync token whenever user logs in or auth state changes
  useEffect(() => {
    if (authToken && userId && currentTokenRef.current) {
      syncTokenWithBackend(currentTokenRef.current);
    }
  }, [authToken, userId]);

  return {
    getCurrentToken: () => currentTokenRef.current,
  };
}
