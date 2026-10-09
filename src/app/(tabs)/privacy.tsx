import { View, ScrollView, ActivityIndicator, Platform } from "react-native";
import type { JSX } from "react";
import { Card, Text, Switch, Button } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { useState } from "react";
import { useSettings } from "../../context/settingsContext";
import { useAuth } from "../../context/UserContext";
import { useConfirm } from "../../context/ConfirmationContext";
import { deleteAccountApi } from "../../config/api";
import { useRouter } from "expo-router";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import { generateHealthReportHtml } from "../../utils/healthReportPdf";
import { getMotherProfileLocal, getSupplementsLocal } from "../../db/repository";

export default function PrivacyScreen(): JSX.Element {
  const router = useRouter();
  const { user, token, motherRecord, activePregnancy, logout } = useAuth();
  const { shareHealthData, setShareHealthData, analyticsEnabled, setAnalyticsEnabled } =
    useSettings();
  const { confirm } = useConfirm();

  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleDownloadData = async () => {
    setIsExporting(true);
    setStatusMessage(null);

    try {
      // 1. Fetch comprehensive local profile and records
      let fullMotherRecord = motherRecord;
      let supplementsList: any[] = [];
      try {
        if (user.user_id) {
          const profileData = await getMotherProfileLocal(user.user_id);
          if (profileData?.motherRecord) {
            fullMotherRecord = profileData.motherRecord;
          }
          const supps = await getSupplementsLocal(fullMotherRecord?.mother_id || user.user_id);
          if (supps) supplementsList = supps;
        }
      } catch (err) {
        console.warn("Could not load supplementary local records for PDF:", err);
      }

      // 2. Generate HTML report
      const reportHtml = generateHealthReportHtml({
        user,
        motherRecord: fullMotherRecord,
        activePregnancy,
        supplements: supplementsList,
      });

      // 3. Render printable document file
      const { uri: tempPdfUri } = await Print.printToFileAsync({
        html: reportHtml,
      });

      const cleanName = (user.first_name || user.name || "User").replace(/[^a-zA-Z0-9]/g, "_");
      const dateTag = new Date().toISOString().split("T")[0];
      const fileName = `BMS_Health_Records_${cleanName}_${dateTag}.pdf`;
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || "";
      const targetFileUri = `${baseDir}${fileName}`;

      // 4. Copy to clean named file in document directory
      await FileSystem.copyAsync({
        from: tempPdfUri,
        to: targetFileUri,
      });

      // 5. Directly open PDF in phone's default document viewer on Android
      if (Platform.OS === "android") {
        try {
          const contentUri = await FileSystem.getContentUriAsync(targetFileUri);
          await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
            data: contentUri,
            flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
            type: "application/pdf",
          });
          setStatusMessage(`Document opened: ${fileName}`);
          return;
        } catch (intentErr) {
          console.warn("IntentLauncher fallback:", intentErr);
        }
      }

      // iOS or Fallback
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(targetFileUri, {
          mimeType: "application/pdf",
          dialogTitle: "Download Health Record",
          UTI: "com.adobe.pdf",
        });
      }
      setStatusMessage(`Document saved: ${fileName}`);
    } catch (err: any) {
      confirm({
        title: "Export Failed",
        message: err.message || "Could not generate health document.",
        confirmText: "OK",
        cancelText: "",
        variant: "danger",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = () => {
    confirm({
      title: "Delete Account",
      message:
        "Are you sure you want to delete your account? Your account will be deactivated and you will be signed out immediately.",
      confirmText: "Delete Account",
      cancelText: "Cancel",
      variant: "danger",
      icon: "trash-outline",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          const motherId = motherRecord?.mother_id || user.user_id;
          await deleteAccountApi(motherId, token || "");
          confirm({
            title: "Account Deleted",
            message: "Your account has been deleted successfully.",
            confirmText: "OK",
            cancelText: "",
            variant: "success",
            icon: "checkmark-circle-outline",
          });
          await logout();
          router.replace("/(auth)/login");
        } catch (err: any) {
          confirm({
            title: "Delete Failed",
            message: err.message || "Failed to delete account. Please contact facility staff.",
            confirmText: "OK",
            cancelText: "",
            variant: "danger",
          });
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  return (
    <View className="flex-1 bg-background">
      <Header
        showBackButton
        title="Data Privacy"
        onBack={() => router.push("/(tabs)/profile")}
        rightIcon={null}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {statusMessage && (
          <View className="mx-5 mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex-row items-center gap-3">
            <Ionicons name="checkmark-circle-outline" size={22} color="#10b981" />
            <Text className="text-green-600 dark:text-green-400 text-sm flex-1">
              {statusMessage}
            </Text>
          </View>
        )}

        <View className="px-5 mb-6 pt-2">
          <Text className="text-zinc-400 text-sm font-medium mb-2 ml-1">Data Sharing</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl p-4">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 mr-4">
                <Text className="text-foreground text-base font-medium">Share Health Data</Text>
                <Text className="text-zinc-400 text-sm mt-0.5">
                  Allow authorized healthcare providers to access your medical records securely.
                </Text>
              </View>
              <Switch
                isSelected={shareHealthData}
                {...({ onValueChange: setShareHealthData } as any)}
              />
            </View>

            <View className="h-px bg-default mb-4" />

            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-foreground text-base font-medium">
                  Analytics & Performance
                </Text>
                <Text className="text-zinc-400 text-sm mt-0.5">
                  Share anonymous usage logs to help improve the app.
                </Text>
              </View>
              <Switch
                isSelected={analyticsEnabled}
                {...({ onValueChange: setAnalyticsEnabled } as any)}
              />
            </View>
          </Card>
        </View>

        <View className="px-5 mb-6">
          <Text className="text-zinc-400 text-sm font-medium mb-2 ml-1">Data Management</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl p-4 gap-4">
            <View>
              <Text className="text-foreground text-base font-medium mb-1">
                Download Health Record
              </Text>
              <Text className="text-zinc-400 text-sm mb-3">
                Save an official, printable summary of your maternal profile, prenatal vitals,
                prescriptions, and delivery logs to your device.
              </Text>
              <Button
                variant="secondary"
                className="w-full bg-default border-0 rounded-xl"
                onPress={handleDownloadData}
                isDisabled={isExporting}
              >
                <View className="flex-row items-center justify-center gap-2">
                  {isExporting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="download-outline" size={18} color="#0284c7" />
                  )}
                  <Button.Label className="text-foreground font-medium">
                    {isExporting ? "Generating Document..." : "Download Health Summary"}
                  </Button.Label>
                </View>
              </Button>
            </View>

            <View className="h-px bg-default" />

            <View>
              <Text className="text-danger text-base font-medium mb-1">Delete Account</Text>
              <Text className="text-zinc-400 text-sm mb-3">
                Deactivate your account and revoke mobile access. Medical records remain securely
                archived at your facility.
              </Text>
              <Button
                className="w-full bg-red-500/15 border-0 rounded-xl"
                onPress={handleDeleteAccount}
                isDisabled={isDeleting}
              >
                <View className="flex-row items-center justify-center gap-2">
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  )}
                  <Button.Label className="text-red-500 font-medium">
                    {isDeleting ? "Deleting..." : "Delete Account"}
                  </Button.Label>
                </View>
              </Button>
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
