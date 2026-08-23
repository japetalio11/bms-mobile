import { View, ScrollView, Pressable } from "react-native";
import { Text, Avatar, Button, Card } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import type { JSX } from "react";
import { useAuth } from "../../context/UserContext";

function SettingRow({
  icon,
  title,
  subtitle,
  onPress,
  showChevron = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-4 py-3.5 px-1">
      <View className="size-9 rounded-full bg-default items-center justify-center">
        <Ionicons name={icon} size={18} color="#a1a1aa" />
      </View>
      <View className="flex-1">
        <Text className="text-foreground text-base font-medium">{title}</Text>
        {subtitle && <Text className="text-muted text-sm mt-0.5">{subtitle}</Text>}
      </View>
      {showChevron && <Ionicons name="chevron-forward" size={16} color="#71717a" />}
    </Pressable>
  );
}

export default function ProfileScreen(): JSX.Element {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.replace("/(auth)/login");
  };

  return (
    <View className="flex-1 bg-background">
      <Header rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Profile Hero */}
        <View className="items-center px-5 pt-2 pb-6">
          <Avatar size="lg" className="mb-4">
            {(user as any).profile_picture_url || (user as any).avatar_url ? (
              <Avatar.Image source={{ uri: (user as any).profile_picture_url || (user as any).avatar_url }} />
            ) : (
              <Avatar.Fallback delayMs={0}>
                <View className="w-full h-full bg-[#212129] items-center justify-center border border-white/10">
                  <Text className="text-white text-xl font-bold">
                    {user.first_name ? user.first_name.charAt(0).toUpperCase() : "M"}
                  </Text>
                </View>
              </Avatar.Fallback>
            )}
          </Avatar>
          <Text className="text-foreground text-lg font-bold">{user.name || "Mother Profile"}</Text>
          <Text className="text-muted text-sm mb-5">{user.email || user.phone_number || ""}</Text>

          <Button
            variant="secondary"
            className="w-full bg-default border-0 rounded-xl"
            onPress={() => router.push("/(tabs)/edit-profile")}
          >
            <Button.Label className="text-foreground font-medium">Edit Profile</Button.Label>
          </Button>
        </View>

        {/* Preferences */}
        <View className="px-5 mb-4">
          <Text className="text-muted text-sm font-medium mb-1 ml-1">Preferences</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl px-3 py-1">
            <SettingRow
              icon="notifications-outline"
              title="Notification Preferences"
              subtitle="Reminders for supplements, appointments"
            />
            <View className="h-px bg-separator mx-1" />
            <SettingRow
              icon="color-palette-outline"
              title="App Appearance"
              subtitle="Theme and display settings"
              onPress={() => router.push("/(tabs)/app-appearance")}
            />
          </Card>
        </View>

        {/* Privacy & Security */}
        <View className="px-5 mb-4">
          <Text className="text-muted text-sm font-medium mb-1 ml-1">Privacy & Security</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl px-3 py-1">
            <SettingRow
              icon="lock-closed-outline"
              title="Security"
              subtitle="Manage password & authentication"
              onPress={() => router.push("/(tabs)/security")}
            />
            <View className="h-px bg-default mx-1" />
            <SettingRow
              icon="shield-checkmark-outline"
              title="Data Privacy"
              subtitle="Manage your personal data"
              onPress={() => router.push("/(tabs)/privacy")}
            />
          </Card>
        </View>

        {/* Account */}
        <View className="px-5">
          <Text className="text-muted text-sm font-medium mb-1 ml-1">Account</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl px-3 py-1">
            <SettingRow
              icon="log-out-outline"
              title="Sign Out"
              showChevron={false}
              onPress={handleLogout}
            />
          </Card>
        </View>

      </ScrollView>
    </View>
  );
}
