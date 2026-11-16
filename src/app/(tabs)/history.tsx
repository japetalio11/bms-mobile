import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import type { JSX } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";
import { AppIcon } from "../../components/AppIcon";
import { MobileEmptyState } from "../../components/MobileEmptyState";
import { AppointmentBookingSheet } from "../../components/AppointmentBookingSheet";
import Animated, { FadeIn } from "react-native-reanimated";
import { useAuth } from "../../context/UserContext";
import { getAppointmentsByUserApi } from "../../config/api";
import type { AppointmentRecord } from "../../config/api";
import { getAppointmentsLocal, saveAppointmentsLocal } from "../../db/repository";
import { subscribeSyncEvents } from "../../services/syncEngine";

type HistoryTab = "upcoming" | "completed" | "cancelled";
const HISTORY_TABS: { id: HistoryTab; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

function appointmentDate(value: string): Date {
  const datePart = value?.split("T")[0] ?? "";
  const [year, month, day] = datePart.split("-").map(Number);
  if (year && month && day) return new Date(year, month - 1, day);
  return new Date(value);
}

function statusOf(appointment: AppointmentRecord): string {
  return (appointment.status || "scheduled").toLowerCase();
}

export default function HistoryScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const isDark = theme === "dark";
  const { user, token, isOnline, refreshProfile } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [activeTab, setActiveTab] = useState<HistoryTab>("upcoming");
  const [isLoading, setIsLoading] = useState(Boolean(user?.user_id && isOnline && token));
  const [appointmentSheetOpen, setAppointmentSheetOpen] = useState(false);

  const hasFacility = Boolean(user?.facility_id || user?.facility?.facility_id);

  useEffect(() => {
    let isMounted = true;
    if (!user?.user_id) return () => { isMounted = false; };

    if (isOnline && token) {
      refreshProfile().catch(() => {});
    }

    getAppointmentsLocal(user.user_id)
      .then((local) => {
        if (isMounted) setAppointments(local || []);
      })
      .catch(() => {});

    if (isOnline && token) {
      getAppointmentsByUserApi(user.user_id, token)
        .then(async (result) => {
          if (isMounted && Array.isArray(result)) {
            const currentLocal = await getAppointmentsLocal(user.user_id);
            const pendingLocal = currentLocal.filter((a: any) => a.sync_status === "pending");
            const freshIds = new Set(result.map((a) => a.appointment_id));
            const merged = [
              ...pendingLocal.filter((p) => !freshIds.has(p.appointment_id)),
              ...result.map((f) => {
                const pendingMatch = pendingLocal.find((p) => p.appointment_id === f.appointment_id);
                return pendingMatch || f;
              }),
            ];
            setAppointments(merged);
            await saveAppointmentsLocal(result, true);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }
    return () => { isMounted = false; };
  }, [user?.user_id, token, isOnline, refreshProfile]);

  useEffect(() => {
    const unsubscribe = subscribeSyncEvents((event) => {
      if (
        event.type === "sync_completed" ||
        event.actionType === "CREATE_APPOINTMENT" ||
        event.actionType === "CANCEL_APPOINTMENT"
      ) {
        if (user?.user_id) {
          getAppointmentsLocal(user.user_id)
            .then((local) => setAppointments(local || []))
            .catch(() => {});
        }
      }
    });
    return () => unsubscribe();
  }, [user?.user_id]);

  const groupedAppointments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      upcoming: appointments.filter((item) => {
        const status = statusOf(item);
        return status !== "completed" && status !== "cancelled" && status !== "canceled" && appointmentDate(item.appointment_date) >= today;
      }).sort((a, b) => appointmentDate(a.appointment_date).getTime() - appointmentDate(b.appointment_date).getTime()),
      completed: appointments.filter((item) => statusOf(item) === "completed"),
      cancelled: appointments.filter((item) => statusOf(item) === "cancelled" || statusOf(item) === "canceled"),
    };
  }, [appointments]);

  const currentAppointments = groupedAppointments[activeTab];

  if (!hasFacility) {
    return (
      <View className="flex-1 bg-background">
        <View className="mt-4 h-12 flex-row items-center justify-center bg-background px-4">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="absolute left-4 size-9 items-center justify-center active:opacity-70"
          >
            <AppIcon name="chevron-back" size={20} weight="bold" color={isDark ? "#f5f5f5" : "#262626"} />
          </Pressable>
          <Text className="text-2xl font-semibold text-foreground">Appointments</Text>
        </View>

        <View className="flex-1 items-center justify-center p-6">
          <View className="size-20 rounded-full bg-muted border border-blue-500/20 items-center justify-center mb-4">
            <AppIcon name="business-outline" size={36} color="#3b82f6" />
          </View>
          <Text className="text-foreground font-semibold text-base mb-2 text-center">
            Not Affiliated with any Facility
          </Text>
          <Text className="text-muted-foreground text-sm text-center max-w-sm leading-6 mb-6">
            You are currently not affiliated with any healthcare facility. Setting an appointment is only
            available once your account is linked to a health center.
          </Text>

          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            className="px-6 py-3 rounded-full flex-row items-center gap-2 active:opacity-85 shadow-none"
            style={{ backgroundColor: isDark ? "#fffe8c" : "#171717" }}
          >
            <AppIcon name="person-circle-outline" size={20} color={isDark ? "#171717" : "#ffffff"} />
            <Text style={{ color: isDark ? "#171717" : "#ffffff" }} className="font-semibold text-sm">View Profile</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="mt-4 h-12 flex-row items-center justify-center bg-background px-4">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="absolute left-4 size-9 items-center justify-center active:opacity-70"
        >
          <AppIcon name="chevron-back" size={20} weight="bold" color={isDark ? "#f5f5f5" : "#262626"} />
        </Pressable>
        <Text className="text-2xl font-semibold text-foreground">Appointments</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 184 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pt-3">
          <View className="overflow-hidden rounded-[18px] bg-[#262626]">
            <View className="flex-row bg-[#1b1b1b]">
              {HISTORY_TABS.map((tab) => {
                const selected = activeTab === tab.id;
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    className="min-h-12 flex-1 items-center justify-center rounded-t-[18px] px-2 active:opacity-75"
                    style={{ backgroundColor: selected ? "#262626" : tab.id === "upcoming" ? "#1b1b1b" : tab.id === "completed" ? "#222222" : "#292929" }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: selected ? "#f5f5f5" : "#a3a3a3" }}>
                      {tab.label} ({groupedAppointments[tab.id].length})
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Animated.View key={activeTab} entering={FadeIn.duration(180)} className="gap-3 bg-[#262626] px-3 pb-3 pt-3">
              {isLoading && appointments.length === 0 ? (
                <ActivityIndicator size="small" color="#fffe8c" className="py-8" />
              ) : currentAppointments.length > 0 ? (
                currentAppointments.map((appointment, index) => {
                  const date = appointmentDate(appointment.appointment_date);
                  const time = appointment.appointment_time || "Time to be confirmed";
                  const validDate = !Number.isNaN(date.getTime());
                  const dateLabel = validDate
                    ? date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                    : "Date to be confirmed";
                  const timeParts = time.split(" ");
                  const status = appointment.status || "Scheduled";
                  return (
                    <Pressable
                      key={appointment.appointment_id}
                      onPress={() => router.push({ pathname: "/(tabs)/appointment-detail", params: { id: appointment.appointment_id } })}
                      accessibilityRole="button"
                      accessibilityLabel={`${appointment.appointment_type}, ${dateLabel}, ${time}`}
                      className="flex-row gap-3 active:opacity-80"
                    >
                      <View className="w-12 items-end pt-4">
                        <Text className="text-sm font-semibold" style={{ color: "#f5f1c4" }} numberOfLines={1}>{timeParts[0]}</Text>
                        <Text className="text-sm" style={{ color: "#b9b48a" }}>{timeParts[1] || ""}</Text>
                        {index < currentAppointments.length - 1 && (
                          <View className="mr-1 mt-3 w-[2px] flex-1 rounded-full" style={{ backgroundColor: "#77713a" }} />
                        )}
                      </View>
                      <View
                        className="min-h-40 flex-1 justify-between rounded-[16px] p-4"
                        style={{ backgroundColor: "#302f22" }}
                      >
                        <View className="gap-2">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-sm" style={{ color: "#b9b48a" }}>{time}</Text>
                            {((appointment as any).sync_status === "pending" || appointment.appointment_id.startsWith("appt_local_")) && (
                              <View className="flex-row items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                <AppIcon name="cloud-offline-outline" size={11} color="#f59e0b" />
                                <Text className="text-[11px] text-amber-400 font-medium">Queued to sync</Text>
                              </View>
                            )}
                          </View>
                          <Text className="text-base font-semibold leading-6" style={{ color: "#f5f1c4" }} numberOfLines={2}>
                            {appointment.appointment_type}
                          </Text>
                        </View>
                        <View className="flex-row items-center justify-between gap-3">
                          <View className="flex-1 flex-row items-center gap-2">
                          <View className="size-9 items-center justify-center rounded-[10px]" style={{ backgroundColor: "#41402c" }}>
                              <AppIcon name="calendar" size={18} weight="bold" color="#fffe8c" />
                            </View>
                            <View className="flex-1">
                              <Text className="text-sm font-medium" style={{ color: "#f5f1c4" }} numberOfLines={1}>{dateLabel}</Text>
                              <Text className="text-sm" style={{ color: "#b9b48a" }} numberOfLines={1}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
                            </View>
                          </View>
                          <View className="size-9 items-center justify-center rounded-full bg-[#171717]">
                            <AppIcon name="arrow-up-right-box-outline" size={17} weight="bold" color="#ffffff" />
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <MobileEmptyState
                  icon="calendar"
                  title={`No ${activeTab} appointments`}
                  description={activeTab === "upcoming" ? "Scheduled visits will appear here." : `${activeTab === "completed" ? "Completed" : "Cancelled"} visits will appear here.`}
                />
              )}
            </Animated.View>
          </View>
        </View>
      </ScrollView>
      {activeTab === "upcoming" && currentAppointments.length === 0 && !isLoading && (
        <Pressable
          onPress={() => setAppointmentSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Set appointment"
          className="absolute right-5 min-h-14 flex-row items-center justify-center gap-2.5 rounded-full bg-[#fffe8c] px-6 active:opacity-85"
          style={{ bottom: Math.max(insets.bottom, 8) + 88 }}
        >
          <AppIcon name="add" size={21} weight="bold" color="#171717" />
          <Text className="text-base font-semibold text-[#171717]">Set Appointment</Text>
        </Pressable>
      )}
      {appointmentSheetOpen && (
        <AppointmentBookingSheet
          visible={appointmentSheetOpen}
          onClose={() => setAppointmentSheetOpen(false)}
          onCreated={async () => {
            if (user?.user_id) setAppointments(await getAppointmentsLocal(user.user_id));
          }}
        />
      )}
    </View>
  );
}
