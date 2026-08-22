import { View, Text, ScrollView, Pressable } from "react-native";
import type { JSX } from "react";
import { useState } from "react";
import { Card } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DATES = [
  [29, 30, 31, 1, 2, 3, 4],
  [5, 6, 7, 8, 9, 10, 11],
  [12, 13, 14, 15, 16, 17, 18],
  [19, 20, 21, 22, 23, 24, 25],
  [26, 27, 28, 29, 30, 31, 1],
];
const DOT_DATES = [2, 6, 11, 16];
const TODAY = 16;

const UPCOMING = [
  { day: "Thu", date: 11, title: "Prenatal Checkup", time: "July 11, 2026 9:00 AM" },
  { day: "Mon", date: 21, title: "Urinalysis Submission", time: "July 21, 2026 8:00 AM" },
];

export default function CalendarScreen(): JSX.Element {
  const [selected, setSelected] = useState(TODAY);

  return (
    <View className="flex-1 bg-background pb-24">
      <Header rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Month Header */}
        <View className="px-5 mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Text className="text-primary text-lg font-semibold">July 2026</Text>
            <Ionicons name="chevron-down" size={16} color="#6366f1" />
          </View>
          <View className="flex-row gap-2">
            <Pressable className="size-8 items-center justify-center">
              <Ionicons name="chevron-back" size={20} color="#a1a1aa" />
            </Pressable>
            <Pressable className="size-8 items-center justify-center">
              <Ionicons name="chevron-forward" size={20} color="#a1a1aa" />
            </Pressable>
          </View>
        </View>

        {/* Calendar Grid */}
        <Card variant="secondary" className="mx-5 mb-6 rounded-xl p-5 bg-[#18181b] border-0">
          <View className="flex-row justify-between mb-4">
            {DAYS.map((day) => (
              <Text key={day} className="text-muted text-sm flex-1 text-center font-medium">
                {day}
              </Text>
            ))}
          </View>
          {DATES.map((row, rowIndex) => (
            <View key={rowIndex} className="flex-row justify-between mb-3">
              {row.map((date, colIndex) => {
                const isPrevMonth = rowIndex === 0 && date > 20;
                const isNextMonth = rowIndex === 4 && date < 10;
                const isMuted = isPrevMonth || isNextMonth;
                const isSelected = !isMuted && date === selected;
                const hasDot = !isMuted && DOT_DATES.includes(date);

                return (
                  <Pressable
                    key={colIndex}
                    className="flex-1 items-center justify-center"
                    onPress={() => { if (!isMuted) setSelected(date); }}
                  >
                    <View
                      className={`size-8 items-center justify-center rounded-full ${
                        isSelected ? "bg-primary" : ""
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          isMuted
                            ? "text-zinc-600"
                            : isSelected
                            ? "text-white font-medium"
                            : "text-foreground font-medium"
                        }`}
                      >
                        {date}
                      </Text>
                    </View>
                    {hasDot && !isSelected && (
                      <View className="size-1 rounded-full bg-primary mt-1" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Card>

        {/* Upcoming Events */}
        <View className="px-5">
          <Text className="text-white text-lg font-semibold mb-1">Upcoming</Text>
          <Text className="text-muted text-sm mb-4">Scheduled appointments this month.</Text>
          <View className="gap-3">
            {UPCOMING.map((item, index) => (
              <Card
                key={index}
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
                  <Text className="text-muted text-sm">{item.time}</Text>
                </View>
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
