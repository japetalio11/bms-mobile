import { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Text, Avatar, Button, Card } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { JSX } from "react";
import { useAuth } from "../../context/UserContext";
import { MotherQRCodeModal } from "../../components/MotherQRCodeModal";
import { MotherShareJourneyModal } from "../../components/MotherShareJourneyModal";

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
        {subtitle && <Text className="text-zinc-400 text-sm mt-0.5">{subtitle}</Text>}
      </View>
      {showChevron && <Ionicons name="chevron-forward" size={16} color="#71717a" />}
    </Pressable>
  );
}

export default function ProfileScreen(): JSX.Element {
  const router = useRouter();
  const { user, motherRecord, logout } = useAuth();
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [shareJourneyModalOpen, setShareJourneyModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.replace("/(auth)/login");
  };

  const facilityName = user.facility_name || user.facility?.facility_name;

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        <View className="items-center px-5 pt-8 pb-6">
          <Avatar size="lg" className="mb-4">
            {user.profile_url || (user as any).profile_picture_url || (user as any).avatar_url ? (
              <Avatar.Image source={{ uri: user.profile_url || (user as any).profile_picture_url || (user as any).avatar_url }} />
            ) : (
              <Avatar.Fallback delayMs={0}>
                <View className="w-full h-full bg-[#212129] items-center justify-center border border-white/10">
                  <Text className="text-white text-lg font-bold">
                    {user.first_name ? user.first_name.charAt(0).toUpperCase() : "M"}
                  </Text>
                </View>
              </Avatar.Fallback>
            )}
          </Avatar>
          <Text className="text-foreground text-lg font-bold">{user.name || "Mother Profile"}</Text>
          <Text className="text-zinc-400 text-sm mb-4">{user.email || user.phone_number || ""}</Text>

          <Button
            variant="secondary"
            className="w-full bg-default border-0 rounded-xl"
            onPress={() => router.push("/(tabs)/edit-profile")}
          >
            <Button.Label className="text-foreground font-medium">Edit Profile</Button.Label>
          </Button>
        </View>

        <View className="px-5 mb-4">
          <Text className="text-zinc-400 text-sm font-medium mb-1 ml-1">Assigned Care Team</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl px-4 py-3.5">
            {motherRecord?.assignedWorker ? (
              <View className="flex-row items-center gap-3">
                <View className="size-11 rounded-full bg-blue-500/15 items-center justify-center">
                  <Ionicons name="medical" size={20} color="#3b82f6" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-foreground text-base font-bold">
                      {motherRecord.assignedWorker.first_name} {motherRecord.assignedWorker.last_name}
                    </Text>
                    <View className="bg-blue-500/15 px-2 py-0.5 rounded-full">
                      <Text className="text-[#3b82f6] text-xs font-semibold">
                        {motherRecord.assignedWorker.role}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-zinc-400 text-xs mt-0.5">
                    Assigned Primary Care Provider · {facilityName || "Primary Facility"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push("/(tabs)/chat")}
                  className="size-9 rounded-full bg-blue-500/20 items-center justify-center"
                >
                  <Ionicons name="chatbubble-ellipses" size={18} color="#3b82f6" />
                </Pressable>
              </View>
            ) : (
              <View className="flex-row items-center gap-3">
                <View className="size-11 rounded-full bg-default items-center justify-center">
                  <Ionicons name="business-outline" size={20} color="#a1a1aa" />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-base font-semibold">
                    {facilityName || "Primary Health Facility"}
                  </Text>
                  <Text className="text-zinc-400 text-xs mt-0.5">
                    Facility Care Team (Direct staff assignment pending)
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push("/(tabs)/chat")}
                  className="size-9 rounded-full bg-default items-center justify-center"
                >
                  <Ionicons name="chatbubble-ellipses" size={18} color="#a1a1aa" />
                </Pressable>
              </View>
            )}
          </Card>
        </View>

        <View className="px-5 mb-4">
          <Text className="text-zinc-400 text-sm font-medium mb-1 ml-1">Clinical Sharing & Facility</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl px-3 py-1">
            <SettingRow
              icon="share-social-outline"
              title="Share Pregnancy Journey & Vitals"
              subtitle="Generate QR code & 6-digit PIN for doctor web view"
              onPress={() => setShareJourneyModalOpen(true)}
            />
            <View className="h-px bg-separator mx-1" />
            <SettingRow
              icon="qr-code-outline"
              title="Mother Health Card & Facility QR"
              subtitle="Scan code to connect to your health facility"
              onPress={() => setQrModalOpen(true)}
            />
          </Card>
        </View>

        <View className="px-5 mb-4">
          <Text className="text-zinc-400 text-sm font-medium mb-1 ml-1">Preferences</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl px-3 py-1">
            <SettingRow
              icon="notifications-outline"
              title="Notification Preferences"
              subtitle="Reminders for supplements, appointments"
              onPress={() => router.push("/(tabs)/notifications")}
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

        <View className="px-5 mb-4">
          <Text className="text-zinc-400 text-sm font-medium mb-1 ml-1">Privacy & Security</Text>
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

        <View className="px-5">
          <Text className="text-zinc-400 text-sm font-medium mb-1 ml-1">Account</Text>
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

      <MotherQRCodeModal
        visible={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        user={user}
        motherRecord={motherRecord}
      />

      <MotherShareJourneyModal
        visible={shareJourneyModalOpen}
        onClose={() => setShareJourneyModalOpen(false)}
        user={user}
        motherRecord={motherRecord}
      />
    </View>
  );
}
