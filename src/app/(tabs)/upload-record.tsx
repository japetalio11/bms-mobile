import { View, ScrollView, Pressable, ActivityIndicator, Image, Modal } from "react-native";
import type { JSX } from "react";
import { Text, Button } from "heroui-native";
import { Header } from "../../components/Header";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

import { useAuth } from "../../context/UserContext";
import { useNetwork } from "../../context/NetworkContext";
import { createLabScreeningApi, uploadLabFileApi } from "../../config/api";
import { createLabScreeningLocal, saveLabScreeningsLocal } from "../../db/repository";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

type SelectedFile = {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
};

const RECORD_TYPES = [
  { id: "Urinalysis", label: "Urinalysis", icon: "flask-outline" },
  { id: "Blood Typing", label: "Blood Typing", icon: "water-outline" },
  { id: "Hepatitis B Screening", label: "Hepatitis B Screening", icon: "shield-checkmark-outline" },
  { id: "Complete Blood Count", label: "Complete Blood Count (CBC)", icon: "stats-chart-outline" },
  { id: "Other", label: "Other Document", icon: "document-text-outline" },
];

export default function UploadRecordScreen(): JSX.Element {
  const router = useRouter();
  const { token, activePregnancy } = useAuth();
  const { isOnline } = useNetwork();

  const [recordType, setRecordType] = useState<string>("Urinalysis");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePickDocument = async () => {
    setError(null);
    try {
      // 1. Try DocumentPicker first
      const docRes = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });

      if (!docRes.canceled && docRes.assets && docRes.assets.length > 0) {
        const asset = docRes.assets[0];
        const fileSize = asset.size || 0;

        if (fileSize > MAX_FILE_SIZE_BYTES) {
          setError(`File size (${(fileSize / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 10MB.`);
          return;
        }

        setSelectedFile({
          uri: asset.uri,
          name: asset.name || "lab_document",
          size: fileSize,
          mimeType: asset.mimeType || "image/jpeg",
        });
        return;
      }

      // 2. Fallback to ImagePicker if document picker is cancelled or unsupported
      const imgRes = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });

      if (!imgRes.canceled && imgRes.assets && imgRes.assets.length > 0) {
        const asset = imgRes.assets[0];
        const fileSize = asset.fileSize || 0;

        if (fileSize > MAX_FILE_SIZE_BYTES) {
          setError(`File size (${(fileSize / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 10MB.`);
          return;
        }

        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || "lab_photo.jpg",
          size: fileSize,
          mimeType: asset.mimeType || "image/jpeg",
        });
      }
    } catch (err: any) {
      console.warn("File picking failed:", err);
      setError("Unable to select file. Please try again.");
    }
  };

  const handleSubmit = async () => {
    if (!recordType) {
      setError("Please select a record type");
      return;
    }

    const pregnancyId = activePregnancy?.pregnancy_id || `preg_${Date.now()}`;
    const visitId = activePregnancy?.prenatalVisits?.[0]?.visit_id || pregnancyId;

    setIsLoading(true);
    setError(null);

    const payload = {
      pregnancy_id: pregnancyId,
      visit_id: visitId,
      screening_type: recordType,
      result: "Uploaded",
      remarks: undefined,
      date_of_screening: new Date().toISOString(),
    };

    try {
      if (isOnline && token) {
        try {
          let serverFileUrl = undefined;
          if (selectedFile) {
            const formData = new FormData();
            formData.append("file", {
              uri: selectedFile.uri,
              name: selectedFile.name,
              type: selectedFile.mimeType || "image/jpeg",
            } as any);

            const uploadRes = await uploadLabFileApi(formData, token);
            serverFileUrl = uploadRes.fileUrl;
          }

          const res = await createLabScreeningApi(
            {
              ...payload,
              file_url: serverFileUrl,
            },
            token
          );

          if (res) {
            await saveLabScreeningsLocal([res], true);
          }
        } catch (apiErr: any) {
          console.warn("Backend lab registration failed, saving to local SQLite outbox:", apiErr);
          await createLabScreeningLocal(
            payload,
            selectedFile?.uri || null,
            selectedFile?.size || null,
            false
          );
        }
      } else {
        // Offline Save to SQLite & outbox queue
        await createLabScreeningLocal(
          payload,
          selectedFile?.uri || null,
          selectedFile?.size || null,
          false
        );
      }

      setSuccess(true);
      setTimeout(() => {
        router.back();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to submit lab record");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTypeObj = RECORD_TYPES.find((t) => t.id === recordType) || RECORD_TYPES[0];

  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Upload Record" rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
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
              Lab screening record submitted successfully! {!isOnline && "(Saved Offline)"}
            </Text>
          </View>
        )}

        {/* Record Type Dropdown Trigger */}
        <View className="px-5 mb-6 pt-2">
          <Text className="text-foreground text-base font-semibold mb-1">Record Type</Text>
          <Text className="text-muted text-sm mb-3">Select the type of document or test you are submitting.</Text>

          <Pressable
            onPress={() => setIsDropdownOpen(true)}
            className="bg-[#18171C] border border-white/[0.08] rounded-2xl p-3.5 flex-row items-center justify-between active:bg-[#25242A]"
          >
            <View className="flex-row items-center gap-3 flex-1">
              <View className="size-9 rounded-xl items-center justify-center bg-[#25242A] border border-white/[0.06]">
                <Ionicons name={selectedTypeObj.icon as any} size={18} color="#f43f5e" />
              </View>
              <View className="flex-1">
                <Text className="text-white text-xs font-bold">{selectedTypeObj.label}</Text>
                <Text className="text-zinc-400 text-[11px] mt-0.5">Tap to change record type</Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={18} color="#a1a1aa" />
          </Pressable>
        </View>

        {/* File Selection Box */}
        <View className="px-5 mb-6">
          <Text className="text-foreground text-base font-semibold mb-1">Upload Document Attachment</Text>
          <Text className="text-muted text-sm mb-4">Upload a lab scan, image, or report document.</Text>

          {selectedFile ? (
            <View className="bg-surface border border-sky-500/40 rounded-2xl p-4 flex-row items-center gap-3">
              {selectedFile.mimeType?.startsWith("image/") || selectedFile.uri.match(/\.(jpg|jpeg|png)$/i) ? (
                <Image source={{ uri: selectedFile.uri }} className="size-14 rounded-xl bg-default/40" />
              ) : (
                <View className="size-14 rounded-xl bg-sky-500/20 items-center justify-center">
                  <Ionicons name="document-text" size={26} color="#38bdf8" />
                </View>
              )}

              <View className="flex-1">
                <Text className="text-foreground font-semibold text-sm" numberOfLines={1}>
                  {selectedFile.name}
                </Text>
                <Text className="text-muted text-xs mt-0.5">
                  {selectedFile.size
                    ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                    : "Document attached"}
                </Text>
              </View>

              <Pressable
                onPress={() => setSelectedFile(null)}
                className="size-8 rounded-full bg-red-500/15 items-center justify-center"
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handlePickDocument}
              className="bg-surface border-2 border-dashed border-default rounded-2xl items-center justify-center py-8 mb-4 active:bg-surface-secondary"
            >
              <View className="size-16 rounded-full bg-[#6366f1]/15 items-center justify-center mb-3">
                <Ionicons name="cloud-upload-outline" size={28} color="#6366f1" />
              </View>
              <Text className="text-foreground font-semibold text-base mb-1">Tap to select document</Text>
              <Text className="text-muted text-sm">PDF, PNG, or JPG (max 10MB)</Text>
            </Pressable>
          )}
        </View>

        {/* Submit Record Button */}
        <View className="px-5 mt-2 mb-6">
          <Button
            variant="primary"
            className="w-full rounded-2xl h-12 bg-[#f43f5e]"
            onPress={handleSubmit}
            isDisabled={!recordType || isLoading}
          >
            <View className="flex-row items-center justify-center gap-2">
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Ionicons name="checkmark-circle" size={18} color="white" />
              )}
              <Button.Label className="text-white font-bold text-sm">
                {isLoading ? "Submitting..." : "Submit Record"}
              </Button.Label>
            </View>
          </Button>
        </View>
      </ScrollView>

      {/* Record Type Dropdown Selection Modal */}
      <Modal visible={isDropdownOpen} transparent animationType="fade" onRequestClose={() => setIsDropdownOpen(false)}>
        <Pressable onPress={() => setIsDropdownOpen(false)} className="flex-1 bg-black/80 justify-center items-center p-5">
          <Pressable className="w-full max-w-sm bg-[#16161C] border border-white/[0.12] rounded-3xl p-5 gap-3 shadow-2xl">
            <View className="flex-row items-center justify-between pb-3 border-b border-white/[0.08]">
              <View className="flex-row items-center gap-2">
                <Ionicons name="list" size={18} color="#f43f5e" />
                <Text className="text-white font-bold text-base">Select Record Type</Text>
              </View>
              <Pressable onPress={() => setIsDropdownOpen(false)} className="size-7 items-center justify-center rounded-full bg-[#25242A]">
                <Ionicons name="close" size={16} color="#a1a1aa" />
              </Pressable>
            </View>

            <View className="gap-2 pt-1">
              {RECORD_TYPES.map((type) => {
                const isSelected = recordType === type.id;
                return (
                  <Pressable
                    key={type.id}
                    onPress={() => {
                      setRecordType(type.id);
                      setIsDropdownOpen(false);
                      setError(null);
                    }}
                    className={`p-3.5 rounded-2xl border flex-row items-center justify-between ${
                      isSelected
                        ? "bg-[#25242A] border-[#f43f5e]"
                        : "bg-[#18171C] border-white/[0.06]"
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="size-9 rounded-xl items-center justify-center bg-[#25242A] border border-white/[0.06]">
                        <Ionicons name={type.icon as any} size={18} color={isSelected ? "#f43f5e" : "#a1a1aa"} />
                      </View>
                      <Text className={`text-xs font-semibold ${isSelected ? "text-white" : "text-zinc-300"}`}>
                        {type.label}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color="#f43f5e" />}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
