import { View, ScrollView, Image, ActivityIndicator, Pressable } from "react-native";
import { useState, useEffect, useCallback } from "react";
import type { JSX } from "react";
import { Card, Text, Checkbox } from "heroui-native";
import { Header } from "../../components/Header";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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

export default function DashboardScreen(): JSX.Element {
  const router = useRouter();
  const { user, token, motherRecord, activePregnancy } = useAuth();
  const { isOnline } = useNetwork();

  const [supplements, setSupplements] = useState<SupplementRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);

  // Calculate Gestational Age based on LMP Date
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

  const loadData = useCallback(async () => {
    // 1. Read from local SQLite database first (instant UI, offline preservation)
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

    // 2. Fetch fresh API data if online
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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleToggleSupplement = async (supplementId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;

    // Optimistic UI & Local SQLite Update
    setSupplements((prev) =>
      prev.map((item) => (item.supplement_id === supplementId ? { ...item, is_completed: nextStatus } : item))
    );

    try {
      await updateSupplementStatusLocal(supplementId, nextStatus, isOnline);
      if (isOnline && token) {
        await updateSupplementStatusApi({ supplement_id: supplementId, is_completed: nextStatus }, token);
      }
    } catch (err) {
      console.warn("Supplement update error:", err);
    }
  };

  const nextAppointment = appointments.length > 0 ? appointments[0] : null;

  return (
    <View className="flex-1 bg-background">
      <Header title={`Good day${user.first_name ? `, ${user.first_name}` : ""} 👋`} />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-3">
          {/* Week Card */}
          <Card className="mb-6 p-4 bg-surface gap-3 rounded-3xl border-0">
            {gestationalData.hasPregnancy ? (
              <>
                <View className="mb-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-foreground text-xl font-bold">Week {gestationalData.weeks}</Text>
                    <View className="bg-[#f43f5e]/15 px-3 py-1 rounded-full">
                      <Text className="text-[#f43f5e] text-sm font-semibold">{gestationalData.progress}%</Text>
                    </View>
                  </View>
                  <Text className="text-muted text-sm mt-1">
                    {gestationalData.trimesterText} · {gestationalData.remainingWeeks} weeks to go
                  </Text>
                </View>

                <Image
                  source={require("../../../assets/fetus.jpg")}
                  className="w-full h-44 rounded-lg my-1"
                  resizeMode="cover"
                />

                <View className="gap-2 mt-1">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-foreground text-sm font-medium">Maternal Progress Overview</Text>
                    <Text className="text-muted text-sm">{gestationalData.weeks} wks</Text>
                  </View>
                  <View className="h-2 w-full bg-default rounded-full overflow-hidden">
                    <View
                      className="h-full bg-[#f43f5e] rounded-full"
                      style={{ width: `${gestationalData.progress}%` }}
                    />
                  </View>
                </View>
              </>
            ) : (
              <View className="py-6 items-center">
                <Ionicons name="medical-outline" size={32} color="#f43f5e" className="mb-2" />
                <Text className="text-foreground font-semibold text-base mb-1">Maternal Care Dashboard</Text>
                <Text className="text-muted text-sm text-center">
                  Your pregnancy and prenatal visit records will appear here once registered by your healthcare facility.
                </Text>
              </View>
            )}
          </Card>

          {/* Cascaded Vitals & Analytics Navigation Option */}
          <View className="mb-6">
            <Text className="text-foreground text-lg font-semibold mb-3">Vitals & Analytics</Text>

            <Pressable onPress={() => router.push("/(tabs)/vitals")}>
              <Card className="p-4 bg-surface flex-row items-center gap-4 rounded-2xl border-0">
                <View className="size-12 rounded-full bg-rose-500/15 items-center justify-center">
                  <Ionicons name="pulse" size={22} color="#f43f5e" />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-semibold text-base">Blood pressure, heart rate, weight</Text>
                  <Text className="text-muted text-xs mt-0.5">Mother & newborn health tracking</Text>
                </View>
                <View className="size-8 rounded-full bg-default items-center justify-center">
                  <Ionicons name="chevron-forward" size={14} color="#a1a1aa" />
                </View>
              </Card>
            </Pressable>
          </View>

          {/* Daily Prescriptions / Supplements */}
          <View className="mb-6">
            <Text className="text-foreground text-lg font-semibold mb-3">Daily Prescriptions</Text>

            {supplements.length > 0 ? (
              <View className="gap-3">
                {supplements.map((item) => (
                  <Card key={item.supplement_id} className="p-4 bg-surface flex-row items-center gap-4 rounded-2xl border-0">
                    <Checkbox
                      isSelected={item.is_completed}
                      onSelectedChange={() => handleToggleSupplement(item.supplement_id, item.is_completed)}
                      className="border-2 border-zinc-400 dark:border-zinc-500"
                    />
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold text-base">{item.supplement_type}</Text>
                      <Text className="text-muted text-sm">{item.tablets_given_count} tablets prescribed</Text>
                    </View>
                    <View className={`px-3 py-1 rounded-full ${item.is_completed ? "bg-emerald-500/20" : "bg-amber-400/20 border border-amber-400/30"}`}>
                      <Text className={`text-xs font-semibold ${item.is_completed ? "text-emerald-400" : "text-amber-300"}`}>
                        {item.is_completed ? "Done" : "Pending"}
                      </Text>
                    </View>
                  </Card>
                ))}
              </View>
            ) : (
              <Card className="p-4 bg-surface rounded-2xl border-0 items-center py-6">
                <Ionicons name="leaf-outline" size={24} color="#71717a" className="mb-2" />
                <Text className="text-muted text-sm">No active daily prescriptions logged.</Text>
              </Card>
            )}
          </View>

          {/* Upcoming Appointments */}
          <View className="mb-6">
            <Text className="text-foreground text-lg font-semibold mb-3">Upcoming Appointments</Text>

            {nextAppointment ? (
              <Pressable onPress={() => router.push("/(tabs)/appointments")}>
                <Card className="p-4 bg-surface flex-row items-center gap-3 rounded-2xl border-0">
                  <View className="items-center justify-center w-12 bg-[#f43f5e]/15 rounded-xl py-2">
                    <Text className="text-[#f43f5e] text-sm font-semibold">
                      {new Date(nextAppointment.appointment_date).toLocaleDateString("en-US", { weekday: "short" })}
                    </Text>
                    <Text className="text-foreground text-lg font-bold">
                      {new Date(nextAppointment.appointment_date).getDate()}
                    </Text>
                  </View>

                  <View className="flex-1">
                    <Text className="text-foreground font-semibold text-base">{nextAppointment.appointment_type}</Text>
                    <Text className="text-muted text-sm">
                      {new Date(nextAppointment.appointment_date).toLocaleDateString()} · {nextAppointment.appointment_time}
                    </Text>
                  </View>

                  <View className="size-8 rounded-full bg-[#f43f5e]/15 items-center justify-center">
                    <Ionicons name="chevron-forward" size={14} color="#f43f5e" />
                  </View>
                </Card>
              </Pressable>
            ) : (
              <Card className="p-4 bg-surface rounded-2xl border-0 items-center py-6">
                <Ionicons name="calendar-outline" size={24} color="#71717a" className="mb-2" />
                <Text className="text-muted text-sm">No upcoming appointments scheduled.</Text>
              </Card>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
