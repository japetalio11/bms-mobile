import { View, ScrollView, Pressable } from "react-native";
import { useState } from "react";
import type { JSX } from "react";
import { Tabs, Card, SearchField, Text, Button } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";

const LAB_RECORD_COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b"];

const labRecords = [
  { title: "Complete Blood Count", color: "#6366f1" },
  { title: "Urinalysis", color: "#3b82f6", route: "/(tabs)/urinalysis" },
  { title: "Blood Typing", color: "#10b981" },
  { title: "Hepatitis B Screening", color: "#f59e0b" },
];

export default function RecordsScreen(): JSX.Element {
  const router = useRouter();
  const [activeMainTab, setActiveMainTab] = useState("lab");
  const [activePrescriptionTab, setActivePrescriptionTab] = useState("medicine");
  const [searchLab, setSearchLab] = useState("");
  const [searchPrescription, setSearchPrescription] = useState("");

  return (
    <View className="flex-1 bg-background">
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Main Tabs */}
        <View className="px-5 mb-5">
          <Tabs value={activeMainTab} onValueChange={setActiveMainTab} variant="primary">
            <Tabs.List className="bg-default p-1 rounded-xl">
              <Tabs.Indicator className="bg-surface-secondary rounded-xl" />
              <Tabs.Trigger value="lab">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                    Laboratory Records
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="prescriptions">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                    Prescriptions
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </View>

        {/* Lab Records Tab */}
        {activeMainTab === "lab" && (
          <View className="px-5">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-foreground text-lg font-semibold">Laboratory Records</Text>
              <Button 
                size="sm" 
                variant="primary" 
                className="rounded-xl px-3"
                onPress={() => router.push("/(tabs)/upload-record")}
              >
                <Button.Label className="text-sm font-medium">Upload</Button.Label>
              </Button>
            </View>
            <Text className="text-muted text-sm mb-4">You're in your second trimester with 16 weeks to go.</Text>

            <SearchField value={searchLab} onChange={setSearchLab}>
              <SearchField.Group className="bg-default border-0 rounded-xl h-12 mb-5">
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search for laboratory records..." className="text-sm" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>

            <View className="flex-row flex-wrap justify-between">
              {labRecords.map((item, index) => (
                <Pressable
                  key={index}
                  className="w-[48%] mb-4"
                  onPress={() => { if (item.route) router.push(item.route as any); }}
                >
                  <Card variant="secondary" className="bg-surface border-0 rounded-xl overflow-hidden" style={{ height: 160 }}>
                    {/* Colored gradient header */}
                    <View
                      className="flex-1 items-center justify-center"
                      style={{ backgroundColor: item.color + "18" }}
                    >
                      <View
                        className="size-12 rounded-full items-center justify-center"
                        style={{ backgroundColor: item.color + "30" }}
                      >
                        <Ionicons name="document-text-outline" size={24} color={item.color} />
                      </View>
                    </View>
                    <Card.Body className="px-3 py-2 flex-none bg-surface">
                      <Text className="text-foreground text-sm font-semibold leading-tight">{item.title}</Text>
                      <Text className="text-muted text-sm mt-0.5">2nd Trimester</Text>
                    </Card.Body>
                  </Card>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Prescriptions Tab */}
        {activeMainTab === "prescriptions" && (
          <View className="px-5">
            <Text className="text-foreground text-lg font-semibold mb-1">Prescriptions</Text>
            <Text className="text-muted text-sm mb-4">You're in your second trimester with 16 weeks to go.</Text>

            <View className="mb-5 flex-row items-center gap-3">
              <View className="flex-1">
                <SearchField value={searchPrescription} onChange={setSearchPrescription}>
                  <SearchField.Group className="bg-default border-0 rounded-xl h-12">
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Search for medicine..." className="text-sm" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </View>
              <Pressable className="size-12 bg-default rounded-xl items-center justify-center">
                <Ionicons name="options-outline" size={20} color="#a1a1aa" />
              </Pressable>
            </View>

            {/* Prescription sub-tabs */}
            <View className="mb-5">
              <Tabs value={activePrescriptionTab} onValueChange={setActivePrescriptionTab} variant="primary">
                <Tabs.List className="bg-default p-1 rounded-xl">
                  <Tabs.Indicator className="bg-surface-secondary rounded-xl" />
                  <Tabs.Trigger value="medicine">
                    {({ isSelected }) => (
                      <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                        Medicine
                      </Tabs.Label>
                    )}
                  </Tabs.Trigger>
                  <Tabs.Trigger value="supplement">
                    {({ isSelected }) => (
                      <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                        Supplement
                      </Tabs.Label>
                    )}
                  </Tabs.Trigger>
                </Tabs.List>
              </Tabs>
            </View>

            <Card variant="secondary" className="bg-surface border-0 rounded-xl p-4">
              <View className="flex-row items-start gap-3 mb-4">
                <View className="size-10 rounded-full bg-[#6366f1]/15 items-center justify-center mt-0.5">
                  <Ionicons name="medkit-outline" size={18} color="#6366f1" />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-semibold text-base">Prenatal Vitamin</Text>
                  <Text className="text-muted text-sm">Morning · 500 mg</Text>
                </View>
              </View>
              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-muted text-sm">Dosage</Text>
                  <Text className="text-foreground text-sm font-medium">500 mg</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-muted text-sm">Start Date</Text>
                  <Text className="text-foreground text-sm font-medium">June 16, 2026 · 8:00 AM</Text>
                </View>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
