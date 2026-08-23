import { View, ScrollView } from "react-native";
import { Text, Card, Tabs } from "heroui-native";
import { Header } from "../../components/Header";
import { useState } from "react";
import type { JSX } from "react";
import { useAuth } from "../../context/UserContext";
import { Ionicons } from "@expo/vector-icons";

const DataRow = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row justify-between py-3 border-b border-separator last:border-0">
    <Text className="text-muted text-sm">{label}</Text>
    <Text className="text-foreground text-sm font-medium">{value}</Text>
  </View>
);

export default function VitalsScreen(): JSX.Element {
  const [activeTab, setActiveTab] = useState("maternal");
  const { activePregnancy } = useAuth();

  const latestVisit = activePregnancy?.prenatalVisits?.[0];

  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Vitals & Analytics" rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Tabs */}
        <View className="px-5 mb-5">
          <Tabs value={activeTab} onValueChange={setActiveTab} variant="primary">
            <Tabs.List className="bg-default p-1 rounded-xl">
              <Tabs.Indicator className="bg-surface-secondary rounded-xl" />
              <Tabs.Trigger value="maternal">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                    Maternal Analytics
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="newborn">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                    Newborn Analytics
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </View>

        {activeTab === "maternal" && (
          <View className="px-5">
            <Text className="text-foreground text-base font-semibold mb-1">Maternal Vitals</Text>
            {latestVisit ? (
              <>
                <Text className="text-muted text-sm mb-4">
                  Last recorded: {new Date(latestVisit.visit_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </Text>
                <Card variant="secondary" className="bg-surface border-0 rounded-xl px-4 py-1">
                  <DataRow label="Blood Pressure" value={`${latestVisit.bp_systolic}/${latestVisit.bp_diastolic} mmHg`} />
                  <DataRow label="Heart Rate" value={`${latestVisit.pulse_rate_bpm} bpm`} />
                  <DataRow label="Body Temp" value={`${latestVisit.temperature_celsius} °C`} />
                  <DataRow label="Weight" value={`${latestVisit.weight_kg} kg`} />
                  {latestVisit.fundic_height_cm && <DataRow label="Fundic Height" value={`${latestVisit.fundic_height_cm} cm`} />}
                  {latestVisit.fetal_heart_tone_bpm && <DataRow label="Fetal Heart Tone" value={`${latestVisit.fetal_heart_tone_bpm} bpm`} />}
                </Card>
              </>
            ) : (
              <Card variant="secondary" className="bg-surface border-0 rounded-xl p-6 items-center py-8">
                <Ionicons name="pulse" size={28} color="#71717a" className="mb-2" />
                <Text className="text-foreground font-semibold text-base mb-1">No Recorded Vitals</Text>
                <Text className="text-muted text-sm text-center">
                  Vitals will be recorded during your prenatal visits at the healthcare facility.
                </Text>
              </Card>
            )}
          </View>
        )}

        {activeTab === "newborn" && (
          <View className="px-5">
            <Card variant="secondary" className="bg-surface border-0 rounded-xl p-6 items-center">
              <View className="size-16 rounded-full bg-default items-center justify-center mb-3">
                <Text className="text-3xl">👶</Text>
              </View>
              <Text className="text-foreground font-semibold text-base mb-1">No Data Yet</Text>
              <Text className="text-muted text-sm text-center leading-5">
                Newborn analytics will be available after delivery.
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
