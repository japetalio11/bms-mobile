import React, { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Uniwind, useUniwind } from "uniwind";

const SETTINGS_STORAGE_KEY = "@bms_user_settings_v1";

export type TextSize = "small" | "medium" | "large";

export type NotificationPreferences = {
  prenatalReminders: boolean;
  supplementReminders: boolean;
  appointmentAlerts: boolean;
  healthTips: boolean;
};

export type SettingsContextType = {
  theme: "light" | "dark" | "system";
  textSize: TextSize;
  shareHealthData: boolean;
  analyticsEnabled: boolean;
  notifications: NotificationPreferences;
  setTheme: (theme: "light" | "dark" | "system") => Promise<void>;
  setTextSize: (size: TextSize) => Promise<void>;
  setShareHealthData: (enabled: boolean) => Promise<void>;
  setAnalyticsEnabled: (enabled: boolean) => Promise<void>;
  setNotificationSetting: (key: keyof NotificationPreferences, value: boolean) => Promise<void>;
};

const defaultNotifications: NotificationPreferences = {
  prenatalReminders: true,
  supplementReminders: true,
  appointmentAlerts: true,
  healthTips: true,
};

const defaultSettingsContext: SettingsContextType = {
  theme: "system",
  textSize: "medium",
  shareHealthData: true,
  analyticsEnabled: true,
  notifications: defaultNotifications,
  setTheme: async () => {},
  setTextSize: async () => {},
  setShareHealthData: async () => {},
  setAnalyticsEnabled: async () => {},
  setNotificationSetting: async () => {},
};

const SettingsContext = createContext<SettingsContextType>(defaultSettingsContext);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { theme: currentUniwindTheme } = useUniwind();
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("system");
  const [textSize, setTextSizeState] = useState<TextSize>("medium");
  const [shareHealthData, setShareHealthDataState] = useState<boolean>(true);
  const [analyticsEnabled, setAnalyticsEnabledState] = useState<boolean>(true);
  const [notifications, setNotificationsState] = useState<NotificationPreferences>(defaultNotifications);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.theme) {
            setThemeState(parsed.theme);
            Uniwind.setTheme(parsed.theme);
          }
          if (parsed.textSize) setTextSizeState(parsed.textSize);
          if (parsed.shareHealthData !== undefined) setShareHealthDataState(parsed.shareHealthData);
          if (parsed.analyticsEnabled !== undefined) setAnalyticsEnabledState(parsed.analyticsEnabled);
          if (parsed.notifications) setNotificationsState(parsed.notifications);
        }
      } catch (err) {
        console.error("Failed to load user settings:", err);
      }
    };

    loadSettings();
  }, []);

  const saveSettings = async (updatedSettings: Partial<{
    theme: "light" | "dark" | "system";
    textSize: TextSize;
    shareHealthData: boolean;
    analyticsEnabled: boolean;
    notifications: NotificationPreferences;
  }>) => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      const existing = stored ? JSON.parse(stored) : {};
      const newSettings = { ...existing, ...updatedSettings };
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (err) {
      console.error("Failed to persist user settings:", err);
    }
  };

  const setTheme = async (newTheme: "light" | "dark" | "system") => {
    setThemeState(newTheme);
    Uniwind.setTheme(newTheme);
    await saveSettings({ theme: newTheme });
  };

  const setTextSize = async (size: TextSize) => {
    setTextSizeState(size);
    await saveSettings({ textSize: size });
  };

  const setShareHealthData = async (enabled: boolean) => {
    setShareHealthDataState(enabled);
    await saveSettings({ shareHealthData: enabled });
  };

  const setAnalyticsEnabled = async (enabled: boolean) => {
    setAnalyticsEnabledState(enabled);
    await saveSettings({ analyticsEnabled: enabled });
  };

  const setNotificationSetting = async (key: keyof NotificationPreferences, value: boolean) => {
    const updatedNotifications = { ...notifications, [key]: value };
    setNotificationsState(updatedNotifications);
    await saveSettings({ notifications: updatedNotifications });
  };

  return (
    <SettingsContext.Provider
      value={{
        theme,
        textSize,
        shareHealthData,
        analyticsEnabled,
        notifications,
        setTheme,
        setTextSize,
        setShareHealthData,
        setAnalyticsEnabled,
        setNotificationSetting,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  return useContext(SettingsContext);
}
