import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import 'expo-router/entry';

// Register background/headless notification handler outside of React tree
const messagingInstance = getMessaging();
setBackgroundMessageHandler(messagingInstance, async (remoteMessage) => {
  console.log('[FCM] Headless/Background Remote Message received:', remoteMessage.messageId, remoteMessage.data);
});
