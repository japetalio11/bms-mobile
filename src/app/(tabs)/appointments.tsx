import { View, ScrollView, Pressable, ActivityIndicator, Modal } from "react-native";
import type { JSX } from "react";
import { Card, Text, SearchField } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useState, useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header } from "../../components/Header";
import { useAuth } from "../../context/UserContext";
import { getAppointmentsByUserApi, createAppointmentApi } from "../../config/api";
import type { AppointmentRecord } from "../../config/api";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AppointmentsScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();

  const [activeFilter, setActiveFilter] = useState<"all" | "prenatal" | "postnatal" | "neonatal">("all");
  const [searchValue, setSearchValue] = useState("");
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateNum, setSelectedDateNum] = useState<number | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("09:00 AM");
  const [bookingType, setBookingType] = useState("Prenatal Visit");
  const [bookingReason, setBookingReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      if (user?.user_id && token) {
        setIsLoading(true);
        getAppointmentsByUserApi(user.user_id, token)
          .then((res) => {
            if (isMounted) setAppointments(res);
          })
          .catch(() => {})
          .finally(() => {
            if (isMounted) setIsLoading(false);
          });
      }
      return () => {
        isMounted = false;
      };
    }, [user?.user_id, token])
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
      // Filter by selected date on the calendar grid if clicked
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

      // Search filter
      if (searchValue.trim()) {
        const q = searchValue.toLowerCase();
        const matchType = item.appointment_type.toLowerCase().includes(q);
        const matchReason = (item.reason || "").toLowerCase().includes(q);
        if (!matchType && !matchReason) return false;
      }

      // Category filter
      if (activeFilter === "all") return true;
      if (activeFilter === "prenatal") return item.appointment_type.toLowerCase().includes("prenatal");
      if (activeFilter === "postnatal")
        return item.appointment_type.toLowerCase().includes("postpartum") || item.appointment_type.toLowerCase().includes("postnatal");
      if (activeFilter === "neonatal")
        return item.appointment_type.toLowerCase().includes("newborn") || item.appointment_type.toLowerCase().includes("neonatal");
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

  const handleBookAppointment = async () => {
    if (!user?.user_id || !token) return;
    if (!bookingDate.trim()) {
      setBookingError("Please specify an appointment date (YYYY-MM-DD)");
      return;
    }

    setIsSubmitting(true);
    setBookingError(null);
    try {
      await createAppointmentApi(
        {
          user_id: user.user_id,
          appointment_date: bookingDate.trim(),
          appointment_time: bookingTime.trim() || "09:00 AM",
          appointment_type: bookingType,
          reason: bookingReason.trim() || undefined,
        },
        token
      );

      setIsModalOpen(false);
      setBookingDate("");
      setBookingReason("");

      const res = await getAppointmentsByUserApi(user.user_id, token);
      setAppointments(res);
    } catch (err: any) {
      setBookingError(err.message || "Failed to schedule appointment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAccentColor = (typeStr: string) => {
    const t = typeStr.toLowerCase();
    if (t.includes("prenatal")) return "#0284c7"; // sky/blue accent
    if (t.includes("postnatal") || t.includes("postpartum")) return "#10b981"; // emerald/green
    if (t.includes("neonatal") || t.includes("newborn")) return "#f59e0b"; // amber/orange
    return "#6366f1"; // indigo
  };

  // Dynamic bottom padding to eliminate bottom nav overlap
  const bottomScrollPadding = insets.bottom + 110;

  return (
    <View className="flex-1 bg-[#0A0A0D]">
      <Header />

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomScrollPadding }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Action Header Row */}
        <View className="px-5 mb-4 mt-3 flex-row items-center justify-between">
          <Text className="text-white text-xl font-bold tracking-tight">Appointments</Text>

          <Pressable
            onPress={() => setIsModalOpen(true)}
            className="bg-[#212129] border border-white/10 py-2.5 px-4 rounded-xl flex-row items-center gap-1.5 active:bg-[#2a2a35]"
          >
            <Ionicons name="add-circle" size={16} color="#ffffff" />
            <Text className="text-white font-semibold text-xs">New Visit</Text>
          </Pressable>
        </View>

        {/* ── 1. Full Calendar Grid Card (Level 1 Surface) ── */}
        <View className="mx-5 mb-4 bg-[#16161C] border border-white/[0.08] rounded-2xl p-4">
          {/* Month Navigation */}
          <View className="flex-row items-center justify-between mb-3 px-1">
            <Text className="text-white font-semibold text-sm">{monthName}</Text>
            <View className="flex-row gap-1">
              <Pressable
                className="size-7 items-center justify-center rounded-lg bg-[#212129]"
                onPress={() => {
                  setCurrentDate(new Date(year, month - 1, 1));
                  setSelectedDateNum(null);
                }}
              >
                <Ionicons name="chevron-back" size={14} color="#a1a1aa" />
              </Pressable>
              <Pressable
                className="size-7 items-center justify-center rounded-lg bg-[#212129]"
                onPress={() => {
                  setCurrentDate(new Date(year, month + 1, 1));
                  setSelectedDateNum(null);
                }}
              >
                <Ionicons name="chevron-forward" size={14} color="#a1a1aa" />
              </Pressable>
            </View>
          </View>

          {/* 7 Equal Columns Day Headers */}
          <View className="flex-row w-full mb-2 border-b border-white/[0.06] pb-2">
            {DAYS.map((day) => (
              <View key={day} className="w-[14.28%] items-center justify-center">
                <Text className="text-zinc-400 text-[11px] font-medium text-center">{day}</Text>
              </View>
            ))}
          </View>

          {/* 7 Equal Columns Date Grid Rows */}
          {calendarRows.map((row, rowIndex) => (
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
                              ? "bg-sky-500/20 border border-sky-400"
                              : isToday
                              ? "bg-sky-500"
                              : "bg-transparent"
                          }`}
                        >
                          <Text
                            className={`text-xs ${
                              isToday
                                ? "text-white font-bold"
                                : isSelected
                                ? "text-sky-400 font-bold"
                                : "text-white font-normal"
                            }`}
                          >
                            {dateNum}
                          </Text>
                        </View>
                        {/* Dot indicator ALWAYS below number */}
                        {hasEvent && (
                          <View
                            className={`size-1.5 rounded-full ${
                              isToday ? "bg-white" : "bg-sky-400"
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

        {/* ── 2. Clean Action Shortcuts Row (Full Calendar & Visit History) ── */}
        <View className="px-5 mb-4 flex-row gap-2.5">
          <Pressable
            onPress={() => router.push("/(tabs)/calendar")}
            className="flex-1 bg-[#16161C] border border-white/[0.08] py-2.5 px-3 rounded-xl flex-row items-center justify-center gap-2 active:bg-[#212129]"
          >
            <Ionicons name="calendar-outline" size={15} color="#0284c7" />
            <Text className="text-white font-medium text-xs">Full Calendar</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(tabs)/history")}
            className="flex-1 bg-[#16161C] border border-white/[0.08] py-2.5 px-3 rounded-xl flex-row items-center justify-center gap-2 active:bg-[#212129]"
          >
            <Ionicons name="time-outline" size={15} color="#10b981" />
            <Text className="text-white font-medium text-xs">Visit History</Text>
          </Pressable>
        </View>

        {/* ── 3. Category Filter Pills Row ── */}
        <View className="mb-4 relative">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingRight: 36 }}
          >
            {[
              { id: "all", label: "All Visits" },
              { id: "prenatal", label: "Prenatal" },
              { id: "postnatal", label: "Postnatal" },
              { id: "neonatal", label: "Neonatal" },
            ].map((tab) => {
              const isSelected = activeFilter === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveFilter(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl border ${
                    isSelected
                      ? "bg-[#212129] border-sky-500/50"
                      : "bg-[#16161C] border-white/[0.08]"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      isSelected ? "text-sky-400 font-semibold" : "text-zinc-400"
                    }`}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {/* Subtle Right Edge Fade Indicator */}
          <View className="absolute right-0 top-0 bottom-0 w-8 bg-[#0A0A0D]/80 pointer-events-none" />
        </View>

        {/* ── 4. Search Bar ── */}
        <View className="px-5 mb-4">
          <SearchField value={searchValue} onChange={setSearchValue}>
            <SearchField.Group className="bg-[#16161C] border border-white/[0.08] rounded-xl h-10 px-3">
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search appointments..." className="text-xs text-white" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </View>

        {/* ── 5. Appointment List with Restructured Hierarchy ── */}
        <View className="px-5 gap-3">
          {selectedDateNum !== null && (
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-sky-400 text-xs font-medium">
                Showing visits for {monthName} {selectedDateNum}
              </Text>
              <Pressable onPress={() => setSelectedDateNum(null)}>
                <Text className="text-zinc-400 text-xs underline">Clear date filter</Text>
              </Pressable>
            </View>
          )}

          {isLoading ? (
            <ActivityIndicator size="small" color="#0284c7" className="py-6" />
          ) : filteredAppointments.length > 0 ? (
            filteredAppointments.map((item) => {
              const d = parseLocalDate(item.appointment_date);
              const dayStr = d.toLocaleDateString("en-US", { weekday: "short" });
              const dateNum = d.getDate();
              const formattedDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              const isCompleted = item.status.toLowerCase() === "completed";
              const accentColor = getAccentColor(item.appointment_type);

              return (
                <Pressable key={item.appointment_id} onPress={() => router.push("/(tabs)/appointment-detail")}>
                  <View className="bg-[#16161C] border border-white/[0.08] rounded-2xl flex-row overflow-hidden">
                    {/* Thin Left Accent Bar */}
                    <View style={{ width: 4, backgroundColor: accentColor }} />

                    <View className="p-3.5 flex-1 flex-row items-center gap-3">
                      {/* Date Badge */}
                      <View className="items-center justify-center w-12 py-2 rounded-xl bg-[#212129]">
                        <Text className="text-zinc-400 text-[11px] font-medium">{dayStr}</Text>
                        <Text className="text-white text-base font-bold">{dateNum}</Text>
                      </View>

                      {/* Card Content */}
                      <View className="flex-1 justify-center">
                        <Text className="text-white text-[16px] font-semibold mb-1" numberOfLines={1}>
                          {item.appointment_type}
                        </Text>

                        <View className="flex-row items-center justify-between">
                          <Text className="text-zinc-400 text-xs">
                            {formattedDate} · {item.appointment_time}
                          </Text>

                          {/* Status Dot + Short Label */}
                          <View className="flex-row items-center gap-1.5">
                            <View
                              className="size-2 rounded-full"
                              style={{ backgroundColor: isCompleted ? "#10b981" : "#0284c7" }}
                            />
                            <Text
                              className="text-xs font-normal"
                              style={{ color: isCompleted ? "#10b981" : "#0284c7" }}
                            >
                              {item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase()}
                            </Text>
                          </View>
                        </View>

                        {/* Note (only if non-empty) */}
                        {item.reason && item.reason.trim().length > 0 ? (
                          <Text className="text-zinc-400 text-[12px] font-normal mt-1.5" numberOfLines={1}>
                            Note: {item.reason}
                          </Text>
                        ) : null}
                      </View>

                      <Ionicons name="chevron-forward" size={16} color="#71717a" />
                    </View>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View className="p-6 bg-[#16161C] border border-white/[0.08] rounded-2xl items-center">
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

      {/* Booking Modal */}
      <Modal visible={isModalOpen} transparent animationType="fade" onRequestClose={() => setIsModalOpen(false)}>
        <View className="flex-1 bg-black/75 justify-center items-center p-5">
          <View className="w-full max-w-md bg-[#16161C] p-5 rounded-2xl border border-white/[0.1]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-lg font-bold">Schedule Visit</Text>
              <Pressable
                onPress={() => { setIsModalOpen(false); setBookingError(null); }}
                className="size-7 items-center justify-center rounded-full bg-[#212129]"
              >
                <Ionicons name="close" size={18} color="#a1a1aa" />
              </Pressable>
            </View>

            {bookingError && (
              <View className="mb-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg flex-row items-center gap-2">
                <Ionicons name="alert-circle-outline" size={16} className="text-red-500" />
                <Text className="text-red-500 text-xs flex-1">{bookingError}</Text>
              </View>
            )}

            <View className="gap-3.5 mb-5">
              <View>
                <Text className="text-white text-xs font-medium mb-1">Visit Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {["Prenatal Visit", "Postnatal Checkup", "Neonatal Screening"].map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setBookingType(type)}
                      className={`px-3 py-1.5 rounded-lg border ${
                        bookingType === type
                          ? "bg-[#212129] border-sky-500"
                          : "bg-[#16161C] border-white/[0.08]"
                      }`}
                    >
                      <Text className={`text-xs font-medium ${bookingType === type ? "text-sky-400" : "text-zinc-400"}`}>
                        {type}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View>
                <Text className="text-white text-xs font-medium mb-1">Date (YYYY-MM-DD)</Text>
                <SearchField value={bookingDate} onChange={setBookingDate}>
                  <SearchField.Group className="bg-[#212129] border border-white/[0.08] rounded-lg h-10 px-3">
                    <SearchField.Input placeholder="2026-08-28" className="text-xs text-white" />
                  </SearchField.Group>
                </SearchField>
              </View>

              <View>
                <Text className="text-white text-xs font-medium mb-1">Time</Text>
                <SearchField value={bookingTime} onChange={setBookingTime}>
                  <SearchField.Group className="bg-[#212129] border border-white/[0.08] rounded-lg h-10 px-3">
                    <SearchField.Input placeholder="09:00 AM" className="text-xs text-white" />
                  </SearchField.Group>
                </SearchField>
              </View>

              <View>
                <Text className="text-white text-xs font-medium mb-1">Notes (Optional)</Text>
                <SearchField value={bookingReason} onChange={setBookingReason}>
                  <SearchField.Group className="bg-[#212129] border border-white/[0.08] rounded-lg h-10 px-3">
                    <SearchField.Input placeholder="Reason for visit" className="text-xs text-white" />
                  </SearchField.Group>
                </SearchField>
              </View>
            </View>

            <View className="flex-row gap-2.5">
              <Pressable
                onPress={() => { setIsModalOpen(false); setBookingError(null); }}
                className="flex-1 py-2.5 rounded-xl bg-[#212129] items-center"
              >
                <Text className="text-white font-medium text-xs">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleBookAppointment}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-sky-600 flex-row items-center justify-center gap-1.5 active:bg-sky-700"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Ionicons name="checkmark" size={16} color="white" />
                )}
                <Text className="text-white font-semibold text-xs">
                  {isSubmitting ? "Saving..." : "Confirm"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
