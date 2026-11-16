import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, View } from "react-native";
import { Text, useToast } from "heroui-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton as Button } from "./FormControls";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { AppIcon } from "./AppIcon";
import { BottomSheetHeader } from "./BottomSheetHeader";
import { useAuth, type User } from "../context/UserContext";
import { getMotherShareTokenApi, regenerateMotherShareTokenApi, type MotherRecord, type MotherShareTokenResponse } from "../config/api";

type MotherShareJourneyModalProps = {
  visible: boolean;
  onClose: () => void;
  user: User;
  motherRecord: MotherRecord | null;
};

export function MotherShareJourneyModal({ visible, onClose, motherRecord }: MotherShareJourneyModalProps) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { toast } = useToast();
  const [shareData, setShareData] = useState<MotherShareTokenResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const fetchToken = useCallback(async () => {
    if (!token) {
      toast.show({ label: "Sign in to share your records", variant: "warning" });
      return;
    }
    setLoading(true);
    try {
      setShareData(await getMotherShareTokenApi(token, motherRecord?.mother_id));
    } catch (error) {
      toast.show({ label: "Could not load sharing details", description: error instanceof Error ? error.message : "Please try again.", variant: "danger" });
    } finally {
      setLoading(false);
    }
  }, [token, motherRecord, toast]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => void fetchToken(), 0);
    return () => clearTimeout(timer);
  }, [visible, fetchToken]);

  const copy = async (value: string, label: string) => {
    try {
      await Clipboard.setStringAsync(value);
      toast.show({ label, variant: "success" });
    } catch {
      toast.show({ label: "Could not copy", variant: "danger" });
    }
  };

  const preview = async () => {
    if (!shareData?.web_url) return;
    const url = /^https?:\/\//.test(shareData.web_url) ? shareData.web_url : `https://${shareData.web_url}`;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      try {
        await Linking.openURL(url);
      } catch {
        toast.show({ label: "Could not open sharing link", variant: "danger" });
      }
    }
  };

  const regenerate = () => {
    Alert.alert("Reset access code?", "The previous code will stop working immediately.", [
      { text: "Keep code", style: "cancel" },
      { text: "Reset code", style: "destructive", onPress: async () => {
        if (!token) return;
        setRegenerating(true);
        try {
          setShareData(await regenerateMotherShareTokenApi(token, motherRecord?.mother_id));
          toast.show({ label: "New access code ready", variant: "success" });
        } catch (error) {
          toast.show({ label: "Could not reset access code", description: error instanceof Error ? error.message : "Please try again.", variant: "danger" });
        } finally {
          setRegenerating(false);
        }
      } },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <Pressable className="flex-1" onPress={onClose} />
        <View
          className="max-h-[85%] rounded-t-[24px] bg-background px-5 pt-2"
          style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
        >
          <View className="mb-3 h-1 w-12 self-center rounded-full bg-muted/60" />
          <BottomSheetHeader
            title="Share pregnancy journey"
            description="Share a secure link with your care team."
            onClose={onClose}
            closeLabel="Close sharing sheet"
          />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
            {loading ? (
              <View className="min-h-48 items-center justify-center">
                <ActivityIndicator color="#171717" />
              </View>
            ) : shareData ? (
              <>
                <View className="items-center py-2">
                  <View className="rounded-xl bg-white p-2.5">
                    <QRCode value={shareData.web_url} size={164} color="#171717" backgroundColor="#ffffff" quietZone={3} />
                  </View>
                </View>
                <View className="mt-2 flex-row items-center justify-between rounded-xl bg-surface px-4 py-3">
                  <View className="flex-1">
                    <Text className="text-sm text-muted-foreground">Access code</Text>
                    <Text className="mt-1 text-base font-semibold tracking-widest text-foreground">{shareData.pin_code}</Text>
                  </View>
                  <Pressable onPress={() => void copy(shareData.pin_code, "Code copied")} accessibilityLabel="Copy access code" className="size-11 items-center justify-center rounded-full bg-default">
                    <AppIcon name="copy-outline" size={19} color="#171717" />
                  </Pressable>
                </View>
                <View className="mt-3 flex-row gap-2">
                  <Button onPress={() => void copy(shareData.web_url, "Link copied")} className="min-h-11 flex-1 rounded-md bg-[#fffe8c]">
                    <AppIcon name="link-outline" size={17} color="#171717" />
                    <Button.Label className="text-sm font-medium text-[#171717]">Copy link</Button.Label>
                  </Button>
                  <Button variant="outline" onPress={() => void preview()} className="min-h-11 flex-1 rounded-md">
                    <Button.Label className="text-sm font-medium">Open preview</Button.Label>
                  </Button>
                </View>
                <Pressable onPress={regenerate} disabled={regenerating} className="mt-1 min-h-10 items-center justify-center">
                  <Text className="text-sm font-medium text-muted-foreground">{regenerating ? "Resetting code…" : "Reset access code"}</Text>
                </Pressable>
              </>
            ) : (
              <View className="min-h-56 items-center justify-center">
                <Text className="text-sm text-muted-foreground">Sharing details are unavailable.</Text>
                <Button variant="outline" onPress={() => void fetchToken()} className="mt-4 rounded-md">
                  <Button.Label>Try again</Button.Label>
                </Button>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
