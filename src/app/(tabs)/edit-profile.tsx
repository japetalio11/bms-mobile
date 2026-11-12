import { View, ScrollView, ActivityIndicator, Pressable, Modal, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Keyboard, BackHandler, } from "react-native";
import { Text, Avatar, Label, useToast } from "heroui-native";
import { AppButton as Button, AppTextField as TextField, AppInput as Input } from "../../components/FormControls";
import { AppIcon as Ionicons } from "../../components/AppIcon";
import type { JSX } from "react";
import { useState, useCallback } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth, STORAGE_KEYS } from "../../context/UserContext";
import { useNetwork } from "../../context/NetworkContext";
import { useConfirm } from "../../context/ConfirmationContext";
import { updateMotherProfileApi, uploadAvatarApi, formatFormDataFile } from "../../config/api";
import { updateUserProfileLocal, enqueueSyncAction } from "../../db/repository";

export default function EditProfileScreen(): JSX.Element {
  const router = useRouter();
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        router.replace("/(tabs)/profile");
        return true;
      });
      return () => subscription.remove();
    }, [router])
  );
  const { user, token, refreshProfile } = useAuth();
  const { isOnline } = useNetwork();
  const { confirm } = useConfirm();
  const { toast } = useToast();

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

  useFocusEffect(
    useCallback(() => {
      setError(null);
      setIsLoading(false);
      setIsUploadingPhoto(false);

      return () => {
        setError(null);
      };
    }, [])
  );

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

    try {
      let uploadedProfileUrl: string | undefined = undefined;
      const isLocalFile =
        avatarUri && (avatarUri.startsWith("file://") || avatarUri.startsWith("content://"));

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
        name: [updatedPayload.first_name, user.middle_name, updatedPayload.last_name]
          .filter(Boolean)
          .join(" "),
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

      toast.show({ label: "Profile updated", variant: "success" });
      setTimeout(() => {
        router.replace("/(tabs)/profile");
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
      <View className="h-16 flex-row items-center justify-between px-5">
        <Pressable onPress={() => router.replace("/(tabs)/profile")} accessibilityLabel="Back to settings" className="size-11 items-center justify-center"><Ionicons name="chevron-back" size={23} weight="bold" color="#171717" /></Pressable>
        <Text className="text-2xl font-semibold text-foreground">Edit Profile</Text>
        <View className="size-10" />
      </View>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View className="px-5 items-center pt-5 mb-6">
            <Pressable
              onPress={() => setIsPhotoPickerOpen(true)}
              className="relative mb-4 active:opacity-80"
            >
              <Avatar size="lg" className="h-24 w-24">
                {avatarUri ? (
                  <Avatar.Image source={{ uri: avatarUri }} />
                ) : (
                  <Avatar.Fallback delayMs={0}>
                    <View className="w-full h-full bg-[#f2f2f2] items-center justify-center">
                      <Text className="text-foreground text-base font-semibold">
                        {firstName ? firstName.charAt(0).toUpperCase() : "M"}
                      </Text>
                    </View>
                  </Avatar.Fallback>
                )}
              </Avatar>
              <View className="absolute bottom-0 right-0 size-8 bg-[#fffe8c] rounded-full items-center justify-center border-2 border-background">
                {isUploadingPhoto ? (
                  <ActivityIndicator size="small" color="#171717" />
                ) : (
                  <Ionicons name="camera-outline" size={14} color="#171717" />
                )}
              </View>
            </Pressable>

            <Text className="text-foreground text-base font-semibold mb-0.5">
              {user.name || "Mother Profile"}
            </Text>
            <Text className="text-muted-foreground text-sm">{user.email || user.phone_number || ""}</Text>
          </View>

          {error && (
            <View className="mx-5 mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex-row items-center gap-3">
              <Ionicons name="alert-circle-outline" size={22} color="#ef4444" />
              <Text className="text-red-500 text-sm flex-1">{error}</Text>
            </View>
          )}

          <View className="px-5 gap-5">
            <Text className="text-base font-semibold text-foreground">Personal information</Text>

            <TextField isRequired>
              <Label>First Name</Label>
              <Input value={firstName} onChangeText={setFirstName} placeholder="Enter first name" />
            </TextField>

            <TextField isRequired>
              <Label>Last Name</Label>
              <Input value={lastName} onChangeText={setLastName} placeholder="Enter last name" />
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
              <Input value={address} onChangeText={setAddress} placeholder="Enter home address" />
            </TextField>
          </View>

          <View className="px-5 mt-8">
            <Button
              variant="primary"
              className="rounded-md min-h-12 bg-[#fffe8c]"
              onPress={handleSave}
              isDisabled={isLoading}
            >
              <View className="flex-row items-center justify-center gap-2">
                {isLoading ? (
                  <ActivityIndicator color="#171717" size="small" />
                ) : (
                  <Ionicons name="checkmark-circle" size={18} color="#171717" />
                )}
                <Button.Label className="text-base font-medium text-[#171717]">{isLoading ? "Saving profile..." : "Save changes"}</Button.Label>
              </View>
            </Button>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      <Modal
        visible={isPhotoPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPhotoPickerOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsPhotoPickerOpen(false)}>
          <View className="flex-1 bg-black/50 justify-end">
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View className="bg-background rounded-t-2xl px-5 pt-5 pb-8 gap-2">
                <View className="flex-row items-center justify-between mb-3"><Text className="text-foreground text-base font-semibold">Change profile photo</Text><Pressable onPress={() => setIsPhotoPickerOpen(false)} accessibilityLabel="Close" className="size-11 items-center justify-center"><Ionicons name="close" size={22} color="#171717" /></Pressable></View>

                <Pressable
                  onPress={() => handlePickImage(true)}
                  className="min-h-14 flex-row items-center gap-3 px-4 rounded-xl bg-[#f6f6f6] active:opacity-70"
                >
                  <Ionicons name="camera-outline" size={20} color="#242424" />
                  <Text className="text-foreground text-sm font-medium">Take photo</Text>
                </Pressable>

                <Pressable
                  onPress={() => handlePickImage(false)}
                  className="min-h-14 flex-row items-center gap-3 px-4 rounded-xl bg-[#f6f6f6] active:opacity-70"
                >
                  <Ionicons name="images-outline" size={20} color="#242424" />
                  <Text className="text-foreground text-sm font-medium">Choose from library</Text>
                </Pressable>

                <Pressable
                  onPress={() => setIsPhotoPickerOpen(false)}
                  className="min-h-11 items-center justify-center mt-1"
                >
                  <Text className="text-muted-foreground text-sm font-medium">Cancel</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}
