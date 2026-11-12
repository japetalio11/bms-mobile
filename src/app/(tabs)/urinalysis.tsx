import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useCallback, useState } from "react";
import { Text } from "heroui-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../context/UserContext";
import { useNetwork } from "../../context/NetworkContext";
import { getLabScreeningsByMotherApi, type LabScreeningRecord } from "../../config/api";
import { getLabScreeningsLocal, saveLabScreeningsLocal } from "../../db/repository";
import { AppIcon } from "../../components/AppIcon";
import { MobileEmptyState } from "../../components/MobileEmptyState";

export default function UrinalysisScreen() {
  const router = useRouter();
  const { token, motherRecord } = useAuth();
  const { isOnline } = useNetwork();
  const [records, setRecords] = useState<LabScreeningRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    const motherId = motherRecord?.mother_id;
    if (!motherId) return () => { active = false; };
    const selectUrinalysis = (items: LabScreeningRecord[]) => items.filter(item => item.screening_type?.toLowerCase().includes("urinalysis"));
    void getLabScreeningsLocal(motherId).then(items => { if (active) setRecords(selectUrinalysis(items)); }).catch(() => {});
    if (isOnline && token) {
      setLoading(true);
      void getLabScreeningsByMotherApi(motherId, token).then(async items => {
        if (Array.isArray(items)) {
          if (active) setRecords(selectUrinalysis(items));
          await saveLabScreeningsLocal(items, true, motherId, true);
        }
      }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [motherRecord?.mother_id, token, isOnline]));

  return <View className="flex-1 bg-background">
    <View className="mt-4 h-12 flex-row items-center justify-center px-4">
      <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/records")} accessibilityRole="button" accessibilityLabel="Go back" className="absolute left-4 size-10 items-center justify-center">
        <AppIcon name="chevron-back" size={20} weight="bold" color="#262626" />
      </Pressable>
      <Text className="text-2xl font-semibold text-foreground">Urinalysis</Text>
    </View>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 }}>
      <Text className="mb-4 text-base font-semibold text-foreground">Screening results</Text>
      {loading && records.length === 0 ? <ActivityIndicator color="#171717" /> : records.length === 0 ? <View className="rounded-[18px] bg-[#262626]"><MobileEmptyState icon="document-text-outline" title="No urinalysis records yet" description="Your care team's screening results will appear here." /></View> : records.map((record, index) => <View key={record.screening_id || index} className="mb-3 rounded-[18px] bg-[#262626] p-4">
        <Text className="text-base font-semibold text-white">{record.screening_type}</Text>
        <Text className="mt-1 text-sm text-[#a3a3a3]">{record.date_of_screening ? new Date(record.date_of_screening).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Date not recorded"}</Text>
        {record.result ? <View className="mt-4"><Text className="text-sm text-[#a3a3a3]">Result</Text><Text className="mt-1 text-base font-medium text-white">{record.result}</Text></View> : null}
        {record.remarks ? <View className="mt-3"><Text className="text-sm text-[#a3a3a3]">Remarks</Text><Text className="mt-1 text-sm text-white">{record.remarks}</Text></View> : null}
      </View>)}
    </ScrollView>
  </View>;
}
