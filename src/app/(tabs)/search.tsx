import { View, Text, ScrollView, Pressable, Keyboard } from "react-native";
import type { JSX } from "react";
import { useState, useEffect } from "react";
import { SearchField, Card } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CATEGORIES = [
  { label: "Appointments", icon: "calendar-outline" as const, color: "#6366f1", route: "/(tabs)/appointments" },
  { label: "Lab Records", icon: "clipboard-outline" as const, color: "#3b82f6", route: "/(tabs)/records" },
  { label: "Prescriptions", icon: "medkit-outline" as const, color: "#10b981", route: "/(tabs)/records" },
  { label: "Vitals", icon: "pulse-outline" as const, color: "#f59e0b", route: "/(tabs)/vitals" },
];

const STORAGE_KEY = "@bms_recent_searches";

export default function SearchScreen(): JSX.Element {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    loadRecentSearches();
  }, []);

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      } else {
        // Default initial items
        setRecentSearches(["Prenatal Checkup", "Urinalysis", "Iron Supplement", "Blood Pressure"]);
      }
    } catch (e) {
      console.warn("Failed to load recent searches", e);
    }
  };

  const saveSearch = async (query: string) => {
    if (!query.trim()) return;
    try {
      const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5); // keep top 5
      setRecentSearches(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to save search", e);
    }
  };

  const handleSearch = (query: string) => {
    if (!query.trim()) return;
    saveSearch(query);
    Keyboard.dismiss();
    // For now, simply navigate to explore/records as search results are unified there
    router.push("/(tabs)/explore"); 
  };

  return (
    <View className="flex-1 bg-background pb-24">
      <Header rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 mb-6">
          <Text className="text-white text-lg font-semibold mb-1">Search</Text>
          <Text className="text-zinc-400 text-sm mb-4">Find appointments, records, and more.</Text>

          <SearchField 
            value={search} 
            onChange={setSearch}
          >
            <SearchField.Group className="bg-[#18181b] border-0 rounded-xl h-12">
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search anything..." className="text-sm" returnKeyType="search" onSubmitEditing={() => handleSearch(search)} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </View>

        <View className="px-5 mb-6">
          <Text className="text-zinc-400 text-sm mb-3 ml-1">Browse by Category</Text>
          <View className="flex-row flex-wrap gap-3">
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.label}
                onPress={() => router.push(cat.route as any)}
                className="flex-row items-center gap-2 bg-[#18181b] rounded-xl px-4 py-3 active:opacity-70"
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
          <Text className="text-zinc-400 text-sm mb-3 ml-1">Recent Searches</Text>
          <Card variant="secondary" className="bg-[#18181b] border-0 rounded-xl p-0 overflow-hidden">
            {recentSearches.map((item, index) => (
              <Pressable
                key={item}
                onPress={() => {
                  setSearch(item);
                  handleSearch(item);
                }}
                className={`flex-row items-center gap-3 px-4 py-3 active:bg-[#27272a] ${
                  index < recentSearches.length - 1 ? "border-b border-[#27272a]" : ""
                }`}
              >
                <Ionicons name="time-outline" size={18} color="#71717a" />
                <Text className="text-white text-base flex-1">{item}</Text>
                <Ionicons name="chevron-forward" size={16} color="#52525b" />
              </Pressable>
            ))}
            {recentSearches.length === 0 && (
              <View className="px-4 py-4 items-center">
                <Text className="text-zinc-400 text-sm">No recent searches</Text>
              </View>
            )}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
