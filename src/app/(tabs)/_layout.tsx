import { AppIcon as Ionicons } from "../../components/AppIcon";
import { Tabs, Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import type { ComponentProps, JSX } from "react";
import type { ColorValue } from "react-native";
import { AnimatedTabBar } from "../../components/AnimatedTabBar";
import { useAuth } from "../../context/UserContext";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, color, size, weight }: { name: IoniconName; color: ColorValue; size: number; weight: "fill" | "bold" }): JSX.Element {
  return <Ionicons name={name} size={size} weight={weight} color={typeof color === "string" ? color : "#71717a"} />;
}

export default function TabsLayout(): JSX.Element {
  const { isAuthenticated, isLoadingStorage } = useAuth();

  if (isLoadingStorage) {
    return (
      <View
        style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}
      >
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { display: "none" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <TabIcon name="home-outline" color={color} size={size} weight="fill" />,
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: "EHR Records",
          tabBarIcon: ({ color, size }) => <TabIcon name="document-text-outline" color={color} size={size} weight="bold" />,
        }}
      />

      <Tabs.Screen name="chat" options={{ title: "Messages" }} />
      <Tabs.Screen name="profile" options={{}} />

      <Tabs.Screen name="scanner" options={{}} />
      <Tabs.Screen name="search" options={{}} />
      <Tabs.Screen name="history" options={{}} />
      <Tabs.Screen name="security" options={{}} />
      <Tabs.Screen name="privacy" options={{}} />
      <Tabs.Screen name="upload-record" options={{}} />
      <Tabs.Screen name="vitals" options={{}} />
      <Tabs.Screen name="explore" options={{}} />
      <Tabs.Screen name="appointment-detail" options={{}} />
      <Tabs.Screen name="urinalysis" options={{}} />
      <Tabs.Screen name="medical-history" options={{}} />
      <Tabs.Screen name="edit-profile" options={{}} />
      <Tabs.Screen name="notifications" options={{}} />
    </Tabs>
  );
}
