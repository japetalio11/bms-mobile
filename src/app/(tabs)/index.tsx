import { View, ScrollView, Image, ActivityIndicator, Pressable } from "react-native";
import { useState, useEffect } from "react";
import type { JSX } from "react";
import { Card, Text, Checkbox } from "heroui-native";
import { Header } from "../../components/Header";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/UserContext";
import { getSupplementsByMotherApi, updateSupplementStatusApi, getAppointmentsByUserApi } from "../../config/api";
import type { SupplementRecord, AppointmentRecord } from "../../config/api";

export default function DashboardScreen(): JSX.Element {
  const router = useRouter();
  const { user, token, motherRecord, activePregnancy } = useAuth();

  const [supplements, setSupplements] = useState<SupplementRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);

  // Calculate Gestational Age based on LMP Date
  const calculateGestationalWeeks = (): { weeks: number; progress: number; remainingWeeks: number; trimesterText: string; hasPregnancy: boolean } => {
    if (!activePregnancy || !activePregnancy.lmp_date) {
      return { weeks: 0, progress: 0, remainingWeeks: 0, trimesterText: "No active pregnancy record", hasPregnancy: false };
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

  // Load Supplements & Appointments on mount / context update
  useEffect(() => {
    let isMounted = true;
    if (motherRecord?.mother_id && token) {
      getSupplementsByMotherApi(motherRecord.mother_id, token)
        .then((res) => { if (isMounted) setSupplements(res); })
        .catch(() => {});
    }
    if (user?.user_id && token) {
      getAppointmentsByUserApi(user.user_id, token)
        .then((res) => { if (isMounted) setAppointments(res); })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [motherRecord?.mother_id, user?.user_id, token]);

  const handleToggleSupplement = async (supplementId: string, currentStatus: boolean) => {
    if (!token) return;
    try {
      setSupplements((prev) =>
        prev.map((item) => (item.supplement_id === supplementId ? { ...item, is_completed: !currentStatus } : item))
      );
      await updateSupplementStatusApi({ supplement_id: supplementId, is_completed: !currentStatus }, token);
    } catch {
      // Revert on error
      setSupplements((prev) =>
        prev.map((item) => (item.supplement_id === supplementId ? { ...item, is_completed: currentStatus } : item))
      );
    }
  };

  // Find next upcoming appointment
  const nextAppointment = appointments.length > 0 ? appointments[0] : null;

  return (
    <View className="flex-1 bg-background">
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-2">

          {/* Greeting */}
          <Text className="text-foreground text-lg font-bold mb-5">
            Good day{user.first_name ? `, ${user.first_name}` : ""} 👋
          </Text>

          {/* Week Card */}
          <Card className="mb-6 p-4 bg-surface gap-4 rounded-xl border-0">
            {gestationalData.hasPregnancy ? (
              <>
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-foreground text-lg font-semibold">Week {gestationalData.weeks}</Text>
                    <Text className="text-muted text-sm mt-0.5">
                      {gestationalData.trimesterText} · {gestationalData.remainingWeeks} weeks to go
                    </Text>
                  </View>
                  <View className="bg-[#6366f1]/15 px-3 py-1.5 rounded-full">
                    <Text className="text-[#6366f1] text-sm font-semibold">{gestationalData.progress}%</Text>
                  </View>
                </View>

                <Image
                  source={require('../../../assets/fetus.jpg')}
                  className="w-full h-40 rounded-xl"
                  resizeMode="cover"
                />

                <View className="gap-2">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-foreground text-sm font-medium">Maternal Progress Overview</Text>
                    <Text className="text-muted text-sm">{gestationalData.weeks} wks</Text>
                  </View>
                  <View className="h-2 w-full bg-default rounded-full overflow-hidden">
                    <View 
                      className="h-full bg-accent rounded-full" 
                      style={{ width: `${gestationalData.progress}%` }} 
                    />
                  </View>
                </View>
              </>
            ) : (
              <View className="py-6 items-center">
                <Ionicons name="medical-outline" size={32} color="#6366f1" className="mb-2" />
                <Text className="text-foreground font-semibold text-base mb-1">Maternal Care Dashboard</Text>
                <Text className="text-muted text-sm text-center">
                  Your pregnancy and prenatal visit records will appear here once registered by your healthcare facility.
                </Text>
              </View>
            )}
          </Card>

          {/* Vitals & Analytics Navigation */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-foreground text-lg font-semibold">Vitals & Analytics</Text>
                <Text className="text-muted text-sm">Maternal and newborn health metrics.</Text>
              </View>
            </View>

            <Pressable onPress={() => router.push("/(tabs)/vitals")}>
              <Card className="p-4 bg-surface flex-row items-center gap-4 rounded-xl border-0">
                <View className="size-12 rounded-full bg-blue-500/15 items-center justify-center">
                  <Ionicons name="pulse" size={22} color="#3b82f6" />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-semibold text-base">View Dashboard</Text>
                  <Text className="text-muted text-sm">Blood pressure, heart rate, weight</Text>
                </View>
                <View className="size-8 rounded-full bg-default items-center justify-center">
                  <Ionicons name="chevron-forward" size={14} color="#a1a1aa" />
                </View>
              </Card>
            </Pressable>
          </View>

          {/* Daily Prescriptions / Supplements */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-foreground text-lg font-semibold">Daily Prescriptions</Text>
                <Text className="text-muted text-sm">Remember to log your daily intake.</Text>
              </View>
            </View>

            {supplements.length > 0 ? (
              <View className="gap-3">
                {supplements.map((item) => (
                  <Card key={item.supplement_id} className="p-4 bg-surface flex-row items-center gap-4 rounded-xl border-0">
                    <Checkbox
                      isSelected={item.is_completed}
                      onSelectedChange={() => handleToggleSupplement(item.supplement_id, item.is_completed)}
                    />
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold text-base">{item.supplement_type}</Text>
                      <Text className="text-muted text-sm">{item.tablets_given_count} tablets prescribed</Text>
                    </View>
                    <View className={`px-2 py-1 rounded-full ${item.is_completed ? "bg-[#10b981]/15" : "bg-[#f59e0b]/15"}`}>
                      <Text className={`text-sm font-medium ${item.is_completed ? "text-[#10b981]" : "text-[#f59e0b]"}`}>
                        {item.is_completed ? "Done" : "Pending"}
                      </Text>
                    </View>
                  </Card>
                ))}
              </View>
            ) : (
              <Card className="p-4 bg-surface rounded-xl border-0 items-center py-6">
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
                <Card className="p-4 bg-surface flex-row items-center gap-3 rounded-xl border-0">
                  <View className="items-center justify-center w-12 bg-[#ef4444]/15 rounded-xl py-2">
                    <Text className="text-[#ef4444] text-sm font-semibold">
                      {new Date(nextAppointment.appointment_date).toLocaleDateString('en-US', { weekday: 'short' })}
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

                  <View className="size-8 rounded-full bg-[#6366f1]/15 items-center justify-center">
                    <Ionicons name="chevron-forward" size={14} color="#6366f1" />
                  </View>
                </Card>
              </Pressable>
            ) : (
              <Card className="p-4 bg-surface rounded-xl border-0 items-center py-6">
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
