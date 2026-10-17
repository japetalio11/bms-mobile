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
import { triggerSelectionHaptic } from "../../lib/haptics";

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
    <Text className="text-zinc-500 dark:text-zinc-400 text-sm font-normal shrink-0">{label}</Text>
    <View className="flex-1 items-end justify-center">
      {badge ? (
        <View className="flex-row items-center gap-2">
          {badge}
          {value !== undefined && value !== null && (
            <Text className="text-foreground text-sm font-semibold text-right">{value}</Text>
          )}
        </View>
      ) : (
        <View className="items-end">
          <Text className="text-foreground text-sm font-semibold text-right">{value ?? "—"}</Text>
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

const RangeSpectrumBar = ({
  percentage,
  labels = ["Low", "Optimal", "High"],
  markerColor = "#10b981",
}: {
  percentage: number;
  labels?: [string, string, string];
  markerColor?: string;
}) => {
  const clamped = Math.max(6, Math.min(94, percentage));
  return (
    <View className="mt-3.5 mb-1">
      <View className="h-2 rounded-full flex-row overflow-hidden bg-zinc-200 dark:bg-zinc-800">
        <View className="w-1/4 bg-blue-400/50" />
        <View className="w-1/2 bg-emerald-500/80" />
        <View className="w-1/4 bg-rose-400/60" />
      </View>
      <View
        style={{
          position: "absolute",
          top: -3,
          left: `${clamped}%`,
          marginLeft: -7,
          backgroundColor: markerColor,
        }}
        className="size-3.5 rounded-full border-2 border-white dark:border-zinc-950 shadow-xs"
      />
      <View className="flex-row justify-between items-center mt-2 px-0.5">
        <Text className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
          {labels[0]}
        </Text>
        <Text className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          {labels[1]}
        </Text>
        <Text className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
          {labels[2]}
        </Text>
      </View>
    </View>
  );
};

const getBpAssessment = (systolic?: number | null, diastolic?: number | null) => {
  if (!systolic || !diastolic) return null;
  const sys = Number(systolic);
  const dia = Number(diastolic);
  if (isNaN(sys) || isNaN(dia)) return null;

  if (sys < 90 || dia < 60) {
    return {
      status: "Low",
      title: "Low Blood Pressure",
      note: "Mild hypotension can happen in early pregnancy. Rest and hydrate.",
      badgeBg: "bg-blue-500/10 dark:bg-blue-500/20",
      badgeText: "text-blue-600 dark:text-blue-400",
      accentColor: "#3b82f6",
      percentage: 18,
    };
  }
  if (sys < 120 && dia < 80) {
    return {
      status: "Optimal",
      title: "Healthy & Optimal Range",
      note: "Both systolic and diastolic pressures are inside reassuring clinical targets.",
      badgeBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      badgeText: "text-emerald-600 dark:text-emerald-400",
      accentColor: "#10b981",
      percentage: 50,
    };
  }
  if (sys < 130 && dia < 80) {
    return {
      status: "Elevated",
      title: "Slightly Elevated",
      note: "A slight rise above normal. Continue monitoring at upcoming appointments.",
      badgeBg: "bg-amber-500/10 dark:bg-amber-500/20",
      badgeText: "text-amber-600 dark:text-amber-400",
      accentColor: "#f59e0b",
      percentage: 72,
    };
  }
  return {
    status: "High",
    title: "High Blood Pressure",
    note: "Clinical attention recommended to monitor for preeclampsia risks.",
    badgeBg: "bg-rose-500/10 dark:bg-rose-500/20",
    badgeText: "text-rose-600 dark:text-rose-400",
    accentColor: "#ef4444",
    percentage: 88,
  };
};

const getFhtAssessment = (bpm?: number | null) => {
  if (!bpm) return null;
  const val = Number(bpm);
  if (isNaN(val)) return null;

  if (val < 110) {
    return {
      status: "Slow (<110)",
      title: "Slow Fetal Rhythm",
      note: "Below the typical 110-160 bpm baseline. Consult your midwife.",
      badgeBg: "bg-amber-500/10 dark:bg-amber-500/20",
      badgeText: "text-amber-600 dark:text-amber-400",
      accentColor: "#f59e0b",
      percentage: 20,
    };
  }
  if (val <= 160) {
    return {
      status: "Reassuring",
      title: "Normal Fetal Heart Rhythm",
      note: "Baby's heart rate is inside the safe 110–160 bpm physiological window.",
      badgeBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      badgeText: "text-emerald-600 dark:text-emerald-400",
      accentColor: "#10b981",
      percentage: 52,
    };
  }
  return {
    status: "Rapid (>160)",
    title: "Rapid Fetal Rhythm",
    note: "Above standard baseline. May occur during periods of fetal movement.",
    badgeBg: "bg-amber-500/10 dark:bg-amber-500/20",
    badgeText: "text-amber-600 dark:text-amber-400",
    accentColor: "#f59e0b",
    percentage: 85,
  };
};

const getPulseAssessment = (pulse?: number | null) => {
  if (!pulse) return null;
  const p = Number(pulse);
  if (isNaN(p)) return null;

  if (p >= 60 && p <= 100) {
    return {
      status: "Normal",
      badgeBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      badgeText: "text-emerald-600 dark:text-emerald-400",
    };
  }
  return {
    status: p < 60 ? "Low" : "Elevated",
    badgeBg: "bg-amber-500/10 dark:bg-amber-500/20",
    badgeText: "text-amber-600 dark:text-amber-400",
  };
};

export default function VitalsScreen(): JSX.Element {
  const router = useRouter();
  const [activeMainTab, setActiveMainTab] = useState<string>("maternal");
  const [selectedNewbornId, setSelectedNewbornId] = useState<string>("all");
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
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
    return list.sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
  }, [activePregnancy, motherRecord]);

  const activeVisit = useMemo<PrenatalVisitRecord | null>(() => {
    if (!allVisits.length) return null;
    if (selectedVisitId) {
      const found = allVisits.find((v) => v.visit_id === selectedVisitId);
      if (found) return found;
    }
    return allVisits[0] || null;
  }, [allVisits, selectedVisitId]);

  const activeVisitIndex = useMemo(() => {
    if (!activeVisit) return -1;
    return allVisits.findIndex((v) => v.visit_id === activeVisit.visit_id);
  }, [allVisits, activeVisit]);

  const previousVisit = useMemo(() => {
    if (activeVisitIndex >= 0 && activeVisitIndex < allVisits.length - 1) {
      return allVisits[activeVisitIndex + 1];
    }
    return null;
  }, [allVisits, activeVisitIndex]);

  const weightChange = useMemo(() => {
    if (
      activeVisit?.weight_kg !== undefined &&
      activeVisit?.weight_kg !== null &&
      previousVisit?.weight_kg !== undefined &&
      previousVisit?.weight_kg !== null
    ) {
      const curr = Number(activeVisit.weight_kg);
      const prev = Number(previousVisit.weight_kg);
      if (!isNaN(curr) && !isNaN(prev)) {
        return Number((curr - prev).toFixed(1));
      }
    }
    return null;
  }, [activeVisit, previousVisit]);

  const bpAssessment = useMemo(() => {
    return getBpAssessment(activeVisit?.bp_systolic, activeVisit?.bp_diastolic);
  }, [activeVisit?.bp_systolic, activeVisit?.bp_diastolic]);

  const fhtAssessment = useMemo(() => {
    return getFhtAssessment(activeVisit?.fetal_heart_tone_bpm);
  }, [activeVisit?.fetal_heart_tone_bpm]);

  const pulseAssessment = useMemo(() => {
    return getPulseAssessment(activeVisit?.pulse_rate_bpm);
  }, [activeVisit?.pulse_rate_bpm]);

  const healthStory = useMemo(() => {
    if (!activeVisit) return null;
    const isHighRisk =
      (activeVisit.risk_level_assessed &&
        activeVisit.risk_level_assessed.toLowerCase().includes("high")) ||
      bpAssessment?.status === "High";

    const isAttention =
      bpAssessment?.status === "Elevated" ||
      (fhtAssessment && fhtAssessment.status.includes("Slow")) ||
      (fhtAssessment && fhtAssessment.status.includes("Rapid")) ||
      pulseAssessment?.status === "Elevated" ||
      pulseAssessment?.status === "Low";

    if (isHighRisk) {
      return {
        title: "Clinical Attention Advised",
        description: "Measurements require clinical review. Please consult your provider.",
        icon: "alert-circle" as const,
        iconColor: "#ef4444",
        cardBg: "bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/20",
      };
    }

    if (isAttention) {
      return {
        title: "Checkup Notes Recorded",
        description: "Slight variations noted. Stay hydrated and attend scheduled visits.",
        icon: "information-circle" as const,
        iconColor: "#f59e0b",
        cardBg: "bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20",
      };
    }

    return {
      title: "Vitals are on track",
      description: "Blood pressure and heart rate are inside healthy clinical targets.",
      icon: "checkmark-circle" as const,
      iconColor: "#10b981",
      cardBg: "bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20",
    };
  }, [activeVisit, bpAssessment, fhtAssessment, pulseAssessment]);

  const { allNewborns } = useMemo(() => {
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
      <Header
        showBackButton
        title="Vitals & Analytics"
        onBack={() => router.back()}
        rightIcon={null}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
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

            {allVisits.length > 1 && (
              <View className="gap-2">
                <Text className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-wider px-1">
                  Visit History
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
                >
                  {allVisits.map((visit, index) => {
                    const isSelected = activeVisit?.visit_id === visit.visit_id;
                    const visitNumber = visit.visit_number || allVisits.length - index;
                    const formattedDate = new Date(visit.visit_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });

                    return (
                      <Pressable
                        key={visit.visit_id || `visit-${index}`}
                        onPress={() => {
                          triggerSelectionHaptic();
                          setSelectedVisitId(visit.visit_id);
                        }}
                        className={`px-3.5 py-2 rounded-xl flex-row items-center gap-2 ${
                          isSelected
                            ? "bg-primary shadow-xs"
                            : "bg-surface border border-separator/30 dark:border-zinc-800"
                        }`}
                      >
                        <View
                          className={`size-2 rounded-full ${
                            isSelected ? "bg-primary-foreground" : "bg-primary"
                          }`}
                        />
                        <View>
                          <Text
                            className={`text-xs font-bold ${
                              isSelected ? "text-primary-foreground" : "text-foreground"
                            }`}
                          >
                            Visit #{visitNumber}
                          </Text>
                          <Text
                            className={`text-[11px] ${
                              isSelected ? "text-primary-foreground/80" : "text-zinc-400"
                            }`}
                          >
                            {formattedDate}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {activeVisit ? (
              <View className="gap-4">
                {healthStory && (
                  <Card
                    variant="secondary"
                    className={`rounded-xl px-4 py-3 ${healthStory.cardBg}`}
                  >
                    <View className="flex-row items-center gap-2.5">
                      <View className="size-7 rounded-full bg-surface items-center justify-center shadow-2xs shrink-0">
                        <Ionicons name={healthStory.icon} size={15} color={healthStory.iconColor} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground text-sm font-bold">
                          {healthStory.title}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-foreground/80 dark:text-foreground/75 text-xs leading-4 mt-2">
                      {healthStory.description}
                    </Text>
                  </Card>
                )}

                <Card variant="secondary" className="bg-surface border-0 rounded-2xl p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5">
                      <View className="size-8 rounded-full bg-emerald-500/10 items-center justify-center">
                        <Ionicons name="fitness-outline" size={17} color="#10b981" />
                      </View>
                      <View>
                        <Text className="text-foreground text-sm font-semibold">
                          Blood Pressure
                        </Text>
                        <Text className="text-zinc-400 text-xs font-normal">
                          Maternal circulation
                        </Text>
                      </View>
                    </View>
                    {bpAssessment ? (
                      <View className={`px-2.5 py-1 rounded-full ${bpAssessment.badgeBg}`}>
                        <Text className={`text-xs font-bold ${bpAssessment.badgeText}`}>
                          {bpAssessment.status}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View className="flex-row items-baseline gap-1.5 mt-3">
                    <Text className="text-foreground text-3xl font-extrabold tracking-tight">
                      {activeVisit.bp_systolic}/{activeVisit.bp_diastolic}
                    </Text>
                    <Text className="text-zinc-400 text-xs font-medium">mmHg</Text>
                  </View>

                  {bpAssessment ? (
                    <>
                      <RangeSpectrumBar
                        percentage={bpAssessment.percentage}
                        markerColor={bpAssessment.accentColor}
                        labels={["<90 Low", "120/80 Target", ">140 High"]}
                      />
                      <Text className="text-zinc-500 dark:text-zinc-400 text-xs leading-4 mt-2">
                        {bpAssessment.note}
                      </Text>
                    </>
                  ) : null}
                </Card>

                {activeVisit.fetal_heart_tone_bpm ? (
                  <Card variant="secondary" className="bg-surface border-0 rounded-2xl p-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2.5">
                        <View className="size-8 rounded-full bg-rose-500/10 items-center justify-center">
                          <Ionicons name="heart" size={16} color="#f43f5e" />
                        </View>
                        <View>
                          <Text className="text-foreground text-sm font-semibold">
                            Fetal Heart Tone
                          </Text>
                          <Text className="text-zinc-400 text-xs font-normal">
                            Baby&apos;s heartbeat
                          </Text>
                        </View>
                      </View>
                      {fhtAssessment ? (
                        <View className={`px-2.5 py-1 rounded-full ${fhtAssessment.badgeBg}`}>
                          <Text className={`text-xs font-bold ${fhtAssessment.badgeText}`}>
                            {fhtAssessment.status}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View className="flex-row items-baseline gap-1.5 mt-3">
                      <Text className="text-foreground text-3xl font-extrabold tracking-tight">
                        {activeVisit.fetal_heart_tone_bpm}
                      </Text>
                      <Text className="text-zinc-400 text-xs font-medium">bpm</Text>
                    </View>

                    {fhtAssessment ? (
                      <>
                        <RangeSpectrumBar
                          percentage={fhtAssessment.percentage}
                          markerColor={fhtAssessment.accentColor}
                          labels={["<110 Slow", "110–160 Target", ">160 Rapid"]}
                        />
                        <Text className="text-zinc-500 dark:text-zinc-400 text-xs leading-4 mt-2">
                          {fhtAssessment.note}
                        </Text>
                      </>
                    ) : null}
                  </Card>
                ) : null}

                <View className="flex-row gap-3">
                  <Card variant="secondary" className="flex-1 bg-surface border-0 rounded-2xl p-4">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-zinc-500 dark:text-zinc-400 text-xs font-medium">
                        Weight
                      </Text>
                      <View className="size-7 rounded-full bg-blue-500/10 items-center justify-center">
                        <Ionicons name="scale-outline" size={15} color="#3b82f6" />
                      </View>
                    </View>
                    <View className="flex-row items-baseline gap-1">
                      <Text className="text-foreground text-2xl font-bold">
                        {activeVisit.weight_kg ?? "—"}
                      </Text>
                      {activeVisit.weight_kg ? (
                        <Text className="text-zinc-400 text-xs font-semibold">kg</Text>
                      ) : null}
                    </View>
                    {weightChange !== null ? (
                      <View className="flex-row items-center gap-1 mt-2">
                        <Ionicons
                          name={weightChange >= 0 ? "trending-up" : "trending-down"}
                          size={13}
                          color={weightChange >= 0 ? "#10b981" : "#f59e0b"}
                        />
                        <Text
                          className={`text-xs font-semibold ${
                            weightChange >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-500"
                          }`}
                        >
                          {weightChange > 0 ? `+${weightChange}` : `${weightChange}`} kg vs prev
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-zinc-400 text-xs mt-2 font-medium">
                        Baseline record
                      </Text>
                    )}
                  </Card>

                  <Card variant="secondary" className="flex-1 bg-surface border-0 rounded-2xl p-4">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-zinc-500 dark:text-zinc-400 text-xs font-medium">
                        Maternal Pulse
                      </Text>
                      <View className="size-7 rounded-full bg-rose-500/10 items-center justify-center">
                        <Ionicons name="heart-outline" size={15} color="#f43f5e" />
                      </View>
                    </View>
                    <View className="flex-row items-baseline gap-1">
                      <Text className="text-foreground text-2xl font-bold">
                        {activeVisit.pulse_rate_bpm ?? "—"}
                      </Text>
                      {activeVisit.pulse_rate_bpm ? (
                        <Text className="text-zinc-400 text-xs font-semibold">bpm</Text>
                      ) : null}
                    </View>
                    {pulseAssessment ? (
                      <View className="flex-row items-center gap-1.5 mt-2">
                        <View className={`px-2 py-0.5 rounded-md ${pulseAssessment.badgeBg}`}>
                          <Text
                            className={`text-[11px] font-semibold ${pulseAssessment.badgeText}`}
                          >
                            {pulseAssessment.status}
                          </Text>
                        </View>
                        <Text className="text-zinc-400 text-xs">resting</Text>
                      </View>
                    ) : (
                      <Text className="text-zinc-400 text-xs mt-2 font-medium">Heart rate</Text>
                    )}
                  </Card>
                </View>

                <View className="gap-2">
                  <Text className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-wider px-1">
                    Clinical Examination
                  </Text>
                  <Card
                    variant="secondary"
                    className="bg-surface border-0 rounded-2xl overflow-hidden p-0"
                  >
                    <InsetRow
                      label="Body Temperature"
                      value={`${activeVisit.temperature_celsius} °C`}
                    />
                    {activeVisit.fundic_height_cm ? (
                      <InsetRow
                        label="Fundic Height"
                        value={`${activeVisit.fundic_height_cm} cm`}
                      />
                    ) : null}
                    {activeVisit.age_of_gestation_weeks ? (
                      <InsetRow
                        label="Gestational Age"
                        value={`${activeVisit.age_of_gestation_weeks} weeks`}
                      />
                    ) : null}
                    {activeVisit.trimester ? (
                      <InsetRow label="Trimester" value={`Trimester ${activeVisit.trimester}`} />
                    ) : null}
                    {activeVisit.risk_level_assessed ? (
                      <InsetRow
                        label="Risk Assessment"
                        value={activeVisit.risk_level_assessed}
                        badge={
                          <View
                            className={`px-2 py-0.5 rounded-md ${
                              activeVisit.risk_level_assessed.toLowerCase().includes("high")
                                ? "bg-rose-500/15"
                                : "bg-emerald-500/15"
                            }`}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                activeVisit.risk_level_assessed.toLowerCase().includes("high")
                                  ? "text-rose-500"
                                  : "text-emerald-500"
                              }`}
                            >
                              {activeVisit.risk_level_assessed}
                            </Text>
                          </View>
                        }
                        isLast
                      />
                    ) : null}
                  </Card>
                </View>
              </View>
            ) : (
              <Card
                variant="secondary"
                className="bg-surface border-0 rounded-2xl p-8 items-center py-12"
              >
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
              <Card
                variant="secondary"
                className="bg-surface border-0 rounded-2xl p-8 items-center py-12"
              >
                <View className="size-16 rounded-full bg-primary/10 items-center justify-center mb-3">
                  <Ionicons name="heart-outline" size={28} color="#0284c7" />
                </View>
                <Text className="text-foreground font-bold text-base mb-1">
                  Expectant Care Mode
                </Text>
                <Text className="text-zinc-500 dark:text-zinc-400 text-sm text-center leading-5 max-w-xs">
                  Infant birth and delivery records will be logged automatically by your healthcare
                  provider upon delivery.
                </Text>
              </Card>
            ) : (
              <View className="gap-4">
                {/* Secondary Compact Selector if Multiple Newborns */}
                {allNewborns.length > 1 &&
                  (allNewborns.length <= 3 ? (
                    <View className="flex-row bg-default/70 dark:bg-zinc-800/70 p-1 rounded-xl gap-1">
                      <Pressable
                        onPress={() => setSelectedNewbornId("all")}
                        className={`flex-1 py-1.5 px-2 rounded-lg flex-row items-center justify-center gap-1.5 ${
                          selectedNewbornId === "all" ? "bg-surface shadow-xs" : "bg-transparent"
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
                              isSelected ? "bg-surface shadow-xs" : "bg-transparent"
                            }`}
                          >
                            <Ionicons
                              name={isMale ? "male" : "female"}
                              size={13}
                              color={isSelected ? (isMale ? "#3b82f6" : "#ec4899") : "#a1a1aa"}
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
                  ))}

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
                        <InsetRow label="Status at Birth" value={nb.status_at_birth} />
                        {nb.mode_of_delivery && (
                          <InsetRow label="Mode of Delivery" value={nb.mode_of_delivery} />
                        )}
                        {nb.place_of_delivery && (
                          <InsetRow label="Facility / Place" value={nb.place_of_delivery} />
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
