import { View, ScrollView, Pressable } from "react-native";
import type { JSX } from "react";
import { Tabs, Card, SearchField, Text } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Header } from "../../components/Header";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DATES = [
  [29, 30, 31, 1, 2, 3, 4],
  [5, 6, 7, 8, 9, 10, 11],
  [12, 13, 14, 15, 16, 17, 18],
  [19, 20, 21, 22, 23, 24, 25],
  [26, 27, 28, 29, 30, 31, 1],
];
const DOT_DATES = [2, 6, 14, 27, 28];
const SELECTED_DATE = 16;

export default function AppointmentsScreen(): JSX.Element {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");
  const [searchValue, setSearchValue] = useState("");

  const renderCalendar = () => (
    <Card variant="secondary" className="mx-5 mb-5 rounded-xl p-5 bg-surface border-0">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-1">
          <Text className="text-[#6366f1] font-semibold text-base">December 2025</Text>
          <Ionicons name="chevron-down" size={14} color="#6366f1" />
        </View>
        <View className="flex-row gap-1">
          <Pressable className="size-8 items-center justify-center rounded-full bg-default">
            <Ionicons name="chevron-back" size={16} color="#a1a1aa" />
          </Pressable>
          <Pressable className="size-8 items-center justify-center rounded-full bg-default">
            <Ionicons name="chevron-forward" size={16} color="#a1a1aa" />
          </Pressable>
        </View>
      </View>

      <View className="flex-row justify-between mb-3">
        {DAYS.map((day) => (
          <Text key={day} className="text-muted text-sm flex-1 text-center font-medium">
            {day}
          </Text>
        ))}
      </View>

      {DATES.map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row justify-between mb-2">
          {row.map((date, colIndex) => {
            const isPrevMonth = rowIndex === 0 && date > 20;
            const isNextMonth = rowIndex === 4 && date < 10;
            const isMuted = isPrevMonth || isNextMonth;
            const isSelected = !isMuted && date === SELECTED_DATE;
            const hasDot = !isMuted && DOT_DATES.includes(date);

            return (
              <View key={colIndex} className="flex-1 items-center justify-center py-1">
                <View
                  className={`size-8 items-center justify-center rounded-full ${
                    isSelected ? "bg-accent" : ""
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      isMuted
                        ? "text-muted opacity-40"
                        : isSelected
                        ? "text-white font-semibold"
                        : "text-foreground font-medium"
                    }`}
                  >
                    {date}
                  </Text>
                </View>
                {hasDot && !isSelected && (
                  <View className="size-1 rounded-full bg-accent mt-0.5" />
                )}
              </View>
            );
          })}
        </View>
      ))}
    </Card>
  );

  return (
    <View className="flex-1 bg-background">
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {renderCalendar()}

        {/* Quick Actions */}
        <View className="px-5 mb-5 flex-row gap-3">
          <Pressable
            onPress={() => router.push("/(tabs)/calendar")}
            className="flex-1 bg-surface py-3 px-4 rounded-xl flex-row items-center gap-2 justify-center"
          >
            <Ionicons name="calendar-outline" size={18} color="#6366f1" />
            <Text className="text-foreground font-medium text-sm">Full Calendar</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/history")}
            className="flex-1 bg-surface py-3 px-4 rounded-xl flex-row items-center gap-2 justify-center"
          >
            <Ionicons name="time-outline" size={18} color="#10b981" />
            <Text className="text-foreground font-medium text-sm">Visit History</Text>
          </Pressable>
        </View>

        {/* Consistent Tab bar */}
        <View className="px-5 mb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} variant="primary">
            <Tabs.List className="bg-default p-1 rounded-xl">
              <Tabs.Indicator className="bg-surface-secondary rounded-xl" />
              <Tabs.Trigger value="all">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                    All
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="prenatal">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                    Prenatal
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="postnatal">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                    Postnatal
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="neonatal">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                    Neonatal
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </View>

        {/* Search + filter */}
        <View className="px-5 mb-5 flex-row items-center gap-3">
          <View className="flex-1">
            <SearchField value={searchValue} onChange={setSearchValue}>
              <SearchField.Group className="bg-default border-0 rounded-xl h-12">
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search for an appointment..." className="text-sm" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </View>
          <Pressable className="size-12 bg-default rounded-xl items-center justify-center">
            <Ionicons name="options-outline" size={20} color="#a1a1aa" />
          </Pressable>
        </View>

        {/* Appointment cards */}
        <View className="px-5 gap-3">
          <Pressable onPress={() => router.push("/(tabs)/appointment-detail")}>
            <Card variant="secondary" className="bg-surface border-0 rounded-xl p-4 flex-row items-center gap-3">
              <View className="items-center justify-center w-12 bg-[#ef4444]/15 rounded-xl py-2">
                <Text className="text-[#ef4444] text-sm font-semibold">Thu</Text>
                <Text className="text-foreground text-lg font-bold">11</Text>
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold text-base mb-0.5">Prenatal Checkup</Text>
                <Text className="text-muted text-sm">July 11, 2026 · 9:00 AM</Text>
              </View>
              <View className="size-8 rounded-full bg-[#6366f1]/15 items-center justify-center">
                <Ionicons name="chevron-forward" size={14} color="#6366f1" />
              </View>
            </Card>
          </Pressable>

          <Pressable onPress={() => router.push("/(tabs)/appointment-detail")}>
            <Card variant="secondary" className="bg-surface border-0 rounded-xl p-4 flex-row items-center gap-3">
              <View className="items-center justify-center w-12 bg-[#10b981]/15 rounded-xl py-2">
                <Text className="text-[#10b981] text-sm font-semibold">Fri</Text>
                <Text className="text-foreground text-lg font-bold">8</Text>
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold text-base mb-0.5">Prenatal Checkup</Text>
                <Text className="text-muted text-sm">June 8, 2026 · 9:00 AM</Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color="#10b981" />
            </Card>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
