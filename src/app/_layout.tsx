import type { JSX } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaView } from "react-native-safe-area-context";

import "../global.css";
import { UserProvider, useAuth } from "../context/UserContext";
import { SocketProvider } from "../context/SocketContext";
import { NetworkProvider } from "../context/NetworkContext";
import { SettingsProvider } from "../context/settingsContext";
import { ConfirmationProvider } from "../context/ConfirmationContext";
import { OfflineBanner } from "../components/OfflineBanner";
import { PushNotificationSubscriber } from "../components/PushNotificationSubscriber";

SplashScreen.preventAutoHideAsync();

function RootNavigator(): JSX.Element {
  const { isAuthenticated, isLoadingStorage } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoadingStorage) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoadingStorage, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout(): JSX.Element | null {
  const [loaded, error] = useFonts({
    Inter: Inter_400Regular,
    "Inter-Medium": Inter_500Medium,
    "Inter-SemiBold": Inter_600SemiBold,
    "Inter-Bold": Inter_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider config={{ devInfo: { stylingPrinciples: false } }}>
        <SettingsProvider>
          <NetworkProvider>
            <UserProvider>
              <SocketProvider>
                <ConfirmationProvider>
                  <PushNotificationSubscriber />
                  <SafeAreaView
                    className="flex-1 bg-background"
                    style={{ flex: 1 }}
                    edges={["top"]}
                  >
                    <OfflineBanner />
                    <RootNavigator />
                    <StatusBar style="auto" />
                  </SafeAreaView>
                </ConfirmationProvider>
              </SocketProvider>
            </UserProvider>
          </NetworkProvider>
        </SettingsProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
