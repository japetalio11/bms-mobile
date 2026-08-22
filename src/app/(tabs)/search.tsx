import { View, Text, ScrollView, Pressable } from "react-native";
import type { JSX } from "react";
import { useState } from "react";
import { SearchField, Card } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";

const CATEGORIES = [
  { label: "Appointments", icon: "calendar-outline" as const, color: "#6366f1" },
  { label: "Lab Records", icon: "clipboard-outline" as const, color: "#3b82f6" },
  { label: "Prescriptions", icon: "medkit-outline" as const, color: "#10b981" },
  { label: "Vitals", icon: "pulse-outline" as const, color: "#f59e0b" },
];

const RECENT = ["Prenatal Checkup", "Urinalysis", "Iron Supplement", "Blood Pressure"];

export default function SearchScreen(): JSX.Element {
  const [search, setSearch] = useState("");

  return (
    <View className="flex-1 bg-background pb-24">
      <Header rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 mb-6">
          <Text className="text-white text-lg font-semibold mb-1">Search</Text>
          <Text className="text-muted text-sm mb-4">Find appointments, records, and more.</Text>

          <SearchField value={search} onChange={setSearch}>
            <SearchField.Group className="bg-[#18181b] border-0 rounded-xl h-12">
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search anything..." className="text-sm" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </View>

        <View className="px-5 mb-6">
          <Text className="text-muted text-sm mb-3 ml-1">Browse by Category</Text>
          <View className="flex-row flex-wrap gap-3">
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.label}
                className="flex-row items-center gap-2 bg-[#18181b] rounded-xl px-4 py-3"
              >
                <View
                  className="size-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: cat.color + "20" }}
                >
                  <Ionicons name={cat.icon} size={16} color={cat.color} />
                </View>
                <Text className="text-white text-sm font-medium">{cat.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="px-5">
          <Text className="text-muted text-sm mb-3 ml-1">Recent Searches</Text>
          <Card variant="secondary" className="bg-[#18181b] border-0 rounded-xl p-0 overflow-hidden">
            {RECENT.map((item, index) => (
              <Pressable
                key={item}
                className={`flex-row items-center gap-3 px-4 py-3 ${
                  index < RECENT.length - 1 ? "border-b border-[#27272a]" : ""
                }`}
              >
                <Ionicons name="time-outline" size={18} color="#71717a" />
                <Text className="text-white text-base flex-1">{item}</Text>
                <Ionicons name="chevron-forward" size={16} color="#52525b" />
              </Pressable>
            ))}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
