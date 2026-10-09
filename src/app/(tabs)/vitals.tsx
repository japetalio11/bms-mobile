import { View, ScrollView, RefreshControl, Pressable } from "react-native";
import { Text, Card, Tabs } from "heroui-native";
import { Header } from "../../components/Header";
import { useState, useEffect, useMemo } from "react";
import type { JSX } from "react";
import { useAuth } from "../../context/UserContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getDeliveryOutcomesLocal } from "../../db/repository";
import type { DeliveryOutcomeRecord, PrenatalVisitRecord } from "../../config/api";

interface EnrichedNewborn {
  id: string;
  nameOrLabel: string;
  shortLabel: string;
  newborn_id: string;
  delivery_id: string;
  pregnancy_id?: string;
  sex: string;
  birth_weight_kg: number | string;
  status_at_birth: string;
  apgar_score: number;
  created_at?: string;
  delivery_date?: string;
  place_of_delivery?: string;
  mode_of_delivery?: string;
  duration_of_labor_hours?: number | string;
  blood_loss_ml?: number;
  delivery_complications?: string;
  pregnancyLabel?: string;
  siblingCount: number;
  siblingIndex: number;
}

const InsetRow = ({
  label,
  value,
  subvalue,
  badge,
  isLast = false,
}: {
  label: string;
  value?: string | number | null;
  subvalue?: string | null;
  badge?: React.ReactNode;
  isLast?: boolean;
}) => (
  <View
    className={`flex-row items-center justify-between py-3.5 px-4 ${
      isLast ? "" : "border-b border-separator/30 dark:border-zinc-800/80"
    } gap-3`}
  >
    <Text className="text-zinc-500 dark:text-zinc-400 text-sm font-normal shrink-0">
      {label}
    </Text>
    <View className="flex-1 items-end justify-center">
      {badge ? (
        <View className="flex-row items-center gap-2">
          {badge}
          {value !== undefined && value !== null && (
            <Text className="text-foreground text-sm font-semibold text-right">
              {value}
            </Text>
          )}
        </View>
      ) : (
        <View className="items-end">
          <Text className="text-foreground text-sm font-semibold text-right">
            {value ?? "—"}
          </Text>
          {subvalue ? (
            <Text className="text-zinc-400 dark:text-zinc-500 text-xs text-right mt-0.5">
              {subvalue}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  </View>
);

const getApgarAssessment = (score: number) => {
  if (score >= 7) {
    return {
      label: "Reassuring",
      color: "#10b981",
      badgeBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      textColor: "text-emerald-600 dark:text-emerald-400",
    };
  }
  if (score >= 4) {
    return {
      label: "Moderately Depressed",
      color: "#f59e0b",
      badgeBg: "bg-amber-500/10 dark:bg-amber-500/20",
      textColor: "text-amber-600 dark:text-amber-400",
    };
  }
  return {
    label: "Critical",
    color: "#ef4444",
    badgeBg: "bg-rose-500/10 dark:bg-rose-500/20",
    textColor: "text-rose-600 dark:text-rose-400",
  };
};

export default function VitalsScreen(): JSX.Element {
  const router = useRouter();
  const [activeMainTab, setActiveMainTab] = useState<string>("maternal");
  const [selectedNewbornId, setSelectedNewbornId] = useState<string>("all");
  const { activePregnancy, motherRecord, user, refreshProfile } = useAuth();
  const [localDeliveries, setLocalDeliveries] = useState<DeliveryOutcomeRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadLocalDeliveries = async () => {
    const mid = motherRecord?.mother_id || user?.user_id;
    if (mid) {
      try {
        const outcomes = await getDeliveryOutcomesLocal(mid);
        if (outcomes.length > 0) {
          setLocalDeliveries(outcomes);
        }
      } catch (e) {
        console.warn("Failed to load local delivery outcomes:", e);
      }
    }
  };

  useEffect(() => {
    loadLocalDeliveries();
  }, [motherRecord?.mother_id, user?.user_id]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshProfile(), loadLocalDeliveries()]);
    setIsRefreshing(false);
  };

  // Compile all maternal prenatal visits
  const allVisits = useMemo<PrenatalVisitRecord[]>(() => {
    const list: PrenatalVisitRecord[] = [];
    if (activePregnancy?.prenatalVisits) {
      list.push(...activePregnancy.prenatalVisits);
    }
    if (motherRecord?.pregnancies) {
      for (const preg of motherRecord.pregnancies) {
        if (preg.prenatalVisits) {
          for (const v of preg.prenatalVisits) {
            if (!list.some((existing) => existing.visit_id === v.visit_id)) {
              list.push(v);
            }
          }
        }
      }
    }
    return list.sort(
      (a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
    );
  }, [activePregnancy, motherRecord]);

  const latestVisit = allVisits[0] || null;

  // Compile and enrich all newborns across all deliveries and pregnancies
  const { allDeliveries, allNewborns } = useMemo(() => {
    const deliveryMap = new Map<string, DeliveryOutcomeRecord & { pregnancyLabel?: string }>();

    for (const d of localDeliveries) {
      if (d.delivery_id) {
        deliveryMap.set(d.delivery_id, { ...d });
      }
    }

    if (activePregnancy?.deliveryOutcomes) {
      for (const d of activePregnancy.deliveryOutcomes) {
        if (d.delivery_id) {
          const existing = deliveryMap.get(d.delivery_id);
          deliveryMap.set(d.delivery_id, {
            ...existing,
            ...d,
            newbornRecords: d.newbornRecords || existing?.newbornRecords || [],
            pregnancyLabel: `Current Pregnancy (Gravida ${activePregnancy.gravida || 1})`,
          });
        }
      }
    }

    if (motherRecord?.pregnancies) {
      for (let i = 0; i < motherRecord.pregnancies.length; i++) {
        const preg = motherRecord.pregnancies[i];
        const pLabel = `Pregnancy #${motherRecord.pregnancies.length - i} (G${preg.gravida || i + 1}P${preg.parity || 0})`;
        if (preg.deliveryOutcomes) {
          for (const d of preg.deliveryOutcomes) {
            if (d.delivery_id) {
              const existing = deliveryMap.get(d.delivery_id);
              deliveryMap.set(d.delivery_id, {
                ...existing,
                ...d,
                newbornRecords: d.newbornRecords || existing?.newbornRecords || [],
                pregnancyLabel: existing?.pregnancyLabel || pLabel,
              });
            }
          }
        }
      }
    }

    const deliveries = Array.from(deliveryMap.values()).sort(
      (a, b) => new Date(b.delivery_date || 0).getTime() - new Date(a.delivery_date || 0).getTime()
    );

    const newborns: EnrichedNewborn[] = [];
    const seenIds = new Set<string>();

    deliveries.forEach((d, dIdx) => {
      const records = d.newbornRecords || [];
      const totalInDeliv = records.length;
      records.forEach((nb, nbIdx) => {
        const nbKey = nb.newborn_id || `${d.delivery_id}_nb_${nbIdx}`;
        if (!seenIds.has(nbKey)) {
          seenIds.add(nbKey);

          let label = "Newborn Infant";
          let shortLabel = "Baby 1";
          if (totalInDeliv > 1) {
            const letter = String.fromCharCode(65 + nbIdx);
            label = `Baby ${letter} (Twin ${nbIdx + 1})`;
            shortLabel = `Baby ${letter}`;
          } else if (deliveries.length > 1) {
            label = `Child #${deliveries.length - dIdx}`;
            shortLabel = `Child #${deliveries.length - dIdx}`;
          } else {
            label = `Infant #${nbIdx + 1}`;
            shortLabel = `Baby ${nbIdx + 1}`;
          }

          newborns.push({
            id: nbKey,
            nameOrLabel: label,
            shortLabel,
            newborn_id: nb.newborn_id,
            delivery_id: d.delivery_id,
            pregnancy_id: d.pregnancy_id,
            sex: nb.sex || "Not specified",
            birth_weight_kg: nb.birth_weight_kg,
            status_at_birth: nb.status_at_birth || "Live Birth",
            apgar_score: Number(nb.apgar_score) || 0,
            created_at: nb.created_at,
            delivery_date: d.delivery_date,
            place_of_delivery: d.place_of_delivery,
            mode_of_delivery: d.mode_of_delivery,
            duration_of_labor_hours: d.duration_of_labor_hours,
            blood_loss_ml: d.blood_loss_ml,
            delivery_complications: d.delivery_complications,
            pregnancyLabel: d.pregnancyLabel,
            siblingCount: totalInDeliv,
            siblingIndex: nbIdx + 1,
          });
        }
      });
    });

    return { allDeliveries: deliveries, allNewborns: newborns };
  }, [localDeliveries, activePregnancy, motherRecord]);

  const filteredNewborns = useMemo(() => {
    if (selectedNewbornId === "all") return allNewborns;
    return allNewborns.filter((nb) => nb.id === selectedNewbornId);
  }, [allNewborns, selectedNewbornId]);

  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Vitals & Analytics" onBack={() => router.back()} rightIcon={null} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        {/* iOS Native Segmented Tab Control */}
        <View className="px-5 mb-5 pt-2">
          <Tabs value={activeMainTab} onValueChange={setActiveMainTab} variant="primary">
            <Tabs.List className="bg-default p-1 rounded-2xl flex-row w-full h-11 items-center">
              <Tabs.Indicator className="bg-surface rounded-xl shadow-xs" />
              <Tabs.Trigger value="maternal" className="flex-1 items-center justify-center h-9">
                {({ isSelected }) => (
                  <Tabs.Label
                    className={`font-semibold text-sm text-center ${
                      isSelected ? "text-foreground font-bold" : "text-zinc-400"
                    }`}
                  >
                    Maternal Vitals
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="newborn" className="flex-1 items-center justify-center h-9">
                {({ isSelected }) => (
                  <View className="flex-row items-center gap-1.5 justify-center">
                    <Tabs.Label
                      className={`font-semibold text-sm text-center ${
                        isSelected ? "text-foreground font-bold" : "text-zinc-400"
                      }`}
                    >
                      Newborn Records
                    </Tabs.Label>
                    {allNewborns.length > 0 && (
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                        }}
                        className={`items-center justify-center ${
                          isSelected ? "bg-primary/20" : "bg-zinc-500/15"
                        }`}
                      >
                        <Text
                          style={{
                            includeFontPadding: false,
                            textAlignVertical: "center",
                            lineHeight: 12,
                          }}
                          className={`text-[10px] font-bold text-center ${
                            isSelected ? "text-primary" : "text-zinc-400"
                          }`}
                        >
                          {allNewborns.length}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </View>

        {/* Maternal Tab Content */}
        {activeMainTab === "maternal" && (
          <View className="px-5 gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground text-lg font-bold">Maternal Health Log</Text>
              {allVisits.length > 1 && (
                <Text className="text-zinc-400 text-xs font-medium">
                  {allVisits.length} recorded visits
                </Text>
              )}
            </View>

            {latestVisit ? (
              <View className="gap-4">
                <View className="flex-row items-center justify-between px-1">
                  <Text className="text-zinc-500 dark:text-zinc-400 text-xs font-medium">
                    Latest checkup:{" "}
                    {new Date(latestVisit.visit_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                  <Text className="text-primary text-xs font-semibold">
                    Visit #{latestVisit.visit_number || 1} · Tri {latestVisit.trimester || 1}
                  </Text>
                </View>

                {/* Inset Grouped Card */}
                <Card variant="secondary" className="bg-surface border-0 rounded-2xl overflow-hidden p-0">
                  <InsetRow
                    label="Blood Pressure"
                    value={`${latestVisit.bp_systolic}/${latestVisit.bp_diastolic}`}
                    subvalue="mmHg (Systolic/Diastolic)"
                  />
                  <InsetRow
                    label="Heart Rate"
                    value={`${latestVisit.pulse_rate_bpm}`}
                    subvalue="beats per min (bpm)"
                  />
                  <InsetRow
                    label="Body Temperature"
                    value={`${latestVisit.temperature_celsius} °C`}
                  />
                  <InsetRow
                    label="Maternal Weight"
                    value={`${latestVisit.weight_kg} kg`}
                  />
                  {latestVisit.fundic_height_cm ? (
                    <InsetRow
                      label="Fundic Height"
                      value={`${latestVisit.fundic_height_cm} cm`}
                    />
                  ) : null}
                  {latestVisit.fetal_heart_tone_bpm ? (
                    <InsetRow
                      label="Fetal Heart Tone"
                      value={`${latestVisit.fetal_heart_tone_bpm} bpm`}
                    />
                  ) : null}
                  {latestVisit.age_of_gestation_weeks ? (
                    <InsetRow
                      label="Gestational Age"
                      value={`${latestVisit.age_of_gestation_weeks} weeks`}
                    />
                  ) : null}
                  {latestVisit.risk_level_assessed ? (
                    <InsetRow
                      label="Risk Level Assessed"
                      value={latestVisit.risk_level_assessed}
                      badge={
                        <View
                          className={`px-2 py-0.5 rounded-md ${
                            latestVisit.risk_level_assessed.toLowerCase().includes("high")
                              ? "bg-rose-500/15"
                              : "bg-emerald-500/15"
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              latestVisit.risk_level_assessed.toLowerCase().includes("high")
                                ? "text-rose-500"
                                : "text-emerald-500"
                            }`}
                          >
                            {latestVisit.risk_level_assessed}
                          </Text>
                        </View>
                      }
                      isLast
                    />
                  ) : null}
                </Card>
              </View>
            ) : (
              <Card variant="secondary" className="bg-surface border-0 rounded-2xl p-8 items-center py-12">
                <View className="size-14 rounded-2xl bg-zinc-500/10 items-center justify-center mb-3">
                  <Ionicons name="pulse" size={26} color="#71717a" />
                </View>
                <Text className="text-foreground font-bold text-base mb-1">No Recorded Vitals</Text>
                <Text className="text-zinc-500 dark:text-zinc-400 text-sm text-center leading-5 max-w-xs">
                  Prenatal vitals will be updated and synchronized after your routine clinic visits.
                </Text>
              </Card>
            )}
          </View>
        )}

        {/* Newborn Tab Content */}
        {activeMainTab === "newborn" && (
          <View className="px-5 gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground text-lg font-bold">Newborn & Infant Records</Text>
              {allNewborns.length > 0 && (
                <Text className="text-zinc-500 dark:text-zinc-400 text-xs font-medium">
                  {allNewborns.length} {allNewborns.length === 1 ? "infant" : "infants"} total
                </Text>
              )}
            </View>

            {allNewborns.length === 0 ? (
              <Card variant="secondary" className="bg-surface border-0 rounded-2xl p-8 items-center py-12">
                <View className="size-16 rounded-full bg-primary/10 items-center justify-center mb-3">
                  <Ionicons name="heart-outline" size={28} color="#0284c7" />
                </View>
                <Text className="text-foreground font-bold text-base mb-1">Expectant Care Mode</Text>
                <Text className="text-zinc-500 dark:text-zinc-400 text-sm text-center leading-5 max-w-xs">
                  Infant birth and delivery records will be logged automatically by your healthcare provider upon delivery.
                </Text>
              </Card>
            ) : (
              <View className="gap-4">
                {/* Secondary Compact Selector if Multiple Newborns */}
                {allNewborns.length > 1 && (
                  allNewborns.length <= 3 ? (
                    <View className="flex-row bg-default/70 dark:bg-zinc-800/70 p-1 rounded-xl gap-1">
                      <Pressable
                        onPress={() => setSelectedNewbornId("all")}
                        className={`flex-1 py-1.5 px-2 rounded-lg flex-row items-center justify-center gap-1.5 ${
                          selectedNewbornId === "all"
                            ? "bg-surface shadow-xs"
                            : "bg-transparent"
                        }`}
                      >
                        <Ionicons
                          name="people"
                          size={13}
                          color={selectedNewbornId === "all" ? "#0284c7" : "#a1a1aa"}
                        />
                        <Text
                          numberOfLines={1}
                          className={`text-xs ${
                            selectedNewbornId === "all"
                              ? "text-primary font-bold"
                              : "text-zinc-500 dark:text-zinc-400 font-medium"
                          }`}
                        >
                          All ({allNewborns.length})
                        </Text>
                      </Pressable>

                      {allNewborns.map((nb, index) => {
                        const isSelected = selectedNewbornId === nb.id;
                        const isMale = nb.sex.toLowerCase().includes("male");
                        return (
                          <Pressable
                            key={nb.id}
                            onPress={() => setSelectedNewbornId(nb.id)}
                            className={`flex-1 py-1.5 px-2 rounded-lg flex-row items-center justify-center gap-1.5 ${
                              isSelected
                                ? "bg-surface shadow-xs"
                                : "bg-transparent"
                            }`}
                          >
                            <Ionicons
                              name={isMale ? "male" : "female"}
                              size={13}
                              color={
                                isSelected
                                  ? isMale
                                    ? "#3b82f6"
                                    : "#ec4899"
                                  : "#a1a1aa"
                              }
                            />
                            <Text
                              numberOfLines={1}
                              className={`text-xs ${
                                isSelected
                                  ? isMale
                                    ? "text-blue-600 dark:text-blue-400 font-bold"
                                    : "text-pink-600 dark:text-pink-400 font-bold"
                                  : "text-zinc-500 dark:text-zinc-400 font-medium"
                              }`}
                            >
                              {nb.shortLabel || `Baby ${index + 1}`}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="py-1 -mx-5 px-5"
                      contentContainerStyle={{ gap: 8, paddingRight: 20 }}
                    >
                      <Pressable
                        onPress={() => setSelectedNewbornId("all")}
                        className={`px-3 py-1.5 rounded-xl flex-row items-center gap-1.5 ${
                          selectedNewbornId === "all"
                            ? "bg-primary shadow-xs"
                            : "bg-surface border border-separator/40 dark:border-zinc-800"
                        }`}
                      >
                        <Ionicons
                          name="people"
                          size={13}
                          color={selectedNewbornId === "all" ? "#ffffff" : "#a1a1aa"}
                        />
                        <Text
                          className={`text-xs font-semibold ${
                            selectedNewbornId === "all" ? "text-white" : "text-foreground"
                          }`}
                        >
                          All ({allNewborns.length})
                        </Text>
                      </Pressable>

                      {allNewborns.map((nb, index) => {
                        const isSelected = selectedNewbornId === nb.id;
                        const isMale = nb.sex.toLowerCase().includes("male");
                        return (
                          <Pressable
                            key={nb.id}
                            onPress={() => setSelectedNewbornId(nb.id)}
                            className={`px-3 py-1.5 rounded-xl flex-row items-center gap-1.5 ${
                              isSelected
                                ? isMale
                                  ? "bg-blue-600 shadow-xs"
                                  : "bg-pink-600 shadow-xs"
                                : "bg-surface border border-separator/40 dark:border-zinc-800"
                            }`}
                          >
                            <Ionicons
                              name={isMale ? "male" : "female"}
                              size={13}
                              color={isSelected ? "#ffffff" : isMale ? "#3b82f6" : "#ec4899"}
                            />
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? "text-white" : "text-foreground"
                              }`}
                            >
                              {nb.shortLabel || `Baby ${index + 1}`}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )
                )}

                {/* List of Newborn Cards */}
                {filteredNewborns.map((nb, index) => {
                  const apgarInfo = getApgarAssessment(nb.apgar_score);
                  const isMale = nb.sex.toLowerCase().includes("male");
                  const formattedDate = nb.delivery_date
                    ? new Date(nb.delivery_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Recorded Delivery";

                  return (
                    <View key={nb.id} className="gap-2 mb-2">
                      {/* Section Title for each child */}
                      <View className="flex-row items-center justify-between px-1">
                        <View className="flex-row items-center gap-2 flex-1 mr-2">
                          <View
                            className={`size-6 rounded-full items-center justify-center shrink-0 ${
                              isMale ? "bg-blue-500/15" : "bg-pink-500/15"
                            }`}
                          >
                            <Ionicons
                              name={isMale ? "male" : "female"}
                              size={12}
                              color={isMale ? "#3b82f6" : "#ec4899"}
                            />
                          </View>
                          <Text
                            className="text-foreground font-bold text-sm flex-1"
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {nb.nameOrLabel}
                          </Text>
                        </View>
                        <Text className="text-zinc-500 dark:text-zinc-400 text-xs font-medium shrink-0">
                          {formattedDate}
                        </Text>
                      </View>

                      {/* Inset Grouped List Card */}
                      <Card
                        variant="secondary"
                        className="bg-surface border-0 rounded-2xl overflow-hidden p-0"
                      >
                        <InsetRow
                          label="Biological Sex"
                          value={nb.sex}
                          badge={
                            <View
                              className={`px-2 py-0.5 rounded-md ${
                                isMale ? "bg-blue-500/15" : "bg-pink-500/15"
                              }`}
                            >
                              <Text
                                className={`text-xs font-semibold ${
                                  isMale ? "text-blue-500" : "text-pink-500"
                                }`}
                              >
                                {nb.sex}
                              </Text>
                            </View>
                          }
                        />
                        <InsetRow
                          label="Birth Weight"
                          value={`${nb.birth_weight_kg} kg`}
                          subvalue={
                            Number(nb.birth_weight_kg) < 2.5
                              ? "Low birth weight"
                              : Number(nb.birth_weight_kg) > 4.0
                              ? "High birth weight"
                              : "Healthy birth range"
                          }
                        />
                        <InsetRow
                          label="APGAR Score"
                          value={`${nb.apgar_score} / 10`}
                          badge={
                            <View className={`px-2 py-0.5 rounded-md ${apgarInfo.badgeBg}`}>
                              <Text className={`text-xs font-semibold ${apgarInfo.textColor}`}>
                                {apgarInfo.label}
                              </Text>
                            </View>
                          }
                        />
                        <InsetRow
                          label="Status at Birth"
                          value={nb.status_at_birth}
                        />
                        {nb.mode_of_delivery && (
                          <InsetRow
                            label="Mode of Delivery"
                            value={nb.mode_of_delivery}
                          />
                        )}
                        {nb.place_of_delivery && (
                          <InsetRow
                            label="Facility / Place"
                            value={nb.place_of_delivery}
                          />
                        )}
                        {nb.duration_of_labor_hours ? (
                          <InsetRow
                            label="Labor Duration"
                            value={`${nb.duration_of_labor_hours} hours`}
                          />
                        ) : null}
                        {nb.delivery_complications ? (
                          <InsetRow
                            label="Complications"
                            value={nb.delivery_complications}
                            isLast
                          />
                        ) : (
                          <InsetRow
                            label="Delivery Notes"
                            value="Normal without complications"
                            isLast
                          />
                        )}
                      </Card>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

