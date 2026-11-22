import type { JSX } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaView } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { useUniwind } from "uniwind";

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
  const { user, isAuthenticated, isLoadingStorage, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoadingStorage) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoadingStorage]);

  useEffect(() => {
    if (isLoadingStorage) return;

    const inAuthGroup = segments[0] === "(auth)";
    const isMotherAccount = user.role?.trim().toLowerCase() === "mother";

    if (isAuthenticated && !isMotherAccount) {
      void logout();
      router.replace("/(auth)/login");
      return;
    }

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user.role, isAuthenticated, isLoadingStorage, segments, router, logout]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

function ThemedStatusBar(): JSX.Element {
  const { theme } = useUniwind();
  return <StatusBar style={theme === "dark" ? "light" : "dark"} />;
}

export default function RootLayout(): JSX.Element | null {
  const [loaded, error] = useFonts({
    Manrope: Manrope_400Regular,
    "Manrope-Medium": Manrope_500Medium,
    "Manrope-SemiBold": Manrope_600SemiBold,
    "Manrope-Bold": Manrope_700Bold,
  });

  useEffect(() => {
    if (error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [error]);

  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

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
                  {Platform.OS !== "web" && <PushNotificationSubscriber />}
                  <SafeAreaView
                    className="flex-1 bg-background"
                    style={{ flex: 1 }}
                    edges={["top"]}
                  >
                    <OfflineBanner />
                    <RootNavigator />
                    <ThemedStatusBar />
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
