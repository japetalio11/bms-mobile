import { View, Text, ScrollView, Pressable } from "react-native";
import type { JSX } from "react";
import { Header } from "../../components/Header";
import { Card } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const RECORD_MODULES = [
  {
    title: "Appointments",
    description: "View upcoming and past clinic visits.",
    icon: "calendar-outline" as const,
    color: "#6366f1",
    route: "/(tabs)/appointments",
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
    color: "#8b5cf6",
    route: "/(tabs)/history",
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

  return (
    <View className="flex-1 bg-background pb-24">
      <Header rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 mb-6">
          <Text className="text-white text-lg font-semibold mb-1">Records Overview</Text>
          <Text className="text-muted text-sm mb-6">Access all your medical information in one place.</Text>

          <View className="flex-col gap-4">
            {RECORD_MODULES.map((mod) => (
              <Pressable 
                key={mod.title} 
                onPress={() => router.push(mod.route as any)}
                className="active:opacity-70"
              >
                <Card variant="secondary" className="bg-[#18181b] border-0 rounded-xl p-4 flex-row items-center gap-4">
                  <View
                    className="size-12 rounded-full items-center justify-center"
                    style={{ backgroundColor: mod.color + "20" }}
                  >
                    <Ionicons name={mod.icon} size={24} color={mod.color} />
                  </View>
                  
                  <View className="flex-1">
                    <Text className="text-white text-base font-medium mb-0.5">{mod.title}</Text>
                    <Text className="text-muted text-sm leading-5">{mod.description}</Text>
                  </View>

                  <Ionicons name="chevron-forward" size={20} color="#52525b" />
                </Card>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
