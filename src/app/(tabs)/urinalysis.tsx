import { View, ScrollView, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { Text, Card } from "heroui-native";
import { Header } from "../../components/Header";
import type { JSX } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/UserContext";
import { getLabScreeningsByMotherApi } from "../../config/api";
import type { LabScreeningRecord } from "../../config/api";

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
  const { token, motherRecord } = useAuth();
  const [record, setRecord] = useState<LabScreeningRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (motherRecord?.mother_id && token) {
      getLabScreeningsByMotherApi(motherRecord.mother_id, token)
        .then((records) => {
          if (isMounted) {
            const u = records.find((r) => r.screening_type.toLowerCase().includes("urinalysis"));
            if (u) setRecord(u);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [motherRecord?.mother_id, token]);

  const dateStr = record?.date_of_screening
    ? new Date(record.date_of_screening).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";

  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Urinalysis" rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Summary banner */}
        <View className="px-5 mb-5 pt-2">
          {isLoading ? (
            <ActivityIndicator size="small" color="#6366f1" className="py-4" />
          ) : record ? (
            <View className="bg-[#10b981]/15 rounded-xl p-4 flex-row items-center gap-3">
              <View className="size-10 rounded-full bg-[#10b981]/20 items-center justify-center">
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              </View>
              <View className="flex-1">
                <Text className="text-[#10b981] font-semibold text-base">{record.result}</Text>
                <Text className="text-[#10b981] opacity-70 text-sm">Submitted {dateStr}</Text>
              </View>
            </View>
          ) : (
            <Card className="p-6 bg-surface rounded-xl border-0 items-center py-6">
              <Ionicons name="document-text-outline" size={28} color="#71717a" className="mb-2" />
              <Text className="text-foreground font-semibold text-base mb-1">No Urinalysis Record</Text>
              <Text className="text-muted text-sm text-center">
                No urinalysis lab screening record has been submitted yet.
              </Text>
            </Card>
          )}
        </View>

        {record && (
          <>
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
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
