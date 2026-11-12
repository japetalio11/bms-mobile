import { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, Pressable, RefreshControl, ActivityIndicator, BackHandler } from "react-native";
import { Text } from "heroui-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "../../components/AppIcon";
import { useAuth } from "../../context/UserContext";
import { getNotificationsApi, updateNotificationReadApi, type NotificationRecord } from "../../config/api";
import { getNotificationsLocal, saveNotificationsLocal, markNotificationReadLocal } from "../../db/repository";

type Category = "All" | "Appointments" | "Reminders" | "Care";
const categories: Category[] = ["All", "Appointments", "Reminders", "Care"];

function categoryFor(item: NotificationRecord): Exclude<Category, "All"> {
  const type = `${item.notification_type} ${item.category || ""}`.toLowerCase();
  if (type.includes("appointment") || type.includes("booking")) return "Appointments";
  if (type.includes("reminder") || type.includes("supplement") || type.includes("medicine")) return "Reminders";
  return "Care";
}

function notificationTitle(item: NotificationRecord) {
  const message = item.notification_message?.trim() || "";
  const firstSentence = message.split(/[.!?]/)[0]?.trim();
  return item.sender?.trim() || (firstSentence && firstSentence.length <= 48 ? firstSentence : categoryFor(item) === "Appointments" ? "Appointment update" : categoryFor(item) === "Reminders" ? "Care reminder" : "Health update");
}

function isToday(value: string) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toDateString() === new Date().toDateString();
}

export default function NotificationCenterScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const returnTo = from === "settings" ? "/(tabs)/profile" : "/(tabs)";
  const goBack = useCallback(() => {
    if (from === "settings" || from === "dashboard") router.replace(returnTo);
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, [from, returnTo, router]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack]));
  const insets = useSafeAreaInsets();
  const { user, token, isOnline, markAllNotificationsRead } = useAuth();
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [active, setActive] = useState<Category>("All");
  const [loading, setLoading] = useState(Boolean(user?.user_id));
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.user_id) return;
    try {
      const cached = await getNotificationsLocal(user.user_id);
      if (Array.isArray(cached)) setItems(cached as NotificationRecord[]);
    } catch (error) { console.warn("Local notifications unavailable:", error); }
    if (isOnline && token) {
      try {
        const fresh = await getNotificationsApi(user.user_id, token);
        if (Array.isArray(fresh)) { setItems(fresh); await saveNotificationsLocal(fresh as any); }
      } catch (error) { console.warn("Notifications unavailable, showing cached items:", error); }
    }
    setLoading(false);
  }, [user, token, isOnline]);

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 0);
    return () => clearTimeout(timeout);
  }, [load]);
  const visible = useMemo(() => items.filter(item => active === "All" || categoryFor(item) === active).sort((a, b) => new Date(b.notification_date).getTime() - new Date(a.notification_date).getTime()), [items, active]);
  const today = visible.filter(item => isToday(item.notification_date));
  const earlier = visible.filter(item => !isToday(item.notification_date));

  const openItem = async (item: NotificationRecord) => {
    if (!item.is_read) {
      setItems(current => current.map(entry => entry.notification_id === item.notification_id ? { ...entry, is_read: true } : entry));
      await markNotificationReadLocal(item.notification_id);
      if (isOnline && token) {
        try { await updateNotificationReadApi(item.notification_id, true, token); }
        catch (error) { console.warn("Could not sync notification read state:", error); }
      }
    }
    const category = categoryFor(item);
    if (category === "Appointments") router.push("/(tabs)/history");
    else if (category === "Reminders") router.push({ pathname: "/(tabs)/records", params: { tab: "prescriptions" } });
    else router.push("/(tabs)/records");
  };
  const markAllRead = async () => {
    await markAllNotificationsRead();
    setItems(current => current.map(item => ({ ...item, is_read: true })));
  };

  const renderGroup = (label: string, entries: NotificationRecord[]) => entries.length > 0 && <View className="mt-6">
    <Text className="mb-2 px-5 text-sm font-semibold text-foreground">{label}</Text>
    {entries.map(item => {
      const category = categoryFor(item);
      const icon = category === "Appointments" ? "calendar-outline" : category === "Reminders" ? "notifications-outline" : "heart-outline";
      const date = new Date(item.notification_date);
      const time = Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return <Pressable key={item.notification_id} onPress={() => void openItem(item)} className="mx-5 flex-row gap-3 border-b border-[#e8e8e8] py-4 active:opacity-70">
        <View className="size-11 items-center justify-center rounded-full bg-[#f2f2f2]"><AppIcon name={icon} size={20} weight="regular" color="#303030" /></View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-2"><Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={2}>{notificationTitle(item)}</Text><Text className="text-sm text-muted-foreground">{time}</Text></View>
          <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={3}>{item.notification_message}</Text>
        </View>
        {!item.is_read && <View className="absolute right-0 top-10 size-2 rounded-full bg-[#a9a733]" />}
      </Pressable>;
    })}
  </View>;

  return <View className="flex-1 bg-background">
    <View className="h-16 flex-row items-center justify-between px-5">
      <Pressable onPress={goBack} accessibilityLabel="Back" className="size-11 items-center justify-center"><AppIcon name="chevron-back" size={23} weight="bold" color="#171717" /></Pressable>
      <Text className="text-2xl font-semibold text-foreground">Notifications</Text>
      <Pressable onPress={() => void markAllRead()} accessibilityLabel="Mark all as read" className="size-11 items-center justify-center"><AppIcon name="checkmark-done" size={20} weight="regular" color={items.some(item => !item.is_read) ? "#171717" : "#a3a3a3"} /></Pressable>
    </View>
    <View className="pt-3"><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
      {categories.map(category => <Pressable key={category} onPress={() => setActive(category)} className={`rounded-xl border px-4 py-2.5 ${active === category ? "border-[#202020] bg-[#202020]" : "border-[#e5e5e5] bg-white"}`}><Text className={`text-sm font-medium ${active === category ? "text-white" : "text-foreground"}`}>{category}</Text></Pressable>)}
    </ScrollView></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      {loading && items.length === 0 ? <ActivityIndicator className="mt-16" color="#171717" /> : visible.length === 0 ? <View className="mt-24 items-center px-8"><View className="mb-4 size-14 items-center justify-center rounded-xl bg-[#f2f2f2]"><AppIcon name="notifications-outline" size={26} weight="regular" color="#555" /></View><Text className="text-base font-semibold text-foreground">No notifications yet</Text><Text className="mt-2 text-center text-sm text-muted-foreground">Care updates and appointment reminders will appear here.</Text></View> : <>{renderGroup("Today", today)}{renderGroup("Earlier", earlier)}</>}
    </ScrollView>
  </View>;
}
