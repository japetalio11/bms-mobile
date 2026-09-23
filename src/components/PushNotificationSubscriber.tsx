import { useAuth } from "../context/UserContext";
import { usePushNotifications } from "../hooks/usePushNotifications";

export function PushNotificationSubscriber() {
  const { token, user } = useAuth();

  usePushNotifications({
    authToken: token,
    userId: user?.user_id,
  });

  return null;
}
