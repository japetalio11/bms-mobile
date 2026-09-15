import React, { useState } from "react";
import { View, Text, Modal, Pressable, ScrollView } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import type { User } from "../context/UserContext";
import type { MotherRecord } from "../config/api";

type MotherQRCodeModalProps = {
  visible: boolean;
  onClose: () => void;
  user: User;
  motherRecord: MotherRecord | null;
};

export function MotherQRCodeModal({
  visible,
  onClose,
  user,
  motherRecord,
}: MotherQRCodeModalProps) {
  const [copied, setCopied] = useState(false);

  // Formatted mother code (e.g. MTH-8F3A2190 or user_id)
  const rawId = motherRecord?.mother_id || user.user_id || "BMS-UNKNOWN";
  const displayCode = `MTH-${rawId.substring(0, 8).toUpperCase()}`;

  // Structured QR payload containing IDs & verification metadata
  const qrPayload = JSON.stringify({
    type: "BMS_MOTHER_QR",
    mother_id: motherRecord?.mother_id || rawId,
    user_id: user.user_id,
    name: user.name,
    code: displayCode,
  });

  const handleCopyCode = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const facilityName = user.facility_name || user.facility?.facility_name;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-end">
        <View className="bg-background rounded-t-3xl border-t border-white/10 px-6 pt-6 pb-10 max-h-[88%]">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-foreground text-xl font-bold">My Health Card QR</Text>
              <Text className="text-muted text-xs mt-0.5">Show code to connect to a facility</Text>
            </View>
            <Pressable
              onPress={onClose}
              className="size-9 rounded-full bg-default items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#a1a1aa" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: "center", paddingBottom: 20 }}>
            {/* Mother Card Info */}
            <View className="w-full bg-surface border border-white/10 rounded-2xl p-4 items-center mb-6">
              <Text className="text-foreground text-lg font-bold text-center">{user.name}</Text>
              <Text className="text-muted text-xs mb-3">{user.email || user.phone_number || "Self-Registered Mother"}</Text>

              {/* Status Badge */}
              <View className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full ${facilityName ? "bg-emerald-500/15 border border-emerald-500/30" : "bg-amber-500/15 border border-amber-500/30"}`}>
                <Ionicons
                  name={facilityName ? "checkmark-circle" : "alert-circle-outline"}
                  size={14}
                  color={facilityName ? "#10b981" : "#f59e0b"}
                />
                <Text className={`text-xs font-semibold ${facilityName ? "text-emerald-400" : "text-amber-400"}`}>
                  {facilityName ? `Connected: ${facilityName}` : "Not Connected"}
                </Text>
              </View>
            </View>

            {/* QR Code Container */}
            <View className="bg-white p-5 rounded-2xl shadow-lg items-center justify-center mb-5 border border-gray-200">
              <QRCode
                value={qrPayload}
                size={220}
                color="#0f172a"
                backgroundColor="#ffffff"
              />
            </View>

            {/* Code Badge & Copy */}
            <View className="w-full flex-row items-center justify-between bg-surface border border-white/10 rounded-xl p-3.5 mb-5">
              <View>
                <Text className="text-muted text-xs font-medium uppercase tracking-wider">Mother QR Code</Text>
                <Text className="text-foreground text-lg font-mono font-bold mt-0.5">{displayCode}</Text>
              </View>
              <Pressable
                onPress={handleCopyCode}
                className="flex-row items-center gap-1.5 bg-primary/20 border border-primary/30 px-3 py-2 rounded-lg"
              >
                <Ionicons name={copied ? "checkmark-outline" : "copy-outline"} size={16} color="#6366f1" />
                <Text className="text-primary text-xs font-semibold">{copied ? "Copied!" : "Copy Code"}</Text>
              </Pressable>
            </View>

            {/* Instructions */}
            <View className="w-full bg-default/40 rounded-xl p-3.5 flex-row items-start gap-3">
              <Ionicons name="information-circle-outline" size={20} color="#818cf8" style={{ marginTop: 2 }} />
              <Text className="text-muted text-xs leading-5 flex-1">
                When visiting a health center, present this QR code or provide your Mother Code to facility staff. They can scan/input it to register your profile under their facility.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
