import { View, ScrollView } from "react-native";
import { Text, Card, Tabs } from "heroui-native";
import { Header } from "../../components/Header";
import { useState } from "react";
import type { JSX } from "react";
import { useAuth } from "../../context/UserContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const DataRow = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row justify-between py-3.5 border-b border-separator last:border-0">
    <Text className="text-muted text-sm">{label}</Text>
    <Text className="text-foreground text-sm font-medium">{value}</Text>
  </View>
);

export default function VitalsScreen(): JSX.Element {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("maternal");
  const { activePregnancy, motherRecord } = useAuth();

  let latestVisit = activePregnancy?.prenatalVisits?.[0] || null;
  let latestDelivery = activePregnancy?.deliveryOutcomes?.[0] || null;
  let latestNewborn = latestDelivery?.newbornRecords?.[0] || null;

  if (!latestVisit && motherRecord?.pregnancies) {
    for (const preg of motherRecord.pregnancies) {
      if (preg.prenatalVisits && preg.prenatalVisits.length > 0) {
        latestVisit = preg.prenatalVisits[0];
        break;
      }
    }
  }

  if (!latestDelivery && motherRecord?.pregnancies) {
    for (const preg of motherRecord.pregnancies) {
      if (preg.deliveryOutcomes && preg.deliveryOutcomes.length > 0) {
        latestDelivery = preg.deliveryOutcomes[0];
        if (latestDelivery.newbornRecords && latestDelivery.newbornRecords.length > 0) {
          latestNewborn = latestDelivery.newbornRecords[0];
        }
        break;
      }
    }
  }

  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Vitals & Analytics" onBack={() => router.back()} rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Tabs */}
        <View className="px-5 mb-5 pt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} variant="primary">
            <Tabs.List className="bg-default p-1 rounded-xl">
              <Tabs.Indicator className="bg-surface-secondary rounded-xl" />
              <Tabs.Trigger value="maternal">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground font-bold" : "text-muted"}`}>
                    Maternal Analytics
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="newborn">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground font-bold" : "text-muted"}`}>
                    Newborn Analytics
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </View>

        {activeTab === "maternal" && (
          <View className="px-5">
            <Text className="text-foreground text-base font-semibold mb-1">Maternal Vitals Log</Text>
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
                  {latestVisit.risk_level_assessed && <DataRow label="Assessed Risk Level" value={latestVisit.risk_level_assessed} />}
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
            <Text className="text-foreground text-base font-semibold mb-1">Newborn Record & Health</Text>
            {latestNewborn ? (
              <>
                <Text className="text-muted text-sm mb-4">
                  Delivered: {latestDelivery?.delivery_date ? new Date(latestDelivery.delivery_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recorded"}
                </Text>
                <Card variant="secondary" className="bg-surface border-0 rounded-xl px-4 py-1">
                  <DataRow label="Sex" value={latestNewborn.sex} />
                  <DataRow label="Birth Weight" value={`${latestNewborn.birth_weight_kg} kg`} />
                  <DataRow label="APGAR Score" value={`${latestNewborn.apgar_score} / 10`} />
                  <DataRow label="Status at Birth" value={latestNewborn.status_at_birth} />
                  {latestDelivery?.mode_of_delivery && <DataRow label="Delivery Mode" value={latestDelivery.mode_of_delivery} />}
                  {latestDelivery?.place_of_delivery && <DataRow label="Facility Place" value={latestDelivery.place_of_delivery} />}
                </Card>
              </>
            ) : (
              <Card variant="secondary" className="bg-surface border-0 rounded-xl p-6 items-center">
                <View className="size-16 rounded-full bg-default items-center justify-center mb-3">
                  <Text className="text-3xl">👶</Text>
                </View>
                <Text className="text-foreground font-semibold text-base mb-1">Expectant Care Mode</Text>
                <Text className="text-muted text-sm text-center leading-5">
                  Newborn delivery records will be updated automatically by your healthcare facility after delivery.
                </Text>
              </Card>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
