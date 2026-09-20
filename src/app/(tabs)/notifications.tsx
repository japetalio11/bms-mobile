import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import type { JSX } from "react";
import { Card, Text, Switch } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { useSettings } from "../../context/settingsContext";
import { useAuth } from "../../context/UserContext";
import { useRouter } from "expo-router";
import {
  getNotificationsApi,
  updateNotificationReadApi,
  type NotificationRecord,
} from "../../config/api";
import {
  getNotificationsLocal,
  saveNotificationsLocal,
  markNotificationReadLocal,
} from "../../db/repository";

export default function NotificationCenterScreen(): JSX.Element {
  const router = useRouter();
  const { user, token, isOnline, markAllNotificationsRead } = useAuth();
  const { notifications: prefSettings, setNotificationSetting } = useSettings();

  const [activeTab, setActiveTab] = useState<"notifications" | "preferences">("notifications");
  const [notificationList, setNotificationList] = useState<NotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user?.user_id) return;

    // 1. Always load from local SQLite first (offline capability & instant load)
    try {
      const cached = await getNotificationsLocal(user.user_id);
      if (cached && cached.length > 0) {
        setNotificationList(cached as any);
      }
    } catch (e) {
      console.warn("Local notifications fetch error:", e);
    }

    // 2. Fetch fresh backend notifications if online
    if (isOnline && token) {
      setIsLoading(true);
      try {
        const fresh = await getNotificationsApi(user.user_id, token);
        if (Array.isArray(fresh)) {
          setNotificationList(fresh);
          await saveNotificationsLocal(fresh as any);
        }
      } catch (err) {
        console.warn("Backend notifications fetch error, preserving local cache:", err);
      } finally {
        setIsLoading(false);
      }
    }
  }, [user?.user_id, token, isOnline]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setIsRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotificationList((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleItemPress = async (item: NotificationRecord) => {
    if (item.is_read) return;

    // Optimistically mark as read in state
    setNotificationList((prev) =>
      prev.map((n) =>
        n.notification_id === item.notification_id ? { ...n, is_read: true } : n
      )
    );

    // Save to local SQLite DB
    await markNotificationReadLocal(item.notification_id);

    // Sync to backend API if online
    if (isOnline && token) {
      try {
        await updateNotificationReadApi(item.notification_id, true, token);
      } catch (err) {
        console.warn("Failed to mark notification read on backend:", err);
      }
    }
  };

  const getCategoryConfig = (typeStr: string) => {
    const t = (typeStr || "").toLowerCase();
    if (t.includes("vitals") || t.includes("risk") || t.includes("cdss")) {
      return {
        icon: "heart-dislike-outline" as const,
        color: "#ef4444",
        bg: "bg-red-500/15",
        border: "border-red-500/30",
        label: "Clinical Alert",
      };
    }
    if (t.includes("appointment")) {
      return {
        icon: "calendar-outline" as const,
        color: "#0284c7",
        bg: "bg-sky-500/15",
        border: "border-sky-500/30",
        label: "Appointment",
      };
    }
    if (t.includes("referral")) {
      return {
        icon: "git-branch-outline" as const,
        color: "#a78bfa",
        bg: "bg-purple-500/15",
        border: "border-purple-500/30",
        label: "Referral",
      };
    }
    return {
      icon: "notifications-outline" as const,
      color: "#10b981",
      bg: "bg-emerald-500/15",
      border: "border-emerald-500/30",
      label: "Care Notice",
    };
  };

  return (
    <View className="flex-1 bg-background">
      <Header
        showBackButton
        title="Notification Center"
        onBack={() => router.push("/(tabs)")}
        rightIcon={null}
      />

      {/* Segment Switcher Tabs */}
      <View className="px-5 pt-2 pb-4">
        <View className="flex-row bg-[#1c1c22] border border-white/10 rounded-2xl p-1">
          <Pressable
            onPress={() => setActiveTab("notifications")}
            className={`flex-1 py-2.5 rounded-xl items-center justify-center flex-row gap-2 ${
              activeTab === "notifications" ? "bg-[#272730]" : "bg-transparent"
            }`}
          >
            <Ionicons
              name="notifications"
              size={16}
              color={activeTab === "notifications" ? "#ffffff" : "#71717a"}
            />
            <Text
              className={`text-sm font-bold ${
                activeTab === "notifications" ? "text-white" : "text-zinc-400"
              }`}
            >
              Notifications
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("preferences")}
            className={`flex-1 py-2.5 rounded-xl items-center justify-center flex-row gap-2 ${
              activeTab === "preferences" ? "bg-[#272730]" : "bg-transparent"
            }`}
          >
            <Ionicons
              name="options-outline"
              size={16}
              color={activeTab === "preferences" ? "#ffffff" : "#71717a"}
            />
            <Text
              className={`text-sm font-bold ${
                activeTab === "preferences" ? "text-white" : "text-zinc-400"
              }`}
            >
              Preferences
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
          />
        }
      >
        {activeTab === "notifications" ? (
          <View className="px-5">
            {/* Header Action Bar */}
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-zinc-400 text-sm font-medium ml-1">
                Recent Alerts & Notifications
              </Text>
              {notificationList.some((n) => !n.is_read) && (
                <Pressable onPress={handleMarkAllRead}>
                  <Text className="text-sky-400 text-sm font-semibold">
                    Mark All as Read
                  </Text>
                </Pressable>
              )}
            </View>

            {isLoading && notificationList.length === 0 ? (
              <ActivityIndicator size="small" color="#3b82f6" className="py-12" />
            ) : notificationList.length > 0 ? (
              <View className="gap-3">
                {notificationList.map((item) => {
                  const catConfig = getCategoryConfig(item.notification_type);
                  const dateStr = item.notification_date
                    ? new Date(item.notification_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  return (
                    <Pressable
                      key={item.notification_id}
                      onPress={() => handleItemPress(item)}
                      className={`p-4 rounded-2xl border flex-row items-start gap-3.5 ${
                        item.is_read
                          ? "bg-[#18171C] border-white/[0.08]"
                          : "bg-[#201d27] border-sky-500/30"
                      }`}
                    >
                      {/* Category Icon Badge */}
                      <View
                        className={`size-10 rounded-xl items-center justify-center border ${catConfig.bg} ${catConfig.border}`}
                      >
                        <Ionicons name={catConfig.icon} size={20} color={catConfig.color} />
                      </View>

                      {/* Content */}
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between mb-1">
                          <Text className="text-white text-sm font-bold flex-1 mr-2" numberOfLines={1}>
                            {item.sender || catConfig.label}
                          </Text>
                          <Text className="text-zinc-500 text-[11px] font-medium">
                            {dateStr}
                          </Text>
                        </View>

                        <Text className="text-zinc-300 text-sm leading-5">
                          {item.notification_message}
                        </Text>
                      </View>

                      {/* Unread Dot */}
                      {!item.is_read && (
                        <View className="size-2.5 rounded-full bg-sky-400 mt-1.5" />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View className="p-8 bg-[#18171C] border border-white/[0.08] rounded-2xl items-center my-4">
                <View className="size-12 rounded-full bg-surface-secondary items-center justify-center mb-3">
                  <Ionicons name="notifications-off-outline" size={24} color="#a1a1aa" />
                </View>
                <Text className="text-white font-semibold text-sm mb-1">
                  No notifications yet
                </Text>
                <Text className="text-zinc-400 text-sm text-center leading-4">
                  You are all caught up! Automated care reminders and health alerts will appear here.
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* Preferences Tab */
          <View className="px-5 gap-6 pt-2">
            <View>
              <Text className="text-zinc-400 text-sm font-medium mb-2 ml-1">
                Maternal Care Reminders
              </Text>
              <Card variant="secondary" className="bg-surface border-0 rounded-2xl p-4">
                {/* Prenatal Visit Reminders */}
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-1 mr-4">
                    <Text className="text-foreground text-base font-medium">
                      Prenatal Visit Reminders
                    </Text>
                    <Text className="text-zinc-400 text-sm mt-0.5">
                      Receive alerts for scheduled checkups and trimester milestones.
                    </Text>
                  </View>
                  <Switch
                    isSelected={prefSettings.prenatalReminders}
                    {...({
                      onValueChange: (val: boolean) =>
                        setNotificationSetting("prenatalReminders", val),
                    } as any)}
                  />
                </View>

                <View className="h-px bg-white/10 mb-4" />

                {/* Daily Supplement & Iron Reminders */}
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-1 mr-4">
                    <Text className="text-foreground text-base font-medium">
                      Supplement & Iron Reminders
                    </Text>
                    <Text className="text-zinc-400 text-sm mt-0.5">
                      Daily reminder notifications to log and take prescribed vitamins.
                    </Text>
                  </View>
                  <Switch
                    isSelected={prefSettings.supplementReminders}
                    {...({
                      onValueChange: (val: boolean) =>
                        setNotificationSetting("supplementReminders", val),
                    } as any)}
                  />
                </View>

                <View className="h-px bg-white/10 mb-4" />

                {/* Upcoming Appointment Alerts */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 mr-4">
                    <Text className="text-foreground text-base font-medium">
                      Upcoming Appointment Alerts
                    </Text>
                    <Text className="text-zinc-400 text-sm mt-0.5">
                      Alerts 24 hours and 1 hour before facility appointments.
                    </Text>
                  </View>
                  <Switch
                    isSelected={prefSettings.appointmentAlerts}
                    {...({
                      onValueChange: (val: boolean) =>
                        setNotificationSetting("appointmentAlerts", val),
                    } as any)}
                  />
                </View>
              </Card>
            </View>

            <View>
              <Text className="text-zinc-400 text-sm font-medium mb-2 ml-1">
                General Updates
              </Text>
              <Card variant="secondary" className="bg-surface border-0 rounded-2xl p-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 mr-4">
                    <Text className="text-foreground text-base font-medium">
                      Health & Wellness Tips
                    </Text>
                    <Text className="text-zinc-400 text-sm mt-0.5">
                      Receive weekly pregnancy advice and nutrition guides.
                    </Text>
                  </View>
                  <Switch
                    isSelected={prefSettings.healthTips}
                    {...({
                      onValueChange: (val: boolean) =>
                        setNotificationSetting("healthTips", val),
                    } as any)}
                  />
                </View>
              </Card>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
