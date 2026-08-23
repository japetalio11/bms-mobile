import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View } from "react-native";
import type { ComponentProps, JSX } from "react";
import type { ColorValue } from "react-native";
import { withUniwind } from "uniwind";
import { AnimatedTabBar } from "../../components/AnimatedTabBar";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
const StyledIonicons = withUniwind(Ionicons);

function TabIcon({
  name,
  color,
}: {
  name: IoniconName;
  color: ColorValue;
}): JSX.Element {
  return <StyledIonicons name={name} size={22} color={color} />;
}

export default function TabsLayout(): JSX.Element {
  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { display: "none" }, // hidden — we use AnimatedTabBar
      }}
    >
      {/* ── Visible tabs (appear in scrollable tab bar) ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabIcon name="home-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: "Appointments",
          tabBarIcon: ({ color }) => <TabIcon name="calendar-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: "New Visit",
          tabBarIcon: ({ color }) => (
            <StyledIonicons name="add-outline" size={26} color="white" />
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: "Lab Records",
          tabBarIcon: ({ color }) => <TabIcon name="clipboard-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabIcon name="person-outline" color={color} />,
        }}
      />
      {/* ── Hidden screens (not shown in tab bar) ── */}
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="security" options={{ href: null }} />
      <Tabs.Screen name="privacy" options={{ href: null }} />
      <Tabs.Screen name="upload-record" options={{ href: null }} />
      <Tabs.Screen name="vitals" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="appointment-detail" options={{ href: null }} />
      <Tabs.Screen name="urinalysis" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="app-appearance" options={{ href: null }} />
    </Tabs>
  );
}
