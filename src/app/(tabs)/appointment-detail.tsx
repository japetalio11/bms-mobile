import { View, ScrollView } from "react-native";
import { Card, Text } from "heroui-native";
import { Header } from "../../components/Header";
import type { JSX } from "react";

const DataRow = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row justify-between py-3 border-b border-separator last:border-0">
    <Text className="text-muted text-sm">{label}</Text>
    <Text className="text-foreground text-sm font-medium">{value}</Text>
  </View>
);

export default function AppointmentDetailScreen(): JSX.Element {
  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Prenatal Checkup" subtitle="June 8, 2026 · 9:00 AM" rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        <View className="px-5 mb-5">
          <Text className="text-foreground text-lg font-semibold mb-1">Maternal Vitals</Text>
          <Text className="text-muted text-sm mb-4">Recorded during your prenatal visit.</Text>

          <Card variant="secondary" className="bg-surface border-0 rounded-xl px-4 py-1">
            <DataRow label="Blood Pressure" value="120/80 mmHg" />
            <DataRow label="Heart Rate" value="75 bpm" />
            <DataRow label="Blood Sugar" value="90 mg/dL" />
            <DataRow label="Body Temp" value="37.0 °C" />
            <DataRow label="Weight" value="65 kg" />
            <DataRow label="Respiratory Rate" value="16 breaths/min" />
            <DataRow label="O2 Saturation" value="98%" />
          </Card>
        </View>

        <View className="px-5">
          <Text className="text-foreground text-lg font-semibold mb-1">Fetal & Visit Metrics</Text>
          <Text className="text-muted text-sm mb-4">Key indicators from this visit.</Text>

          <Card variant="secondary" className="bg-surface border-0 rounded-xl px-4 py-1">
            <DataRow label="Gestational Age" value="24 Weeks" />
            <DataRow label="Fetal Heart Tone" value="140 bpm" />
            <DataRow label="Fundic Height" value="22 cm" />
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
