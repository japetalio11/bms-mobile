import { View, ScrollView, ActivityIndicator } from "react-native";
import { Text, Avatar, Button, TextField, Label, Input } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import type { JSX } from "react";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/UserContext";
import { updateMotherProfileApi } from "../../config/api";

export default function EditProfileScreen(): JSX.Element {
  const router = useRouter();
  const { user, token, refreshProfile } = useAuth();

  const [firstName, setFirstName] = useState(user.first_name || "");
  const [lastName, setLastName] = useState(user.last_name || "");
  const [phone, setPhone] = useState(user.phone_number || "");
  const [email, setEmail] = useState(user.email || "");
  const [address, setAddress] = useState(user.address || "");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and Last name are required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await updateMotherProfileApi(
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone_number: phone.trim(),
          email: email.trim(),
          address: address.trim(),
        },
        token || ""
      );

      await refreshProfile();
      setSuccess(true);
      setTimeout(() => {
        router.back();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Edit Profile" rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Avatar section */}
        <View className="px-5 items-center pt-2 mb-6">
          <View className="relative mb-4">
            <Avatar size="lg" className="h-24 w-24">
              <Avatar.Fallback delayMs={0}>
                <View className="w-full h-full bg-orange-300" />
              </Avatar.Fallback>
            </Avatar>
            <View className="absolute bottom-0 right-0 size-8 bg-accent rounded-full items-center justify-center">
              <Ionicons name="camera-outline" size={14} color="white" />
            </View>
          </View>
          <Text className="text-foreground text-lg font-bold mb-0.5">{user.name}</Text>
          <Text className="text-muted text-sm">{user.email || user.phone_number}</Text>
        </View>

        {/* Error Alert */}
        {error && (
          <View className="mx-5 mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex-row items-center gap-3">
            <Ionicons name="alert-circle-outline" size={22} color="#ef4444" />
            <Text className="text-red-500 text-sm flex-1">{error}</Text>
          </View>
        )}

        {/* Success Alert */}
        {success && (
          <View className="mx-5 mb-5 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex-row items-center gap-3">
            <Ionicons name="checkmark-circle-outline" size={22} color="#10b981" />
            <Text className="text-green-600 dark:text-green-400 text-sm flex-1">
              Profile updated successfully!
            </Text>
          </View>
        )}

        {/* Form */}
        <View className="px-5 gap-5">
          <Text className="text-muted text-sm font-medium ml-1">Personal Information</Text>

          <TextField isRequired>
            <Label>First Name</Label>
            <Input value={firstName} onChangeText={setFirstName} />
          </TextField>

          <TextField isRequired>
            <Label>Last Name</Label>
            <Input value={lastName} onChangeText={setLastName} />
          </TextField>

          <TextField>
            <Label>Phone Number</Label>
            <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </TextField>

          <TextField>
            <Label>Email Address</Label>
            <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </TextField>

          <TextField>
            <Label>Home Address</Label>
            <Input value={address} onChangeText={setAddress} />
          </TextField>
        </View>

        <View className="px-5 mt-6">
          <Button variant="primary" className="rounded-xl" onPress={handleSave} isDisabled={isLoading}>
            <View className="flex-row items-center justify-center gap-2">
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Ionicons name="checkmark-circle" size={18} color="white" />
              )}
              <Button.Label>{isLoading ? "Saving..." : "Save Changes"}</Button.Label>
            </View>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
