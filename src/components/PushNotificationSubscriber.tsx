import { useAuth } from "../context/UserContext";
import { usePushNotifications } from "../hooks/usePushNotifications";

/**
 * Headless component that activates Firebase Push Notification listeners
 * and synchronizes FCM tokens when an authenticated user is active.
 */
export function PushNotificationSubscriber() {
  const { token, user } = useAuth();

  usePushNotifications({
    authToken: token,
    userId: user?.user_id,
  });

  return null;
}
