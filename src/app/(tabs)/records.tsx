import { View, ScrollView, Pressable, ActivityIndicator, Image, Modal, RefreshControl, Linking } from "react-native";
import { useState, useEffect, useCallback } from "react";
import type { JSX } from "react";
import { Tabs, Card, SearchField, Text, Button } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Header } from "../../components/Header";
import { useAuth } from "../../context/UserContext";
import { useNetwork } from "../../context/NetworkContext";
import {
  getLabScreeningsByMotherApi,
  getSupplementsByMotherApi,
  getMotherEhrDocumentsApi,
  deleteLabScreeningApi,
  deleteEhrDocumentApi,
  getFullFileUrl,
  API_BASE_URL,
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
  const { token, motherRecord, refreshProfile } = useAuth();
  const { isOnline } = useNetwork();

  const [activeMainTab, setActiveMainTab] = useState("lab");
  const [searchLab, setSearchLab] = useState("");
  const [searchPrescription, setSearchPrescription] = useState("");

  const [labScreenings, setLabScreenings] = useState<LabScreeningRecord[]>([]);
  const [supplements, setSupplements] = useState<SupplementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<LabScreeningRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<LabScreeningRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleOpenAttachment = async (url: string, lab?: LabScreeningRecord) => {
    if (!url) return;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes(".pdf") || lowerUrl.includes("/pdf") || lowerUrl.endsWith(".doc") || lowerUrl.endsWith(".docx")) {
      try {
        await WebBrowser.openBrowserAsync(url);
      } catch {
        Linking.openURL(url).catch(() => {});
      }
    } else {
      setSelectedImageModal(url);
      if (lab) setSelectedRecord(lab);
    }
  };

  const confirmDeleteRecord = (record: LabScreeningRecord) => {
    setDeleteError(null);
    setRecordToDelete(record);
  };

  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;

    const targetId =
      recordToDelete.screening_id ||
      (recordToDelete as any).id ||
      (recordToDelete as any).temp_id;

    if (!targetId) {
      setRecordToDelete(null);
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      // 1. Delete from local SQLite database
      await deleteLabScreeningLocal(targetId);

      // 2. If online and token available, call backend delete
      if (isOnline && token) {
        try {
          await deleteLabScreeningApi(targetId, token);
        } catch (err: any) {
          // Fallback for EHR facility documents
          try {
            await deleteEhrDocumentApi(targetId, token);
          } catch (innerErr) {
            console.warn("Backend delete document failed:", err, innerErr);
          }
        }
      }

      // 3. Update local state
      setLabScreenings((prev) =>
        prev.filter(
          (l) =>
            (l.screening_id || (l as any).id || (l as any).temp_id) !== targetId
        )
      );

      // 4. Close preview modal if deleting currently viewed image
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

    // 1. Read from local SQLite database first (scoped strictly to current mother)
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

    // 2. Fetch fresh API data if online
    if (isOnline && token) {
      setIsLoading(true);
      Promise.all([
        getLabScreeningsByMotherApi(motherRecord.mother_id, token),
        getSupplementsByMotherApi(motherRecord.mother_id, token),
        getMotherEhrDocumentsApi(motherRecord.mother_id, token),
      ])
        .then(async ([labs, supps, ehrDocs]) => {
          let allLabs: LabScreeningRecord[] = Array.isArray(labs) ? [...labs] : [];

          // Map EHR facility documents into lab screening format
          if (Array.isArray(ehrDocs) && ehrDocs.length > 0) {
            const mappedEhrDocs: LabScreeningRecord[] = ehrDocs.map((doc: any) => ({
              screening_id: doc.document_id || doc.id,
              pregnancy_id: "",
              visit_id: "",
              screening_type: doc.title || doc.category || "Clinical Document",
              result: doc.category || "Uploaded by Healthcare Staff",
              file_url: doc.file_url || doc.fileUrl,
              date_of_screening: doc.created_at || doc.dateUploaded || new Date().toISOString(),
              remarks: doc.uploaded_by ? `Uploaded by: ${doc.uploaded_by}` : undefined,
              sync_status: "synced",
            }));

            // Deduplicate against existing screenings
            const existingIds = new Set(allLabs.map((l) => l.screening_id));
            const uniqueEhr = mappedEhrDocs.filter((d) => !existingIds.has(d.screening_id));
            allLabs = [...allLabs, ...uniqueEhr];
          }

          // Keep local pending items that haven't synced to server yet
          const currentLocal = await getLabScreeningsLocal(motherRecord.mother_id);
          const pendingLabs = currentLocal.filter(
            (l: any) => l.sync_status === "pending" && l.screening_id && l.screening_id !== "null" && l.screening_id !== "undefined"
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
  }, [motherRecord?.mother_id, token, isOnline]);

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
    if (!searchLab.trim()) return true;
    const q = searchLab.toLowerCase();
    return (
      lab.screening_type.toLowerCase().includes(q) ||
      lab.result.toLowerCase().includes(q) ||
      (lab.remarks || "").toLowerCase().includes(q)
    );
  });

  const filteredSupplements = supplements.filter((supp) => {
    if (!searchPrescription.trim()) return true;
    return supp.supplement_type.toLowerCase().includes(searchPrescription.toLowerCase());
  });


  return (
    <View className="flex-1 bg-background">
      <Header />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        {/* Main Tabs */}
        <View className="px-5 mb-4">
          <Tabs value={activeMainTab} onValueChange={setActiveMainTab} variant="primary">
            <Tabs.List className="bg-default p-1 rounded-xl flex-row w-full h-10 items-center">
              <Tabs.Indicator className="bg-surface-secondary rounded-lg" />
              <Tabs.Trigger value="lab" className="flex-1 items-center justify-center h-8">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-semibold text-sm text-center ${isSelected ? "text-foreground font-bold" : "text-zinc-400"}`}>
                    Lab Records
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="prescriptions" className="flex-1 items-center justify-center h-8">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-semibold text-sm text-center ${isSelected ? "text-foreground font-bold" : "text-zinc-400"}`}>
                    Prescriptions
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </View>

        {/* Laboratory Records Tab */}
        {activeMainTab === "lab" && (
          <View className="px-5">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-foreground text-lg font-semibold">Laboratory Records</Text>
              <Button
                size="sm"
                variant="primary"
                className="rounded-xl px-3 flex-row items-center gap-1"
                onPress={() => router.push("/(tabs)/upload-record")}
              >
                <Ionicons name="cloud-upload-outline" size={15} color="white" />
                <Button.Label className="text-sm font-medium">Upload</Button.Label>
              </Button>
            </View>

            <SearchField value={searchLab} onChange={setSearchLab}>
              <SearchField.Group className="bg-default border-0 rounded-xl h-12 mb-5">
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search for laboratory records..." className="text-sm" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>

            {isLoading && labScreenings.length === 0 ? (
              <ActivityIndicator size="small" color="#6366f1" className="py-8" />
            ) : filteredLabs.length > 0 ? (
              <View className="gap-3.5">
                {filteredLabs.map((lab, index) => {
                  const labKey = lab.screening_id || (lab as any).id || (lab as any).temp_id || `lab_${index}`;
                  const fileUrl = getFullFileUrl(lab.file_url, (lab as any).local_file_uri);
                  const dateStr = lab.date_of_screening
                    ? new Date(lab.date_of_screening).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "";
                  const isPendingSync = (lab as any).sync_status === "pending";

                  return (
                    <Card key={labKey} variant="secondary" className="bg-surface border-0 rounded-2xl p-4">
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center gap-3 flex-1 min-w-0 pr-2">
                          <View className="size-10 rounded-xl bg-primary/15 items-center justify-center shrink-0">
                            <Ionicons name="document-text-outline" size={20} color="#0284c7" />
                          </View>
                          <View className="flex-1 min-w-0">
                            <Text className="text-foreground font-semibold text-base" numberOfLines={1}>
                              {lab.screening_type}
                            </Text>
                            <Text className="text-zinc-400 text-sm" numberOfLines={1}>{dateStr || "Screening Record"}</Text>
                          </View>
                        </View>

                        <View className="flex-row items-center gap-1.5 shrink-0">
                          {isPendingSync ? (
                            <View className="px-2.5 py-1 rounded-full bg-amber-500/20">
                              <Text className="text-amber-400 text-xs font-semibold">Pending Upload</Text>
                            </View>
                          ) : (
                            <View className="px-2.5 py-1 rounded-full bg-emerald-500/15">
                              <Text className="text-emerald-400 text-xs font-semibold">
                                {lab.result || "Uploaded"}
                              </Text>
                            </View>
                          )}
                          <Pressable
                            onPress={() => confirmDeleteRecord(lab)}
                            hitSlop={8}
                            className="size-8 rounded-full bg-red-500/10 active:bg-red-500/25 items-center justify-center ml-0.5"
                          >
                            <Ionicons name="trash-outline" size={15} color="#ef4444" />
                          </Pressable>
                        </View>
                      </View>

                      {fileUrl ? (
                        fileUrl.toLowerCase().includes(".pdf") || fileUrl.toLowerCase().includes("/pdf") ? (
                          <Pressable
                            onPress={() => handleOpenAttachment(fileUrl, lab)}
                            className="mt-2.5 mb-2 p-3 bg-default/40 border border-default rounded-xl flex-row items-center gap-3 active:bg-default/70"
                          >
                            <View className="size-10 rounded-lg bg-red-500/20 items-center justify-center">
                              <Ionicons name="document-text" size={22} color="#3b82f6" />
                            </View>
                            <View className="flex-1 min-w-0">
                              <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
                                {fileUrl.split("/").pop()?.split("?")[0] || "PDF Document"}
                              </Text>
                              <Text className="text-zinc-400 text-[11px] mt-0.5">PDF Document Attachment • Tap to view</Text>
                            </View>
                            <Ionicons name="open-outline" size={16} color="#a1a1aa" />
                          </Pressable>
                        ) : (
                          <Pressable onPress={() => handleOpenAttachment(fileUrl, lab)} className="mt-2.5 mb-2 relative rounded-xl overflow-hidden">
                            <Image
                              source={{ uri: fileUrl }}
                              style={{ width: "100%", height: 180 }}
                              className="w-full h-44 rounded-xl bg-default/40"
                              resizeMode="cover"
                            />
                            <View className="absolute bottom-2 right-2 bg-black/70 px-2.5 py-1 rounded-lg flex-row items-center gap-1.5 z-10">
                              <Ionicons name="eye-outline" size={12} color="white" />
                              <Text className="text-white text-[11px] font-medium">View Full Image</Text>
                            </View>
                          </Pressable>
                        )
                      ) : null}

                      {lab.remarks ? (
                        <Text className="text-zinc-400 text-sm mt-1" numberOfLines={2}>
                          Remarks: {lab.remarks}
                        </Text>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            ) : (
              <Card variant="secondary" className="bg-surface border-0 rounded-2xl p-6 items-center py-10">
                <Ionicons name="document-text-outline" size={32} color="#71717a" className="mb-2" />
                <Text className="text-foreground font-semibold text-base mb-1">No Lab Records Found</Text>
                <Text className="text-zinc-400 text-sm text-center max-w-xs mb-4">
                  {searchLab.trim()
                    ? "No laboratory records match your search criteria."
                    : "You haven't uploaded or received any laboratory records yet."}
                </Text>
                <Button
                  size="sm"
                  variant="primary"
                  className="rounded-xl px-4 flex-row items-center gap-1.5"
                  onPress={() => router.push("/(tabs)/upload-record")}
                >
                  <Ionicons name="cloud-upload-outline" size={16} color="white" />
                  <Button.Label className="text-sm font-semibold">Upload First Record</Button.Label>
                </Button>
              </Card>
            )}
          </View>
        )}

        {/* Prescriptions Tab */}
        {activeMainTab === "prescriptions" && (
          <View className="px-5">
            <Text className="text-foreground text-lg font-semibold mb-4">Prescriptions</Text>

            <View className="mb-5 flex-row items-center gap-3">
              <View className="flex-1">
                <SearchField value={searchPrescription} onChange={setSearchPrescription}>
                  <SearchField.Group className="bg-default border-0 rounded-xl h-12">
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Search for prescriptions..." className="text-sm" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </View>
            </View>

            {isLoading && supplements.length === 0 ? (
              <ActivityIndicator size="small" color="#6366f1" className="py-6" />
            ) : filteredSupplements.length > 0 ? (
              <View className="gap-3">
                {filteredSupplements.map((supp, index) => {
                  const suppKey = supp.supplement_id || (supp as any).id || `supp_${index}`;
                  return (
                    <Card key={suppKey} variant="secondary" className="bg-surface border-0 rounded-xl p-4">
                    <View className="flex-row items-start gap-3 mb-4">
                      <View className="size-10 rounded-full bg-[#6366f1]/15 items-center justify-center mt-0.5">
                        <Ionicons name="medkit-outline" size={18} color="#6366f1" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground font-semibold text-base">{supp.supplement_type}</Text>
                        <Text className="text-zinc-400 text-sm">{supp.tablets_given_count} Tablets Prescribed</Text>
                      </View>
                    </View>
                    <View className="gap-2">
                      <View className="flex-row justify-between">
                        <Text className="text-zinc-400 text-sm">Status</Text>
                        <Text className={`text-sm font-medium ${supp.is_completed ? "text-[#10b981]" : "text-[#f59e0b]"}`}>
                          {supp.is_completed ? "Completed" : "In Progress"}
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-zinc-400 text-sm">Date Prescribed</Text>
                        <Text className="text-foreground text-sm font-medium">
                          {new Date(supp.date_given).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
              </View>
            ) : (
              <Card variant="secondary" className="bg-surface border-0 rounded-xl p-6 items-center py-8">
                <Ionicons name="medkit-outline" size={28} color="#71717a" className="mb-2" />
                <Text className="text-foreground font-semibold text-base mb-1">No Prescriptions</Text>
                <Text className="text-zinc-400 text-sm text-center">
                  You have no active prescriptions or supplements recorded.
                </Text>
              </Card>
            )}
          </View>
        )}
      </ScrollView>

      {/* Full Preview Image Modal */}
      <Modal
        visible={!!selectedImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSelectedImageModal(null);
          setSelectedRecord(null);
        }}
      >
        <View className="flex-1 bg-black/95 justify-between p-4 pt-12 pb-8">
          {/* Top Action Bar */}
          <View className="flex-row items-center justify-between px-2 pb-3 border-b border-white/10 z-20">
            <View className="flex-1 pr-3">
              <Text className="text-white font-bold text-base" numberOfLines={1}>
                {selectedRecord?.screening_type || "Document Preview"}
              </Text>
              {selectedRecord?.date_of_screening ? (
                <Text className="text-zinc-400 text-xs mt-0.5">
                  {new Date(selectedRecord.date_of_screening).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              ) : null}
            </View>

            <View className="flex-row items-center gap-2">
              {selectedRecord && (
                <Pressable
                  onPress={() => confirmDeleteRecord(selectedRecord)}
                  className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/20 active:bg-red-500/35 border border-red-500/30"
                >
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  <Text className="text-red-400 text-xs font-semibold">Delete</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  setSelectedImageModal(null);
                  setSelectedRecord(null);
                }}
                className="size-9 rounded-full bg-white/15 active:bg-white/25 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="white" />
              </Pressable>
            </View>
          </View>

          {/* Center Image */}
          <View className="flex-1 justify-center items-center my-4">
            {selectedImageModal && (
              <Image
                source={{ uri: selectedImageModal }}
                style={{ width: "100%", height: "100%" }}
                className="w-full h-full rounded-2xl"
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={!!recordToDelete}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeleting && setRecordToDelete(null)}
      >
        <Pressable
          onPress={() => !isDeleting && setRecordToDelete(null)}
          className="flex-1 bg-black/80 justify-center items-center p-5"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#16161C] border border-white/[0.12] rounded-3xl p-6 gap-4 shadow-2xl"
          >
            <View className="size-14 rounded-2xl bg-red-500/15 border border-red-500/30 items-center justify-center self-center">
              <Ionicons name="trash-outline" size={28} color="#ef4444" />
            </View>

            <View className="items-center gap-1">
              <Text className="text-white font-bold text-lg text-center">
                Delete Document
              </Text>
              <Text className="text-zinc-400 text-sm text-center">
                Are you sure you want to delete{" "}
                <Text className="text-white font-semibold">
                  {recordToDelete?.screening_type || "this document"}
                </Text>
                ? This action cannot be undone.
              </Text>
            </View>

            {deleteError && (
              <View className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <Text className="text-red-400 text-xs text-center">{deleteError}</Text>
              </View>
            )}

            <View className="flex-row items-center gap-3 pt-2">
              <Pressable
                disabled={isDeleting}
                onPress={() => setRecordToDelete(null)}
                className="flex-1 h-11 rounded-xl bg-[#25242A] border border-white/[0.08] items-center justify-center active:bg-[#302f36]"
              >
                <Text className="text-zinc-300 font-semibold text-sm">Cancel</Text>
              </Pressable>

              <Pressable
                disabled={isDeleting}
                onPress={handleDeleteRecord}
                className="flex-1 h-11 rounded-xl bg-red-600 items-center justify-center active:bg-red-700 flex-row gap-2"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="trash" size={16} color="white" />
                )}
                <Text className="text-white font-bold text-sm">
                  {isDeleting ? "Deleting..." : "Delete"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
