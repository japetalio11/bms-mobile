import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import type { JSX } from "react";
import { Tabs, Card, SearchField, Text, Button } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { useAuth } from "../../context/UserContext";
import { getLabScreeningsByMotherApi, getSupplementsByMotherApi } from "../../config/api";
import type { LabScreeningRecord, SupplementRecord } from "../../config/api";

const defaultLabCards = [
  { title: "Complete Blood Count", color: "#6366f1", type: "cbc" },
  { title: "Urinalysis", color: "#3b82f6", route: "/(tabs)/urinalysis", type: "urinalysis" },
  { title: "Blood Typing", color: "#10b981", type: "blood_typing" },
  { title: "Hepatitis B Screening", color: "#f59e0b", type: "hep_b" },
];

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

  useEffect(() => {
    let isMounted = true;
    if (motherRecord?.mother_id && token) {
      getLabScreeningsByMotherApi(motherRecord.mother_id, token)
        .then((res) => { if (isMounted) setLabScreenings(res); })
        .catch(() => {});

      getSupplementsByMotherApi(motherRecord.mother_id, token)
        .then((res) => { if (isMounted) setSupplements(res); })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [motherRecord?.mother_id, token]);

  const filteredLabs = defaultLabCards.filter((card) => {
    if (!searchLab.trim()) return true;
    return card.title.toLowerCase().includes(searchLab.toLowerCase());
  });

  const filteredSupplements = supplements.filter((supp) => {
    if (!searchPrescription.trim()) return true;
    return supp.supplement_type.toLowerCase().includes(searchPrescription.toLowerCase());
  });

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

        {/* Lab Records Tab */}
        {activeMainTab === "lab" && (
          <View className="px-5">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-foreground text-lg font-semibold">Laboratory Records</Text>
              <Button 
                size="sm" 
                variant="primary" 
                className="rounded-xl px-3"
                onPress={() => router.push("/(tabs)/upload-record")}
              >
                <Button.Label className="text-sm font-medium">Upload</Button.Label>
              </Button>
            </View>
            <Text className="text-muted text-sm mb-4">View your maternal health screening records and lab results.</Text>

            <SearchField value={searchLab} onChange={setSearchLab}>
              <SearchField.Group className="bg-default border-0 rounded-xl h-12 mb-5">
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search for laboratory records..." className="text-sm" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>

            {isLoading ? (
              <ActivityIndicator size="small" color="#6366f1" className="py-6" />
            ) : (
              <View className="flex-row flex-wrap justify-between">
                {filteredLabs.map((item, index) => {
                  const matchingRecord = labScreenings.find((s) =>
                    s.screening_type.toLowerCase().includes(item.type) ||
                    item.title.toLowerCase().includes(s.screening_type.toLowerCase())
                  );

                  return (
                    <Pressable
                      key={index}
                      className="w-[48%] mb-4"
                      onPress={() => {
                        if (item.route) {
                          router.push(item.route as any);
                        } else {
                          router.push("/(tabs)/urinalysis");
                        }
                      }}
                    >
                      <Card variant="secondary" className="bg-surface border-0 rounded-xl overflow-hidden" style={{ height: 160 }}>
                        <View
                          className="flex-1 items-center justify-center"
                          style={{ backgroundColor: item.color + "18" }}
                        >
                          <View
                            className="size-12 rounded-full items-center justify-center"
                            style={{ backgroundColor: item.color + "30" }}
                          >
                            <Ionicons name="document-text-outline" size={24} color={item.color} />
                          </View>
                        </View>
                        <Card.Body className="px-3 py-2 flex-none bg-surface">
                          <Text className="text-foreground text-sm font-semibold leading-tight">{item.title}</Text>
                          <Text className="text-muted text-sm mt-0.5">
                            {matchingRecord ? matchingRecord.result : "No file recorded"}
                          </Text>
                        </Card.Body>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
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
    </View>
  );
}
