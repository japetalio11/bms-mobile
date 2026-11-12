import { View, ScrollView, ActivityIndicator, Platform, Pressable, BackHandler } from "react-native";
import type { JSX } from "react";
import { Text, Switch, useToast } from "heroui-native";
import { AppButton as Button } from "../../components/FormControls";
import { AppIcon } from "../../components/AppIcon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useCallback } from "react";
import { useSettings } from "../../context/settingsContext";
import { useAuth } from "../../context/UserContext";
import { useConfirm } from "../../context/ConfirmationContext";
import { deleteAccountApi } from "../../config/api";
import { useRouter, useFocusEffect } from "expo-router";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import { generateHealthReportHtml } from "../../utils/healthReportPdf";
import { getMotherProfileLocal, getSupplementsLocal } from "../../db/repository";

export default function PrivacyScreen(): JSX.Element {
  const router = useRouter();
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/(tabs)/profile");
      return true;
    });
    return () => subscription.remove();
  }, [router]));
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { user, token, motherRecord, activePregnancy, logout } = useAuth();
  const { shareHealthData, setShareHealthData, analyticsEnabled, setAnalyticsEnabled } =
    useSettings();
  const { confirm } = useConfirm();

  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDownloadData = async () => {
    setIsExporting(true);

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
          toast.show({ label: "Health summary opened", variant: "success" });
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
      toast.show({ label: "Health summary saved", variant: "success" });
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
  return <View className="flex-1 bg-background">
    <View className="h-16 flex-row items-center justify-between px-5">
      <Pressable onPress={() => router.replace("/(tabs)/profile")} accessibilityLabel="Back to settings" className="size-11 items-center justify-center"><AppIcon name="chevron-back" size={23} weight="bold" color="#171717" /></Pressable>
      <Text className="text-2xl font-semibold text-foreground">Privacy and Data</Text>
      <View className="size-10" />
    </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 100 }}>
      <Text className="text-base font-semibold text-foreground">Data sharing</Text>
      <Text className="mt-1 text-sm text-muted-foreground">Choose how your health information is used.</Text>
      <View className="mt-5 overflow-hidden rounded-xl bg-[#f6f6f6]">
        <View className="min-h-20 flex-row items-center gap-4 px-4 py-3">
          <View className="flex-1"><Text className="text-sm font-medium text-foreground">Share health data</Text><Text className="mt-1 text-sm text-muted-foreground">Allow your care team to view your records.</Text></View>
          <Switch isSelected={shareHealthData} onSelectedChange={setShareHealthData} />
        </View>
        <View className="min-h-20 flex-row items-center gap-4 px-4 py-3">
          <View className="flex-1"><Text className="text-sm font-medium text-foreground">Usage analytics</Text><Text className="mt-1 text-sm text-muted-foreground">Help improve Silang with anonymous usage data.</Text></View>
          <Switch isSelected={analyticsEnabled} onSelectedChange={setAnalyticsEnabled} />
        </View>
      </View>
      <Text className="mt-8 text-base font-semibold text-foreground">Your records</Text>
      <Text className="mt-1 text-sm text-muted-foreground">Keep a copy of your maternal health information.</Text>
      <Button onPress={handleDownloadData} isDisabled={isExporting} className="mt-5 min-h-12 rounded-md bg-[#f2f2f2]">
        {isExporting ? <ActivityIndicator color="#171717" /> : <View className="flex-row items-center gap-2"><AppIcon name="download-outline" size={18} color="#171717" /><Button.Label className="text-sm font-medium text-foreground">Download health summary</Button.Label></View>}
      </Button>
      <Text className="mt-8 text-base font-semibold text-foreground">Delete account</Text>
      <Text className="mt-1 text-sm text-muted-foreground">Your account will be deactivated. Medical records remain archived at your facility.</Text>
      <Button onPress={handleDeleteAccount} isDisabled={isDeleting} className="mt-5 min-h-12 rounded-md bg-[#fef0ef]">
        {isDeleting ? <ActivityIndicator color="#b42318" /> : <Button.Label className="text-sm font-medium text-[#b42318]">Delete account</Button.Label>}
      </Button>
    </ScrollView>
  </View>;
}
