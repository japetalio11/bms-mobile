import { View, Text, ScrollView, Pressable } from "react-native";
import type { JSX } from "react";
import { Header } from "../../components/Header";
import { Card } from "heroui-native";
import { AppIcon as Ionicons } from "../../components/AppIcon";
import { useLocalSearchParams, useRouter } from "expo-router";

const RECORD_MODULES = [
  {
    title: "Appointments",
    description: "View upcoming and past clinic visits.",
    icon: "calendar-outline" as const,
    color: "#6366f1",
    route: "/(tabs)/history",
  },
  {
    title: "Vitals & Biometrics",
    description: "Track blood pressure, weight, and heart rate.",
    icon: "pulse-outline" as const,
    color: "#f59e0b",
    route: "/(tabs)/vitals",
  },
  {
    title: "Lab Records",
    description: "View blood tests, ultrasounds, and lab results.",
    icon: "flask-outline" as const,
    color: "#3b82f6",
    route: "/(tabs)/records",
  },
  {
    title: "Urinalysis",
    description: "Routine urine test tracking.",
    icon: "water-outline" as const,
    color: "#0ea5e9",
    route: "/(tabs)/urinalysis",
  },
  {
    title: "Medical History",
    description: "Past pregnancies and pre-existing conditions.",
    icon: "time-outline" as const,
    color: "#3b82f6",
    route: "/(tabs)/medical-history",
  },
  {
    title: "Upload Record",
    description: "Add new external physical records.",
    icon: "cloud-upload-outline" as const,
    color: "#10b981",
    route: "/(tabs)/upload-record",
  },
];

export default function ExploreTab(): JSX.Element {
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const query = (q || "").trim().toLowerCase();
  const modules = RECORD_MODULES.filter((module) => !query || `${module.title} ${module.description}`.toLowerCase().includes(query));

  return (
    <View className="flex-1 bg-background pb-24">
      <Header rightIcon={null} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 mb-6">
          <Text className="text-white text-base font-semibold mb-1">Records Overview</Text>
          <Text className="text-muted-foreground text-sm mb-6">
            Access all your medical information in one place.
          </Text>

          <View className="flex-col gap-4">
            {modules.map((mod) => (
              <Pressable
                key={mod.title}
                onPress={() => router.push(mod.route as any)}
                className="active:opacity-70"
              >
                <Card
                  variant="secondary"
                  className="bg-surface border-0 rounded-xl p-4 flex-row items-center gap-4"
                >
                  <View
                    className="size-12 rounded-full items-center justify-center"
                    style={{ backgroundColor: mod.color + "20" }}
                  >
                    <Ionicons name={mod.icon} size={24} color={mod.color} />
                  </View>

                  <View className="flex-1">
                    <Text className="text-white text-base font-medium mb-0.5">{mod.title}</Text>
                    <Text className="text-muted-foreground text-sm leading-5">{mod.description}</Text>
                  </View>

                  <Ionicons name="chevron-forward" size={20} color="#52525b" />
                </Card>
              </Pressable>
            ))}
            {modules.length === 0 && (
              <View className="rounded-xl bg-surface p-5">
                <Text className="text-base font-semibold text-foreground">No matching sections</Text>
                <Text className="mt-1 text-sm text-muted-foreground">Try searching for appointments, prescriptions, records, or vitals.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
