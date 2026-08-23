import { View, ScrollView, Pressable, ActivityIndicator, Image, Modal } from "react-native";
import { useState, useEffect } from "react";
import type { JSX } from "react";
import { Tabs, Card, SearchField, Text, Button } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { useAuth } from "../../context/UserContext";
import { getLabScreeningsByMotherApi, getSupplementsByMotherApi, API_BASE_URL } from "../../config/api";
import type { LabScreeningRecord, SupplementRecord } from "../../config/api";

export default function RecordsScreen(): JSX.Element {
  const router = useRouter();
  const { token, motherRecord } = useAuth();

  const [activeMainTab, setActiveMainTab] = useState("lab");
  const [activePrescriptionTab, setActivePrescriptionTab] = useState("medicine");
  const [searchLab, setSearchLab] = useState("");
  const [searchPrescription, setSearchPrescription] = useState("");

  const [labScreenings, setLabScreenings] = useState<LabScreeningRecord[]>([]);
  const [supplements, setSupplements] = useState<SupplementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (motherRecord?.mother_id && token) {
      setIsLoading(true);
      Promise.all([
        getLabScreeningsByMotherApi(motherRecord.mother_id, token),
        getSupplementsByMotherApi(motherRecord.mother_id, token),
      ])
        .then(([labs, supps]) => {
          if (isMounted) {
            setLabScreenings(labs);
            setSupplements(supps);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [motherRecord?.mother_id, token]);

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

  const getFullFileUrl = (url?: string) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  return (
    <View className="flex-1 bg-background">
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Main Tabs */}
        <View className="px-5 mb-5">
          <Tabs value={activeMainTab} onValueChange={setActiveMainTab} variant="primary">
            <Tabs.List className="bg-default p-1 rounded-xl">
              <Tabs.Indicator className="bg-surface-secondary rounded-xl" />
              <Tabs.Trigger value="lab">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                    Laboratory Records
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="prescriptions">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
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
            <View className="flex-row items-center justify-between mb-1">
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
            <Text className="text-muted text-sm mb-4">View uploaded maternal screening documents & lab results.</Text>

            <SearchField value={searchLab} onChange={setSearchLab}>
              <SearchField.Group className="bg-default border-0 rounded-xl h-12 mb-5">
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search for laboratory records..." className="text-sm" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>

            {isLoading ? (
              <ActivityIndicator size="small" color="#6366f1" className="py-8" />
            ) : filteredLabs.length > 0 ? (
              <View className="gap-3.5">
                {filteredLabs.map((lab) => {
                  const fileUrl = getFullFileUrl(lab.file_url);
                  const dateStr = lab.date_of_screening
                    ? new Date(lab.date_of_screening).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "";

                  return (
                    <Card key={lab.screening_id} variant="secondary" className="bg-surface border-0 rounded-2xl p-4">
                      <View className="flex-row items-start justify-between mb-2">
                        <View className="flex-row items-center gap-3 flex-1 pr-2">
                          <View className="size-10 rounded-xl bg-primary/15 items-center justify-center">
                            <Ionicons name="document-text-outline" size={20} color="#0284c7" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-foreground font-semibold text-base" numberOfLines={1}>
                              {lab.screening_type}
                            </Text>
                            <Text className="text-muted text-xs">{dateStr || "Screening Record"}</Text>
                          </View>
                        </View>

                        <View className="px-2.5 py-1 rounded-full bg-emerald-500/15">
                          <Text className="text-emerald-400 text-xs font-semibold">
                            {lab.result || "Uploaded"}
                          </Text>
                        </View>
                      </View>

                      {/* Display Image thumbnail if file_url exists */}
                      {fileUrl ? (
                        <Pressable onPress={() => setSelectedImageModal(fileUrl)} className="mt-2.5 mb-2">
                          <Image
                            source={{ uri: fileUrl }}
                            className="w-full h-44 rounded-xl bg-default/40"
                            resizeMode="cover"
                          />
                          <View className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded-md flex-row items-center gap-1">
                            <Ionicons name="eye-outline" size={12} color="white" />
                            <Text className="text-white text-[11px] font-medium">View Full Image</Text>
                          </View>
                        </Pressable>
                      ) : null}

                      {lab.remarks ? (
                        <Text className="text-muted text-xs mt-1" numberOfLines={2}>
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
                <Text className="text-muted text-xs text-center max-w-xs mb-4">
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
                  <Button.Label className="text-xs font-semibold">Upload First Record</Button.Label>
                </Button>
              </Card>
            )}
          </View>
        )}

        {/* Prescriptions Tab */}
        {activeMainTab === "prescriptions" && (
          <View className="px-5">
            <Text className="text-foreground text-lg font-semibold mb-1">Prescriptions</Text>
            <Text className="text-muted text-sm mb-4">View your active maternal health prescriptions and supplements.</Text>

            <View className="mb-5 flex-row items-center gap-3">
              <View className="flex-1">
                <SearchField value={searchPrescription} onChange={setSearchPrescription}>
                  <SearchField.Group className="bg-default border-0 rounded-xl h-12">
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Search for medicine..." className="text-sm" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </View>
            </View>

            {/* Prescription sub-tabs */}
            <View className="mb-5">
              <Tabs value={activePrescriptionTab} onValueChange={setActivePrescriptionTab} variant="primary">
                <Tabs.List className="bg-default p-1 rounded-xl">
                  <Tabs.Indicator className="bg-surface-secondary rounded-xl" />
                  <Tabs.Trigger value="medicine">
                    {({ isSelected }) => (
                      <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                        Medicine
                      </Tabs.Label>
                    )}
                  </Tabs.Trigger>
                  <Tabs.Trigger value="supplement">
                    {({ isSelected }) => (
                      <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                        Supplement
                      </Tabs.Label>
                    )}
                  </Tabs.Trigger>
                </Tabs.List>
              </Tabs>
            </View>

            {isLoading ? (
              <ActivityIndicator size="small" color="#6366f1" className="py-6" />
            ) : filteredSupplements.length > 0 ? (
              <View className="gap-3">
                {filteredSupplements.map((supp) => (
                  <Card key={supp.supplement_id} variant="secondary" className="bg-surface border-0 rounded-xl p-4">
                    <View className="flex-row items-start gap-3 mb-4">
                      <View className="size-10 rounded-full bg-[#6366f1]/15 items-center justify-center mt-0.5">
                        <Ionicons name="medkit-outline" size={18} color="#6366f1" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground font-semibold text-base">{supp.supplement_type}</Text>
                        <Text className="text-muted text-sm">{supp.tablets_given_count} Tablets Prescribed</Text>
                      </View>
                    </View>
                    <View className="gap-2">
                      <View className="flex-row justify-between">
                        <Text className="text-muted text-sm">Status</Text>
                        <Text className={`text-sm font-medium ${supp.is_completed ? "text-[#10b981]" : "text-[#f59e0b]"}`}>
                          {supp.is_completed ? "Completed" : "In Progress"}
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-muted text-sm">Date Prescribed</Text>
                        <Text className="text-foreground text-sm font-medium">
                          {new Date(supp.date_given).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            ) : (
              <Card variant="secondary" className="bg-surface border-0 rounded-xl p-6 items-center py-8">
                <Ionicons name="medkit-outline" size={28} color="#71717a" className="mb-2" />
                <Text className="text-foreground font-semibold text-base mb-1">No Prescriptions</Text>
                <Text className="text-muted text-sm text-center">
                  You have no active prescriptions or supplements recorded.
                </Text>
              </Card>
            )}
          </View>
        )}
      </ScrollView>

      {/* Full Preview Image Modal */}
      <Modal visible={!!selectedImageModal} transparent animationType="fade" onRequestClose={() => setSelectedImageModal(null)}>
        <View className="flex-1 bg-black/90 justify-center items-center p-4">
          <Pressable
            onPress={() => setSelectedImageModal(null)}
            className="absolute top-12 right-5 z-10 size-10 rounded-full bg-white/20 items-center justify-center"
          >
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
          {selectedImageModal && (
            <Image
              source={{ uri: selectedImageModal }}
              className="w-full h-4/5 rounded-2xl"
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
