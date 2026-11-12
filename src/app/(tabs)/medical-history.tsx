import { Pressable, ScrollView, View } from "react-native";
import { Text } from "heroui-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/UserContext";
import { AppIcon } from "../../components/AppIcon";
import { MobileEmptyState } from "../../components/MobileEmptyState";

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function MedicalHistoryScreen() {
  const router = useRouter();
  const { motherRecord } = useAuth();
  const pregnancies = motherRecord?.pregnancies ?? [];

  return <View className="flex-1 bg-background">
    <View className="mt-4 h-12 flex-row items-center justify-center px-4">
      <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/records")} accessibilityRole="button" accessibilityLabel="Go back" className="absolute left-4 size-10 items-center justify-center">
        <AppIcon name="chevron-back" size={20} weight="bold" color="#262626" />
      </Pressable>
      <Text className="text-2xl font-semibold text-foreground">Medical History</Text>
    </View>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 }}>
      <Text className="mb-4 text-base font-semibold text-foreground">Pregnancy history</Text>
      {pregnancies.length === 0 ? <View className="rounded-[18px] bg-[#262626]"><MobileEmptyState icon="document-text-outline" title="No pregnancy history yet" description="Your pregnancy records will appear here when your care team adds them." /></View> : pregnancies.map((pregnancy, index) => {
        const dueDate = new Date(pregnancy.lmp_date);
        if (!Number.isNaN(dueDate.getTime())) dueDate.setDate(dueDate.getDate() + 280);
        return <View key={pregnancy.pregnancy_id || index} className="mb-3 rounded-[18px] bg-[#262626] p-4">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-base font-semibold text-white">Pregnancy {index + 1}</Text>
            <Text className="text-sm font-medium capitalize text-[#fffe8c]">{pregnancy.pregnancy_status || "Status pending"}</Text>
          </View>
          <Text className="mt-3 text-sm text-[#a3a3a3]">Gravida / parity</Text>
          <Text className="text-base font-medium text-white">G{pregnancy.gravida ?? "—"} P{pregnancy.parity ?? "—"}</Text>
          <View className="mt-3 flex-row gap-6">
            <View><Text className="text-sm text-[#a3a3a3]">Last period</Text><Text className="text-sm font-medium text-white">{formatDate(pregnancy.lmp_date)}</Text></View>
            <View><Text className="text-sm text-[#a3a3a3]">Estimated due date</Text><Text className="text-sm font-medium text-white">{formatDate(Number.isNaN(dueDate.getTime()) ? undefined : dueDate.toISOString())}</Text></View>
          </View>
        </View>;
      })}
    </ScrollView>
  </View>;
}
