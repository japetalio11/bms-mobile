import { View, ScrollView } from "react-native";
import { Card, Text } from "heroui-native";
import { Header } from "../../components/Header";
import type { JSX } from "react";
import { useAuth } from "../../context/UserContext";

const DataRow = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row justify-between py-3 border-b border-separator last:border-0">
    <Text className="text-muted text-sm">{label}</Text>
    <Text className="text-foreground text-sm font-medium">{value}</Text>
  </View>
);

export default function AppointmentDetailScreen(): JSX.Element {
  const { activePregnancy } = useAuth();
  const latestVisit = activePregnancy?.prenatalVisits?.[0];

  const formattedDate = latestVisit?.visit_date
    ? new Date(latestVisit.visit_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Appointment Details";

  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Prenatal Visit Details" subtitle={formattedDate} rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        <View className="px-5 mb-5 pt-2">
          <Text className="text-foreground text-lg font-semibold mb-1">Maternal Vitals</Text>
          <Text className="text-muted text-sm mb-4">Recorded during your prenatal visit.</Text>

          {latestVisit ? (
            <Card variant="secondary" className="bg-surface border-0 rounded-xl px-4 py-1">
              <DataRow label="Blood Pressure" value={`${latestVisit.bp_systolic}/${latestVisit.bp_diastolic} mmHg`} />
              <DataRow label="Heart Rate" value={`${latestVisit.pulse_rate_bpm} bpm`} />
              <DataRow label="Body Temp" value={`${latestVisit.temperature_celsius} °C`} />
              <DataRow label="Weight" value={`${latestVisit.weight_kg} kg`} />
            </Card>
          ) : (
            <Card variant="secondary" className="bg-surface border-0 rounded-xl p-6 items-center">
              <Text className="text-muted text-sm">No vital signs recorded for this visit yet.</Text>
            </Card>
          )}
        </View>

        <View className="px-5">
          <Text className="text-foreground text-lg font-semibold mb-1">Fetal & Visit Metrics</Text>
          <Text className="text-muted text-sm mb-4">Key indicators from this visit.</Text>

          {latestVisit ? (
            <Card variant="secondary" className="bg-surface border-0 rounded-xl px-4 py-1">
              <DataRow label="Gestational Age" value={`${latestVisit.age_of_gestation_weeks} Weeks`} />
              <DataRow label="Fetal Heart Tone" value={latestVisit.fetal_heart_tone_bpm ? `${latestVisit.fetal_heart_tone_bpm} bpm` : "N/A"} />
              <DataRow label="Fundic Height" value={latestVisit.fundic_height_cm ? `${latestVisit.fundic_height_cm} cm` : "N/A"} />
            </Card>
          ) : (
            <Card variant="secondary" className="bg-surface border-0 rounded-xl p-6 items-center">
              <Text className="text-muted text-sm">No visit metrics recorded yet.</Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
