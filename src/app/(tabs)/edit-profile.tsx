import {
  View,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { Text, Avatar, Button, TextField, Label, Input } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import type { JSX } from "react";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth, STORAGE_KEYS } from "../../context/UserContext";
import { useNetwork } from "../../context/NetworkContext";
import { useConfirm } from "../../context/ConfirmationContext";
import {
  updateMotherProfileApi,
  uploadAvatarApi,
  formatFormDataFile,
} from "../../config/api";
import { updateUserProfileLocal, enqueueSyncAction } from "../../db/repository";

export default function EditProfileScreen(): JSX.Element {
  const router = useRouter();
  const { user, token, refreshProfile } = useAuth();
  const { isOnline } = useNetwork();
  const { confirm } = useConfirm();

  const [firstName, setFirstName] = useState(user.first_name || "");
  const [lastName, setLastName] = useState(user.last_name || "");
  const [phone, setPhone] = useState(user.phone_number || "");
  const [email, setEmail] = useState(user.email || "");
  const [address, setAddress] = useState(user.address || "");
  const [avatarUri, setAvatarUri] = useState<string | null>(
    user.profile_url || (user as any).profile_picture_url || (user as any).avatar_url || null
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setSuccess(false);
      setError(null);
      setIsLoading(false);
      setIsUploadingPhoto(false);

      return () => {
        setSuccess(false);
        setError(null);
      };
    }, [])
  );

  useEffect(() => {
    if (user) {
      if (user.first_name) setFirstName(user.first_name);
      if (user.last_name) setLastName(user.last_name);
      if (user.phone_number) setPhone(user.phone_number);
      if (user.email) setEmail(user.email);
      if (user.address) setAddress(user.address);
      const photo = user.profile_url || (user as any).profile_picture_url || (user as any).avatar_url;
      if (photo) setAvatarUri(photo);
    }
  }, [user]);

  const handlePickImage = async (useCamera = false) => {
    setIsPhotoPickerOpen(false);
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          confirm({
            title: "Camera Permission Required",
            message: "Camera access is needed to capture a profile photo.",
            confirmText: "OK",
            cancelText: "",
            variant: "warning",
            icon: "camera-outline",
          });
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.8,
          allowsEditing: true,
          aspect: [1, 1],
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
          allowsEditing: true,
          aspect: [1, 1],
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (err: any) {
      console.warn("Error picking profile image:", err);
      setError("Could not select photo. Please try again.");
    }
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and Last name are required");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let uploadedProfileUrl: string | undefined = undefined;
      const isLocalFile = avatarUri && (avatarUri.startsWith("file://") || avatarUri.startsWith("content://"));

      if (isLocalFile) {
        if (isOnline && token) {
          try {
            setIsUploadingPhoto(true);
            const fileName = `profile_${user.user_id}_${Date.now()}.jpg`;
            const filePayload = formatFormDataFile(avatarUri, fileName, "image/jpeg");
            const formData = new FormData();
            formData.append("file", filePayload as any);

            const uploadRes = await uploadAvatarApi(formData, token);
            uploadedProfileUrl = uploadRes.fileUrl;
          } catch (uploadErr: any) {
            console.warn("Supabase photo upload warning, preserving local URI:", uploadErr);
            uploadedProfileUrl = avatarUri;
          } finally {
            setIsUploadingPhoto(false);
          }
        } else {
          uploadedProfileUrl = avatarUri;
        }
      } else if (avatarUri) {
        uploadedProfileUrl = avatarUri;
      }

      const updatedPayload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        ...(uploadedProfileUrl ? { profile_url: uploadedProfileUrl } : {}),
      };

      if (user.user_id) {
        await updateUserProfileLocal(user.user_id, updatedPayload);
      }

      const updatedUser = {
        ...user,
        ...updatedPayload,
        name: [updatedPayload.first_name, user.middle_name, updatedPayload.last_name].filter(Boolean).join(" "),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));

      if (isOnline && token) {
        try {
          await updateMotherProfileApi(updatedPayload, token);
          await refreshProfile();
        } catch (apiErr: any) {
          console.warn("Online profile update failed, queued to offline sync engine:", apiErr);
          if (user.user_id) {
            await enqueueSyncAction(
              "UPDATE_PROFILE",
              "/api/v1/mother/profile/update",
              "PUT",
              {
                ...updatedPayload,
                ...(isLocalFile ? { localAvatarUri: avatarUri } : {}),
              },
              user.user_id
            );
          }
        }
      } else {
        if (user.user_id) {
          await enqueueSyncAction(
            "UPDATE_PROFILE",
            "/api/v1/mother/profile/update",
            "PUT",
            {
              ...updatedPayload,
              ...(isLocalFile ? { localAvatarUri: avatarUri } : {}),
            },
            user.user_id
          );
        }
        await refreshProfile();
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)/profile");
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
      setIsUploadingPhoto(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <Header showBackButton title="Edit Profile" onBack={() => router.push("/(tabs)/profile")} rightIcon={null} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >

        <View className="px-5 items-center pt-2 mb-6">
          <Pressable onPress={() => setIsPhotoPickerOpen(true)} className="relative mb-4 active:opacity-80">
            <Avatar size="lg" className="h-24 w-24">
              {avatarUri ? (
                <Avatar.Image source={{ uri: avatarUri }} />
              ) : (
                <Avatar.Fallback delayMs={0}>
                  <View className="w-full h-full bg-[#212129] items-center justify-center border border-white/10">
                    <Text className="text-white text-lg font-bold">
                      {firstName ? firstName.charAt(0).toUpperCase() : "M"}
                    </Text>
                  </View>
                </Avatar.Fallback>
              )}
            </Avatar>
            <View className="absolute bottom-0 right-0 size-8 bg-primary rounded-full items-center justify-center border-2 border-background">
              {isUploadingPhoto ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="camera-outline" size={14} color="white" />
              )}
            </View>
          </Pressable>

          <Text className="text-foreground text-lg font-bold mb-0.5">{user.name || "Mother Profile"}</Text>
          <Text className="text-zinc-400 text-sm">{user.email || user.phone_number || ""}</Text>
        </View>

        {error && (
          <View className="mx-5 mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex-row items-center gap-3">
            <Ionicons name="alert-circle-outline" size={22} color="#ef4444" />
            <Text className="text-red-500 text-sm flex-1">{error}</Text>
          </View>
        )}

        {success && (
          <View className="mx-5 mb-5 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex-row items-center gap-3">
            <Ionicons name="checkmark-circle-outline" size={22} color="#10b981" />
            <Text className="text-green-600 dark:text-green-400 text-sm flex-1">
              Profile updated successfully! Redirecting...
            </Text>
          </View>
        )}

        <View className="px-5 gap-5">
          <Text className="text-zinc-400 text-sm font-medium ml-1">Personal Information</Text>

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
      </TouchableWithoutFeedback>

      <Modal visible={isPhotoPickerOpen} transparent animationType="fade" onRequestClose={() => setIsPhotoPickerOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setIsPhotoPickerOpen(false)}>
          <View className="flex-1 bg-black/70 justify-end p-5">
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View className="bg-[#1c1c24] border border-white/10 rounded-3xl p-4 gap-2">
                <Text className="text-white text-base font-bold text-center py-2 border-b border-white/10 mb-1">
                  Change Profile Photo
                </Text>

                <Pressable
                  onPress={() => handlePickImage(true)}
                  className="flex-row items-center gap-3 p-3.5 rounded-2xl bg-[#252530] active:bg-[#30303d]"
                >
                  <Ionicons name="camera-outline" size={20} color="#38bdf8" />
                  <Text className="text-white text-sm font-semibold">Take Photo</Text>
                </Pressable>

                <Pressable
                  onPress={() => handlePickImage(false)}
                  className="flex-row items-center gap-3 p-3.5 rounded-2xl bg-[#252530] active:bg-[#30303d]"
                >
                  <Ionicons name="images-outline" size={20} color="#10b981" />
                  <Text className="text-white text-sm font-semibold">Choose from Library</Text>
                </Pressable>

                <Pressable
                  onPress={() => setIsPhotoPickerOpen(false)}
                  className="p-3.5 rounded-2xl bg-white/5 items-center justify-center mt-1"
                >
                  <Text className="text-zinc-400 text-sm font-medium">Cancel</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}
