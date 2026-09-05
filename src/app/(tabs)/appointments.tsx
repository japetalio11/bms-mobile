import { View, ScrollView, Pressable, ActivityIndicator, Modal, TextInput } from "react-native";
import type { JSX } from "react";
import { Card, Text, SearchField } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useState, useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Header } from "../../components/Header";
import { useAuth } from "../../context/UserContext";
import { useNetwork } from "../../context/NetworkContext";
import { getAppointmentsByUserApi, createAppointmentApi } from "../../config/api";
import type { AppointmentRecord } from "../../config/api";
import {
  getAppointmentsLocal,
  saveAppointmentsLocal,
  createAppointmentLocal,
} from "../../db/repository";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIME_SLOTS = [
  "08:00 AM",
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
];

const VISIT_TYPES = [
  { id: "Prenatal Visit", label: "Prenatal Visit", icon: "medical-outline", color: "#0284c7" },
  { id: "Postnatal Checkup", label: "Postnatal Checkup", icon: "heart-outline", color: "#10b981" },
  { id: "Neonatal Screening", label: "Neonatal Screening", icon: "sparkles-outline", color: "#f59e0b" },
];

export default function AppointmentsScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { isOnline } = useNetwork();

  const [activeFilter, setActiveFilter] = useState<"all" | "prenatal" | "postnatal" | "neonatal">("all");
  const [searchValue, setSearchValue] = useState("");
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateNum, setSelectedDateNum] = useState<number | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Modal & Interactive DatePicker State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<Date>(new Date());
  const [modalCalendarMonth, setModalCalendarMonth] = useState<Date>(new Date());
  const [bookingTime, setBookingTime] = useState("09:00 AM");
  const [bookingType, setBookingType] = useState("Prenatal Visit");
  const [bookingReason, setBookingReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    if (!user?.user_id) return;

    // 1. Always load from local SQLite first (instant UI, offline preservation)
    try {
      const cached = await getAppointmentsLocal(user.user_id);
      if (cached && cached.length > 0) {
        setAppointments(cached);
      }
    } catch (e) {
      console.warn("Error reading local appointments:", e);
    }

    // 2. If online and token available, fetch fresh backend data
    if (isOnline && token) {
      setIsLoading(true);
      try {
        const fresh = await getAppointmentsByUserApi(user.user_id, token);
        if (Array.isArray(fresh)) {
          setAppointments(fresh);
          await saveAppointmentsLocal(fresh, true);
        }
      } catch (err) {
        console.warn("Backend appointments fetch failed, preserving local data:", err);
      } finally {
        setIsLoading(false);
      }
    }
  }, [user?.user_id, token, isOnline]);

  useFocusEffect(
    useCallback(() => {
      loadAppointments();
    }, [loadAppointments])
  );

  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    try {
      const cleanStr = String(dateStr).split("T")[0];
      const parts = cleanStr.split("-");
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
      return new Date(dateStr);
    } catch {
      return new Date(dateStr);
    }
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter((item) => {
      if (selectedDateNum !== null) {
        const itemDate = parseLocalDate(item.appointment_date);
        if (
          itemDate.getDate() !== selectedDateNum ||
          itemDate.getMonth() !== currentDate.getMonth() ||
          itemDate.getFullYear() !== currentDate.getFullYear()
        ) {
          return false;
        }
      }

      if (searchValue.trim()) {
        const q = searchValue.toLowerCase();
        const matchType = item.appointment_type.toLowerCase().includes(q);
        const matchReason = (item.reason || "").toLowerCase().includes(q);
        if (!matchType && !matchReason) return false;
      }

      if (activeFilter === "all") return true;
      if (activeFilter === "prenatal") return item.appointment_type.toLowerCase().includes("prenatal");
      if (activeFilter === "postnatal")
        return (
          item.appointment_type.toLowerCase().includes("postpartum") ||
          item.appointment_type.toLowerCase().includes("postnatal")
        );
      if (activeFilter === "neonatal")
        return (
          item.appointment_type.toLowerCase().includes("newborn") ||
          item.appointment_type.toLowerCase().includes("neonatal")
        );
      return true;
    });
  }, [appointments, selectedDateNum, currentDate, searchValue, activeFilter]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarRows: (number | null)[][] = useMemo(() => {
    const rows: (number | null)[][] = [];
    let dayCounter = 1;
    while (dayCounter <= daysInMonth) {
      const row: (number | null)[] = [];
      for (let c = 0; c < 7; c++) {
        if ((rows.length === 0 && c < firstDay) || dayCounter > daysInMonth) {
          row.push(null);
        } else {
          row.push(dayCounter++);
        }
      }
      rows.push(row);
    }
    return rows;
  }, [daysInMonth, firstDay]);

  // Modal Mini-Calendar Computation
  const mYear = modalCalendarMonth.getFullYear();
  const mMonth = modalCalendarMonth.getMonth();
  const mMonthName = modalCalendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const mFirstDay = new Date(mYear, mMonth, 1).getDay();
  const mDaysInMonth = new Date(mYear, mMonth + 1, 0).getDate();

  const modalCalendarRows: (number | null)[][] = useMemo(() => {
    const rows: (number | null)[][] = [];
    let dayCounter = 1;
    while (dayCounter <= mDaysInMonth) {
      const row: (number | null)[] = [];
      for (let c = 0; c < 7; c++) {
        if ((rows.length === 0 && c < mFirstDay) || dayCounter > mDaysInMonth) {
          row.push(null);
        } else {
          row.push(dayCounter++);
        }
      }
      rows.push(row);
    }
    return rows;
  }, [mDaysInMonth, mFirstDay]);

  const handleBookAppointment = async () => {
    if (!user?.user_id) {
      setBookingError("User session not found. Please log in again.");
      return;
    }

    const y = modalDate.getFullYear();
    const m = String(modalDate.getMonth() + 1).padStart(2, "0");
    const d = String(modalDate.getDate()).padStart(2, "0");
    const formattedDate = `${y}-${m}-${d}`;

    const payload = {
      user_id: user.user_id,
      appointment_date: formattedDate,
      appointment_time: bookingTime,
      appointment_type: bookingType,
      reason: bookingReason.trim() || undefined,
    };

    setIsSubmitting(true);
    setBookingError(null);

    try {
      if (isOnline && token) {
        try {
          const res = await createAppointmentApi(payload, token);
          if (res) {
            await saveAppointmentsLocal([res], true);
          }
        } catch (apiErr: any) {
          console.warn("API appointment creation failed, falling back to local SQLite outbox:", apiErr);
          await createAppointmentLocal(payload, false);
        }
      } else {
        await createAppointmentLocal(payload, false);
      }

      setIsModalOpen(false);
      setBookingReason("");
      setModalDate(new Date());
      await loadAppointments();
    } catch (err: any) {
      setBookingError(err.message || "Failed to schedule appointment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const setDatePreset = (daysToAdd: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    setModalDate(d);
    setModalCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(false);

  const displayedCalendarRows = useMemo(() => {
    if (!isCalendarCollapsed) return calendarRows;
    const targetDay =
      selectedDateNum ||
      (month === new Date().getMonth() && year === new Date().getFullYear() ? new Date().getDate() : 1);
    const activeRow = calendarRows.find((row) => row.includes(targetDay));
    return activeRow ? [activeRow] : calendarRows.slice(0, 1);
  }, [calendarRows, isCalendarCollapsed, selectedDateNum, month, year]);

  const formatTime12h = (timeStr: string) => {
    if (!timeStr) return "";
    if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
    const parts = timeStr.trim().split(":");
    let h = parseInt(parts[0], 10);
    if (isNaN(h)) return timeStr;
    const m = parts[1] ? parts[1].substring(0, 2) : "00";
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
  };

  const getAccentColor = (typeStr: string) => {
    const t = typeStr.toLowerCase();
    if (t.includes("prenatal")) return "#f43f5e";
    if (t.includes("postnatal") || t.includes("postpartum")) return "#10b981";
    if (t.includes("neonatal") || t.includes("newborn")) return "#f59e0b";
    return "#f43f5e";
  };

  const bottomScrollPadding = insets.bottom + 120;

  return (
    <View className="flex-1 bg-[#121214]">
      <Header />

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomScrollPadding }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Row — Above the entire calendar component */}
        <View className="px-5 mb-4 mt-3 flex-row items-center justify-between">
          <Text className="text-white text-xl font-bold tracking-tight">Appointments</Text>

          <Pressable
            onPress={() => setIsModalOpen(true)}
            className="bg-[#f43f5e] py-2 px-3.5 rounded-xl flex-row items-center gap-1.5 active:bg-[#e11d48] shadow-sm"
          >
            <Ionicons name="add-circle" size={16} color="#ffffff" />
            <Text className="text-white font-bold text-xs">Schedule Visit</Text>
          </Pressable>
        </View>

        {!user?.facility_id && (
          <View className="mx-5 mb-4 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex-row items-center gap-3">
            <View className="size-9 rounded-xl bg-amber-500/20 items-center justify-center">
              <Ionicons name="business-outline" size={18} color="#f59e0b" />
            </View>
            <View className="flex-1">
              <Text className="text-amber-400 font-bold text-xs mb-0.5">No Health Center Linked</Text>
              <Text className="text-zinc-400 text-[11px] leading-4">
                Your account is not currently linked to a health center. Contact your facility staff to link your account.
              </Text>
            </View>
          </View>
        )}

        {/* ── 1. Collapsible Calendar Grid Card ── */}
        <View className="mx-5 mb-4 bg-[#18171C] border border-white/[0.08] rounded-2xl p-4">
          <View className="flex-row items-center justify-between mb-3 px-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-white font-bold text-sm">{monthName}</Text>
              <Pressable
                onPress={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
                className="px-2 py-0.5 rounded-full bg-[#25242A] border border-white/10 flex-row items-center gap-1"
              >
                <Text className="text-zinc-300 text-[10px] font-medium">
                  {isCalendarCollapsed ? "Expand Month" : "Week View"}
                </Text>
                <Ionicons
                  name={isCalendarCollapsed ? "chevron-down" : "chevron-up"}
                  size={12}
                  color="#a1a1aa"
                />
              </Pressable>
            </View>

            <View className="flex-row gap-1">
              <Pressable
                className="size-7 items-center justify-center rounded-lg bg-[#25242A]"
                onPress={() => {
                  setCurrentDate(new Date(year, month - 1, 1));
                  setSelectedDateNum(null);
                }}
              >
                <Ionicons name="chevron-back" size={14} color="#a1a1aa" />
              </Pressable>
              <Pressable
                className="size-7 items-center justify-center rounded-lg bg-[#25242A]"
                onPress={() => {
                  setCurrentDate(new Date(year, month + 1, 1));
                  setSelectedDateNum(null);
                }}
              >
                <Ionicons name="chevron-forward" size={14} color="#a1a1aa" />
              </Pressable>
            </View>
          </View>

          <View className="flex-row w-full mb-2 border-b border-white/[0.06] pb-2">
            {DAYS.map((day) => (
              <View key={day} className="w-[14.28%] items-center justify-center">
                <Text className="text-zinc-400 text-[11px] font-medium text-center">{day}</Text>
              </View>
            ))}
          </View>

          {displayedCalendarRows.map((row, rowIndex) => (
            <View key={rowIndex} className="flex-row w-full mb-1">
              {row.map((dateNum, colIndex) => {
                const isToday =
                  dateNum !== null &&
                  dateNum === new Date().getDate() &&
                  month === new Date().getMonth() &&
                  year === new Date().getFullYear();

                const hasEvent =
                  dateNum !== null &&
                  appointments.some((a) => {
                    const d = parseLocalDate(a.appointment_date);
                    return d.getDate() === dateNum && d.getMonth() === month && d.getFullYear() === year;
                  });

                const isSelected = dateNum !== null && selectedDateNum === dateNum;

                return (
                  <Pressable
                    key={colIndex}
                    disabled={dateNum === null}
                    onPress={() => {
                      if (dateNum) {
                        setSelectedDateNum(selectedDateNum === dateNum ? null : dateNum);
                      }
                    }}
                    className="w-[14.28%] h-9 items-center justify-center relative"
                  >
                    {dateNum !== null ? (
                      <>
                        <View
                          className={`size-7 items-center justify-center rounded-full ${
                            isSelected
                              ? "bg-[#f43f5e]/20 border border-[#f43f5e]"
                              : isToday
                              ? "bg-[#f43f5e]"
                              : "bg-transparent"
                          }`}
                        >
                          <Text
                            className={`text-xs ${
                              isToday
                                ? "text-white font-bold"
                                : isSelected
                                ? "text-[#f43f5e] font-bold"
                                : "text-white font-normal"
                            }`}
                          >
                            {dateNum}
                          </Text>
                        </View>
                        {hasEvent && (
                          <View
                            className={`size-1.5 rounded-full ${
                              isToday ? "bg-white" : "bg-[#f43f5e]"
                            } absolute bottom-0.5`}
                          />
                        )}
                      </>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* ── 2. Unified Search Field + Filter Button ── */}
        <View className="px-5 mb-4 flex-row items-center gap-2">
          <View className="flex-1 bg-[#18171C] border border-white/[0.08] rounded-xl h-10 px-3 flex-row items-center gap-2">
            <Ionicons name="search-outline" size={15} color="#a1a1aa" />
            <TextInput
              value={searchValue}
              onChangeText={setSearchValue}
              placeholder="Search appointments..."
              placeholderTextColor="#a1a1aa"
              className="flex-1 text-xs text-white p-0"
            />
            {searchValue.length > 0 && (
              <Pressable onPress={() => setSearchValue("")}>
                <Ionicons name="close-circle" size={16} color="#71717a" />
              </Pressable>
            )}
          </View>

          {/* Filter Button */}
          <Pressable
            onPress={() => setIsFilterModalOpen(true)}
            className={`h-10 px-3.5 rounded-xl border flex-row items-center gap-1.5 ${
              activeFilter !== "all"
                ? "bg-[#f43f5e]/15 border-[#f43f5e]"
                : "bg-[#18171C] border-white/[0.08]"
            }`}
          >
            <Ionicons name="options-outline" size={16} color={activeFilter !== "all" ? "#f43f5e" : "#a1a1aa"} />
            <Text className={`text-xs font-semibold ${activeFilter !== "all" ? "text-[#f43f5e]" : "text-zinc-300"}`}>
              {activeFilter === "all" ? "Filter" : activeFilter === "prenatal" ? "Prenatal" : activeFilter === "postnatal" ? "Postnatal" : "Neonatal"}
            </Text>
            <Ionicons name="chevron-down" size={12} color={activeFilter !== "all" ? "#f43f5e" : "#a1a1aa"} />
          </Pressable>
        </View>

        {/* ── 3. Appointment List ── */}
        <View className="px-5 gap-3">
          {selectedDateNum !== null && (
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-[#f43f5e] text-xs font-semibold">
                Showing visits for {monthName} {selectedDateNum}
              </Text>
              <Pressable onPress={() => setSelectedDateNum(null)}>
                <Text className="text-zinc-400 text-xs underline">Clear date filter</Text>
              </Pressable>
            </View>
          )}

          {isLoading && appointments.length === 0 ? (
            <ActivityIndicator size="small" color="#f43f5e" className="py-6" />
          ) : filteredAppointments.length > 0 ? (
            filteredAppointments.map((item) => {
              const d = parseLocalDate(item.appointment_date);
              const dayStr = d.toLocaleDateString("en-US", { weekday: "short" });
              const dateNum = d.getDate();
              const isCompleted = item.status.toLowerCase() === "completed";
              const accentColor = getAccentColor(item.appointment_type);
              const isPendingSync = (item as any).sync_status === "pending";

              return (
                <Pressable
                  key={item.appointment_id}
                  onPress={() => router.push("/(tabs)/appointment-detail")}
                >
                  <View className="bg-[#18171C] border border-white/[0.08] rounded-2xl flex-row items-center overflow-hidden h-[84px]">
                    <View style={{ width: 4, height: "100%", backgroundColor: accentColor }} />

                    <View className="px-3.5 flex-1 flex-row items-center gap-3">
                      {/* Date Box */}
                      <View className="items-center justify-center size-12 rounded-xl bg-[#25242A]">
                        <Text className="text-zinc-400 text-[11px] font-medium leading-none">{dayStr}</Text>
                        <Text className="text-white text-base font-bold leading-tight mt-0.5">{dateNum}</Text>
                      </View>

                      <View className="flex-1 justify-center">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-white text-[15px] font-semibold flex-1 mr-2" numberOfLines={1}>
                            {item.appointment_type}
                          </Text>

                          {isPendingSync && (
                            <View className="bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded">
                              <Text className="text-amber-300 text-[10px] font-medium">Pending Sync</Text>
                            </View>
                          )}
                        </View>

                        {/* Standardized 12-hour Time, Inline Notes & Status */}
                        <View className="flex-row items-center justify-between mt-1">
                          <Text className="text-zinc-400 text-xs font-medium flex-1 mr-2" numberOfLines={1}>
                            {formatTime12h(item.appointment_time)}
                            {item.reason && item.reason.trim().length > 0 ? ` · ${item.reason}` : ""}
                          </Text>

                          <View className="flex-row items-center gap-1.5">
                            <View
                              className="size-2 rounded-full"
                              style={{ backgroundColor: isCompleted ? "#10b981" : "#f43f5e" }}
                            />
                            <Text
                              className="text-xs font-semibold"
                              style={{ color: isCompleted ? "#10b981" : "#f43f5e" }}
                            >
                              {item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase()}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <Ionicons name="chevron-forward" size={16} color="#71717a" />
                    </View>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View className="p-6 bg-[#18171C] border border-white/[0.08] rounded-2xl items-center">
              <Ionicons name="calendar-outline" size={24} color="#a1a1aa" className="mb-2" />
              <Text className="text-white font-semibold text-sm mb-1">No appointments found</Text>
              <Text className="text-zinc-400 text-xs text-center">
                {searchValue.trim() || activeFilter !== "all" || selectedDateNum !== null
                  ? "No appointments match your filters."
                  : "You have no upcoming or past visits."}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── 5. Fully Interactive Schedule Visit Modal ── */}
      <Modal visible={isModalOpen} transparent animationType="slide" onRequestClose={() => setIsModalOpen(false)}>
        <View className="flex-1 bg-black/85 justify-end sm:justify-center items-center">
          <View className="w-full max-w-lg bg-[#16161C] border-t sm:border border-white/[0.12] rounded-t-3xl sm:rounded-3xl p-5 max-h-[88%] flex-col">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center pb-3 border-b border-white/[0.08] mb-3">
              <View className="flex-row items-center gap-2.5">
                <View className="size-9 rounded-xl bg-[#f43f5e]/15 items-center justify-center border border-[#f43f5e]/30">
                  <Ionicons name="calendar" size={18} color="#f43f5e" />
                </View>
                <View>
                  <Text className="text-white text-base font-bold">Schedule Appointment</Text>
                  <Text className="text-zinc-400 text-xs">Select visit type, date, and time slot</Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  setIsModalOpen(false);
                  setBookingError(null);
                }}
                className="size-8 items-center justify-center rounded-full bg-[#25242A]"
              >
                <Ionicons name="close" size={18} color="#a1a1aa" />
              </Pressable>
            </View>

            {bookingError && (
              <View className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex-row items-center gap-2">
                <Ionicons name="alert-circle" size={18} color="#ef4444" />
                <Text className="text-red-400 text-xs flex-1 font-medium">{bookingError}</Text>
              </View>
            )}

            {/* Modal Content ScrollView (Steps 1 to 4) */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 16 }}>
              {!user?.facility_id && (
                <View className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex-row items-center gap-2.5">
                  <Ionicons name="warning-outline" size={20} color="#f59e0b" />
                  <Text className="text-amber-300 text-xs flex-1 leading-4">
                    Note: Your account is not currently linked to a health center. Scheduled appointments will be pending facility assignment.
                  </Text>
                </View>
              )}

              {/* 1. Visit Type Cards */}
              <View>
                <Text className="text-white text-xs font-bold mb-2">1. Visit Type</Text>
                <View className="gap-2">
                  {VISIT_TYPES.map((type) => {
                    const isSelected = bookingType === type.id;
                    return (
                      <Pressable
                        key={type.id}
                        onPress={() => setBookingType(type.id)}
                        className={`p-3 rounded-2xl border flex-row items-center justify-between ${
                          isSelected
                            ? "bg-[#25242A] border-[#f43f5e]"
                            : "bg-[#18171C] border-white/[0.08]"
                        }`}
                      >
                        <View className="flex-row items-center gap-3">
                          <View className="size-9 rounded-xl items-center justify-center bg-[#25242A] border border-white/[0.06]">
                            <Ionicons name={type.icon as any} size={18} color={isSelected ? "#f43f5e" : "#a1a1aa"} />
                          </View>
                          <Text className={`text-xs font-semibold ${isSelected ? "text-white" : "text-zinc-300"}`}>
                            {type.label}
                          </Text>
                        </View>
                        <View
                          className={`size-5 rounded-full border items-center justify-center ${
                            isSelected ? "border-[#f43f5e] bg-[#f43f5e]" : "border-zinc-600 bg-transparent"
                          }`}
                        >
                          {isSelected && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 2. Compact Date Picker (Clean Date Display + Presets + 14-Day Strip) */}
              <View>
                <Text className="text-white text-xs font-bold mb-2">2. Select Date</Text>

                {/* Selected Date Banner — Clean format without duplicate ISO text */}
                <View className="bg-[#f43f5e]/10 border border-[#f43f5e]/30 px-3.5 py-2.5 rounded-2xl flex-row items-center justify-between mb-2.5">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="calendar-outline" size={18} color="#f43f5e" />
                    <Text className="text-white text-xs font-bold">
                      {modalDate.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                </View>

                {/* Quick Presets Chips — Fixed padding to prevent text clipping */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
                  {[
                    { label: "Today", days: 0 },
                    { label: "Tomorrow", days: 1 },
                    { label: "In 3 Days", days: 3 },
                    { label: "In 1 Wk", days: 7 },
                    { label: "In 2 Wks", days: 14 },
                  ].map((p) => {
                    const target = new Date();
                    target.setDate(target.getDate() + p.days);
                    const isSelected =
                      modalDate.getDate() === target.getDate() &&
                      modalDate.getMonth() === target.getMonth() &&
                      modalDate.getFullYear() === target.getFullYear();

                    return (
                      <Pressable
                        key={p.label}
                        onPress={() => setDatePreset(p.days)}
                        className={`px-3.5 py-1.5 rounded-xl border shrink-0 ${
                          isSelected
                            ? "bg-[#f43f5e] border-[#f43f5e]"
                            : "bg-[#25242A] border-white/[0.08]"
                        }`}
                      >
                        <Text className={`text-xs ${isSelected ? "text-white font-bold" : "text-zinc-300 font-medium"}`}>
                          {p.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Compact Horizontal 14-Day Scroll Strip */}
                <View className="bg-[#25242A] border border-white/[0.08] rounded-2xl p-2.5">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {Array.from({ length: 14 }).map((_, idx) => {
                      const d = new Date();
                      d.setDate(d.getDate() + idx);
                      const isSelectedDate =
                        d.getDate() === modalDate.getDate() &&
                        d.getMonth() === modalDate.getMonth() &&
                        d.getFullYear() === modalDate.getFullYear();

                      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
                      const dayNum = d.getDate();

                      return (
                        <Pressable
                          key={d.toISOString()}
                          onPress={() => setModalDate(d)}
                          className={`w-12 h-14 rounded-xl items-center justify-center border ${
                            isSelectedDate
                              ? "bg-[#f43f5e] border-[#f43f5e]"
                              : "bg-[#18171C] border-white/[0.08]"
                          }`}
                        >
                          <Text className={`text-[10px] font-medium ${isSelectedDate ? "text-white/90" : "text-zinc-400"}`}>
                            {dayName}
                          </Text>
                          <Text className={`text-sm font-bold ${isSelectedDate ? "text-white" : "text-white"}`}>
                            {dayNum}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              {/* 3. Preferred Time Slot — Solid Filled Accent when Selected */}
              <View>
                <Text className="text-white text-xs font-bold mb-2">3. Preferred Time Slot</Text>
                <View className="flex-row flex-wrap gap-2">
                  {TIME_SLOTS.map((slot) => {
                    const isSelected = bookingTime === slot;
                    return (
                      <Pressable
                        key={slot}
                        onPress={() => setBookingTime(slot)}
                        className={`px-3.5 py-2 rounded-xl border ${
                          isSelected
                            ? "bg-[#f43f5e] border-[#f43f5e] shadow-sm"
                            : "bg-[#25242A] border-white/[0.08]"
                        }`}
                      >
                        <Text
                          className={`text-xs ${
                            isSelected ? "text-white font-bold" : "text-zinc-300 font-medium"
                          }`}
                        >
                          {slot}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 4. Notes Input — Improved Placeholder Contrast */}
              <View>
                <Text className="text-white text-xs font-bold mb-2">4. Reason / Notes (Optional)</Text>
                <TextInput
                  value={bookingReason}
                  onChangeText={setBookingReason}
                  placeholder="e.g. Regular prenatal checkup, headache, ultrasound review"
                  placeholderTextColor="#a1a1aa"
                  multiline
                  numberOfLines={2}
                  style={{ textAlignVertical: "top" }}
                  className="bg-[#25242A] border border-white/[0.1] rounded-2xl p-3 text-white text-xs min-h-[60px]"
                />
              </View>
            </ScrollView>

            {/* Fixed / Sticky Modal Action Footer (Below ScrollView at very bottom of modal) */}
            <View className="flex-row gap-3 pt-3 border-t border-white/[0.08] bg-[#16161C]">
              <Pressable
                onPress={() => {
                  setIsModalOpen(false);
                  setBookingError(null);
                }}
                className="flex-1 py-3 rounded-2xl bg-[#25242A] items-center active:bg-[#2e2d36]"
              >
                <Text className="text-zinc-300 font-semibold text-xs">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleBookAppointment}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-2xl bg-[#f43f5e] flex-row items-center justify-center gap-2 active:bg-[#e11d48] shadow-md"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Ionicons name="checkmark-circle" size={18} color="white" />
                )}
                <Text className="text-white font-bold text-xs">
                  {isSubmitting ? "Saving..." : "Confirm Schedule"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 6. Category Filter Selection Modal ── */}
      <Modal visible={isFilterModalOpen} transparent animationType="fade" onRequestClose={() => setIsFilterModalOpen(false)}>
        <Pressable onPress={() => setIsFilterModalOpen(false)} className="flex-1 bg-black/80 justify-center items-center p-5">
          <Pressable className="w-full max-w-sm bg-[#16161C] border border-white/[0.12] rounded-3xl p-5 gap-3 shadow-2xl">
            <View className="flex-row items-center justify-between pb-3 border-b border-white/[0.08]">
              <View className="flex-row items-center gap-2">
                <Ionicons name="options-outline" size={18} color="#f43f5e" />
                <Text className="text-white font-bold text-base">Filter Appointments</Text>
              </View>
              <Pressable onPress={() => setIsFilterModalOpen(false)} className="size-7 items-center justify-center rounded-full bg-[#25242A]">
                <Ionicons name="close" size={16} color="#a1a1aa" />
              </Pressable>
            </View>

            <View className="gap-2 pt-1">
              {[
                { id: "all", label: "All Visits", desc: "Show all appointment categories" },
                { id: "prenatal", label: "Prenatal", desc: "Routine checkups & ultrasound visits" },
                { id: "postnatal", label: "Postnatal", desc: "Postpartum & recovery care" },
                { id: "neonatal", label: "Neonatal", desc: "Newborn screenings & health checks" },
              ].map((opt) => {
                const isSelected = activeFilter === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      setActiveFilter(opt.id as any);
                      setIsFilterModalOpen(false);
                    }}
                    className={`p-3.5 rounded-2xl border flex-row items-center justify-between ${
                      isSelected
                        ? "bg-[#25242A] border-[#f43f5e]"
                        : "bg-[#18171C] border-white/[0.06]"
                    }`}
                  >
                    <View className="flex-1 mr-2">
                      <Text className={`text-xs font-bold ${isSelected ? "text-[#f43f5e]" : "text-white"}`}>
                        {opt.label}
                      </Text>
                      <Text className="text-zinc-400 text-[11px] mt-0.5">{opt.desc}</Text>
                    </View>
                    <View
                      className={`size-5 rounded-full border items-center justify-center ${
                        isSelected ? "border-[#f43f5e] bg-[#f43f5e]" : "border-zinc-600 bg-transparent"
                      }`}
                    >
                      {isSelected && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
