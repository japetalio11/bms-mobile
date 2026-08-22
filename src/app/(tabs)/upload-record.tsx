import { View, ScrollView, Pressable } from "react-native";
import type { JSX } from "react";
import { Card, Text, Button, Select } from "heroui-native";
import { Header } from "../../components/Header";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

export default function UploadRecordScreen(): JSX.Element {
  const [recordType, setRecordType] = useState<{ value: string; label: string } | undefined>();

  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Upload Record" rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        <View className="px-5 mb-6 pt-2">
          <Text className="text-foreground text-base font-semibold mb-1">Record Type</Text>
          <Text className="text-muted text-sm mb-4">Select the type of document you are uploading.</Text>
          
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

        <View className="px-5 mb-6">
          <Text className="text-foreground text-base font-semibold mb-1">Upload Document</Text>
          <Text className="text-muted text-sm mb-4">Take a photo or upload a PDF/Image file.</Text>
          
          <Pressable className="bg-surface border-2 border-dashed border-default rounded-xl items-center justify-center py-10 mb-4">
            <View className="size-16 rounded-full bg-[#6366f1]/15 items-center justify-center mb-3">
              <Ionicons name="cloud-upload-outline" size={28} color="#6366f1" />
            </View>
            <Text className="text-foreground font-semibold text-base mb-1">Tap to upload file</Text>
            <Text className="text-muted text-sm">PDF, PNG, or JPG (max 10MB)</Text>
          </Pressable>
          
          <View className="flex-row items-center justify-between">
            <Text className="text-muted text-sm font-medium">Or take a photo instead</Text>
            <Button size="sm" variant="secondary" className="bg-default border-0 rounded-xl px-4">
              <Ionicons name="camera-outline" size={16} color="#71717a" style={{ marginRight: 4 }} />
              <Button.Label className="text-foreground font-medium">Camera</Button.Label>
            </Button>
          </View>
        </View>

      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-background/80 px-5 py-4 border-t border-default" style={{ paddingBottom: 34 }}>
        <Button variant="primary" className="w-full rounded-xl" isDisabled={!recordType}>
          <Button.Label>Upload Record</Button.Label>
        </Button>
      </View>
    </View>
  );
}
