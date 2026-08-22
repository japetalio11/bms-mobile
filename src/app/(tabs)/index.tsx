import { View, ScrollView, Image } from "react-native";
import type { JSX } from "react";
import { Card, Text, Checkbox } from "heroui-native";
import { Header } from "../../components/Header";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function DashboardScreen(): JSX.Element {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-2">

          {/* Greeting */}
          <Text className="text-foreground text-lg font-bold mb-5">Good morning, Maria 👋</Text>

          {/* Week 24 Card */}
          <Card className="mb-6 p-4 bg-surface gap-4 rounded-xl border-0">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-foreground text-lg font-semibold">Week 24</Text>
                <Text className="text-muted text-sm mt-0.5">Second trimester · 16 weeks to go</Text>
              </View>
              <View className="bg-[#6366f1]/15 px-3 py-1.5 rounded-full">
                <Text className="text-[#6366f1] text-sm font-semibold">60%</Text>
              </View>
            </View>

            <Image
              source={require('../../../assets/fetus.jpg')}
              className="w-full h-40 rounded-xl"
              resizeMode="cover"
            />

            <View className="gap-2">
              <View className="flex-row justify-between items-center">
                <Text className="text-foreground text-sm font-medium">Baby is the size of a cantaloupe</Text>
                <Text className="text-muted text-sm">24 wks</Text>
              </View>
              <View className="h-2 w-full bg-default rounded-full overflow-hidden">
                <View className="h-full bg-accent w-[60%] rounded-full" />
              </View>
            </View>
          </Card>

          {/* Vitals & Analytics */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-foreground text-lg font-semibold">Vitals & Analytics</Text>
                <Text className="text-muted text-sm">Maternal and newborn health metrics.</Text>
              </View>
            </View>

            <Card
              className="p-4 bg-surface flex-row items-center gap-4 rounded-xl border-0"
              isPressable
              onPress={() => router.push("/(tabs)/vitals")}
            >
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
          </View>

          {/* Daily Prescriptions */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-foreground text-lg font-semibold">Daily Prescriptions</Text>
                <Text className="text-muted text-sm">Remember to log your daily intake.</Text>
              </View>
            </View>

            <View className="gap-3">
              <Card className="p-4 bg-surface flex-row items-center gap-4 rounded-xl border-0" isPressable>
                <Checkbox isSelected={true} />
                <View className="flex-1">
                  <Text className="text-foreground font-semibold text-base">Prenatal Vitamin</Text>
                  <Text className="text-muted text-sm">Morning · 500 mg</Text>
                </View>
                <View className="px-2 py-1 rounded-full bg-[#10b981]/15">
                  <Text className="text-[#10b981] text-sm font-medium">Done</Text>
                </View>
              </Card>

              <Card className="p-4 bg-surface flex-row items-center gap-4 rounded-xl border-0" isPressable>
                <Checkbox isSelected={false} />
                <View className="flex-1">
                  <Text className="text-foreground font-semibold text-base">Iron Supplement</Text>
                  <Text className="text-muted text-sm">Lunch · 325 mg</Text>
                </View>
                <View className="px-2 py-1 rounded-full bg-[#f59e0b]/15">
                  <Text className="text-[#f59e0b] text-sm font-medium">Pending</Text>
                </View>
              </Card>
            </View>
          </View>

          {/* Upcoming Appointments */}
          <View className="mb-6">
            <Text className="text-foreground text-lg font-semibold mb-3">Upcoming Appointments</Text>

            <Card
              className="p-4 bg-surface flex-row items-center gap-3 rounded-xl border-0"
              isPressable
              onPress={() => router.push("/(tabs)/appointment-detail")}
            >
              <View className="items-center justify-center w-12 bg-[#ef4444]/15 rounded-xl py-2">
                <Text className="text-[#ef4444] text-sm font-semibold">Thu</Text>
                <Text className="text-foreground text-lg font-bold">11</Text>
              </View>

              <View className="flex-1">
                <Text className="text-foreground font-semibold text-base">Prenatal Checkup</Text>
                <Text className="text-muted text-sm">July 11, 2026 · 9:00 AM</Text>
              </View>

              <View className="size-8 rounded-full bg-[#6366f1]/15 items-center justify-center">
                <Ionicons name="chevron-forward" size={14} color="#6366f1" />
              </View>
            </Card>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
