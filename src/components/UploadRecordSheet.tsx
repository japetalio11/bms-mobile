import { useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, View } from "react-native";
import { Label, Text, useToast } from "heroui-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton as Button, AppInput as Input, AppSelect, AppTextField as TextField } from "./FormControls";
import * as DocumentPicker from "expo-document-picker";
import { AppIcon } from "./AppIcon";
import { BottomSheetHeader } from "./BottomSheetHeader";
import { useAuth } from "../context/UserContext";
import { useNetwork } from "../context/NetworkContext";
import { createLabScreeningApi, formatFormDataFile, uploadLabFileApi } from "../config/api";
import { createLabScreeningLocal, saveLabScreeningsLocal } from "../db/repository";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const RECORD_TYPES = ["Laboratory result", "Ultrasound", "Prescription", "Other"] as const;

type SelectedFile = {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
};

function fileDisplayName(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
}

export function UploadRecordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { token, activePregnancy, motherRecord, user, refreshProfile } = useAuth();
  const { isOnline } = useNetwork();
  const [step, setStep] = useState<"file" | "details">("file");
  const [recordType, setRecordType] = useState<string>(RECORD_TYPES[0]);
  const [recordName, setRecordName] = useState("");
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const resetSheet = (force = false) => {
    if (isLoading && !force) return;
    setStep("file");
    setRecordType(RECORD_TYPES[0]);
    setRecordName("");
    setSelectedFile(null);
    onClose();
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      if ((file.size ?? 0) > MAX_FILE_SIZE_BYTES) {
        toast.show({ label: "File is too large", description: "Choose a file under 10 MB.", variant: "danger" });
        return;
      }

      const nextFile = {
        uri: file.uri,
        name: file.name || "ehr-record",
        size: file.size,
        mimeType: file.mimeType || "application/octet-stream",
      };
      setSelectedFile(nextFile);
      setRecordName((current) => current || fileDisplayName(nextFile.name));
      setStep("details");
    } catch {
      toast.show({ label: "Could not open files", description: "Please try again.", variant: "danger" });
    }
  };

  const submitRecord = async () => {
    if (!selectedFile) {
      setStep("file");
      return;
    }
    if (!recordType.trim() || !recordName.trim()) {
      toast.show({ label: "Complete the record details", description: "Choose a type and enter a name.", variant: "warning" });
      return;
    }
    if (!user?.user_id) {
      toast.show({ label: "Profile unavailable", description: "Sign in again before uploading a record.", variant: "danger" });
      return;
    }

    const motherId = motherRecord?.mother_id || user.user_id;
    const pregnancyId = activePregnancy?.pregnancy_id || motherRecord?.pregnancies?.[0]?.pregnancy_id || undefined;
    const visitId = activePregnancy?.prenatalVisits?.[0]?.visit_id || motherRecord?.pregnancies?.[0]?.prenatalVisits?.[0]?.visit_id || undefined;
    const payload = {
      mother_id: motherId,
      pregnancy_id: pregnancyId,
      visit_id: visitId,
      screening_type: recordName.trim(),
      result: "Uploaded",
      remarks: `Record type: ${recordType}`,
      date_of_screening: new Date().toISOString(),
    };

    setIsLoading(true);
    try {
      if (isOnline && token) {
        try {
          const fileToUpload = formatFormDataFile(
            selectedFile.uri,
            selectedFile.name || "ehr-document",
            selectedFile.mimeType || "application/octet-stream"
          );
          const formData = new FormData();
          formData.append("file", fileToUpload as any);
          const uploadRes = await uploadLabFileApi(formData, token);
          const finalUrl = uploadRes.file_url || uploadRes.fileUrl || "";
          const created = await createLabScreeningApi({ ...payload, file_url: finalUrl }, token);
          if (created) await saveLabScreeningsLocal([created], true, motherId);
        } catch (apiErr: any) {
          const msg = apiErr?.message || "";
          const isNetworkError =
            msg.includes("Network request failed") ||
            msg.includes("Failed to fetch") ||
            msg.includes("NetworkError") ||
            msg.includes("timeout");
          if (isNetworkError) {
            await createLabScreeningLocal(payload, selectedFile.uri, selectedFile.size || null, false, motherId);
          } else {
            throw apiErr;
          }
        }
      } else {
        await createLabScreeningLocal(payload, selectedFile.uri, selectedFile.size || null, false, motherId);
      }
      toast.show({
        label: isOnline ? "Record uploaded successfully" : "Record saved offline",
        description: isOnline ? "Your file is securely attached to your profile." : "Saved locally on this device. Will sync once connected.",
        variant: "success",
      });
      resetSheet(true);
      void refreshProfile();
    } catch (error) {
      toast.show({
        label: "Could not upload record",
        description: error instanceof Error ? error.message : "Please check your network and try again.",
        variant: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fileIsImage = selectedFile?.mimeType?.startsWith("image/");

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => resetSheet()}
    >
      <View className="flex-1 justify-end bg-black/60">
        <Pressable className="flex-1" onPress={() => resetSheet()} />
        <View
          className="max-h-[85%] rounded-t-[24px] bg-background px-5 pt-2"
          style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
        >
          <View className="mb-3 h-1 w-12 self-center rounded-full bg-muted/60" />
          <BottomSheetHeader
            title={step === "file" ? "Upload EHR record" : "Add record details"}
            description={step === "file" ? "Choose a document or image." : "Add a name and category for this file."}
            onClose={() => resetSheet()}
            closeLabel="Close upload sheet"
          />

          <View className="mb-4 flex-row items-center gap-2" accessibilityLabel={step === "file" ? "Step 1 of 2: Select file" : "Step 2 of 2: Add details"}>
            <View className="h-1 flex-1 overflow-hidden rounded-full bg-default">
              <View className={`h-full rounded-full bg-[#fffe8c] ${step === "file" ? "w-1/2" : "w-full"}`} />
            </View>
            <Text className="text-sm font-medium text-muted-foreground">{step === "file" ? "1 of 2" : "2 of 2"}</Text>
          </View>

          {step === "file" ? (
            <View className="pb-2">
              <Pressable
                onPress={pickFile}
                accessibilityRole="button"
                className="min-h-[104px] flex-row items-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-4 py-4 active:opacity-75"
              >
                <View className="size-12 items-center justify-center rounded-2xl bg-[#fffe8c]">
                  <AppIcon name="cloud-upload-outline" size={22} weight="bold" color="#171717" />
                </View>
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-sm font-semibold text-foreground">Browse files</Text>
                  <Text className="text-sm leading-4 text-muted-foreground">PDF or image · Up to 10 MB</Text>
                </View>
                <AppIcon name="chevron-forward" size={18} weight="bold" color="#737373" />
              </Pressable>

              <View className="mb-2 mt-6">
                <Button variant="outline" className="w-full rounded-md" onPress={() => resetSheet()} isDisabled={isLoading}>
                  <Button.Label>Cancel</Button.Label>
                </Button>
              </View>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
              {selectedFile && (
                <View className="mb-5 flex-row items-center gap-3 rounded-2xl bg-surface p-3">
                  {fileIsImage ? (
                    <Image source={{ uri: selectedFile.uri }} className="size-12 rounded-xl" />
                  ) : (
                    <View className="size-12 items-center justify-center rounded-xl bg-default">
                      <AppIcon name="file-pdf" size={21} weight="regular" color="#737373" />
                    </View>
                  )}
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{selectedFile.name}</Text>
                    <Text className="text-sm text-muted-foreground">
                      {selectedFile.size ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : "Ready to upload"} · {fileIsImage ? "Image" : "PDF"}
                    </Text>
                  </View>
                  <Pressable onPress={pickFile} accessibilityRole="button" accessibilityLabel="Choose a different file" className="min-h-11 justify-center rounded-full px-3 active:bg-default">
                    <Text className="text-sm font-semibold text-foreground">Change</Text>
                  </Pressable>
                </View>
              )}

              <View className="gap-2.5">
                <Text className="text-sm font-semibold text-foreground">Record type</Text>
                <AppSelect value={recordType} onValueChange={setRecordType} options={RECORD_TYPES} placeholder="Select record type" />
              </View>

              <View className="mt-5">
                <TextField isRequired className="gap-2">
                  <Label isRequired>
                    <Label.Text className="text-sm font-semibold text-foreground">Record name</Label.Text>
                  </Label>
                  <Input
                    value={recordName}
                    onChangeText={setRecordName}
                    placeholder="e.g. Complete blood count"
                    autoCapitalize="sentences"
                  />
                </TextField>
              </View>

              <View className="mt-6 flex-row items-center justify-between gap-3">
                <Button variant="outline" className="min-w-[104px] rounded-md" onPress={() => resetSheet()} isDisabled={isLoading}>
                  <Button.Label>Cancel</Button.Label>
                </Button>
                <Button variant="primary" className="min-w-[160px] rounded-md bg-[#fffe8c]" onPress={submitRecord} isDisabled={isLoading}>
                  {isLoading ? <ActivityIndicator color="#171717" size="small" /> : <AppIcon name="cloud-upload-outline" size={17} weight="bold" color="#171717" />}
                  <Button.Label className="text-[#171717]">{isLoading ? "Uploading…" : "Save record"}</Button.Label>
                </Button>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
