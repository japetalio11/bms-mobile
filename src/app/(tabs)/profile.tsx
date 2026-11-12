import { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Avatar, Text, Switch } from "heroui-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "../../components/AppIcon";
import { useAuth } from "../../context/UserContext";
import { useSettings } from "../../context/settingsContext";
import { MotherQRCodeModal } from "../../components/MotherQRCodeModal";
import { MotherShareJourneyModal } from "../../components/MotherShareJourneyModal";

function SettingsRow({ icon, title, onPress, trailing }: { icon: string; title: string; onPress?: () => void; trailing?: React.ReactNode }) {
  return <Pressable onPress={onPress} accessibilityRole={onPress ? "button" : undefined} className="min-h-14 flex-row items-center gap-3 px-4 active:opacity-70">
    <View className="size-9 items-center justify-center rounded-full bg-[#ededed]"><AppIcon name={icon} size={18} weight="regular" color="#242424" /></View>
    <Text className="flex-1 text-sm font-medium text-foreground">{title}</Text>
    {trailing ?? <AppIcon name="chevron-forward" size={17} weight="bold" color="#737373" />}
  </Pressable>;
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, motherRecord, logout } = useAuth();
  const { notifications, setNotificationSetting } = useSettings();
  const [qrOpen, setQrOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const avatar = user.profile_url || (user as any).profile_picture_url || (user as any).avatar_url;
  const handleLogout = async () => { await logout(); router.replace("/(auth)/login"); };

  return <View className="flex-1 bg-background">
    <View className="h-16 flex-row items-center justify-between px-5">
      <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} accessibilityLabel="Back" className="size-11 items-center justify-center"><AppIcon name="chevron-back" size={23} weight="bold" color="#171717" /></Pressable>
      <Text className="text-2xl font-semibold text-foreground">Settings</Text>
      <View className="size-10" />
    </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}>
      <Pressable onPress={() => router.push("/(tabs)/edit-profile")} className="mt-3 mb-7 flex-row items-center rounded-xl bg-[#f2f2f2] p-4 active:opacity-80">
        <Avatar size="md">{avatar ? <Avatar.Image source={{ uri: avatar }} /> : <Avatar.Fallback delayMs={0}><Text className="text-base font-semibold">{user.first_name?.[0] || "M"}</Text></Avatar.Fallback>}</Avatar>
        <View className="ml-3 flex-1"><Text className="text-base font-semibold text-foreground" numberOfLines={1}>{user.name || "My account"}</Text><Text className="text-sm text-muted-foreground" numberOfLines={1}>{user.email || user.phone_number || "Edit your profile"}</Text></View>
        <Text className="text-sm font-medium text-[#454545]">Edit</Text>
      </Pressable>
      <Text className="mb-2 px-1 text-sm font-semibold text-foreground">Account</Text>
      <View className="mb-6 overflow-hidden rounded-xl bg-[#f6f6f6]">
        <SettingsRow icon="lock-closed-outline" title="Change password" onPress={() => router.push("/(tabs)/security")} />
        <SettingsRow icon="person" title="Account details" onPress={() => router.push("/(tabs)/edit-profile")} />
        <SettingsRow icon="shield-checkmark-outline" title="Privacy and data" onPress={() => router.push("/(tabs)/privacy")} />
      </View>
      <Text className="mb-2 px-1 text-sm font-semibold text-foreground">Care and notifications</Text>
      <View className="mb-6 overflow-hidden rounded-xl bg-[#f6f6f6]">
        <SettingsRow icon="notifications-outline" title="Notifications" onPress={() => router.push({ pathname: "/(tabs)/notifications", params: { from: "settings" } })} />
        <SettingsRow icon="calendar-outline" title="Appointment reminders" trailing={<Switch isSelected={notifications.appointmentAlerts} onSelectedChange={(value: boolean) => setNotificationSetting("appointmentAlerts", value)} />} />
        <SettingsRow icon="medical" title="Medicine reminders" trailing={<Switch isSelected={notifications.supplementReminders} onSelectedChange={(value: boolean) => setNotificationSetting("supplementReminders", value)} />} />
      </View>
      <Text className="mb-2 px-1 text-sm font-semibold text-foreground">Health sharing</Text>
      <View className="mb-6 overflow-hidden rounded-xl bg-[#f6f6f6]">
        <SettingsRow icon="qr-code-outline" title="My health QR code" onPress={() => setQrOpen(true)} />
        <SettingsRow icon="share-social-outline" title="Share pregnancy journey" onPress={() => setShareOpen(true)} />
      </View>
      <Pressable onPress={handleLogout} className="min-h-14 flex-row items-center gap-3 rounded-xl bg-[#f6f6f6] px-4 active:opacity-70"><AppIcon name="log-out-outline" size={18} weight="regular" color="#b42318" /><Text className="text-sm font-medium text-[#b42318]">Sign out</Text></Pressable>
    </ScrollView>
    <MotherQRCodeModal visible={qrOpen} onClose={() => setQrOpen(false)} user={user} motherRecord={motherRecord} />
    <MotherShareJourneyModal visible={shareOpen} onClose={() => setShareOpen(false)} user={user} motherRecord={motherRecord} />
  </View>;
}
