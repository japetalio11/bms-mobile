import {
  View,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Modal,
} from "react-native";
import { useState, useEffect, useCallback, useRef } from "react";
import type { JSX } from "react";
import { Card, Text, Checkbox, Button } from "heroui-native";
import { Header } from "../../components/Header";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/UserContext";
import { useNetwork } from "../../context/NetworkContext";
import {
  getSupplementsByMotherApi,
  updateSupplementStatusApi,
  getAppointmentsByUserApi,
} from "../../config/api";
import type { SupplementRecord, AppointmentRecord } from "../../config/api";
import {
  getSupplementsLocal,
  saveSupplementsLocal,
  updateSupplementStatusLocal,
  getAppointmentsLocal,
  saveAppointmentsLocal,
} from "../../db/repository";
import {
  getWeekMilestone,
  PREGNANCY_WEEKS,
  type WeekMilestone,
} from "../../lib/pregnancyTimeline";

export default function DashboardScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token, motherRecord, activePregnancy, refreshProfile } = useAuth();
  const { isOnline } = useNetwork();

  const [supplements, setSupplements] = useState<SupplementRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [selectedTimelineWeek, setSelectedTimelineWeek] = useState<number>(1);
  const weekScrollerRef = useRef<ScrollView>(null);

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
  const currentWeekMilestone = getWeekMilestone(gestationalData.weeks || 1);
  const activeDetailMilestone = getWeekMilestone(selectedTimelineWeek);

  // Sync selected timeline week with active pregnancy week
  useEffect(() => {
    if (gestationalData.weeks > 0) {
      setSelectedTimelineWeek(Math.min(40, Math.max(1, gestationalData.weeks)));
    }
  }, [gestationalData.weeks]);

  const loadData = useCallback(async () => {
    if (motherRecord?.mother_id) {
      try {
        const localSupps = await getSupplementsLocal(motherRecord.mother_id);
        if (localSupps && localSupps.length > 0) setSupplements(localSupps);
      } catch (e) {
        console.warn("Local supplements load error:", e);
      }
    }

    if (user?.user_id) {
      try {
        const localAppts = await getAppointmentsLocal(user.user_id);
        if (localAppts && localAppts.length > 0) setAppointments(localAppts);
      } catch (e) {
        console.warn("Local appointments load error:", e);
      }
    }

    if (isOnline && token) {
      if (motherRecord?.mother_id) {
        getSupplementsByMotherApi(motherRecord.mother_id, token)
          .then((res) => {
            if (Array.isArray(res)) {
              setSupplements(res);
              saveSupplementsLocal(res, true);
            }
          })
          .catch(() => {});
      }

      if (user?.user_id) {
        getAppointmentsByUserApi(user.user_id, token)
          .then((res) => {
            if (Array.isArray(res)) {
              setAppointments(res);
              saveAppointmentsLocal(res, true);
            }
          })
          .catch(() => {});
      }
    }
  }, [motherRecord?.mother_id, user?.user_id, token, isOnline]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadData(), refreshProfile()]);
    setIsRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleToggleSupplement = async (supplementId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;

    setSupplements((prev) =>
      prev.map((item) =>
        item.supplement_id === supplementId ? { ...item, is_completed: nextStatus } : item
      )
    );

    try {
      await updateSupplementStatusLocal(supplementId, nextStatus, isOnline);
      if (isOnline && token) {
        await updateSupplementStatusApi(
          { supplement_id: supplementId, is_completed: nextStatus },
          token
        );
      }
    } catch (err) {
      console.warn("Supplement update error:", err);
    }
  };

  const openTimelineModal = () => {
    const initialWeek = Math.min(40, Math.max(1, gestationalData.weeks || 1));
    setSelectedTimelineWeek(initialWeek);
    setIsTimelineModalOpen(true);
  };

  const jumpToCurrentWeek = () => {
    const target = Math.min(40, Math.max(1, gestationalData.weeks || 1));
    setSelectedTimelineWeek(target);
    if (weekScrollerRef.current) {
      weekScrollerRef.current.scrollTo({
        x: Math.max(0, (target - 3) * 64),
        animated: true,
      });
    }
  };

  const nextAppointment = appointments.length > 0 ? appointments[0] : null;

  return (
    <View className="flex-1 bg-background">
      <Header title={`Good day${user.first_name ? `, ${user.first_name}` : ""} 👋`} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        <View className="px-5 pt-3">
          {/* Interactive Gestational Card */}
          <Pressable
            onPress={gestationalData.hasPregnancy ? openTimelineModal : undefined}
            className="active:opacity-90"
          >
            <Card className="mb-6 p-4 bg-surface gap-3.5 rounded-3xl border-0">
              {gestationalData.hasPregnancy ? (
                <>
                  {/* Top Week & Progress Row */}
                  <View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-foreground text-lg font-bold">
                        Week {gestationalData.weeks}
                      </Text>
                      <View className="bg-[#3b82f6]/15 px-3 py-1 rounded-full">
                        <Text className="text-[#3b82f6] text-xs font-bold">
                          {gestationalData.progress}%
                        </Text>
                      </View>
                    </View>
                    <Text className="text-zinc-400 text-xs mt-0.5">
                      {gestationalData.trimesterText} · {gestationalData.remainingWeeks} weeks to go
                    </Text>
                  </View>

                  {/* Fetus Image & Floating Size Tag */}
                  <View className="relative overflow-hidden rounded-2xl">
                    <Image
                      source={require("../../../assets/fetus.jpg")}
                      className="w-full h-44 rounded-2xl"
                      resizeMode="cover"
                    />
                    <View className="absolute bottom-3 left-3 bg-black/75 px-3 py-1.5 rounded-full flex-row items-center gap-1.5 shadow-xs">
                      <Ionicons name="nutrition-outline" size={13} color="#60a5fa" />
                      <Text className="text-white text-xs font-semibold">
                        Size of {currentWeekMilestone.sizeComparison} ({currentWeekMilestone.approxLength})
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar Row */}
                  <View className="gap-1.5">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-foreground text-xs font-medium">
                        Maternal Progress Overview
                      </Text>
                      <Text className="text-zinc-400 text-xs font-medium">
                        {gestationalData.weeks} wks
                      </Text>
                    </View>
                    <View className="h-2 w-full bg-default rounded-full overflow-hidden">
                      <View
                        className="h-full bg-[#3b82f6] rounded-full"
                        style={{ width: `${gestationalData.progress}%` }}
                      />
                    </View>
                  </View>

                  {/* Clean Bottom Milestone Summary */}
                  <View className="flex-row items-center justify-between pt-2 border-t border-separator/20">
                    <Text className="text-zinc-400 text-xs flex-1 mr-2 leading-4" numberOfLines={1}>
                      {currentWeekMilestone.babyDevelopment}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color="#71717a" />
                  </View>
                </>
              ) : (
                <View className="py-6 items-center">
                  <Ionicons name="medical-outline" size={32} color="#3b82f6" className="mb-2" />
                  <Text className="text-foreground font-semibold text-base mb-1">
                    Maternal Care Dashboard
                  </Text>
                  <Text className="text-zinc-400 text-sm text-center">
                    Your pregnancy and prenatal visit records will appear here once registered by your
                    healthcare facility.
                  </Text>
                </View>
              )}
            </Card>
          </Pressable>

          {/* 1. Upcoming Appointments */}
          <View className="mb-6">
            <Text className="text-foreground text-lg font-semibold mb-3">
              Upcoming Appointments
            </Text>

            {nextAppointment ? (
              <Pressable onPress={() => router.push("/(tabs)/appointments")}>
                <Card className="p-4 bg-surface flex-row items-center gap-3.5 rounded-2xl border-0">
                  <View className="items-center justify-center w-12 bg-[#3b82f6]/15 rounded-xl py-2">
                    <Text className="text-[#3b82f6] text-xs font-bold">
                      {new Date(nextAppointment.appointment_date).toLocaleDateString("en-US", {
                        weekday: "short",
                      })}
                    </Text>
                    <Text className="text-foreground text-base font-bold">
                      {new Date(nextAppointment.appointment_date).getDate()}
                    </Text>
                  </View>

                  <View className="flex-1">
                    <Text className="text-foreground font-semibold text-sm">
                      {nextAppointment.appointment_type}
                    </Text>
                    <Text className="text-zinc-400 text-xs mt-0.5">
                      {new Date(nextAppointment.appointment_date).toLocaleDateString()} ·{" "}
                      {nextAppointment.appointment_time}
                    </Text>
                  </View>

                  <View className="size-8 rounded-full bg-[#3b82f6]/15 items-center justify-center">
                    <Ionicons name="chevron-forward" size={14} color="#3b82f6" />
                  </View>
                </Card>
              </Pressable>
            ) : (
              <Card className="p-4 bg-surface rounded-2xl border-0 items-center py-6">
                <Ionicons name="calendar-outline" size={24} color="#71717a" className="mb-2" />
                <Text className="text-zinc-400 text-sm">No upcoming appointments scheduled.</Text>
              </Card>
            )}
          </View>

          {/* 2. Daily Prescriptions */}
          <View className="mb-6">
            <Text className="text-foreground text-lg font-semibold mb-3">Daily Prescriptions</Text>

            {supplements.length > 0 ? (
              <View className="gap-3">
                {supplements.map((item) => (
                  <Card
                    key={item.supplement_id}
                    className="p-4 bg-surface flex-row items-center gap-4 rounded-2xl border-0"
                  >
                    <Checkbox
                      isSelected={item.is_completed}
                      onSelectedChange={() =>
                        handleToggleSupplement(item.supplement_id, item.is_completed)
                      }
                      className="border-2 border-zinc-400 dark:border-zinc-500"
                    />
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold text-sm">
                        {item.supplement_type}
                      </Text>
                      <Text className="text-zinc-400 text-xs mt-0.5">
                        {item.tablets_given_count} tablets prescribed
                      </Text>
                    </View>
                    <View
                      className={`px-3 py-1 rounded-full ${item.is_completed ? "bg-emerald-500/20" : "bg-amber-400/20 border border-amber-400/30"}`}
                    >
                      <Text
                        className={`text-xs font-semibold ${item.is_completed ? "text-emerald-400" : "text-amber-300"}`}
                      >
                        {item.is_completed ? "Done" : "Pending"}
                      </Text>
                    </View>
                  </Card>
                ))}
              </View>
            ) : (
              <Card className="p-4 bg-surface rounded-2xl border-0 items-center py-6">
                <Ionicons name="leaf-outline" size={24} color="#71717a" className="mb-2" />
                <Text className="text-zinc-400 text-sm">No active daily prescriptions logged.</Text>
              </Card>
            )}
          </View>

          {/* 3. Vitals & Analytics */}
          <View className="mb-6">
            <Text className="text-foreground text-lg font-semibold mb-3">Vitals & Analytics</Text>

            <Pressable onPress={() => router.push("/(tabs)/vitals")}>
              <Card className="p-4 bg-surface flex-row items-center gap-3.5 rounded-2xl border-0">
                <View className="size-11 rounded-full bg-blue-500/15 items-center justify-center">
                  <Ionicons name="pulse" size={20} color="#3b82f6" />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-semibold text-sm">
                    Blood pressure, heart rate, weight
                  </Text>
                  <Text className="text-zinc-400 text-xs mt-0.5">
                    Mother & newborn health tracking
                  </Text>
                </View>
                <View className="size-8 rounded-full bg-default items-center justify-center">
                  <Ionicons name="chevron-forward" size={14} color="#a1a1aa" />
                </View>
              </Card>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* 40-Week Gestational Timeline Interactive Scrubber Modal */}
      <Modal
        visible={isTimelineModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsTimelineModalOpen(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <Card
            className="w-full h-[85%] bg-surface rounded-t-3xl border-0 p-5 gap-3.5"
            style={{ paddingBottom: Math.max(24, insets.bottom + 16) }}
          >
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-2 border-b border-separator/20">
              <View className="flex-1 mr-2">
                <Text className="text-foreground font-bold text-base">40-Week Timeline</Text>
                <Text className="text-zinc-400 text-xs mt-0.5">
                  Slide across weeks to explore baby's development
                </Text>
              </View>
              <Pressable
                onPress={() => setIsTimelineModalOpen(false)}
                className="size-8 rounded-full bg-default items-center justify-center active:opacity-75 shrink-0"
              >
                <Ionicons name="close" size={18} color="#71717a" />
              </Pressable>
            </View>

            {/* Jump to Current Week action */}
            {gestationalData.weeks > 0 && (
              <View className="flex-row items-center justify-between bg-primary/10 px-3 py-2.5 rounded-xl gap-2">
                <View className="flex-row items-center gap-2 flex-1 min-w-0">
                  <Ionicons name="time-outline" size={15} color="#3b82f6" />
                  <Text
                    className="text-primary text-xs font-semibold flex-1"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    Current: Week {gestationalData.weeks} ({gestationalData.trimesterText})
                  </Text>
                </View>
                <Pressable
                  onPress={jumpToCurrentWeek}
                  className="bg-primary px-3 py-1.5 rounded-lg active:opacity-80 shrink-0"
                >
                  <Text className="text-white text-[11px] font-bold">My Week</Text>
                </Pressable>
              </View>
            )}

            {/* Horizontal Week Scrubber / Slider */}
            <View className="py-1">
              <ScrollView
                ref={weekScrollerRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
              >
                {PREGNANCY_WEEKS.map((item) => {
                  const isSelected = item.week === selectedTimelineWeek;
                  const isCurrent = item.week === gestationalData.weeks;

                  return (
                    <Pressable
                      key={item.week}
                      onPress={() => setSelectedTimelineWeek(item.week)}
                      className={`w-13 py-2 rounded-xl items-center justify-center border ${
                        isSelected
                          ? "bg-primary border-primary shadow-xs"
                          : isCurrent
                          ? "bg-primary/15 border-primary/40"
                          : "bg-default border-transparent"
                      }`}
                    >
                      <Text
                        className={`text-[9px] font-semibold uppercase ${
                          isSelected ? "text-white/80" : "text-zinc-400"
                        }`}
                      >
                        Wk
                      </Text>
                      <Text
                        className={`text-sm font-bold ${
                          isSelected ? "text-white" : isCurrent ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {item.week}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Detailed Week Card Content */}
            <ScrollView showsVerticalScrollIndicator={false} className="gap-3 flex-1">
              {/* Main Week Badge Card */}
              <Card className="p-3.5 bg-default/70 rounded-2xl border-0 gap-2 mb-2.5">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-foreground font-bold text-base">
                      Week {activeDetailMilestone.week}
                    </Text>
                    <Text className="text-zinc-400 text-xs mt-0.5">
                      Trimester {activeDetailMilestone.trimester} ·{" "}
                      {Math.max(0, 40 - activeDetailMilestone.week)} weeks to go
                    </Text>
                  </View>

                  <View className="bg-primary/20 px-2.5 py-0.5 rounded-full">
                    <Text className="text-primary font-bold text-xs">
                      {activeDetailMilestone.week === gestationalData.weeks
                        ? "Current Week"
                        : activeDetailMilestone.week < gestationalData.weeks
                        ? "Past Week"
                        : "Upcoming"}
                    </Text>
                  </View>
                </View>

                <View className="bg-surface p-2.5 rounded-xl flex-row items-center justify-between mt-1">
                  <View className="flex-row items-center gap-2">
                    <View className="size-7 rounded-full bg-pink-500/15 items-center justify-center">
                      <Ionicons name="nutrition" size={14} color="#ec4899" />
                    </View>
                    <View>
                      <Text className="text-zinc-400 text-[10px] font-semibold uppercase">
                        Size Comparison
                      </Text>
                      <Text className="text-foreground font-bold text-xs">
                        {activeDetailMilestone.sizeComparison}
                      </Text>
                    </View>
                  </View>

                  <View className="items-end">
                    <Text className="text-zinc-400 text-[10px] font-semibold uppercase">Length & Wt</Text>
                    <Text className="text-foreground font-bold text-xs">
                      {activeDetailMilestone.approxLength} · {activeDetailMilestone.approxWeight}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Baby Development Section */}
              <Card className="p-3.5 bg-surface rounded-2xl border-0 gap-1.5 mb-2.5">
                <View className="flex-row items-center gap-2 mb-0.5">
                  <Ionicons name="heart" size={15} color="#ef4444" />
                  <Text className="text-foreground font-bold text-sm">Baby's Development</Text>
                </View>
                <Text className="text-zinc-600 dark:text-zinc-300 text-xs leading-5">
                  {activeDetailMilestone.babyDevelopment}
                </Text>
              </Card>

              {/* Mom's Experience Section */}
              <Card className="p-3.5 bg-surface rounded-2xl border-0 gap-1.5 mb-2.5">
                <View className="flex-row items-center gap-2 mb-0.5">
                  <Ionicons name="body" size={15} color="#3b82f6" />
                  <Text className="text-foreground font-bold text-sm">What Mom May Feel</Text>
                </View>
                <Text className="text-zinc-600 dark:text-zinc-300 text-xs leading-5">
                  {activeDetailMilestone.momExperience}
                </Text>
              </Card>

              {/* Clinical / ANC Milestone if applicable */}
              {activeDetailMilestone.clinicalMilestone && (
                <Card className="p-3.5 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-2xl border border-emerald-500/25 gap-1.5 mb-2.5">
                  <View className="flex-row items-center gap-2 mb-0.5">
                    <Ionicons name="medkit" size={15} color="#10b981" />
                    <Text className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                      Recommended Clinical Milestone
                    </Text>
                  </View>
                  <Text className="text-zinc-700 dark:text-zinc-200 text-xs leading-5 font-medium">
                    {activeDetailMilestone.clinicalMilestone}
                  </Text>
                </Card>
              )}
            </ScrollView>

            <Button
              variant="secondary"
              className="rounded-xl w-full"
              onPress={() => setIsTimelineModalOpen(false)}
            >
              <Button.Label className="text-foreground font-semibold">Done</Button.Label>
            </Button>
          </Card>
        </View>
      </Modal>
    </View>
  );
}
