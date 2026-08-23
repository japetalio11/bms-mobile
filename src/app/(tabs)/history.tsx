import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import type { JSX } from "react";
import { Card } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { useState, useEffect } from "react";
import { useAuth } from "../../context/UserContext";
import { getAppointmentsByUserApi } from "../../config/api";
import type { AppointmentRecord } from "../../config/api";

export default function HistoryScreen(): JSX.Element {
  const { user, token } = useAuth();
  const [historyItems, setHistoryItems] = useState<AppointmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (user?.user_id && token) {
      getAppointmentsByUserApi(user.user_id, token)
        .then((res) => {
          if (isMounted) {
            setHistoryItems(res.filter((a) => a.status.toLowerCase() === "completed"));
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [user?.user_id, token]);

  return (
    <View className="flex-1 bg-background pb-24">
      <Header rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 mb-6">
          <Text className="text-white text-lg font-semibold mb-1">Visit History</Text>
          <Text className="text-muted text-sm">Your past completed appointments and healthcare visits.</Text>
        </View>

        <View className="px-5">
          {isLoading ? (
            <ActivityIndicator size="small" color="#6366f1" className="py-6" />
          ) : historyItems.length > 0 ? (
            <View className="gap-3">
              {historyItems.map((item) => {
                const d = new Date(item.appointment_date);
                const dayStr = d.toLocaleDateString("en-US", { weekday: "short" });
                const dateNum = d.getDate();
                const formattedDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

                return (
                  <Pressable key={item.appointment_id}>
                    <Card
                      variant="secondary"
                      className="bg-surface border-0 rounded-xl p-4 flex-row items-center"
                    >
                      <View className="items-center justify-center mr-4 w-12">
                        <Text className="text-red-500 text-sm font-medium">{dayStr}</Text>
                        <Text className="text-white text-lg font-semibold">{dateNum}</Text>
                      </View>

                      <View className="w-px h-full bg-separator mx-2" />

                      <View className="flex-1 ml-2">
                        <Text className="text-white text-base font-medium mb-1">{item.appointment_type}</Text>
                        <Text className="text-muted text-sm">{formattedDate} · {item.appointment_time}</Text>
                      </View>

                      <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Card variant="secondary" className="bg-surface border-0 rounded-xl p-6 items-center py-8">
              <Ionicons name="time-outline" size={28} color="#71717a" className="mb-2" />
              <Text className="text-foreground font-semibold text-base mb-1">No Past Visits</Text>
              <Text className="text-muted text-sm text-center">
                Your completed visit history will be recorded here.
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
