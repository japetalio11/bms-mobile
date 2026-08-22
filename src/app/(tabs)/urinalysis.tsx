import { View, ScrollView } from "react-native";
import { Text, Card } from "heroui-native";
import { Header } from "../../components/Header";
import type { JSX } from "react";
import { Ionicons } from "@expo/vector-icons";

const Result = ({
  label,
  value,
  unit,
  status,
}: {
  label: string;
  value: string;
  unit: string;
  status: "normal" | "abnormal" | "borderline";
}) => {
  const statusConfig = {
    normal: { color: "#10b981", bg: "bg-[#10b981]/15", label: "Normal" },
    abnormal: { color: "#ef4444", bg: "bg-[#ef4444]/15", label: "Abnormal" },
    borderline: { color: "#f59e0b", bg: "bg-[#f59e0b]/15", label: "Borderline" },
  }[status];

  return (
    <View className="flex-row justify-between items-center py-3 border-b border-separator last:border-0">
      <View className="flex-1">
        <Text className="text-foreground text-sm font-medium">{label}</Text>
        <Text className="text-muted text-sm">{unit}</Text>
      </View>
      <Text className="text-foreground text-sm font-semibold mx-4">{value}</Text>
      <View className={`px-2 py-0.5 rounded-full ${statusConfig.bg}`}>
        <Text className="text-sm font-medium" style={{ color: statusConfig.color }}>
          {statusConfig.label}
        </Text>
      </View>
    </View>
  );
};

export default function UrinalysisScreen(): JSX.Element {
  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Urinalysis" rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Summary banner */}
        <View className="px-5 mb-5">
          <View className="bg-[#10b981]/15 rounded-xl p-4 flex-row items-center gap-3">
            <View className="size-10 rounded-full bg-[#10b981]/20 items-center justify-center">
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            </View>
            <View className="flex-1">
              <Text className="text-[#10b981] font-semibold text-base">All Results Normal</Text>
              <Text className="text-[#10b981] opacity-70 text-sm">Submitted June 2, 2026</Text>
            </View>
          </View>
        </View>

        <View className="px-5 mb-5">
          <Text className="text-foreground text-lg font-semibold mb-1">Physical Examination</Text>
          <Text className="text-muted text-sm mb-4">Color, clarity, and specific gravity.</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl px-4 py-1">
            <Result label="Color" value="Yellow" unit="Visual" status="normal" />
            <Result label="Clarity" value="Clear" unit="Visual" status="normal" />
            <Result label="Specific Gravity" value="1.015" unit="Numeric" status="normal" />
          </Card>
        </View>

        <View className="px-5">
          <Text className="text-foreground text-lg font-semibold mb-1">Chemical Examination</Text>
          <Text className="text-muted text-sm mb-4">Protein, glucose, and other markers.</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl px-4 py-1">
            <Result label="Protein" value="None" unit="Qualitative" status="normal" />
            <Result label="Glucose" value="None" unit="Qualitative" status="normal" />
            <Result label="pH Level" value="6.0" unit="Numeric" status="normal" />
            <Result label="Bilirubin" value="Negative" unit="Qualitative" status="normal" />
            <Result label="Leukocyte Esterase" value="Trace" unit="Qualitative" status="borderline" />
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
