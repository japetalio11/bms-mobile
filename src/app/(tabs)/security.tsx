import { useState, useCallback } from "react";
import { View, ScrollView, Pressable, ActivityIndicator, BackHandler } from "react-native";
import { Label, Text, useToast } from "heroui-native";
import { AppButton as Button, AppInput as Input, AppTextField as TextField } from "../../components/FormControls";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "../../components/AppIcon";
import { useAuth } from "../../context/UserContext";
import { changePasswordApi } from "../../config/api";

export default function SecurityScreen() {
  const router = useRouter();
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/(tabs)/profile");
      return true;
    });
    return () => subscription.remove();
  }, [router]));
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { token, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const updatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.show({ label: "Complete all password fields", variant: "warning" });
      return;
    }
    if (newPassword.length < 6) {
      toast.show({ label: "Use at least 6 characters", variant: "warning" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.show({ label: "New passwords do not match", variant: "warning" });
      return;
    }
    if (!token) {
      toast.show({ label: "Please sign in again", variant: "danger" });
      return;
    }
    setLoading(true);
    try {
      await changePasswordApi({ currentPassword, newPassword }, token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.show({ label: "Password updated", variant: "success" });
    } catch (error) {
      toast.show({ label: "Could not update password", description: error instanceof Error ? error.message : "Check your current password and try again.", variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  return <View className="flex-1 bg-background">
    <View className="h-16 flex-row items-center justify-between px-5">
      <Pressable onPress={() => router.replace("/(tabs)/profile")} accessibilityLabel="Back to settings" className="size-11 items-center justify-center"><AppIcon name="chevron-back" size={23} weight="bold" color="#171717" /></Pressable>
      <Text className="text-2xl font-semibold text-foreground">Change Password</Text>
      <View className="size-10" />
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 100 }}>
      <Text className="text-base font-semibold text-foreground">Keep your account secure</Text>
      <Text className="mt-1 text-sm text-muted-foreground">Enter your current password to set a new one.</Text>
      <View className="mt-7 gap-5">
        <TextField isRequired>
          <Label>Current password</Label>
          <Input value={currentPassword} onChangeText={setCurrentPassword} placeholder="Enter current password" secureTextEntry={!visible} autoCapitalize="none" className="rounded-md" />
        </TextField>
        <TextField isRequired>
          <Label>New password</Label>
          <Input value={newPassword} onChangeText={setNewPassword} placeholder="At least 6 characters" secureTextEntry={!visible} autoCapitalize="none" className="rounded-md" />
        </TextField>
        <TextField isRequired>
          <Label>Confirm new password</Label>
          <Input value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter new password" secureTextEntry={!visible} autoCapitalize="none" className="rounded-md" />
        </TextField>
        <Pressable onPress={() => setVisible(value => !value)} accessibilityRole="button" className="min-h-11 flex-row items-center gap-2 self-start active:opacity-70">
          <AppIcon name={visible ? "eye-off-outline" : "eye-outline"} size={18} color="#525252" />
          <Text className="text-sm font-medium text-foreground">{visible ? "Hide passwords" : "Show passwords"}</Text>
        </Pressable>
      </View>
      <Button onPress={updatePassword} isDisabled={loading} className="mt-6 min-h-12 rounded-md bg-[#fffe8c]">
        {loading ? <ActivityIndicator color="#171717" /> : <Button.Label className="text-base font-medium text-[#171717]">Update password</Button.Label>}
      </Button>
      <View className="mt-9 rounded-xl bg-[#f6f6f6] p-4">
        <Text className="text-sm font-medium text-foreground">Active session</Text>
        <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={1}>{user.email || user.phone_number || "Signed in on this device"}</Text>
      </View>
    </ScrollView>
  </View>;
}
