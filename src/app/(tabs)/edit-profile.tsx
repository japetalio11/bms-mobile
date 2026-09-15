import { View, ScrollView, ActivityIndicator } from "react-native";
import { Text, Avatar, Button, TextField, Label, Input } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import type { JSX } from "react";
import { useState, useEffect } from "react";
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

  // Keep form fields synced if user context updates asynchronously
  useEffect(() => {
    if (user) {
      if (user.first_name) setFirstName(user.first_name);
      if (user.last_name) setLastName(user.last_name);
      if (user.phone_number) setPhone(user.phone_number);
      if (user.email) setEmail(user.email);
      if (user.address) setAddress(user.address);
    }
  }, [user]);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and Last name are required");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

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
        router.push("/(tabs)/profile");
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Edit Profile" onBack={() => router.push("/(tabs)/profile")} rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Avatar section */}
        <View className="px-5 items-center pt-2 mb-6">
          <View className="relative mb-4">
            <Avatar size="lg" className="h-24 w-24">
              <Avatar.Fallback delayMs={0}>
                <View className="w-full h-full bg-[#212129] items-center justify-center border border-white/10">
                  <Text className="text-white text-2xl font-bold">
                    {user.first_name ? user.first_name.charAt(0).toUpperCase() : "M"}
                  </Text>
                </View>
              </Avatar.Fallback>
            </Avatar>
            <View className="absolute bottom-0 right-0 size-8 bg-primary rounded-full items-center justify-center border-2 border-background">
              <Ionicons name="camera-outline" size={14} color="white" />
            </View>
          </View>
          <Text className="text-foreground text-lg font-bold mb-0.5">{user.name || "Mother Profile"}</Text>
          <Text className="text-muted text-sm">{user.email || user.phone_number || ""}</Text>
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
              Profile updated successfully! Redirecting...
            </Text>
          </View>
        )}

        {/* Form Fields */}
        <View className="px-5 gap-5">
          <Text className="text-muted text-sm font-medium ml-1">Personal Information</Text>

          <TextField isRequired>
            <Label>First Name</Label>
            <Input 
              value={firstName} 
              onChangeText={setFirstName} 
              placeholder="Enter first name"
            />
          </TextField>

          <TextField isRequired>
            <Label>Last Name</Label>
            <Input 
              value={lastName} 
              onChangeText={setLastName} 
              placeholder="Enter last name"
            />
          </TextField>

          <TextField>
            <Label>Phone Number</Label>
            <Input 
              value={phone} 
              onChangeText={setPhone} 
              placeholder="e.g. 09123456789"
              keyboardType="phone-pad" 
            />
          </TextField>

          <TextField>
            <Label>Email Address</Label>
            <Input 
              value={email} 
              onChangeText={setEmail} 
              placeholder="e.g. mother@gmail.com"
              keyboardType="email-address" 
              autoCapitalize="none" 
            />
          </TextField>

          <TextField>
            <Label>Home Address</Label>
            <Input 
              value={address} 
              onChangeText={setAddress} 
              placeholder="Enter home address"
            />
          </TextField>
        </View>

        <View className="px-5 mt-8">
          <Button variant="primary" className="rounded-xl h-12" onPress={handleSave} isDisabled={isLoading}>
            <View className="flex-row items-center justify-center gap-2">
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Ionicons name="checkmark-circle" size={18} color="white" />
              )}
              <Button.Label>{isLoading ? "Saving Profile..." : "Save Changes"}</Button.Label>
            </View>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
