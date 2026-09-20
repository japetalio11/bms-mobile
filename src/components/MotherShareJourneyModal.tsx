import React, { useState, useEffect } from "react";
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator, Alert, Linking } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { useAuth, type User } from "../context/UserContext";
import {
  getMotherShareTokenApi,
  regenerateMotherShareTokenApi,
  type MotherRecord,
  type MotherShareTokenResponse,
} from "../config/api";

type MotherShareJourneyModalProps = {
  visible: boolean;
  onClose: () => void;
  user: User;
  motherRecord: MotherRecord | null;
};

export function MotherShareJourneyModal({
  visible,
  onClose,
  user,
  motherRecord,
}: MotherShareJourneyModalProps) {
  const { token } = useAuth();
  const [shareData, setShareData] = useState<MotherShareTokenResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchToken = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await getMotherShareTokenApi(token, motherRecord?.mother_id);
      setShareData(data);
    } catch (err: any) {
      console.warn("Failed to load share token:", err);
      setErrorMsg(err.message || "Failed to load share code");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchToken();
    }
  }, [visible, token]);

  const handleCopyPin = async () => {
    if (!shareData?.pin_code) return;
    try {
      await Clipboard.setStringAsync(shareData.pin_code);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    } catch (err) {
      console.error("Failed to copy PIN:", err);
    }
  };

  const handleCopyLink = async () => {
    if (!shareData?.web_url) return;
    try {
      await Clipboard.setStringAsync(shareData.web_url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error("Failed to copy Link:", err);
    }
  };

  const handlePreviewWebView = async () => {
    if (!shareData?.web_url) return;
    try {
      const urlWithPin = `${shareData.web_url}?pin=${shareData.pin_code}`;
      await WebBrowser.openBrowserAsync(urlWithPin);
    } catch (err) {
      Linking.openURL(shareData.web_url).catch(() => {});
    }
  };

  const handleRegeneratePin = () => {
    Alert.alert(
      "Reset Security PIN?",
      "Generating a new PIN will immediately invalidate the previous PIN. Any clinician viewing the old link will need the new PIN code.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Generate New PIN",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            setRegenerating(true);
            try {
              const freshData = await regenerateMotherShareTokenApi(token, motherRecord?.mother_id);
              setShareData(freshData);
              Alert.alert("Success", "New 6-digit access PIN and QR link generated!");
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to reset PIN");
            } finally {
              setRegenerating(false);
            }
          },
        },
      ]
    );
  };

  // Format PIN code with spacing for readability: e.g. "491 • 028"
  const rawPin = shareData?.pin_code || "••••••";
  const formattedPin = rawPin.length === 6 ? `${rawPin.slice(0, 3)}  •  ${rawPin.slice(3)}` : rawPin;
  const qrUrl = shareData?.web_url || `https://birthcare.network/shared-journey/${user.user_id || "demo"}`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/75 justify-end">
        <View className="bg-background rounded-t-3xl border-t border-white/10 px-6 pt-6 pb-10 max-h-[92%]">
          {/* Header */}
          <View className="flex-row items-start justify-between mb-4">
            <View className="flex-1 pr-3">
              <View className="flex-row flex-wrap items-center gap-2 mb-1">
                <Text className="text-foreground text-lg font-bold">Share Pregnancy Journey</Text>
                <View className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40">
                  <Text className="text-emerald-400 text-[10px] font-bold">PIN-Protected</Text>
                </View>
              </View>
              <Text className="text-zinc-400 text-sm">Let clinicians scan to view records and past vitals</Text>
            </View>
            <Pressable
              onPress={onClose}
              className="size-9 rounded-full bg-default items-center justify-center shrink-0 mt-0.5"
            >
              <Ionicons name="close" size={20} color="#a1a1aa" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: "center", paddingBottom: 20 }}>
            {loading ? (
              <View className="py-20 items-center justify-center">
                <ActivityIndicator size="large" color="#6366f1" />
                <Text className="text-zinc-400 text-sm mt-3">Generating secure share link & PIN...</Text>
              </View>
            ) : errorMsg ? (
              <View className="py-12 items-center justify-center px-4">
                <Ionicons name="alert-circle-outline" size={40} color="#ef4444" className="mb-2" />
                <Text className="text-foreground font-semibold text-sm mb-1 text-center">Unable to Load Share Code</Text>
                <Text className="text-zinc-400 text-sm text-center mb-4">{errorMsg}</Text>
                <Pressable
                  onPress={fetchToken}
                  className="bg-primary px-4 py-2 rounded-xl flex-row items-center gap-2"
                >
                  <Ionicons name="refresh" size={16} color="white" />
                  <Text className="text-white text-sm font-semibold">Retry</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* QR Code Canvas */}
                <View className="bg-white p-5 rounded-3xl shadow-xl items-center justify-center mb-5 border border-gray-100">
                  <QRCode
                    value={qrUrl}
                    size={210}
                    color="#09090b"
                    backgroundColor="#ffffff"
                    quietZone={8}
                  />
                  <View className="flex-row items-center gap-1.5 mt-2.5">
                    <Ionicons name="shield-checkmark" size={13} color="#10b981" />
                    <Text className="text-gray-600 text-[10px] font-semibold">Encrypted Clinical Handoff</Text>
                  </View>
                </View>

                {/* PIN Code Box */}
                <View className="w-full bg-surface border border-white/15 rounded-2xl p-4 mb-4">
                  <Text className="text-zinc-400 text-[11px] font-bold uppercase tracking-wider text-center mb-1">
                    Clinician Access PIN Code
                  </Text>
                  
                  {/* High Visibility PIN Display */}
                  <View className="bg-black/40 border border-white/10 rounded-xl py-3 px-4 my-2 items-center justify-center">
                    <Text className="text-indigo-400 text-3xl font-mono font-black tracking-[0.25em] text-center">
                      {formattedPin}
                    </Text>
                  </View>

                  <Text className="text-zinc-400 text-[11px] text-center mb-3.5">
                    Provide this 6-digit PIN to the attending health worker to unlock your full medical history.
                  </Text>

                  {/* Actions Row */}
                  <View className="flex-row items-center gap-2.5">
                    <Pressable
                      onPress={handleCopyPin}
                      className="flex-1 flex-row items-center justify-center gap-2 bg-indigo-600 active:bg-indigo-700 py-3 rounded-xl shadow-sm"
                    >
                      <Ionicons name={copiedPin ? "checkmark" : "copy-outline"} size={16} color="#ffffff" />
                      <Text className="text-white text-sm font-bold">{copiedPin ? "PIN Copied!" : "Copy PIN"}</Text>
                    </Pressable>

                    <Pressable
                      onPress={handleCopyLink}
                      className="flex-1 flex-row items-center justify-center gap-2 bg-[#27272a] active:bg-[#3f3f46] border border-white/15 py-3 rounded-xl"
                    >
                      <Ionicons name={copiedLink ? "checkmark" : "link-outline"} size={16} color="#e4e4e7" />
                      <Text className="text-white text-sm font-bold">{copiedLink ? "Link Copied!" : "Copy Link"}</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Additional Controls */}
                <View className="w-full flex-row items-center gap-2.5 mb-4">
                  <Pressable
                    onPress={handlePreviewWebView}
                    className="flex-1 flex-row items-center justify-center gap-2 bg-[#27272a] active:bg-[#3f3f46] border border-white/15 py-3 rounded-xl"
                  >
                    <Ionicons name="eye-outline" size={16} color="#e4e4e7" />
                    <Text className="text-white text-sm font-semibold">Preview Web View</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleRegeneratePin}
                    disabled={regenerating}
                    className="flex-row items-center justify-center gap-1.5 px-3.5 bg-red-500/15 active:bg-red-500/25 border border-red-500/30 py-3 rounded-xl"
                  >
                    {regenerating ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <>
                        <Ionicons name="refresh-outline" size={16} color="#f87171" />
                        <Text className="text-red-400 text-sm font-semibold">Reset PIN</Text>
                      </>
                    )}
                  </Pressable>
                </View>

                {/* Explanatory Callout */}
                <View className="w-full bg-[#27272a]/60 border border-white/5 rounded-xl p-3.5 flex-row items-start gap-3">
                  <Ionicons name="information-circle-outline" size={18} color="#818cf8" style={{ marginTop: 2 }} />
                  <Text className="text-zinc-400 text-sm leading-5 flex-1">
                    When visiting another clinic, hospital, or emergency facility, let the clinician scan this QR code using their camera or barcode scanner, then provide your 6-digit PIN. They will see your complete prenatal visits, past vitals, and diagnostic scans.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
