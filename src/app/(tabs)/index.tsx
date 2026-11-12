import { View, ScrollView, Pressable, RefreshControl, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import type { ScrollViewInstance } from "react-native";
import { useState, useRef, useCallback, useMemo } from "react";
import type { JSX } from "react";
import { BottomSheet, Card, Text, useToast } from "heroui-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { NativeViewGestureHandler } from "react-native-gesture-handler";
import { Header } from "../../components/Header";
import { MotherQRCodeModal } from "../../components/MotherQRCodeModal";
import { UploadRecordSheet } from "../../components/UploadRecordSheet";
import { AppointmentBookingSheet } from "../../components/AppointmentBookingSheet";
import { BottomSheetHeader } from "../../components/BottomSheetHeader";
import { MobileEmptyState } from "../../components/MobileEmptyState";
import { useRouter, useFocusEffect } from "expo-router";
import { AppIcon as Ionicons } from "../../components/AppIcon";
import { useAuth } from "../../context/UserContext";
import { useNetwork } from "../../context/NetworkContext";
import { getAppointmentsByUserApi, getSupplementsByMotherApi } from "../../config/api";
import type { AppointmentRecord, SupplementRecord } from "../../config/api";
import { getAppointmentsLocal, getSupplementsLocal, saveAppointmentsLocal, saveSupplementsLocal } from "../../db/repository";
import { getWeekMilestone, PREGNANCY_WEEKS } from "../../lib/pregnancyTimeline";
import { getLoggedDoseIds, localDoseDate, setLoggedDoseIds } from "../../lib/doseLog";
import {
  triggerLightHaptic,
  triggerSelectionHaptic,
} from "../../lib/haptics";

export default function DashboardScreen(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const { width: screenWidth } = useWindowDimensions();
  const { user, token, motherRecord, activePregnancy, refreshProfile } = useAuth();
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [appointmentSheetOpen, setAppointmentSheetOpen] = useState(false);
  const { isOnline } = useNetwork();
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<SupplementRecord[]>([]);
  const [todayDoseIds, setTodayDoseIds] = useState<string[]>([]);
  const [doseLogDate, setDoseLogDate] = useState(localDoseDate);
  const [doseLogBusy, setDoseLogBusy] = useState(false);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null);
  const [appointmentTab, setAppointmentTab] = useState<"upcoming" | "completed">("upcoming");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [selectedTimelineWeek, setSelectedTimelineWeek] = useState<number | null>(null);
  const weekScrollerRef = useRef<ScrollViewInstance | null>(null);

  const calculateGestationalWeeks = (): {
    weeks: number;
    progress: number;
    remainingWeeks: number;
    trimesterText: string;
    hasPregnancy: boolean;
  } => {
    if (!activePregnancy || !activePregnancy.lmp_date) {
      return {
        weeks: 0,
        progress: 0,
        remainingWeeks: 0,
        trimesterText: "No active pregnancy record",
        hasPregnancy: false,
      };
    }

    const lmp = new Date(activePregnancy.lmp_date);
    if (isNaN(lmp.getTime())) {
      return {
        weeks: 0,
        progress: 0,
        remainingWeeks: 0,
        trimesterText: "LMP date pending",
        hasPregnancy: true,
      };
    }
    const now = new Date();
    const diffTime = Math.max(0, now.getTime() - lmp.getTime());
    const weeks = Math.min(42, Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7))));
    const remainingWeeks = Math.max(0, 40 - weeks);
    const progress = Math.min(100, Math.round((weeks / 40) * 100));

    let trimesterText = "First trimester";
    if (weeks > 27) {
      trimesterText = "Third trimester";
    } else if (weeks > 13) {
      trimesterText = "Second trimester";
    }

    return { weeks, progress, remainingWeeks, trimesterText, hasPregnancy: true };
  };

  const gestationalData = calculateGestationalWeeks();
  const timelineWeek = selectedTimelineWeek ?? Math.min(40, Math.max(1, gestationalData.weeks || 1));
  const activeDetailMilestone = getWeekMilestone(timelineWeek);

  const loadAppointments = useCallback(async () => {
    if (!user?.user_id) return;
    try {
      setAppointments(await getAppointmentsLocal(user.user_id));
    } catch (error) {
      console.warn("Could not read saved appointments:", error);
    }
    if (isOnline && token) {
      try {
        const fresh = await getAppointmentsByUserApi(user.user_id, token);
        setAppointments(fresh);
        await saveAppointmentsLocal(fresh, true);
      } catch (error) {
        console.warn("Could not refresh appointments:", error);
      }
    }
  }, [user, token, isOnline]);

  useFocusEffect(useCallback(() => { void loadAppointments(); }, [loadAppointments]));

  const loadPrescriptions = useCallback(async () => {
    if (!motherRecord?.mother_id) {
      setPrescriptions([]);
      return;
    }
    try {
      setPrescriptions(await getSupplementsLocal(motherRecord.mother_id));
    } catch (error) {
      console.warn("Could not read saved prescriptions:", error);
    }
    if (isOnline && token) {
      try {
        const fresh = await getSupplementsByMotherApi(motherRecord.mother_id, token);
        setPrescriptions(fresh);
        await saveSupplementsLocal(fresh, true);
      } catch (error) {
        console.warn("Could not refresh prescriptions:", error);
      }
    }
  }, [motherRecord, isOnline, token]);

  useFocusEffect(useCallback(() => { void loadPrescriptions(); }, [loadPrescriptions]));

  const loadDoseLog = useCallback(async () => {
    const date = localDoseDate();
    setDoseLogDate(date);
    if (!user?.user_id) {
      setTodayDoseIds([]);
      return;
    }
    try {
      setTodayDoseIds(await getLoggedDoseIds(user.user_id, date));
    } catch (error) {
      console.warn("Could not read today's dose log:", error);
      setTodayDoseIds([]);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void loadDoseLog(); }, [loadDoseLog]));

  const prescriptionProgress = useMemo(() => {
    const ordered = prescriptions.filter((item) => !item.is_completed);
    const selected = ordered.find((item) => item.supplement_id === selectedPrescriptionId) ?? ordered.find((item) => !todayDoseIds.includes(item.supplement_id)) ?? ordered[0];
    return { ordered, selected, logged: ordered.filter((item) => todayDoseIds.includes(item.supplement_id)).length };
  }, [prescriptions, selectedPrescriptionId, todayDoseIds]);

  const toggleSelectedDose = async () => {
    const prescription = prescriptionProgress.selected;
    if (!user?.user_id || !prescription || doseLogBusy) return;
    setDoseLogBusy(true);
    try {
      const date = localDoseDate();
      const current = date === doseLogDate ? todayDoseIds : await getLoggedDoseIds(user.user_id, date);
      const wasLogged = current.includes(prescription.supplement_id);
      const next = wasLogged ? current.filter((id) => id !== prescription.supplement_id) : [...current, prescription.supplement_id];
      await setLoggedDoseIds(user.user_id, date, next);
      setDoseLogDate(date);
      setTodayDoseIds(next);
      triggerLightHaptic();
      toast.show({ label: wasLogged ? "Dose log removed" : "Dose logged for today", variant: "success" });
    } catch (error) {
      console.warn("Could not save today's dose:", error);
      toast.show({ label: "Could not save dose log", description: "Please try again.", variant: "danger" });
    } finally {
      setDoseLogBusy(false);
    }
  };

  const appointmentGroups = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateFor = (item: AppointmentRecord) => {
      const value = item.appointment_date?.split("T")[0] ?? "";
      const [year, month, day] = value.split("-").map(Number);
      return year && month && day ? new Date(year, month - 1, day) : new Date(item.appointment_date);
    };
    const completed = appointments.filter((item) => item.status?.toLowerCase() === "completed");
    const upcoming = appointments.filter((item) => {
      const status = item.status?.toLowerCase();
      return status !== "completed" && status !== "cancelled" && status !== "canceled" && dateFor(item) >= today;
    });
    upcoming.sort((a, b) => dateFor(a).getTime() - dateFor(b).getTime());
    completed.sort((a, b) => dateFor(b).getTime() - dateFor(a).getTime());
    return { upcoming, completed, dateFor };
  }, [appointments]);

  const shownAppointments = appointmentGroups[appointmentTab].slice(0, 3);

  const onRefresh = async () => {
    triggerLightHaptic();
    setIsRefreshing(true);
    try {
      await Promise.all([refreshProfile(), loadAppointments(), loadPrescriptions(), loadDoseLog()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const openTimelineModal = () => {
    triggerLightHaptic();
    const initialWeek = Math.min(40, Math.max(1, gestationalData.weeks || 1));
    setSelectedTimelineWeek(initialWeek);
    setIsTimelineModalOpen(true);
    setTimeout(() => {
      weekScrollerRef.current?.scrollTo({
        x: Math.max(0, (initialWeek - 2.5) * 60),
        animated: false,
      });
    }, 100);
  };

  const jumpToCurrentWeek = (animated = true) => {
    triggerLightHaptic();
    const target = Math.min(40, Math.max(1, gestationalData.weeks || 1));
    setSelectedTimelineWeek(target);
    if (weekScrollerRef.current) {
      weekScrollerRef.current.scrollTo({
        x: Math.max(0, (target - 2.5) * 60),
        animated,
      });
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#003f2c" />}
      >
        <Card className="px-5 pt-5 pb-6 gap-7 rounded-none border-0" style={{ backgroundColor: "#1f1f1f" }}>
          <Header
            variant="dashboard"
            darkHero
            subtitle={gestationalData.hasPregnancy
              ? gestationalData.trimesterText.replace(/\b\w/g, (letter) => letter.toUpperCase())
              : "Maternal care"}
          />

          <View className="gap-1">
            <Text className="text-sm" style={{ color: "#a3a3a3" }}>Active Pregnancy</Text>
            <Text className="text-[36px] leading-[42px] font-semibold" style={{ color: "#fafafa" }}>
              {gestationalData.hasPregnancy ? `Week ${gestationalData.weeks}` : "No active pregnancy"}
            </Text>
          </View>

          <View className={`gap-2 ${screenWidth < 360 ? "flex-col" : "flex-row"}`}>
            <Pressable
              onPress={() => {
                triggerLightHaptic();
                setAppointmentSheetOpen(true);
              }}
              className="flex-1 min-h-12 flex-row items-center justify-center gap-2 rounded-full px-3 active:opacity-85"
              style={{ backgroundColor: "#fffe8c" }}
            >
              <Ionicons name="add" weight="bold" size={20} color="#111111" />
              <Text className="text-sm font-medium" style={{ color: "#111111" }}>Set Appointment</Text>
            </Pressable>
            <Pressable
              onPress={gestationalData.hasPregnancy ? openTimelineModal : () => router.push("/(tabs)/records")}
              className="flex-1 min-h-12 flex-row items-center justify-center gap-2 rounded-full px-3 active:opacity-85"
              style={{ backgroundColor: "#303030" }}
            >
              <Ionicons name="navigate-outline" weight="bold" size={19} color="#fafafa" />
              <Text className="text-sm font-medium" style={{ color: "#fafafa" }}>Track Pregnancy</Text>
            </Pressable>
          </View>
        </Card>

        <LinearGradient
          colors={["#fffecb", "#fffef0", "#ffffff"]}
          locations={[0, 0.32, 0.78]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ width: "100%" }}
        >
        <Animated.View entering={FadeInUp.duration(220)} className="px-4 pt-8">
          <View className="flex-row justify-between">
            {[
              { label: "QR Connect", icon: "qr-code-outline" as const, route: "qr-connect", weight: "bold" as const },
              { label: "Upload EHR", icon: "cloud-upload-outline" as const, route: "upload-ehr", weight: "bold" as const },
              { label: "Appointment History", icon: "calendar-outline" as const, route: "/(tabs)/history", weight: "bold" as const },
              { label: "Messages", icon: "chatbubble-ellipses-outline" as const, route: "/(tabs)/chat", weight: "bold" as const },
            ].map((action) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  triggerLightHaptic();
                  if (action.route === "qr-connect") setQrModalOpen(true);
                  else if (action.route === "upload-ehr") setUploadSheetOpen(true);
                  else router.push(action.route as never);
                }}
                className="w-[24%] items-center gap-2 active:opacity-75"
              >
                <View className="size-14 rounded-full items-center justify-center" style={{ backgroundColor: "#262626" }}>
                  <Ionicons name={action.icon} weight={action.weight} size={22} color="#fffe8c" />
                </View>
                <Text className="text-foreground text-sm font-medium text-center" numberOfLines={2}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <View className="gap-3 px-4 pt-8">
          <View className="min-h-11 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">Your prescriptions</Text>
            <Pressable
              onPress={() => router.push({ pathname: "/(tabs)/records", params: { tab: "prescriptions" } })}
              accessibilityRole="link"
              className="min-h-11 justify-center active:opacity-70"
            >
              <Text className="text-sm font-medium" style={{ color: "#8a8100" }}>See all</Text>
            </Pressable>
          </View>
          <View className="rounded-[18px] bg-[#1f1f1f] p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-[#f5f5f5]">Today&apos;s doses</Text>
              <Text className="text-sm font-medium text-[#fffe8c]">{prescriptionProgress.logged} of {prescriptionProgress.ordered.length} logged</Text>
            </View>

            {prescriptionProgress.ordered.length > 0 ? (
              <>
                <View className="mt-5 flex-row items-center">
                  {prescriptionProgress.ordered.slice(0, 4).map((prescription, index) => {
                    const isSelected = prescription.supplement_id === prescriptionProgress.selected?.supplement_id;
                    const isLogged = todayDoseIds.includes(prescription.supplement_id);
                    return (
                      <View key={prescription.supplement_id} className="flex-1 flex-row items-center">
                        {index > 0 && <View className="h-0.5 flex-1 bg-[#595959]" />}
                        <Pressable
                          onPress={() => setSelectedPrescriptionId(prescription.supplement_id)}
                          accessibilityRole="button"
                          accessibilityLabel={`${prescription.supplement_type}, ${isLogged ? "logged today" : "not logged today"}`}
                          className="size-9 items-center justify-center rounded-full"
                          style={{ backgroundColor: isLogged ? "#fffe8c" : isSelected ? "#e8ddff" : "#353535" }}
                        >
                          <Ionicons name={isLogged ? "checkmark" : "time-outline"} weight="bold" size={17} color={isLogged || isSelected ? "#171717" : "#f5f5f5"} />
                        </Pressable>
                        {index < Math.min(prescriptionProgress.ordered.length, 4) - 1 && <View className="h-0.5 flex-1 bg-[#595959]" />}
                      </View>
                    );
                  })}
                </View>
                <View className="mt-4 flex-row items-center justify-between gap-3 rounded-xl bg-[#303030] px-3 py-2.5">
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-[#fafafa]" numberOfLines={1}>{prescriptionProgress.selected?.supplement_type}</Text>
                    <Text className="text-sm text-[#a3a3a3]">{prescriptionProgress.selected?.tablets_given_count ?? 0} tablets prescribed</Text>
                  </View>
                  <Pressable
                    onPress={toggleSelectedDose}
                    disabled={doseLogBusy}
                    accessibilityRole="button"
                    className="min-h-11 justify-center rounded-full px-3 active:opacity-80 disabled:opacity-50"
                    style={{ backgroundColor: todayDoseIds.includes(prescriptionProgress.selected?.supplement_id ?? "") ? "#454545" : "#fffe8c" }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: todayDoseIds.includes(prescriptionProgress.selected?.supplement_id ?? "") ? "#fafafa" : "#171717" }}>
                      {todayDoseIds.includes(prescriptionProgress.selected?.supplement_id ?? "") ? "Undo log" : "Log dose"}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text className="mt-4 text-sm text-[#a3a3a3]">Prescriptions from your care team will appear here.</Text>
            )}

          </View>
        </View>

        <View className="px-4 pt-9 gap-4">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-base font-semibold text-foreground">Your appointments</Text>
            <Pressable
              onPress={() => router.push({ pathname: "/(tabs)/history" })}
              accessibilityRole="link"
              className="min-h-11 justify-center active:opacity-70"
            >
              <Text className="text-sm font-medium" style={{ color: "#8a8100" }}>See all</Text>
            </Pressable>
          </View>

          <View className="overflow-hidden rounded-[18px]" style={{ backgroundColor: "#262626" }}>
            <View className="flex-row" style={{ backgroundColor: "#1b1b1b" }}>
              {(["upcoming", "completed"] as const).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setAppointmentTab(tab)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: appointmentTab === tab }}
                  className="min-h-12 flex-1 items-center justify-center rounded-t-[18px] px-3 active:opacity-75"
                  style={{ backgroundColor: appointmentTab === tab ? "#262626" : tab === "upcoming" ? "#1b1b1b" : "#222222" }}
                >
                  <Text className="text-sm font-semibold" style={{ color: appointmentTab === tab ? "#f5f5f5" : "#a3a3a3" }}>
                    {tab === "upcoming" ? "Upcoming" : "Completed"} ({appointmentGroups[tab].length})
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="gap-3 px-3 pb-3 pt-3" style={{ backgroundColor: "#262626" }}>
            {shownAppointments.map((appointment) => {
              const date = appointmentGroups.dateFor(appointment);
              const dateLabel = Number.isNaN(date.getTime())
                ? "Date to be confirmed"
                : date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
              const timeLabel = appointment.appointment_time || "Time to be confirmed";
              return (
                <Pressable
                  key={appointment.appointment_id}
                  onPress={() => router.push({ pathname: "/(tabs)/appointment-detail", params: { id: appointment.appointment_id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${appointment.appointment_type}, ${dateLabel}, ${timeLabel}`}
                  className="flex-row gap-3 active:opacity-80"
                >
                  <View className="w-12 items-end pt-4">
                    <Text className="text-sm font-semibold" style={{ color: "#f5f1c4" }} numberOfLines={1}>{timeLabel.split(" ")[0]}</Text>
                    <Text className="text-sm" style={{ color: "#b9b48a" }}>{timeLabel.split(" ")[1] || ""}</Text>
                    <View className="mr-1 mt-3 w-[2px] flex-1 rounded-full" style={{ backgroundColor: "#77713a" }} />
                  </View>
                  <View className="min-h-40 flex-1 justify-between rounded-[16px] p-4" style={{ backgroundColor: "#302f22" }}>
                    <View className="gap-2">
                      <Text className="text-sm" style={{ color: "#b9b48a" }}>{timeLabel}</Text>
                      <Text className="text-base font-semibold leading-6" style={{ color: "#f5f1c4" }} numberOfLines={2}>{appointment.appointment_type}</Text>
                    </View>
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1 flex-row items-center gap-2">
                        <View className="size-9 rounded-[10px] items-center justify-center" style={{ backgroundColor: "#41402c" }}>
                          <Ionicons name="calendar-outline" weight="bold" size={18} color="#fffe8c" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-medium" style={{ color: "#f5f1c4" }} numberOfLines={2}>{dateLabel}</Text>
                          <Text className="text-sm" style={{ color: "#b9b48a" }}>{appointment.status ? appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1).toLowerCase() : "Scheduled"}</Text>
                        </View>
                      </View>
                      <View className="size-9 rounded-full items-center justify-center" style={{ backgroundColor: "#171717" }}>
                        <Ionicons name="arrow-up-right-box-outline" weight="bold" size={17} color="#ffffff" />
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
            {shownAppointments.length === 0 && (
              <MobileEmptyState
                icon="calendar-outline"
                title={appointmentTab === "upcoming" ? "No upcoming appointments" : "No completed appointments"}
                description={appointmentTab === "upcoming" ? "Your scheduled visits will appear here." : "Completed visits will appear here after your appointment."}
                action={appointmentTab === "upcoming" ? (
                  <Pressable onPress={() => setAppointmentSheetOpen(true)} className="min-h-11 justify-center rounded-md bg-[#fffe8c] px-3 active:opacity-80">
                    <Text className="text-sm font-medium text-[#171717]">Schedule Appointment</Text>
                  </Pressable>
                ) : undefined}
              />
            )}
            </View>
          </View>
        </View>
        </LinearGradient>
      </ScrollView>

      <BottomSheet isOpen={isTimelineModalOpen} onOpenChange={open => { if (!open) setIsTimelineModalOpen(false); }}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay className="bg-black/60" />
          <BottomSheet.Content snapPoints={["66%"]} enableDynamicSizing={false} enableOverDrag={false} contentContainerClassName="h-full" backgroundClassName="rounded-t-[24px] bg-background" handleIndicatorClassName="bg-muted">
            <View className="flex-1 px-5 pb-5 pt-1">
              <BottomSheetHeader title="Track pregnancy" description="Follow your pregnancy week by week." onClose={() => setIsTimelineModalOpen(false)} closeLabel="Close pregnancy timeline" />
              <BottomSheetScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
              <View className="mb-4 rounded-2xl bg-surface p-4">
                <View className="flex-row items-start justify-between gap-3">
                  <View>
                    <Text className="text-sm font-medium text-muted-foreground">Pregnancy timeline</Text>
                    <Text className="mt-1 text-2xl font-semibold text-foreground">Week {timelineWeek}</Text>
                    <Text className="mt-1 text-sm text-muted-foreground">Trimester {activeDetailMilestone.trimester} · {Math.max(0, 40 - timelineWeek)} weeks remaining</Text>
                  </View>
                  {timelineWeek !== gestationalData.weeks && (
                    <Pressable onPress={() => jumpToCurrentWeek(true)} accessibilityRole="button" className="min-h-10 justify-center rounded-md bg-[#fffe8c] px-3">
                      <Text className="text-sm font-medium text-[#171717]">Today</Text>
                    </Pressable>
                  )}
                </View>
                <View accessibilityLabel={`Pregnancy progress: week ${timelineWeek} of 40`} className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <View className="h-full rounded-full bg-[#e5dc42]" style={{ width: `${Math.min(100, (timelineWeek / 40) * 100)}%` }} />
                </View>
                <View className="mt-2 flex-row justify-between">
                  <Text className="text-sm text-muted-foreground">Week {timelineWeek}</Text>
                  <Text className="text-sm text-muted-foreground">40 weeks</Text>
                </View>
              </View>
              <Text className="mb-2 text-sm font-medium text-muted-foreground">Explore a week</Text>
              <NativeViewGestureHandler disallowInterruption>
                <ScrollView ref={weekScrollerRef} horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} className="mb-5 grow-0" contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
                  {PREGNANCY_WEEKS.map(item => {
                    const selected = item.week === timelineWeek;
                    return <Pressable key={item.week} onPress={() => { triggerSelectionHaptic(); setSelectedTimelineWeek(item.week); }} accessibilityRole="button" accessibilityLabel={`Week ${item.week}`} accessibilityState={{ selected }} className={`min-h-11 min-w-11 items-center justify-center rounded-xl px-3 ${selected ? "bg-[#fffe8c]" : "bg-surface active:opacity-70"}`}>
                      <Text className={`text-sm font-semibold ${selected ? "text-[#171717]" : "text-muted-foreground"}`}>{item.week}</Text>
                    </Pressable>;
                  })}
                </ScrollView>
              </NativeViewGestureHandler>
              <View className="gap-4">
                <View className="rounded-2xl bg-surface p-4">
                  <Text className="text-sm font-medium text-muted-foreground">Baby’s development</Text>
                  <Text className="mt-1 text-base font-semibold text-foreground">{activeDetailMilestone.sizeComparison}</Text>
                  <Text className="mt-2 text-sm leading-5 text-muted-foreground">{activeDetailMilestone.babyDevelopment}</Text>
                  <View className="mt-4 flex-row gap-3">
                    <View className="flex-1 rounded-xl bg-background px-3 py-2.5">
                      <Text className="text-sm text-muted-foreground">Length</Text>
                      <Text className="mt-1 text-base font-semibold text-foreground">{activeDetailMilestone.approxLength}</Text>
                    </View>
                    <View className="flex-1 rounded-xl bg-background px-3 py-2.5">
                      <Text className="text-sm text-muted-foreground">Weight</Text>
                      <Text className="mt-1 text-base font-semibold text-foreground">{activeDetailMilestone.approxWeight}</Text>
                    </View>
                  </View>
                </View>
                <View className="px-1">
                  <Text className="text-base font-semibold text-foreground">For you</Text>
                  <Text className="mt-1 text-sm leading-5 text-muted-foreground">{activeDetailMilestone.momExperience}</Text>
                </View>
                {activeDetailMilestone.clinicalMilestone && (
                  <View className="rounded-2xl bg-[#fffedc] p-4">
                    <Text className="text-sm font-semibold text-foreground">Care milestone</Text>
                    <Text className="mt-1 text-sm leading-5 text-foreground/80">{activeDetailMilestone.clinicalMilestone}</Text>
                  </View>
                )}
              </View>
              </BottomSheetScrollView>
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
      <MotherQRCodeModal
        visible={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        user={user}
        motherRecord={motherRecord}
      />
      <UploadRecordSheet visible={uploadSheetOpen} onClose={() => setUploadSheetOpen(false)} />
      <AppointmentBookingSheet visible={appointmentSheetOpen} onClose={() => setAppointmentSheetOpen(false)} onCreated={loadAppointments} />
    </View>
  );
}
