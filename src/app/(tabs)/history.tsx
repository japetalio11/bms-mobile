import { View, Text, ScrollView, Pressable } from "react-native";
import type { JSX } from "react";
import { Card } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";

type HistoryItem = {
  day: string;
  date: number;
  title: string;
  datetime: string;
  completed: boolean;
};

const HISTORY: { month: string; items: HistoryItem[] }[] = [
  {
    month: "June 2026",
    items: [
      { day: "Fri", date: 8, title: "Prenatal Checkup", datetime: "June 8, 2026 9:00 AM", completed: true },
      { day: "Mon", date: 2, title: "Urinalysis Submission", datetime: "June 2, 2026 8:00 AM", completed: true },
    ],
  },
  {
    month: "May 2026",
    items: [
      { day: "Thu", date: 15, title: "Prenatal Checkup", datetime: "May 15, 2026 9:00 AM", completed: true },
      { day: "Tue", date: 6, title: "Blood Typing", datetime: "May 6, 2026 10:00 AM", completed: true },
    ],
  },
  {
    month: "April 2026",
    items: [
      { day: "Wed", date: 17, title: "Prenatal Checkup", datetime: "April 17, 2026 9:00 AM", completed: true },
    ],
  },
];

export default function HistoryScreen(): JSX.Element {
  return (
    <View className="flex-1 bg-background pb-24">
      <Header rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 mb-6">
          <Text className="text-white text-lg font-semibold mb-1">Visit History</Text>
          <Text className="text-muted text-sm">Your past appointments and visits.</Text>
        </View>

        {HISTORY.map((group) => (
          <View key={group.month} className="px-5 mb-6">
            <Text className="text-muted text-sm font-medium mb-3 ml-1">{group.month}</Text>
            <View className="gap-3">
              {group.items.map((item, index) => (
                <Pressable key={index}>
                  <Card
                    variant="secondary"
                    className="bg-[#18181b] border-0 rounded-xl p-4 flex-row items-center"
                  >
                    <View className="items-center justify-center mr-4 w-12">
                      <Text className="text-red-500 text-sm font-medium">{item.day}</Text>
                      <Text className="text-white text-lg font-semibold">{item.date}</Text>
                    </View>

                    <View className="w-px h-full bg-[#27272a] mx-2" />

                    <View className="flex-1 ml-2">
                      <Text className="text-white text-base font-medium mb-1">{item.title}</Text>
                      <Text className="text-muted text-sm">{item.datetime}</Text>
                    </View>

                    <Ionicons
                      name={item.completed ? "checkmark-circle" : "ellipse-outline"}
                      size={20}
                      color={item.completed ? "#10b981" : "#52525b"}
                    />
                  </Card>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
