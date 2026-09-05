import { View, Text, ScrollView, Pressable } from "react-native";
import { useState } from "react";
import { Card } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { useSettings } from "../../context/settingsContext";
import type { TextSize } from "../../context/settingsContext";

import { useRouter } from "expo-router";

export default function AppAppearanceScreen() {
  const router = useRouter();
  const { theme, setTheme, textSize, setTextSize } = useSettings();
  const [showSizeSelector, setShowSizeSelector] = useState(false);

  const textSizeLabels: Record<TextSize, string> = {
    small: "Small",
    medium: "Medium (Recommended)",
    large: "Large (Accessible)",
  };

  return (
    <View className="flex-1 bg-background pb-24">
      <Header showBackButton title="App Appearance" onBack={() => router.push("/(tabs)/profile")} rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        
        {/* Theme Visual Mockup Header */}
        <View className="px-5 mb-8 pt-2">
          <Card variant="secondary" className="bg-surface border-0 rounded-xl h-48 p-4">
            <View className="flex-row items-center mb-6">
              <View className="size-12 rounded-full bg-default mr-4" />
              <View className="flex-1">
                <View className="h-3 w-1/2 bg-default rounded-full mb-2" />
                <View className="h-3 w-3/4 bg-default rounded-full" />
              </View>
            </View>
            <View className="flex-row flex-1 gap-4">
              <View className="flex-1 bg-default/40 rounded-xl p-3 justify-end">
                <View className="h-2 w-full bg-default rounded-full mb-2" />
                <View className="h-2 w-3/4 bg-default rounded-full" />
              </View>
              <View className="flex-1 bg-default rounded-xl p-3 justify-end">
                <View className="h-2 w-full bg-surface rounded-full mb-2" />
                <View className="h-2 w-3/4 bg-surface rounded-full" />
              </View>
            </View>
          </Card>
        </View>

        <View className="px-5">
          <Text className="text-muted text-sm font-medium mb-3 ml-1">Interface Style</Text>

          <Card variant="secondary" className="bg-surface border-0 rounded-xl mb-6 flex-row p-1.5">
            <Pressable
              onPress={() => setTheme("light")}
              className={`flex-1 py-3.5 items-center justify-center rounded-xl ${
                theme === "light" ? "bg-default" : ""
              }`}
            >
              <Ionicons name="sunny-outline" size={22} color={theme === "light" ? "#f43f5e" : "#a1a1aa"} className="mb-1.5" />
              <Text className={`font-medium text-sm ${theme === "light" ? "text-foreground font-semibold" : "text-muted"}`}>Light</Text>
            </Pressable>

            <Pressable
              onPress={() => setTheme("dark")}
              className={`flex-1 py-3.5 items-center justify-center rounded-xl ${
                theme === "dark" ? "bg-default" : ""
              }`}
            >
              <Ionicons name="moon-outline" size={22} color={theme === "dark" ? "#f43f5e" : "#a1a1aa"} className="mb-1.5" />
              <Text className={`font-medium text-sm ${theme === "dark" ? "text-foreground font-semibold" : "text-muted"}`}>Dark</Text>
            </Pressable>

            <Pressable
              onPress={() => setTheme("system")}
              className={`flex-1 py-3.5 items-center justify-center rounded-xl ${
                theme === "system" ? "bg-default" : ""
              }`}
            >
              <Ionicons name="phone-portrait-outline" size={22} color={theme === "system" ? "#f43f5e" : "#a1a1aa"} className="mb-1.5" />
              <Text className={`font-medium text-sm ${theme === "system" ? "text-foreground font-semibold" : "text-muted"}`}>System</Text>
            </Pressable>
          </Card>

          <Text className="text-muted text-sm font-medium mb-3 ml-1">Typography</Text>

          {/* Text Size Selector Card */}
          <Card variant="secondary" className="bg-surface border-0 rounded-xl p-4">
            <Pressable 
              onPress={() => setShowSizeSelector(!showSizeSelector)} 
              className="flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3">
                <View className="size-9 rounded-full bg-default items-center justify-center">
                  <Ionicons name="text-outline" size={18} color="#a1a1aa" />
                </View>
                <View>
                  <Text className="text-foreground text-base font-medium">Text Size</Text>
                  <Text className="text-muted text-sm mt-0.5">{textSizeLabels[textSize]}</Text>
                </View>
              </View>
              <Ionicons name={showSizeSelector ? "chevron-up" : "chevron-down"} size={18} color="#a1a1aa" />
            </Pressable>

            {showSizeSelector && (
              <View className="mt-4 pt-3 border-t border-default gap-2">
                {(["small", "medium", "large"] as TextSize[]).map((size) => (
                  <Pressable
                    key={size}
                    onPress={() => {
                      setTextSize(size);
                      setShowSizeSelector(false);
                    }}
                    className={`flex-row items-center justify-between p-3 rounded-lg ${
                      textSize === size ? "bg-default/40" : ""
                    }`}
                  >
                    <Text className={`text-base ${textSize === size ? "text-primary font-bold" : "text-foreground"}`}>
                      {textSizeLabels[size]}
                    </Text>
                    {textSize === size && <Ionicons name="checkmark" size={18} className="text-primary" />}
                  </Pressable>
                ))}
              </View>
            )}
          </Card>

        </View>
      </ScrollView>
    </View>
  );
}
