import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
} from "react-native";
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
import { getAppointmentStatusConfig } from "../../lib/appointmentUtils";
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

const MORNING_SLOTS = ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM"];
const AFTERNOON_SLOTS = ["01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"];

const VISIT_TYPES = [
  { id: "Prenatal Visit", label: "Prenatal Visit", icon: "woman-outline", color: "#0284c7" },
  {
    id: "Postnatal Checkup",
    label: "Postnatal Checkup",
    icon: "heart-circle-outline",
    color: "#10b981",
  },
  {
    id: "Neonatal Screening",
    label: "Neonatal Screening",
    icon: "happy-outline",
    color: "#f59e0b",
  },
];

export default function AppointmentsScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { isOnline } = useNetwork();

  const [activeFilter, setActiveFilter] = useState<"all" | "prenatal" | "postnatal" | "neonatal">(
    "all"
  );
  const [searchValue, setSearchValue] = useState("");
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateNum, setSelectedDateNum] = useState<number | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<Date>(new Date());
  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false);
  const [modalMonthView, setModalMonthView] = useState<Date>(new Date());
  const [bookingTime, setBookingTime] = useState("09:00 AM");
  const [bookingType, setBookingType] = useState("Prenatal Visit");
  const [bookingReason, setBookingReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    if (!user?.user_id) return;

    try {
      const cached = await getAppointmentsLocal(user.user_id);
      if (cached && cached.length > 0) {
        setAppointments(cached);
      }
    } catch (e) {
      console.warn("Error reading local appointments:", e);
    }

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

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadAppointments();
    setIsRefreshing(false);
  };

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
      if (activeFilter === "prenatal")
        return item.appointment_type.toLowerCase().includes("prenatal");
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

  const modalMonthYear = modalMonthView.getFullYear();
  const modalMonthIndex = modalMonthView.getMonth();
  const modalMonthName = modalMonthView.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const modalFirstDay = new Date(modalMonthYear, modalMonthIndex, 1).getDay();
  const modalDaysInMonth = new Date(modalMonthYear, modalMonthIndex + 1, 0).getDate();

  const isPrevMonthDisabled = useMemo(() => {
    const now = new Date();
    return (
      modalMonthYear < now.getFullYear() ||
      (modalMonthYear === now.getFullYear() && modalMonthIndex <= now.getMonth())
    );
  }, [modalMonthYear, modalMonthIndex]);

  const modalCalendarCells = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < modalFirstDay; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= modalDaysInMonth; d++) {
      cells.push(d);
    }
    return cells;
  }, [modalFirstDay, modalDaysInMonth]);

  const handlePrevMonth = () => {
    if (isPrevMonthDisabled) return;
    setModalMonthView(new Date(modalMonthYear, modalMonthIndex - 1, 1));
  };

  const handleNextMonth = () => {
    setModalMonthView(new Date(modalMonthYear, modalMonthIndex + 1, 1));
  };

  const handleSelectCalendarDay = (day: number) => {
    const newDate = new Date(modalMonthYear, modalMonthIndex, day);
    setModalDate(newDate);
  };

  const handlePresetDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setModalDate(d);
    setModalMonthView(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const isDayInPast = (day: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const check = new Date(modalMonthYear, modalMonthIndex, day);
    check.setHours(0, 0, 0, 0);
    return check.getTime() < today.getTime();
  };

  const isDayToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      modalMonthIndex === today.getMonth() &&
      modalMonthYear === today.getFullYear()
    );
  };

  const isDaySelected = (day: number) => {
    return (
      day === modalDate.getDate() &&
      modalMonthIndex === modalDate.getMonth() &&
      modalMonthYear === modalDate.getFullYear()
    );
  };

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
      facility_id: user.facility_id || undefined,
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
          console.warn(
            "API appointment creation failed, falling back to local SQLite outbox:",
            apiErr?.message || apiErr
          );
          await createAppointmentLocal(payload, false);
          if (apiErr?.message && !apiErr.message.includes("Network")) {
            setBookingError(`Note: Saved offline locally. Server responded: ${apiErr.message}`);
          }
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

  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(false);

  const displayedCalendarRows = useMemo(() => {
    if (!isCalendarCollapsed) return calendarRows;
    const targetDay =
      selectedDateNum ||
      (month === new Date().getMonth() && year === new Date().getFullYear()
        ? new Date().getDate()
        : 1);
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
    if (t.includes("prenatal")) return "#3b82f6";
    if (t.includes("postnatal") || t.includes("postpartum")) return "#10b981";
    if (t.includes("neonatal") || t.includes("newborn")) return "#f59e0b";
    return "#3b82f6";
  };

  const bottomScrollPadding = insets.bottom + 120;

  return (
    <View className="flex-1 bg-background">
      <Header />

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomScrollPadding }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        <View className="px-5 mb-4 mt-3 flex-row items-center justify-between">
          <Text className="text-foreground text-lg font-bold tracking-tight">Appointments</Text>

          <Pressable
            onPress={() => setIsModalOpen(true)}
            className="bg-[#3b82f6] py-2 px-3.5 rounded-xl flex-row items-center gap-1.5 active:bg-[#2563eb] shadow-sm"
          >
            <Ionicons name="add-circle" size={16} color="#ffffff" />
            <Text className="text-white font-bold text-sm">Schedule Visit</Text>
          </Pressable>
        </View>

        {!user?.facility_id && (
          <View className="mx-5 mb-4 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex-row items-center gap-3">
            <View className="size-9 rounded-xl bg-amber-500/20 items-center justify-center">
              <Ionicons name="business-outline" size={18} color="#f59e0b" />
            </View>
            <View className="flex-1">
              <Text className="text-amber-400 font-bold text-sm mb-0.5">
                No Health Center Linked
              </Text>
              <Text className="text-zinc-400 text-[11px] leading-4">
                Your account is not currently linked to a health center. Contact your facility staff
                to link your account.
              </Text>
            </View>
          </View>
        )}

        <View className="mx-5 mb-4 bg-surface border border-white/[0.08] rounded-2xl p-4">
          <View className="flex-row items-center justify-between mb-3 px-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-foreground font-bold text-sm">{monthName}</Text>
              <Pressable
                onPress={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
                className="px-2 py-0.5 rounded-full bg-default border border-white/10 flex-row items-center gap-1"
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
                className="size-7 items-center justify-center rounded-lg bg-default"
                onPress={() => {
                  setCurrentDate(new Date(year, month - 1, 1));
                  setSelectedDateNum(null);
                }}
              >
                <Ionicons name="chevron-back" size={14} color="#a1a1aa" />
              </Pressable>
              <Pressable
                className="size-7 items-center justify-center rounded-lg bg-default"
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
                    return (
                      d.getDate() === dateNum && d.getMonth() === month && d.getFullYear() === year
                    );
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
                              ? "bg-[#3b82f6]/20 border border-[#3b82f6]"
                              : isToday
                                ? "bg-[#3b82f6]"
                                : "bg-transparent"
                          }`}
                        >
                          <Text
                            className={`text-sm ${
                              isToday
                                ? "text-white font-bold"
                                : isSelected
                                  ? "text-[#3b82f6] font-bold"
                                  : "text-foreground font-normal"
                            }`}
                          >
                            {dateNum}
                          </Text>
                        </View>
                        {hasEvent && (
                          <View
                            className={`size-1.5 rounded-full ${
                              isToday ? "bg-white" : "bg-[#3b82f6]"
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

        <View className="px-5 mb-4 flex-row items-center gap-2">
          <View className="flex-1 bg-surface border border-white/[0.08] rounded-xl h-10 px-3 flex-row items-center gap-2">
            <Ionicons name="search-outline" size={15} color="#a1a1aa" />
            <TextInput
              value={searchValue}
              onChangeText={setSearchValue}
              placeholder="Search appointments..."
              placeholderTextColor="#a1a1aa"
              className="flex-1 text-sm text-foreground p-0"
            />
            {searchValue.length > 0 && (
              <Pressable onPress={() => setSearchValue("")}>
                <Ionicons name="close-circle" size={16} color="#71717a" />
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={() => setIsFilterModalOpen(true)}
            className={`h-10 px-3.5 rounded-xl border flex-row items-center gap-1.5 ${
              activeFilter !== "all"
                ? "bg-[#3b82f6]/15 border-[#3b82f6]"
                : "bg-surface border-white/[0.08]"
            }`}
          >
            <Ionicons
              name="options-outline"
              size={16}
              color={activeFilter !== "all" ? "#3b82f6" : "#a1a1aa"}
            />
            <Text
              className={`text-sm font-semibold ${activeFilter !== "all" ? "text-[#3b82f6]" : "text-zinc-300"}`}
            >
              {activeFilter === "all"
                ? "Filter"
                : activeFilter === "prenatal"
                  ? "Prenatal"
                  : activeFilter === "postnatal"
                    ? "Postnatal"
                    : "Neonatal"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={activeFilter !== "all" ? "#3b82f6" : "#a1a1aa"}
            />
          </Pressable>
        </View>

        <View className="px-5 gap-3">
          {selectedDateNum !== null && (
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-[#3b82f6] text-sm font-semibold">
                Showing visits for {monthName} {selectedDateNum}
              </Text>
              <Pressable onPress={() => setSelectedDateNum(null)}>
                <Text className="text-zinc-400 text-sm underline">Clear date filter</Text>
              </Pressable>
            </View>
          )}

          {isLoading && appointments.length === 0 ? (
            <ActivityIndicator size="small" color="#3b82f6" className="py-6" />
          ) : filteredAppointments.length > 0 ? (
            filteredAppointments.map((item) => {
              const d = parseLocalDate(item.appointment_date);
              const dayStr = d.toLocaleDateString("en-US", { weekday: "short" });
              const dateNum = d.getDate();
              const statusCfg = getAppointmentStatusConfig(item.status);
              const accentColor = statusCfg.color || getAccentColor(item.appointment_type);
              const isPendingSync = (item as any).sync_status === "pending";

              return (
                <Pressable
                  key={item.appointment_id}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/appointment-detail",
                      params: { id: item.appointment_id },
                    })
                  }
                >
                  <View className="bg-surface border border-white/[0.08] rounded-2xl flex-row items-center overflow-hidden h-[84px]">
                    <View style={{ width: 4, height: "100%", backgroundColor: accentColor }} />

                    <View className="px-3.5 flex-1 flex-row items-center gap-3">
                      <View className="items-center justify-center size-12 rounded-xl bg-default">
                        <Text className="text-zinc-400 text-[11px] font-medium leading-none">
                          {dayStr}
                        </Text>
                        <Text className="text-foreground text-base font-bold leading-tight mt-0.5">
                          {dateNum}
                        </Text>
                      </View>

                      <View className="flex-1 justify-center">
                        <View className="flex-row items-center justify-between">
                          <Text
                            className="text-foreground text-[15px] font-semibold flex-1 mr-2"
                            numberOfLines={1}
                          >
                            {item.appointment_type}
                          </Text>

                          {isPendingSync && (
                            <View className="bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded">
                              <Text className="text-amber-300 text-[10px] font-medium">
                                Pending Sync
                              </Text>
                            </View>
                          )}
                        </View>

                        <View className="flex-row items-center justify-between mt-1">
                          <Text
                            className="text-zinc-400 text-sm font-medium flex-1 mr-2"
                            numberOfLines={1}
                          >
                            {formatTime12h(item.appointment_time)}
                            {item.reason && item.reason.trim().length > 0
                              ? ` · ${item.reason}`
                              : ""}
                          </Text>

                          <View className="flex-row items-center gap-1.5">
                            <View
                              className="size-2 rounded-full"
                              style={{ backgroundColor: statusCfg.color }}
                            />
                            <Text
                              className="text-sm font-semibold"
                              style={{ color: statusCfg.color }}
                            >
                              {statusCfg.label}
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
            <View className="p-6 bg-surface border border-white/[0.08] rounded-2xl items-center">
              <Ionicons name="calendar-outline" size={24} color="#a1a1aa" className="mb-2" />
              <Text className="text-foreground font-semibold text-sm mb-1">
                No appointments found
              </Text>
              <Text className="text-zinc-400 text-sm text-center">
                {searchValue.trim() || activeFilter !== "all" || selectedDateNum !== null
                  ? "No appointments match your filters."
                  : "You have no upcoming or past visits."}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={isModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View className="flex-1 bg-black/70 justify-end sm:justify-center items-center">
          <View
            style={{ paddingBottom: Math.max(insets.bottom + 12, 28) }}
            className="w-full max-w-lg bg-surface border-t sm:border border-white/[0.12] rounded-t-[28px] sm:rounded-3xl p-5 max-h-[92%] flex-col"
          >
            {/* iOS Sheet Grabber */}
            <View className="w-10 h-1 rounded-full bg-zinc-600/70 self-center mb-3" />

            {/* Header */}
            <View className="flex-row justify-between items-center pb-3 border-b border-white/[0.08] mb-3.5">
              <View>
                <Text className="text-foreground text-lg font-bold">Schedule Appointment</Text>
                <Text className="text-zinc-400 text-xs mt-0.5">
                  Select visit type, date, and preferred time
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  setIsModalOpen(false);
                  setBookingError(null);
                }}
                className="size-8 items-center justify-center rounded-full bg-default active:opacity-70"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color="#a1a1aa" />
              </Pressable>
            </View>

            {bookingError && (
              <View className="mb-3 p-3 bg-red-500/10 border border-red-500/25 rounded-2xl flex-row items-center gap-2">
                <Ionicons name="alert-circle" size={18} color="#ef4444" />
                <Text className="text-red-400 text-xs flex-1 font-medium">{bookingError}</Text>
              </View>
            )}

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 16, paddingBottom: 8 }}
            >
              {!user?.facility_id && (
                <View className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex-row items-center gap-2.5">
                  <Ionicons name="information-circle-outline" size={18} color="#f59e0b" />
                  <Text className="text-amber-300 text-xs flex-1 leading-4">
                    Your account is not linked to a facility yet. Your appointment will be submitted
                    for pending assignment.
                  </Text>
                </View>
              )}

              {/* Visit Type - Segmented Selector */}
              <View>
                <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Visit Type
                </Text>
                <View className="flex-row bg-default p-1 rounded-2xl border border-white/[0.06] gap-1">
                  {VISIT_TYPES.map((type) => {
                    const isSelected = bookingType === type.id;
                    const shortLabel = type.label
                      .replace(" Visit", "")
                      .replace(" Checkup", "")
                      .replace(" Screening", "");
                    return (
                      <Pressable
                        key={type.id}
                        onPress={() => setBookingType(type.id)}
                        className={`flex-1 py-2.5 px-2 rounded-xl items-center justify-center flex-row gap-1.5 ${
                          isSelected ? "bg-[#0284c7] shadow-sm" : "bg-transparent active:opacity-70"
                        }`}
                      >
                        <Ionicons
                          name={type.icon as any}
                          size={15}
                          color={isSelected ? "#ffffff" : "#a1a1aa"}
                        />
                        <Text
                          numberOfLines={1}
                          className={`text-xs font-semibold ${
                            isSelected ? "text-white" : "text-zinc-400"
                          }`}
                        >
                          {shortLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Date Selection */}
              <View>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                    Date
                  </Text>

                  <Pressable
                    onPress={() => {
                      setModalMonthView(new Date(modalDate.getFullYear(), modalDate.getMonth(), 1));
                      setIsCustomDatePickerOpen(true);
                    }}
                    className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-xl bg-default border border-white/[0.06] active:bg-surface-secondary"
                  >
                    <Ionicons name="calendar-outline" size={13} color="#38bdf8" />
                    <Text className="text-[#38bdf8] font-bold text-xs">
                      {modalDate.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <Ionicons name="chevron-forward" size={11} color="#71717a" />
                  </Pressable>
                </View>

                {/* Horizontal Date Picker */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {/* If user picked a custom date beyond 14 days, show it at the front */}
                  {modalDate.getTime() - new Date().setHours(0, 0, 0, 0) >=
                    14 * 24 * 60 * 60 * 1000 && (
                    <Pressable
                      onPress={() => {}}
                      className="w-16 py-2.5 rounded-2xl items-center justify-center border bg-[#0284c7] border-[#0284c7] shadow-sm"
                    >
                      <Text className="text-[10px] font-semibold text-white/80">
                        {modalDate.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                      </Text>
                      <Text className="text-base font-bold my-0.5 text-white">
                        {modalDate.getDate()}
                      </Text>
                      <Text className="text-[10px] font-medium text-white/80">
                        {modalDate.toLocaleDateString("en-US", { month: "short" })}
                      </Text>
                    </Pressable>
                  )}

                  {Array.from({ length: 14 }).map((_, idx) => {
                    const d = new Date();
                    d.setDate(d.getDate() + idx);
                    const isSelectedDate =
                      d.getDate() === modalDate.getDate() &&
                      d.getMonth() === modalDate.getMonth() &&
                      d.getFullYear() === modalDate.getFullYear();

                    const isToday = idx === 0;
                    const dayName = d
                      .toLocaleDateString("en-US", { weekday: "short" })
                      .toUpperCase();
                    const dayNum = d.getDate();
                    const monthName = d.toLocaleDateString("en-US", { month: "short" });

                    return (
                      <Pressable
                        key={d.toISOString()}
                        onPress={() => setModalDate(d)}
                        className={`w-14 py-2.5 rounded-2xl items-center justify-center border ${
                          isSelectedDate
                            ? "bg-[#0284c7] border-[#0284c7] shadow-sm"
                            : "bg-surface-secondary border-white/[0.06] active:bg-default"
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-semibold ${isSelectedDate ? "text-white/80" : "text-zinc-400"}`}
                        >
                          {isToday ? "TODAY" : dayName}
                        </Text>
                        <Text
                          className={`text-base font-bold my-0.5 ${isSelectedDate ? "text-white" : "text-foreground"}`}
                        >
                          {dayNum}
                        </Text>
                        <Text
                          className={`text-[10px] font-medium ${isSelectedDate ? "text-white/80" : "text-zinc-500"}`}
                        >
                          {monthName}
                        </Text>
                      </Pressable>
                    );
                  })}

                  {/* Pick other date button at the end of the strip */}
                  <Pressable
                    onPress={() => {
                      setModalMonthView(new Date(modalDate.getFullYear(), modalDate.getMonth(), 1));
                      setIsCustomDatePickerOpen(true);
                    }}
                    className="w-14 py-2.5 rounded-2xl items-center justify-center border border-dashed border-white/[0.15] bg-default/60 active:bg-surface-secondary"
                  >
                    <Ionicons name="calendar" size={16} color="#38bdf8" />
                    <Text className="text-[10px] font-semibold text-zinc-300 mt-1">More</Text>
                    <Text className="text-[9px] text-zinc-500">Dates...</Text>
                  </Pressable>
                </ScrollView>
              </View>

              {/* Preferred Time Selector */}
              <View>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                    Preferred Time
                  </Text>
                  <View className="flex-row items-center gap-1.5 bg-[#0284c7]/15 px-2.5 py-1 rounded-full border border-[#0284c7]/30">
                    <Ionicons name="time-outline" size={13} color="#38bdf8" />
                    <Text className="text-[#38bdf8] font-bold text-xs">{bookingTime}</Text>
                  </View>
                </View>

                {/* Period Switcher: Morning (AM) vs Afternoon (PM) */}
                <View className="flex-row bg-default p-1 rounded-2xl border border-white/[0.06] gap-1 mb-2.5">
                  <Pressable
                    onPress={() => {
                      if (!bookingTime.includes("AM")) setBookingTime("09:00 AM");
                    }}
                    className={`flex-1 py-2 px-2 rounded-xl items-center justify-center flex-row gap-1.5 ${
                      bookingTime.includes("AM")
                        ? "bg-[#0284c7] shadow-sm"
                        : "bg-transparent active:opacity-70"
                    }`}
                  >
                    <Ionicons
                      name="sunny-outline"
                      size={14}
                      color={bookingTime.includes("AM") ? "#ffffff" : "#a1a1aa"}
                    />
                    <Text
                      className={`text-xs font-semibold ${
                        bookingTime.includes("AM") ? "text-white" : "text-zinc-400"
                      }`}
                    >
                      Morning
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      if (!bookingTime.includes("PM")) setBookingTime("02:00 PM");
                    }}
                    className={`flex-1 py-2 px-2 rounded-xl items-center justify-center flex-row gap-1.5 ${
                      bookingTime.includes("PM")
                        ? "bg-[#0284c7] shadow-sm"
                        : "bg-transparent active:opacity-70"
                    }`}
                  >
                    <Ionicons
                      name="partly-sunny-outline"
                      size={14}
                      color={bookingTime.includes("PM") ? "#ffffff" : "#a1a1aa"}
                    />
                    <Text
                      className={`text-xs font-semibold ${
                        bookingTime.includes("PM") ? "text-white" : "text-zinc-400"
                      }`}
                    >
                      Afternoon
                    </Text>
                  </Pressable>
                </View>

                {/* Time Slots Grid (4 Columns) */}
                <View className="flex-row gap-2">
                  {(bookingTime.includes("AM") ? MORNING_SLOTS : AFTERNOON_SLOTS).map((slot) => {
                    const isSelected = bookingTime === slot;
                    const parts = slot.split(" ");
                    const hour = parts[0];
                    const meridiem = parts[1];

                    return (
                      <Pressable
                        key={slot}
                        onPress={() => setBookingTime(slot)}
                        className={`flex-1 py-2.5 rounded-2xl items-center justify-center border ${
                          isSelected
                            ? "bg-[#0284c7] border-[#0284c7] shadow-sm"
                            : "bg-surface-secondary border-white/[0.06] active:bg-default"
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            isSelected ? "text-white" : "text-foreground"
                          }`}
                        >
                          {hour}
                        </Text>
                        <Text
                          className={`text-[10px] font-medium mt-0.5 ${
                            isSelected ? "text-white/80" : "text-zinc-500"
                          }`}
                        >
                          {meridiem}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Notes / Reason */}
              <View className="mt-1">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                    Reason or Notes
                  </Text>
                  <Text className="text-zinc-500 text-[11px]">Optional</Text>
                </View>
                <TextInput
                  value={bookingReason}
                  onChangeText={setBookingReason}
                  placeholder="e.g. Regular prenatal checkup, headache, ultrasound review"
                  placeholderTextColor="#71717a"
                  multiline
                  numberOfLines={2}
                  style={{ textAlignVertical: "top" }}
                  className="bg-surface-secondary border border-white/[0.06] rounded-2xl p-3.5 text-foreground text-sm min-h-[64px]"
                />
              </View>
            </ScrollView>

            {/* iOS Primary Action Button */}
            <View className="pt-3.5 pb-2 border-t border-white/[0.08]">
              <Pressable
                onPress={handleBookAppointment}
                disabled={isSubmitting}
                className="w-full h-12 rounded-2xl bg-[#0284c7] flex-row items-center justify-center gap-2 active:bg-[#0369a1] shadow-md"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="calendar-outline" size={18} color="white" />
                    <Text className="text-white font-bold text-base">Confirm Appointment</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Month Calendar Modal for picking dates months in advance */}
      <Modal
        visible={isCustomDatePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCustomDatePickerOpen(false)}
      >
        <Pressable
          onPress={() => setIsCustomDatePickerOpen(false)}
          className="flex-1 bg-black/80 justify-center items-center p-5"
        >
          <Pressable className="w-full max-w-sm bg-surface border border-white/[0.12] rounded-3xl p-5 gap-3 shadow-2xl">
            <View className="flex-row items-center justify-between pb-3 border-b border-white/[0.08]">
              <View className="flex-row items-center gap-2">
                <Ionicons name="calendar" size={18} color="#0284c7" />
                <Text className="text-foreground font-bold text-base">Select Date</Text>
              </View>
              <Pressable
                onPress={() => setIsCustomDatePickerOpen(false)}
                className="size-7 items-center justify-center rounded-full bg-default active:opacity-70"
              >
                <Ionicons name="close" size={16} color="#a1a1aa" />
              </Pressable>
            </View>

            {/* Quick 1-Tap Presets */}
            <View className="flex-row flex-wrap gap-1.5 pt-1">
              {[
                { label: "Today", days: 0 },
                { label: "+1 Wk", days: 7 },
                { label: "+2 Wks", days: 14 },
                { label: "+1 Mo", days: 30 },
                { label: "+2 Mo", days: 60 },
                { label: "+3 Mo", days: 90 },
              ].map((p) => (
                <Pressable
                  key={p.label}
                  onPress={() => {
                    handlePresetDate(p.days);
                    setIsCustomDatePickerOpen(false);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-default border border-white/[0.06] active:bg-surface-secondary"
                >
                  <Text className="text-zinc-300 text-xs font-medium">{p.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Month Calendar */}
            <View className="bg-surface-secondary border border-white/[0.06] rounded-2xl p-3 mt-1">
              {/* Month Nav Bar */}
              <View className="flex-row justify-between items-center mb-2.5">
                <Pressable
                  onPress={handlePrevMonth}
                  disabled={isPrevMonthDisabled}
                  className={`size-8 rounded-xl items-center justify-center bg-default ${
                    isPrevMonthDisabled ? "opacity-30" : "active:opacity-70"
                  }`}
                >
                  <Ionicons name="chevron-back" size={16} color="#a1a1aa" />
                </Pressable>

                <Text className="text-foreground text-sm font-bold">{modalMonthName}</Text>

                <Pressable
                  onPress={handleNextMonth}
                  className="size-8 rounded-xl items-center justify-center bg-default active:opacity-70"
                >
                  <Ionicons name="chevron-forward" size={16} color="#a1a1aa" />
                </Pressable>
              </View>

              {/* Weekday headers */}
              <View className="flex-row justify-between mb-1 px-0.5">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
                  <Text
                    key={i}
                    className="flex-1 text-center text-[10px] font-semibold text-zinc-500"
                  >
                    {d}
                  </Text>
                ))}
              </View>

              {/* Day Cells Grid */}
              <View className="flex-row flex-wrap">
                {modalCalendarCells.map((day, idx) => {
                  if (day === null) {
                    return <View key={`empty-${idx}`} className="w-[14.28%] aspect-square" />;
                  }

                  const past = isDayInPast(day);
                  const selected = isDaySelected(day);
                  const today = isDayToday(day);

                  return (
                    <View
                      key={`day-${day}`}
                      className="w-[14.28%] p-0.5 aspect-square items-center justify-center"
                    >
                      <Pressable
                        disabled={past}
                        onPress={() => {
                          handleSelectCalendarDay(day);
                          setIsCustomDatePickerOpen(false);
                        }}
                        className={`w-full h-full rounded-xl items-center justify-center ${
                          selected
                            ? "bg-[#0284c7] shadow-sm"
                            : today
                              ? "border border-[#0284c7]/80 bg-default"
                              : past
                                ? "opacity-20"
                                : "active:bg-default"
                        }`}
                      >
                        <Text
                          className={`text-xs ${
                            selected
                              ? "text-white font-bold"
                              : today
                                ? "text-[#38bdf8] font-bold"
                                : past
                                  ? "text-zinc-600"
                                  : "text-foreground font-semibold"
                          }`}
                        >
                          {day}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>

            <Pressable
              onPress={() => setIsCustomDatePickerOpen(false)}
              className="w-full py-3 rounded-2xl bg-[#0284c7] items-center justify-center active:bg-[#0369a1] mt-1"
            >
              <Text className="text-white font-bold text-sm">Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isFilterModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <Pressable
          onPress={() => setIsFilterModalOpen(false)}
          className="flex-1 bg-black/80 justify-center items-center p-5"
        >
          <Pressable className="w-full max-w-sm bg-surface border border-white/[0.12] rounded-3xl p-5 gap-3 shadow-2xl">
            <View className="flex-row items-center justify-between pb-3 border-b border-white/[0.08]">
              <View className="flex-row items-center gap-2">
                <Ionicons name="options-outline" size={18} color="#3b82f6" />
                <Text className="text-foreground font-bold text-base">Filter Appointments</Text>
              </View>
              <Pressable
                onPress={() => setIsFilterModalOpen(false)}
                className="size-7 items-center justify-center rounded-full bg-default"
              >
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
                        ? "bg-default border-[#3b82f6]"
                        : "bg-surface-secondary border-white/[0.06]"
                    }`}
                  >
                    <View className="flex-1 mr-2">
                      <Text
                        className={`text-sm font-bold ${isSelected ? "text-[#3b82f6]" : "text-foreground"}`}
                      >
                        {opt.label}
                      </Text>
                      <Text className="text-zinc-400 text-[11px] mt-0.5">{opt.desc}</Text>
                    </View>
                    <View
                      className={`size-5 rounded-full border items-center justify-center ${
                        isSelected
                          ? "border-[#3b82f6] bg-[#3b82f6]"
                          : "border-zinc-600 bg-transparent"
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
