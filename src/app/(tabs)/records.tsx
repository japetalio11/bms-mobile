import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  Linking,
  TextInput,
  Platform,
} from "react-native";
import { useState, useCallback } from "react";
import type { JSX } from "react";
import { BottomSheet, Card, Text, useToast } from "heroui-native";
import { AppIcon as Ionicons } from "../../components/AppIcon";
import { BottomSheetHeader } from "../../components/BottomSheetHeader";
import { UploadRecordSheet } from "../../components/UploadRecordSheet";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import { MobileEmptyState } from "../../components/MobileEmptyState";
import { useAuth } from "../../context/UserContext";
import { useNetwork } from "../../context/NetworkContext";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  getLabScreeningsByMotherApi,
  getSupplementsByMotherApi,
  getMotherEhrDocumentsApi,
  deleteLabScreeningApi,
  deleteEhrDocumentApi,
  getFullFileUrl,
} from "../../config/api";
import type { LabScreeningRecord, SupplementRecord } from "../../config/api";
import {
  getLabScreeningsLocal,
  saveLabScreeningsLocal,
  deleteLabScreeningLocal,
  getSupplementsLocal,
  saveSupplementsLocal,
} from "../../db/repository";

export default function RecordsScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { theme } = useUniwind();
  const isDark = theme === "dark";
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { token, motherRecord, refreshProfile } = useAuth();
  const { isOnline } = useNetwork();

  const [selectedMainTab, setSelectedMainTab] = useState("lab");
  const activeMainTab = tab === "prescriptions" ? "prescriptions" : selectedMainTab;
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);

  const [labScreenings, setLabScreenings] = useState<LabScreeningRecord[]>([]);
  const [supplements, setSupplements] = useState<SupplementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOpeningDocument, setIsOpeningDocument] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<LabScreeningRecord | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [recordMenu, setRecordMenu] = useState<{ record: LabScreeningRecord; url: string | null } | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<LabScreeningRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isPdfOrDocument = (url: string, lab?: LabScreeningRecord | null): boolean => {
    const cleanUrl = (url || "").split("?")[0].toLowerCase();
    const screeningType = (lab?.screening_type || "").toLowerCase();
    const remarks = (lab?.remarks || "").toLowerCase();

    if (
      cleanUrl.endsWith(".pdf") ||
      cleanUrl.includes("/pdf") ||
      cleanUrl.endsWith(".doc") ||
      cleanUrl.endsWith(".docx") ||
      cleanUrl.endsWith(".txt")
    ) {
      return true;
    }

    if (
      screeningType.includes(".pdf") ||
      screeningType.includes(".doc") ||
      remarks.includes(".pdf") ||
      remarks.includes("application/pdf")
    ) {
      return true;
    }

    const isImageExtension = /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(cleanUrl);
    if (!isImageExtension && (cleanUrl.startsWith("content://") || cleanUrl.startsWith("file://"))) {
      return true;
    }

    return false;
  };

  const openDocumentSafely = async (url: string, title?: string) => {
    setIsOpeningDocument(true);
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          window.open(url, "_blank");
        } else {
          await Linking.openURL(url);
        }
        return;
      }

      if (url.startsWith("http://") || url.startsWith("https://")) {
        await WebBrowser.openBrowserAsync(url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          toolbarColor: isDark ? "#171717" : "#ffffff",
          controlsColor: isDark ? "#fffe8c" : "#171717",
          showTitle: true,
          enableBarCollapsing: true,
          createTask: false,
        });
        return;
      }

      let localUri = url;

      if (Platform.OS === "android") {
        try {
          const contentUri = localUri.startsWith("content://")
            ? localUri
            : await FileSystem.getContentUriAsync(localUri);

          await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
            data: contentUri,
            flags: 1,
            type: "application/pdf",
          });
          return;
        } catch {}
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(localUri, {
          mimeType: "application/pdf",
          dialogTitle: title || "View EHR Document",
          UTI: "com.adobe.pdf",
        });
        return;
      }

      await Linking.openURL(url);
    } catch {
      toast.show({
        label: "Unable to open document",
        description: "Please check your PDF viewer or try again later.",
        variant: "danger",
      });
    } finally {
      setIsOpeningDocument(false);
    }
  };

  const handleOpenAttachment = async (url: string, lab?: LabScreeningRecord) => {
    if (!url) return;

    if (isPdfOrDocument(url, lab)) {
      await openDocumentSafely(url, lab?.screening_type || "EHR Document");
      return;
    }

    setPreviewScale(1);
    setSelectedImageModal(url);
    if (lab) setSelectedRecord(lab);
  };

  const closeRecordPreview = () => {
    setSelectedImageModal(null);
    setSelectedRecord(null);
    setPreviewScale(1);
  };

  const confirmDeleteRecord = (record: LabScreeningRecord) => {
    setDeleteError(null);
    setRecordToDelete(record);
  };

  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;

    const targetId =
      recordToDelete.screening_id || (recordToDelete as any).id || (recordToDelete as any).temp_id;

    if (!targetId) {
      setRecordToDelete(null);
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteLabScreeningLocal(targetId);

      if (isOnline && token) {
        try {
          await deleteLabScreeningApi(targetId, token);
        } catch (err: any) {
          try {
            await deleteEhrDocumentApi(targetId, token);
          } catch (innerErr) {
            console.warn("Backend delete document failed:", err, innerErr);
          }
        }
      }

      setLabScreenings((prev) =>
        prev.filter((l) => (l.screening_id || (l as any).id || (l as any).temp_id) !== targetId)
      );

      if (
        selectedRecord &&
        (selectedRecord.screening_id || (selectedRecord as any).id) === targetId
      ) {
        setSelectedImageModal(null);
        setSelectedRecord(null);
      }

      setRecordToDelete(null);
      if (refreshProfile) {
        refreshProfile().catch(() => {});
      }
    } catch (err: any) {
      console.error("Failed to delete document:", err);
      setDeleteError(err.message || "Failed to delete document. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const loadData = useCallback(async () => {
    if (!motherRecord?.mother_id) {
      setLabScreenings([]);
      setSupplements([]);
      return;
    }

    try {
      const [localLabs, localSupps] = await Promise.all([
        getLabScreeningsLocal(motherRecord.mother_id),
        getSupplementsLocal(motherRecord.mother_id),
      ]);

      setLabScreenings(localLabs || []);
      setSupplements(localSupps || []);
    } catch (e) {
      console.warn("Local records load error:", e);
    }

    if (isOnline && token) {
      setIsLoading(true);
      Promise.all([
        getLabScreeningsByMotherApi(motherRecord.mother_id, token),
        getSupplementsByMotherApi(motherRecord.mother_id, token),
        getMotherEhrDocumentsApi(motherRecord.mother_id, token),
      ])
        .then(async ([labs, supps, ehrDocs]) => {
          let allLabs: LabScreeningRecord[] = Array.isArray(labs) ? [...labs] : [];

          // Track existing IDs, URLs, and filenames to prevent any duplicate entries
          const existingIds = new Set<string>();
          const existingUrls = new Set<string>();

          allLabs.forEach((l) => {
            const sId = l.screening_id || (l as any).id;
            if (sId) existingIds.add(String(sId));
            if (l.file_url) {
              const cleanUrl = l.file_url.split("?")[0].trim().toLowerCase();
              const filename = cleanUrl.split("/").pop();
              if (cleanUrl) existingUrls.add(cleanUrl);
              if (filename) existingUrls.add(filename);
            }
          });

          if (Array.isArray(ehrDocs) && ehrDocs.length > 0) {
            const mappedEhrDocs: LabScreeningRecord[] = [];

            for (const doc of ehrDocs) {
              const docId = String(doc.document_id || doc.id || "");
              const docUrl = doc.file_url || doc.fileUrl || "";
              const cleanDocUrl = docUrl ? docUrl.split("?")[0].trim().toLowerCase() : "";
              const docFilename = cleanDocUrl ? cleanDocUrl.split("/").pop() : "";

              // Skip if already in allLabs by ID, file URL, or filename
              if (docId && existingIds.has(docId)) continue;
              if (cleanDocUrl && existingUrls.has(cleanDocUrl)) continue;
              if (docFilename && existingUrls.has(docFilename)) continue;

              const uploader = doc.uploaded_by || doc.uploadedBy;
              const uploaderText = uploader ? `Uploaded by: ${uploader}` : undefined;

              mappedEhrDocs.push({
                screening_id: docId,
                pregnancy_id: "",
                visit_id: "",
                screening_type: doc.title || doc.category || "Clinical Document",
                result: doc.category || "Staff Document",
                file_url: docUrl,
                date_of_screening: doc.created_at || doc.dateUploaded || new Date().toISOString(),
                remarks: uploaderText,
                sync_status: "synced",
              });

              if (docId) existingIds.add(docId);
              if (cleanDocUrl) existingUrls.add(cleanDocUrl);
              if (docFilename) existingUrls.add(docFilename);
            }

            allLabs = [...allLabs, ...mappedEhrDocs];
          }

          const currentLocal = await getLabScreeningsLocal(motherRecord.mother_id);
          const pendingLabs = currentLocal.filter(
            (l: any) =>
              l.sync_status === "pending" &&
              l.screening_id &&
              l.screening_id !== "null" &&
              l.screening_id !== "undefined"
          );
          const serverIds = new Set(allLabs.map((l) => l.screening_id).filter(Boolean));
          const merged = [...allLabs, ...pendingLabs.filter((p) => !serverIds.has(p.screening_id))];

          setLabScreenings(merged);
          if (Array.isArray(labs) && labs.length > 0) {
            await saveLabScreeningsLocal(labs, true, motherRecord.mother_id, true);
          }

          if (Array.isArray(supps)) {
            setSupplements(supps);
            await saveSupplementsLocal(supps, true);
          }
        })
        .catch((err) => {
          console.warn("API records fetch failed, preserving local data:", err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [motherRecord, token, isOnline]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadData(), refreshProfile()]);
    setIsRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const filteredLabs = labScreenings.filter((lab) => {
    const q = searchQuery.toLowerCase();
    return !searchQuery.trim() || (
      (lab.screening_type || "").toLowerCase().includes(q) ||
      (lab.result || "").toLowerCase().includes(q) ||
      (lab.remarks || "").toLowerCase().includes(q)
    );
  });

  const filteredSupplements = supplements.filter((supp) => {
    return !searchQuery.trim() || (supp.supplement_type || "").toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Keep the folder treatment from Appointments while using neutral file rows.
  const folderSurface = "#262626";
  const folderRail = "#1b1b1b";
  const folderMuted = "#a3a3a3";
  const folderText = "#f5f5f5";
  const rowSurface = isDark ? "#1f1f1f" : "#ffffff";
  const iconSurface = isDark ? "#383838" : "#f0f0f0";
  const fileText = isDark ? "#f5f5f5" : "#171717";
  const fileMuted = isDark ? "#a3a3a3" : "#737373";

  return (
    <View className="flex-1 bg-[#f5f5f5]">
      <View className="mt-4 h-12 flex-row items-center justify-center bg-[#f5f5f5] px-4">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="absolute left-4 size-9 items-center justify-center active:opacity-70"
        >
          <Ionicons name="chevron-back" size={20} weight="bold" color="#262626" />
        </Pressable>
        <Text className="text-2xl font-semibold text-[#171717]">Health Records</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 184 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        <View className="mb-4 px-4 pt-3">
          <View className="h-11 min-w-0 flex-row items-center gap-2 rounded-md border border-border bg-field-background px-3">
            <Ionicons name="search-outline" size={16} weight="regular" color="#737373" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={activeMainTab === "lab" ? "Search EHR records..." : "Search prescriptions..."}
              placeholderTextColor="#a1a1aa"
              underlineColorAndroid="transparent"
              className="h-full min-w-0 flex-1 p-0 text-base text-foreground"
              style={{ color: isDark ? "#f5f5f5" : "#171717", includeFontPadding: false, borderWidth: 0, backgroundColor: "transparent" }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={16} color="#71717a" />
              </Pressable>
            )}
          </View>
        </View>

        <View className="mx-4 mb-4 overflow-hidden rounded-[18px]" style={{ backgroundColor: folderSurface }}>
          <View className="flex-row" style={{ backgroundColor: folderRail }}>
            {[
              { id: "lab", label: "Records", count: labScreenings.length },
              { id: "prescriptions", label: "Prescriptions", count: supplements.length },
            ].map((tab) => {
              const selected = activeMainTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setSelectedMainTab(tab.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  className="min-h-12 flex-1 items-center justify-center rounded-t-[18px] px-2 active:opacity-75"
                  style={{ backgroundColor: selected ? folderSurface : tab.id === "lab" ? "#1b1b1b" : "#222222" }}
                >
                  <Text className="text-sm font-semibold" style={{ color: selected ? folderText : folderMuted }}>
                    {tab.label} ({tab.count})
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Animated.View key={activeMainTab} entering={FadeIn.duration(180)} className="gap-3 px-3 pb-3 pt-3" style={{ backgroundColor: folderSurface }}>
        {activeMainTab === "lab" && (
          <View>
            {isLoading && labScreenings.length === 0 ? (
              <ActivityIndicator size="small" color={isDark ? "#fffe8c" : "#171717"} className="py-8" />
            ) : filteredLabs.length > 0 ? (
              <View className="gap-3">
                {filteredLabs.map((lab, index) => {
                  const labKey =
                    lab.screening_id || (lab as any).id || (lab as any).temp_id || `lab_${index}`;
                  const fileUrl = getFullFileUrl(lab.file_url, (lab as any).local_file_uri);
                  const dateStr = lab.date_of_screening
                    ? new Date(lab.date_of_screening).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "";
                  const cleanFileUrl = (fileUrl || "").split("?")[0].toLowerCase();
                  const isDoc = fileUrl ? isPdfOrDocument(fileUrl, lab) : false;
                  const isImage = /\.(png|jpe?g|webp|gif|bmp|heic)$/.test(cleanFileUrl);
                  const fileIcon = isDoc ? "file-pdf" : isImage ? "image" : "document-text-outline";

                  return (
                    <Pressable
                      key={labKey}
                      onPress={() => fileUrl && handleOpenAttachment(fileUrl, lab)}
                      disabled={!fileUrl}
                      accessibilityRole={fileUrl ? "button" : undefined}
                      className="active:opacity-80"
                    >
                      <Card variant="secondary" className="rounded-[16px] border-0 p-4" style={{ backgroundColor: rowSurface }}>
                        <View className="flex-row items-center gap-3">
                          <View className="size-11 items-center justify-center rounded-xl" style={{ backgroundColor: iconSurface }}>
                            <Ionicons name={fileIcon} size={21} weight="regular" color={isDark ? "#d4d4d4" : "#525252"} />
                          </View>
                          <View className="min-w-0 flex-1 gap-1">
                            <Text className="text-sm font-semibold text-foreground" style={{ color: fileText }} numberOfLines={1}>
                              {lab.screening_type || "Clinical document"}
                            </Text>
                            <Text className="text-sm text-muted-foreground" style={{ color: fileMuted }} numberOfLines={1}>
                              {[dateStr || "Date not recorded", fileUrl ? (fileUrl.split("/").pop()?.split("?")[0] || "Attachment") : "No file attached"].join(" · ")}
                            </Text>
                          </View>
                          <Pressable
                            onPress={(event) => { event.stopPropagation(); setRecordMenu({ record: lab, url: fileUrl }); }}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="More EHR record actions"
                            className="size-9 items-center justify-center rounded-full active:opacity-70"
                            style={{ backgroundColor: iconSurface }}
                          >
                            <Ionicons name="dots-vertical" size={18} weight="bold" color={isDark ? "#d4d4d4" : "#525252"} />
                          </Pressable>
                        </View>
                        {lab.remarks ? (
                          <Text className="mt-3 text-sm text-muted-foreground" style={{ color: fileMuted }} numberOfLines={2}>{lab.remarks}</Text>
                        ) : null}
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <MobileEmptyState
                icon="document-text-outline"
                title={searchQuery.trim() ? "No matching records" : "No EHR records yet"}
                description={searchQuery.trim() ? "Try another search term." : "Your uploaded documents and screening results will appear here."}
                action={searchQuery.trim() ? (
                  <Pressable onPress={() => setSearchQuery("")} className="min-h-11 justify-center rounded-md bg-default px-3 active:opacity-80"><Text className="text-sm font-medium text-foreground">Clear search</Text></Pressable>
                ) : undefined}
              />
            )}
          </View>
        )}

        {activeMainTab === "prescriptions" && (
          <View>
            {isLoading && supplements.length === 0 ? (
              <ActivityIndicator size="small" color={isDark ? "#fffe8c" : "#171717"} className="py-6" />
            ) : filteredSupplements.length > 0 ? (
              <View className="gap-3">
                {filteredSupplements.map((supp, index) => {
                  const suppKey = supp.supplement_id || (supp as any).id || `supp_${index}`;
                  return (
                    <Card key={suppKey} variant="secondary" className="rounded-[16px] border-0 p-4" style={{ backgroundColor: rowSurface }}>
                      <View className="flex-row items-start gap-3 mb-4">
                      <View className="size-10 rounded-full items-center justify-center mt-0.5" style={{ backgroundColor: iconSurface }}>
                          <Ionicons name="medkit-outline" size={18} color={isDark ? "#d4d4d4" : "#525252"} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-semibold" style={{ color: fileText }}>
                            {supp.supplement_type}
                          </Text>
                          <Text className="text-sm" style={{ color: fileMuted }}>
                            {supp.tablets_given_count} Tablets Prescribed
                          </Text>
                        </View>
                      </View>
                      <View className="gap-2">
                        <View className="flex-row justify-between">
                          <Text className="text-sm" style={{ color: fileMuted }}>Status</Text>
                          <Text
                            className={`text-sm font-medium ${supp.is_completed ? "text-[#10b981]" : "text-[#f59e0b]"}`}
                          >
                            {supp.is_completed ? "Completed" : "In Progress"}
                          </Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-sm" style={{ color: fileMuted }}>Date prescribed</Text>
                          <Text className="text-sm font-medium" style={{ color: fileText }}>
                            {new Date(supp.date_given).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  );
                })}
              </View>
            ) : (
              <MobileEmptyState icon="medkit-outline" title="No prescriptions yet" description="Prescriptions from your care team will appear here." />
            )}
          </View>
        )}
          </Animated.View>
        </View>
      </ScrollView>

      <Pressable
        onPress={() => setUploadSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Upload EHR record"
        className="absolute right-5 z-20 min-h-14 flex-row items-center gap-2.5 rounded-full bg-[#fffe8c] px-6 active:opacity-80"
        style={{ bottom: Math.max(insets.bottom, 8) + 88 }}
      >
        <Ionicons name="cloud-upload-outline" size={21} weight="bold" color="#171717" />
        <Text className="text-base font-semibold text-[#171717]">Upload</Text>
      </Pressable>

      <UploadRecordSheet visible={uploadSheetOpen} onClose={() => { setUploadSheetOpen(false); void loadData(); }} />

      <BottomSheet isOpen={!!recordMenu} onOpenChange={(open) => { if (!open) setRecordMenu(null); }}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay className="bg-black/60" />
          <BottomSheet.Content
            snapPoints={insets.bottom > 0 ? ["38%"] : ["28%"]}
            enableDynamicSizing={false}
            enableOverDrag={false}
            backgroundClassName="rounded-t-[24px] bg-background"
            handleIndicatorClassName="bg-muted"
          >
            <View className="px-5 pt-1" style={{ paddingBottom: Math.max(insets.bottom + 16, 24) }}>
              <BottomSheetHeader title="Record options" description={recordMenu?.record.screening_type || "EHR record"} onClose={() => setRecordMenu(null)} />
              {recordMenu?.url ? (
                <>
                  <Pressable
                    onPress={() => {
                      const url = recordMenu.url;
                      const lab = recordMenu.record;
                      setRecordMenu(null);
                      if (url) {
                        void handleOpenAttachment(url, lab);
                      }
                    }}
                    className="min-h-11 flex-row items-center gap-3 rounded-xl px-2 active:bg-default"
                  >
                    <Ionicons name="eye-outline" size={19} weight="regular" color={isDark ? "#e5e5e5" : "#404040"} />
                    <Text className="text-sm font-medium text-foreground">View document</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const url = recordMenu.url;
                      setRecordMenu(null);
                      if (url) {
                        void Linking.openURL(url).catch(() => {});
                      }
                    }}
                    className="min-h-11 flex-row items-center gap-3 rounded-xl px-2 active:bg-default"
                  >
                    <Ionicons name="download-outline" size={19} weight="regular" color={isDark ? "#e5e5e5" : "#404040"} />
                    <Text className="text-sm font-medium text-foreground">Download file</Text>
                  </Pressable>
                </>
              ) : null}
              <Pressable
                onPress={() => {
                  const record = recordMenu?.record;
                  setRecordMenu(null);
                  if (record) confirmDeleteRecord(record);
                }}
                className="min-h-11 flex-row items-center gap-3 rounded-xl px-2 active:bg-default"
              >
                <Ionicons name="trash-outline" size={19} weight="regular" color="#dc2626" />
                <Text className="text-sm font-medium text-red-600">Delete record</Text>
              </Pressable>
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

      <Modal
        visible={!!selectedImageModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          closeRecordPreview();
        }}
      >
        <View className="flex-1 bg-[#111111]" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View className="min-h-[68px] flex-row items-center gap-3 px-4 py-3">
            <Pressable
              onPress={closeRecordPreview}
              accessibilityRole="button"
              accessibilityLabel="Close record preview"
              className="size-10 items-center justify-center rounded-full active:bg-white/10"
            >
              <Ionicons name="close" size={21} weight="regular" color="#f5f5f5" />
            </Pressable>

            <View className="min-w-0 flex-1">
              <Text className="text-[15px] font-semibold text-white" numberOfLines={1}>
                {selectedRecord?.screening_type || "Health record"}
              </Text>
              <Text className="mt-0.5 text-sm text-[#a3a3a3]" numberOfLines={1}>
                {[
                  selectedRecord?.date_of_screening
                    ? new Date(selectedRecord.date_of_screening).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null,
                  selectedImageModal?.split("/").pop()?.split("?")[0]
                    ? selectedImageModal.split("/").pop()!.split("?")[0].replace(/%20/g, " ")
                    : null,
                ].filter(Boolean).join(" · ") || "Image preview"}
              </Text>
            </View>

            {selectedImageModal ? (
              <Pressable
                onPress={() => Linking.openURL(selectedImageModal).catch(() => {})}
                accessibilityRole="button"
                accessibilityLabel="Download health record"
                className="size-10 items-center justify-center rounded-full bg-[#252525] active:bg-[#333333]"
              >
                <Ionicons name="download-outline" size={19} weight="regular" color="#f5f5f5" />
              </Pressable>
            ) : null}
            {selectedRecord ? (
              <Pressable
                onPress={() => confirmDeleteRecord(selectedRecord)}
                accessibilityRole="button"
                accessibilityLabel="Delete health record"
                className="size-10 items-center justify-center rounded-full active:bg-red-500/15"
              >
                <Ionicons name="trash-outline" size={19} weight="regular" color="#f87171" />
              </Pressable>
            ) : null}
          </View>

          <View className="mx-3 min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-[#181818]">
            {selectedImageModal && (
              <Image
                source={{ uri: selectedImageModal }}
                style={{ width: "100%", height: "100%", transform: [{ scale: previewScale }] }}
                className="w-full h-full"
                resizeMode="contain"
                resizeMethod="scale"
              />
            )}
          </View>

          <View className="flex-row items-center justify-between px-5 py-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="image" size={16} weight="regular" color="#a3a3a3" />
              <Text className="text-sm text-[#a3a3a3]">Preview</Text>
            </View>
            <View className="flex-row items-center gap-1 rounded-full bg-[#252525] p-1">
              <Pressable
                onPress={() => setPreviewScale((scale) => Math.max(1, Number((scale - 0.25).toFixed(2))))}
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
                disabled={previewScale <= 1}
                className="size-8 items-center justify-center rounded-full active:bg-white/10"
              >
                <Text className="text-base leading-5 text-white">−</Text>
              </Pressable>
              <Text className="min-w-12 text-center text-sm font-medium text-white">
                {Math.round(previewScale * 100)}%
              </Text>
              <Pressable
                onPress={() => setPreviewScale((scale) => Math.min(2.5, Number((scale + 0.25).toFixed(2))))}
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
                disabled={previewScale >= 2.5}
                className="size-8 items-center justify-center rounded-full active:bg-white/10"
              >
                <Text className="text-base leading-5 text-white">+</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <BottomSheet
        isOpen={!!recordToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setRecordToDelete(null);
        }}
      >
        <BottomSheet.Portal>
          <BottomSheet.Overlay className="bg-black/60" />
          <BottomSheet.Content
            snapPoints={insets.bottom > 0 ? ["40%"] : ["32%"]}
            enableDynamicSizing={false}
            enableOverDrag={false}
            backgroundClassName="rounded-t-[24px] bg-background"
            handleIndicatorClassName="bg-muted"
          >
            <View className="gap-4 px-5 pt-1" style={{ paddingBottom: Math.max(insets.bottom + 16, 24) }}>
              <BottomSheetHeader
                title="Delete EHR record?"
                description={`${recordToDelete?.screening_type || "This document"} will be permanently removed.`}
                onClose={() => { if (!isDeleting) setRecordToDelete(null); }}
              />

              {deleteError && (
                <View className="rounded-xl bg-red-500/10 p-3">
                  <Text className="text-sm text-red-600">{deleteError}</Text>
                </View>
              )}

              <View className="mt-1 flex-row gap-3">
                <Pressable
                  disabled={isDeleting}
                  onPress={() => setRecordToDelete(null)}
                  className="min-h-11 flex-1 items-center justify-center rounded-md bg-default active:opacity-75 disabled:opacity-50"
                >
                  <Text className="text-sm font-semibold text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={isDeleting}
                  onPress={handleDeleteRecord}
                  className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-md bg-red-600 active:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="trash" size={16} color="white" />}
                  <Text className="text-sm font-semibold text-white">{isDeleting ? "Deleting…" : "Delete record"}</Text>
                </Pressable>
              </View>
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </View>
  );
}
