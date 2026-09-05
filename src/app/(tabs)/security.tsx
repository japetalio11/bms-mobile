import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import type { JSX } from "react";
import { Card, Text, Button, TextField, Label, Input } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { useState } from "react";
import { useAuth } from "../../context/UserContext";
import { changePasswordApi } from "../../config/api";

import { useRouter } from "expo-router";

export default function SecurityScreen(): JSX.Element {
  const router = useRouter();
  const { token, user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isCurrentVisible, setIsCurrentVisible] = useState(false);
  const [isNewVisible, setIsNewVisible] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      setError("Please enter your current password");
      return;
    }
    if (!newPassword) {
      setError("Please enter a new password");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await changePasswordApi(
        {
          currentPassword,
          newPassword,
        },
        token || ""
      );

      setSuccessMessage("Your password has been updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to update password. Please check your current password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Security" onBack={() => router.push("/(tabs)/profile")} rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        {/* Error Alert */}
        {error && (
          <View className="mx-5 mt-4 mb-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex-row items-center gap-3">
            <Ionicons name="alert-circle-outline" size={22} color="#ef4444" />
            <Text className="text-red-500 text-sm flex-1">{error}</Text>
          </View>
        )}

        {/* Success Alert */}
        {successMessage && (
          <View className="mx-5 mt-4 mb-2 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex-row items-center gap-3">
            <Ionicons name="checkmark-circle-outline" size={22} color="#10b981" />
            <Text className="text-green-600 dark:text-green-400 text-sm flex-1">{successMessage}</Text>
          </View>
        )}

        {/* Change Password Form */}
        <View className="px-5 mb-6 pt-2">
          <Text className="text-muted text-sm font-medium mb-2 ml-1">Password & Credentials</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl p-5 gap-5">
            <View>
              <Text className="text-foreground text-lg font-bold">Change Password</Text>
              <Text className="text-muted text-sm mt-0.5">Update your account password to ensure your health account remains secure.</Text>
            </View>

            <TextField isRequired>
              <Label>Current Password</Label>
              <View className="w-full justify-center">
                <Input 
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password" 
                  secureTextEntry={!isCurrentVisible}
                  className="pr-12"
                />
                <Pressable 
                  className="absolute right-4"
                  onPress={() => setIsCurrentVisible(!isCurrentVisible)}
                >
                  <Ionicons 
                    name={isCurrentVisible ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color="#a1a1aa" 
                  />
                </Pressable>
              </View>
            </TextField>

            <TextField isRequired>
              <Label>New Password</Label>
              <View className="w-full justify-center">
                <Input 
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="At least 6 characters" 
                  secureTextEntry={!isNewVisible}
                  className="pr-12"
                />
                <Pressable 
                  className="absolute right-4"
                  onPress={() => setIsNewVisible(!isNewVisible)}
                >
                  <Ionicons 
                    name={isNewVisible ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color="#a1a1aa" 
                  />
                </Pressable>
              </View>
            </TextField>

            <TextField isRequired>
              <Label>Confirm New Password</Label>
              <Input 
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password" 
                secureTextEntry={!isNewVisible}
              />
            </TextField>

            <Button 
              variant="primary" 
              className="w-full rounded-xl mt-2" 
              onPress={handleUpdatePassword}
              isDisabled={isLoading}
            >
              <View className="flex-row items-center justify-center gap-2">
                {isLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Ionicons name="key-outline" size={18} color="white" />
                )}
                <Button.Label>{isLoading ? "Updating..." : "Update Password"}</Button.Label>
              </View>
            </Button>
          </Card>
        </View>

        {/* Active Session Info */}
        <View className="px-5 mb-6">
          <Text className="text-muted text-sm font-medium mb-2 ml-1">Active Session</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl p-4">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-3 flex-1 min-w-0">
                <View className="size-10 rounded-full bg-default items-center justify-center flex-shrink-0">
                  <Ionicons name="phone-portrait-outline" size={20} color="#a1a1aa" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-foreground text-base font-medium" numberOfLines={1} ellipsizeMode="tail">BMS Mobile App</Text>
                  <Text className="text-muted text-sm mt-0.5" numberOfLines={1} ellipsizeMode="tail">{user.email || user.phone_number || "Active Session"}</Text>
                </View>
              </View>
              <View className="px-2.5 py-1 bg-green-500/15 rounded-full flex-shrink-0">
                <Text className="text-green-500 text-xs font-semibold">Active</Text>
              </View>
            </View>
          </Card>
        </View>

      </ScrollView>
    </View>
  );
}
