import { TurboModuleRegistry } from "react-native";

// Check the installed native binary before evaluating React Native Firebase.
// Its JS entry point eagerly constructs an event emitter and will crash if the
// current binary (for example Expo Go or an older dev client) lacks the module.
const firebaseAppNativeModule = TurboModuleRegistry.get("NativeRNFBTurboApp");
const firebaseMessagingNativeModule = TurboModuleRegistry.get("NativeRNFBTurboMessaging");

if (firebaseAppNativeModule && firebaseMessagingNativeModule) {
  try {
    require("@react-native-firebase/app");
    const messaging = require("@react-native-firebase/messaging");
    const messagingInstance = messaging?.getMessaging?.();

    if (!messagingInstance) {
      throw new Error("Firebase Messaging is unavailable in this native build.");
    }

    messaging.setBackgroundMessageHandler(messagingInstance, async (remoteMessage) => {
      console.log(
        "[FCM] Headless/Background Remote Message received:",
        remoteMessage.messageId,
        remoteMessage.data
      );
    });
  } catch (error) {
    console.warn("[FCM] Background messaging is unavailable in this runtime:", error);
  }
}
