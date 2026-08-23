import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import type { JSX } from "react";
import { Text, Button, Select, TextField, Label, Input } from "heroui-native";
import { Header } from "../../components/Header";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/UserContext";
import { createLabScreeningApi } from "../../config/api";

export default function UploadRecordScreen(): JSX.Element {
  const router = useRouter();
  const { token, activePregnancy } = useAuth();

  const [recordType, setRecordType] = useState<{ value: string; label: string } | undefined>();
  const [resultText, setResultText] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!recordType?.value) {
      setError("Please select a record type");
      return;
    }
    if (!activePregnancy?.pregnancy_id) {
      setError("Active pregnancy record not found");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await createLabScreeningApi(
        {
          pregnancy_id: activePregnancy.pregnancy_id,
          visit_id: activePregnancy.prenatalVisits?.[0]?.visit_id || activePregnancy.pregnancy_id,
          screening_type: recordType.value,
          result: resultText.trim() || "Normal",
          remarks: remarks.trim() || undefined,
        },
        token || ""
      );

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

  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Upload Record" rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        
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
              Lab screening record submitted successfully!
            </Text>
          </View>
        )}

        <View className="px-5 mb-6 pt-2">
          <Text className="text-foreground text-base font-semibold mb-1">Record Type</Text>
          <Text className="text-muted text-sm mb-4">Select the type of document or test you are submitting.</Text>
          
          <Select 
            value={recordType}
            onValueChange={setRecordType as any}
          >
            <Select.Trigger className="bg-surface border-0 rounded-xl">
              <Select.Value placeholder="Select record type" className="text-foreground" />
              <Select.TriggerIndicator />
            </Select.Trigger>
            <Select.Portal>
              <Select.Overlay />
              <Select.Content presentation="popover" className="bg-surface rounded-xl">
                <Select.Item value="Urinalysis" label="Urinalysis" />
                <Select.Item value="Blood Typing" label="Blood Typing" />
                <Select.Item value="Hepatitis B Screening" label="Hepatitis B Screening" />
                <Select.Item value="Complete Blood Count" label="Complete Blood Count" />
                <Select.Item value="Other" label="Other" />
              </Select.Content>
            </Select.Portal>
          </Select>
        </View>

        <View className="px-5 gap-5 mb-6">
          <TextField>
            <Label>Test Result Summary</Label>
            <Input
              value={resultText}
              onChangeText={setResultText}
              placeholder="e.g. Normal, Negative, Trace Protein"
            />
          </TextField>

          <TextField>
            <Label>Remarks / Physician Notes</Label>
            <Input
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Optional remarks"
            />
          </TextField>
        </View>

        <View className="px-5 mb-6">
          <Text className="text-foreground text-base font-semibold mb-1">Upload Document Attachment</Text>
          <Text className="text-muted text-sm mb-4">Upload a lab scan, image, or report document.</Text>
          
          <Pressable className="bg-surface border-2 border-dashed border-default rounded-xl items-center justify-center py-8 mb-4">
            <View className="size-16 rounded-full bg-[#6366f1]/15 items-center justify-center mb-3">
              <Ionicons name="cloud-upload-outline" size={28} color="#6366f1" />
            </View>
            <Text className="text-foreground font-semibold text-base mb-1">Tap to select document</Text>
            <Text className="text-muted text-sm">PDF, PNG, or JPG (max 10MB)</Text>
          </Pressable>
        </View>

      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-background/80 px-5 py-4 border-t border-default" style={{ paddingBottom: 34 }}>
        <Button variant="primary" className="w-full rounded-xl" onPress={handleSubmit} isDisabled={!recordType || isLoading}>
          <View className="flex-row items-center justify-center gap-2">
            {isLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons name="checkmark-circle" size={18} color="white" />
            )}
            <Button.Label>{isLoading ? "Submitting..." : "Submit Record"}</Button.Label>
          </View>
        </Button>
      </View>
    </View>
  );
}
