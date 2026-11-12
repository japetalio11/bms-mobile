import { useRef, useState } from "react";
import { ActivityIndicator, Platform, Share, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { BottomSheet, useToast } from "heroui-native";
import { AppButton as Button } from "./FormControls";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { AppIcon } from "./AppIcon";
import { BottomSheetHeader } from "./BottomSheetHeader";
import type { User } from "../context/UserContext";
import type { MotherRecord } from "../config/api";

type MotherQRCodeModalProps = {
  visible: boolean;
  onClose: () => void;
  user: User;
  motherRecord: MotherRecord | null;
};

type QRCodeRef = {
  toDataURL: (callback: (data: string) => void) => void;
};

export function MotherQRCodeModal({ visible, onClose, user, motherRecord }: MotherQRCodeModalProps) {
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);
  const qrRef = useRef<QRCodeRef | null>(null);

  const rawId = motherRecord?.mother_id || user.user_id || "BMS-UNKNOWN";
  const displayCode = `MTH-${rawId.substring(0, 8).toUpperCase()}`;
  const qrPayload = JSON.stringify({
    type: "BMS_MOTHER_QR",
    mother_id: motherRecord?.mother_id || rawId,
    user_id: user.user_id,
    name: user.name,
    code: displayCode,
  });

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      if (Platform.OS === "web") {
        const qrData = await new Promise<string>((resolve, reject) => {
          if (!qrRef.current) {
            reject(new Error("QR code is still loading."));
            return;
          }
          qrRef.current.toDataURL(resolve);
        });
        const imageBlob = await fetch(`data:image/png;base64,${qrData}`).then((response) => response.blob());
        const qrFile = new File([imageBlob], `Mother-QR-${displayCode}.png`, { type: "image/png" });
        if (navigator.share && navigator.canShare?.({ files: [qrFile] })) {
          await navigator.share({
            title: "Mother QR code",
            text: `Mother code: ${displayCode}`,
            files: [qrFile],
          });
        } else {
          await Share.share({ title: "Mother QR code", message: `Mother code: ${displayCode}\nQR data: ${qrPayload}` });
        }
      } else {
        const qrData = await new Promise<string>((resolve, reject) => {
          if (!qrRef.current) {
            reject(new Error("QR code is still loading."));
            return;
          }
          qrRef.current.toDataURL(resolve);
        });
        const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;text-align:center;padding:36px;color:#171717"><h2>Mother QR Code</h2><img alt="Mother QR code" width="280" height="280" src="data:image/png;base64,${qrData}"/><p style="font-size:13px;color:#737373;margin:20px 0 6px">Mother code</p><strong style="font-size:20px;letter-spacing:2px">${displayCode}</strong></body></html>`;
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: "Share QR code and mother code",
            UTI: "com.adobe.pdf",
          });
        } else {
          await Share.share({ title: "Mother QR code", message: `Mother code: ${displayCode}\nQR data: ${qrPayload}` });
        }
      }
    } catch (error) {
      toast.show({
        label: "Could not share QR code",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "danger",
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay className="bg-black/60" />
        <BottomSheet.Content
          snapPoints={["58%"]}
          enableDynamicSizing={false}
          enableOverDrag={false}
          backgroundClassName="rounded-t-[24px] bg-background"
          handleIndicatorClassName="bg-muted"
        >
          <View className="items-center px-5 pb-5 pt-1">
            <BottomSheetHeader title="Mother QR code" description="Share this code with your care team." onClose={onClose} closeLabel="Close QR code" className="w-full" />

            <View className="overflow-hidden rounded-2xl bg-white p-3">
              <QRCode
                value={qrPayload}
                size={216}
                color="#111111"
                backgroundColor="#ffffff"
                quietZone={8}
                getRef={(ref) => { qrRef.current = ref as QRCodeRef | null; }}
              />
            </View>

            <Text className="mt-4 text-sm text-muted-foreground">Mother code</Text>
            <Text className="mt-1 text-base font-semibold tracking-wide text-foreground">{displayCode}</Text>

            <Button
              variant="primary"
              onPress={handleShare}
              isDisabled={isSharing}
              className="mt-4 min-h-11 w-full rounded-md bg-[#fffe8c]"
            >
              {isSharing ? <ActivityIndicator size="small" color="#171717" /> : <AppIcon name="share-social-outline" size={18} weight="bold" color="#171717" />}
              <Button.Label className="font-semibold text-[#171717]">
                {isSharing ? "Preparing share…" : "Share QR & Code"}
              </Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
