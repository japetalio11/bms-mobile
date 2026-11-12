import { useCallback, useEffect, useRef } from "react";
import { Platform, PermissionsAndroid, Alert, TurboModuleRegistry } from "react-native";
import type { RemoteMessage } from "@react-native-firebase/messaging";
import { useRouter } from "expo-router";
import { updatePushTokenApi } from "../config/api";

type UsePushNotificationsOptions = {
  authToken?: string | null;
  userId?: string | null;
  onNotificationReceived?: (notification: RemoteMessage) => void;
};

export function usePushNotifications({
  authToken,
  userId,
  onNotificationReceived,
}: UsePushNotificationsOptions = {}) {
  const router = useRouter();
  const currentTokenRef = useRef<string | null>(null);
  const syncedTokenRef = useRef<string | null>(null);

  const requestUserPermission = useCallback(async (
    messaging: typeof import("@react-native-firebase/messaging"),
    messagingInstance: ReturnType<typeof messaging.getMessaging>
  ): Promise<boolean> => {
    try {
      if (Platform.OS === "android") {
        if (Number(Platform.Version) >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          console.log("[FCM] Android POST_NOTIFICATIONS result:", granted);
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true;
      }

      const authStatus = await messaging.requestPermission(messagingInstance, {
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      });

      return (
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL
      );
    } catch (error) {
      console.error("[FCM] Failed to request notification permission:", error);
      return false;
    }
  }, []);

  const syncTokenWithBackend = useCallback(async (fcmToken: string) => {
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
  }, [authToken, userId]);

  const handleNotificationNavigation = useCallback((remoteMessage: RemoteMessage | null) => {
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
  }, [router]);

  useEffect(() => {
    // RNFirebase can only be evaluated when its native modules exist in the
    // installed binary. Expo Go and stale dev clients do not register them.
    if (
      Platform.OS === "web" ||
      !TurboModuleRegistry.get("NativeRNFBTurboApp") ||
      !TurboModuleRegistry.get("NativeRNFBTurboMessaging")
    ) {
      return;
    }

    let isMounted = true;
    let messaging: typeof import("@react-native-firebase/messaging");
    let messagingInstance: ReturnType<typeof import("@react-native-firebase/messaging").getMessaging>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@react-native-firebase/app");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      messaging = require("@react-native-firebase/messaging");
      if (!messaging) return;
      messagingInstance = messaging.getMessaging();
    } catch (error) {
      console.warn("[FCM] Native Firebase Messaging is unavailable:", error);
      return;
    }

    const initialize = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!isMounted) return;

      const hasPermission = await requestUserPermission(messaging, messagingInstance);
      if (!hasPermission || !isMounted) {
        console.log("[FCM] Notification permission was not granted.");
        return;
      }

      try {
        if (Platform.OS === "ios") {
          await messaging.registerDeviceForRemoteMessages(messagingInstance);
        }

        const token = await messaging.getToken(messagingInstance);
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

    const unsubscribeTokenRefresh = messaging.onTokenRefresh(messagingInstance, async (newToken: string) => {
      console.log("[FCM] Token refreshed by Firebase:", newToken);
      currentTokenRef.current = newToken;
      await syncTokenWithBackend(newToken);
    });

    const unsubscribeForeground = messaging.onMessage(messagingInstance, (remoteMessage: RemoteMessage) => {
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
    });

    const unsubscribeNotificationOpened = messaging.onNotificationOpenedApp(
      messagingInstance,
      (remoteMessage: RemoteMessage) => {
        console.log("[FCM] App opened from background by notification:", remoteMessage);
        handleNotificationNavigation(remoteMessage);
      }
    );

    messaging.getInitialNotification(messagingInstance)
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
  }, [requestUserPermission, syncTokenWithBackend, handleNotificationNavigation, onNotificationReceived]);

  useEffect(() => {
    if (authToken && userId && currentTokenRef.current) {
      syncTokenWithBackend(currentTokenRef.current);
    }
  }, [authToken, userId, syncTokenWithBackend]);

  return {
    getCurrentToken: () => currentTokenRef.current,
  };
}
