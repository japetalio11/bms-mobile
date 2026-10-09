import { Ionicons } from "@expo/vector-icons";
import { Tabs, Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import type { ComponentProps, JSX } from "react";
import type { ColorValue } from "react-native";
import { withUniwind } from "uniwind";
import { AnimatedTabBar } from "../../components/AnimatedTabBar";
import { useAuth } from "../../context/UserContext";

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
  const { isAuthenticated, isLoadingStorage } = useAuth();

  if (isLoadingStorage) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
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
        name="records"
        options={{
          title: "Lab Records",
          tabBarIcon: ({ color }) => <TabIcon name="clipboard-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) => <TabIcon name="chatbubble-ellipses-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabIcon name="person-outline" color={color} />,
        }}
      />
      
      <Tabs.Screen name="scanner" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="security" options={{ href: null }} />
      <Tabs.Screen name="privacy" options={{ href: null }} />
      <Tabs.Screen name="upload-record" options={{ href: null }} />
      <Tabs.Screen name="vitals" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="appointment-detail" options={{ href: null }} />
      <Tabs.Screen name="urinalysis" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="app-appearance" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
