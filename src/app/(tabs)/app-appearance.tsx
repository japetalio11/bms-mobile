import { View, Text, ScrollView, Pressable } from "react-native";
import { Card } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { Uniwind, useUniwind } from "uniwind";

export default function AppAppearanceScreen() {
  const { theme } = useUniwind();

  const setTheme = (value: string) => {
    Uniwind.setTheme(value as "light" | "dark" | "system");
  };

  return (
    <View className="flex-1 bg-background pb-24">
      <Header showBackButton title="App Appearance" rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 mb-8">
          <Card variant="secondary" className="bg-[#52525b] border-0 rounded-xl h-48 p-4">
            {/* Visual Mockup representation */}
            <View className="flex-row items-center mb-6">
              <View className="size-12 rounded-full bg-[#3f3f46] mr-4" />
              <View className="flex-1">
                <View className="h-3 w-1/2 bg-[#3f3f46] rounded-full mb-2" />
                <View className="h-3 w-3/4 bg-[#3f3f46] rounded-full" />
              </View>
            </View>
            <View className="flex-row flex-1 gap-4">
              <View className="flex-1 bg-[#71717a] rounded-xl p-3 justify-end">
                <View className="h-2 w-full bg-[#52525b] rounded-full mb-2" />
                <View className="h-2 w-3/4 bg-[#52525b] rounded-full" />
              </View>
              <View className="flex-1 bg-[#27272a] rounded-xl p-3 justify-end">
                <View className="h-2 w-full bg-[#18181b] rounded-full mb-2" />
                <View className="h-2 w-3/4 bg-[#18181b] rounded-full" />
              </View>
            </View>
          </Card>
        </View>

        <View className="px-5">
          <Text className="text-muted text-sm mb-4 ml-1">Interface Style</Text>

          <Card variant="secondary" className="bg-[#18181b] border-0 rounded-xl mb-4 flex-row p-1">
            <Pressable
              onPress={() => setTheme("light")}
              className={`flex-1 py-4 items-center justify-center rounded-xl ${
                theme === "light" ? "bg-[#27272a]" : ""
              }`}
            >
              <Ionicons name="sunny-outline" size={24} color={theme === "light" ? "white" : "#a1a1aa"} className="mb-2" />
              <Text className={`font-medium ${theme === "light" ? "text-white" : "text-muted"}`}>Light Mode</Text>
            </Pressable>

            <Pressable
              onPress={() => setTheme("dark")}
              className={`flex-1 py-4 items-center justify-center rounded-xl ${
                theme === "dark" ? "bg-[#27272a]" : ""
              }`}
            >
              <Ionicons name="moon-outline" size={24} color={theme === "dark" ? "white" : "#a1a1aa"} className="mb-2" />
              <Text className={`font-medium ${theme === "dark" ? "text-white" : "text-muted"}`}>Dark Mode</Text>
            </Pressable>

            <Pressable
              onPress={() => setTheme("system")}
              className={`flex-1 py-4 items-center justify-center rounded-xl ${
                (theme as string) === "system" ? "bg-[#27272a]" : ""
              }`}
            >
              <Ionicons name="phone-portrait-outline" size={24} color={(theme as string) === "system" ? "white" : "#a1a1aa"} className="mb-2" />
              <Text className={`font-medium ${(theme as string) === "system" ? "text-white" : "text-muted"}`}>System</Text>
            </Pressable>
          </Card>

          <Card variant="secondary" className="bg-[#18181b] border-0 rounded-xl p-4 flex-row items-center">
            <View className="mr-4 ml-1">
              <Ionicons name="options-outline" size={24} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-medium mb-1">Text Size</Text>
              <Text className="text-muted text-sm">Medium (Recommended)</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="white" />
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

