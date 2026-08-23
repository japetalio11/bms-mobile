import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import type { JSX } from "react";
import { Tabs, Card, SearchField, Text } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { Header } from "../../components/Header";
import { useAuth } from "../../context/UserContext";
import { getAppointmentsByUserApi } from "../../config/api";
import type { AppointmentRecord } from "../../config/api";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AppointmentsScreen(): JSX.Element {
  const router = useRouter();
  const { user, token } = useAuth();

  const [activeTab, setActiveTab] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    let isMounted = true;
    if (user?.user_id && token) {
      getAppointmentsByUserApi(user.user_id, token)
        .then((res) => { if (isMounted) setAppointments(res); })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [user?.user_id, token]);

  const filteredAppointments = appointments.filter((item) => {
    if (searchValue.trim()) {
      const q = searchValue.toLowerCase();
      const matchType = item.appointment_type.toLowerCase().includes(q);
      const matchReason = (item.reason || "").toLowerCase().includes(q);
      if (!matchType && !matchReason) return false;
    }
    if (activeTab === "all") return true;
    if (activeTab === "prenatal") return item.appointment_type.toLowerCase().includes("prenatal");
    if (activeTab === "postnatal") return item.appointment_type.toLowerCase().includes("postpartum") || item.appointment_type.toLowerCase().includes("postnatal");
    if (activeTab === "neonatal") return item.appointment_type.toLowerCase().includes("newborn") || item.appointment_type.toLowerCase().includes("neonatal");
    return true;
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarRows: (number | null)[][] = [];
  let dayCounter = 1;
  for (let r = 0; r < 5; r++) {
    const row: (number | null)[] = [];
    for (let c = 0; c < 7; c++) {
      if ((r === 0 && c < firstDay) || dayCounter > daysInMonth) {
        row.push(null);
      } else {
        row.push(dayCounter++);
      }
    }
    calendarRows.push(row);
  }

  const renderCalendar = () => (
    <Card variant="secondary" className="mx-5 mb-5 rounded-xl p-5 bg-surface border-0">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-[#6366f1] font-semibold text-base">{monthName}</Text>
        <View className="flex-row gap-1">
          <Pressable
            className="size-8 items-center justify-center rounded-full bg-default"
            onPress={() => setCurrentDate(new Date(year, month - 1, 1))}
          >
            <Ionicons name="chevron-back" size={16} color="#a1a1aa" />
          </Pressable>
          <Pressable
            className="size-8 items-center justify-center rounded-full bg-default"
            onPress={() => setCurrentDate(new Date(year, month + 1, 1))}
          >
            <Ionicons name="chevron-forward" size={16} color="#a1a1aa" />
          </Pressable>
        </View>
      </View>

      <View className="flex-row justify-between mb-3">
        {DAYS.map((day) => (
          <Text key={day} className="text-muted text-sm flex-1 text-center font-medium">
            {day}
          </Text>
        ))}
      </View>

      {calendarRows.map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row justify-between mb-2">
          {row.map((dateNum, colIndex) => {
            const isToday =
              dateNum !== null &&
              dateNum === new Date().getDate() &&
              month === new Date().getMonth() &&
              year === new Date().getFullYear();

            return (
              <View key={colIndex} className="flex-1 items-center justify-center py-1">
                <View
                  className={`size-8 items-center justify-center rounded-full ${
                    isToday ? "bg-accent" : ""
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      dateNum === null
                        ? "opacity-0"
                        : isToday
                        ? "text-white font-semibold"
                        : "text-foreground font-medium"
                    }`}
                  >
                    {dateNum || ""}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </Card>
  );

  return (
    <View className="flex-1 bg-background">
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {renderCalendar()}

        {/* Quick Actions */}
        <View className="px-5 mb-5 flex-row gap-3">
          <Pressable
            onPress={() => router.push("/(tabs)/calendar")}
            className="flex-1 bg-surface py-3 px-4 rounded-xl flex-row items-center gap-2 justify-center"
          >
            <Ionicons name="calendar-outline" size={18} color="#6366f1" />
            <Text className="text-foreground font-medium text-sm">Full Calendar</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/history")}
            className="flex-1 bg-surface py-3 px-4 rounded-xl flex-row items-center gap-2 justify-center"
          >
            <Ionicons name="time-outline" size={18} color="#10b981" />
            <Text className="text-foreground font-medium text-sm">Visit History</Text>
          </Pressable>
        </View>

        {/* Consistent Tab bar */}
        <View className="px-5 mb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} variant="primary">
            <Tabs.List className="bg-default p-1 rounded-xl">
              <Tabs.Indicator className="bg-surface-secondary rounded-xl" />
              <Tabs.Trigger value="all">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                    All
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="prenatal">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                    Prenatal
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="postnatal">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                    Postnatal
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="neonatal">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                    Neonatal
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </View>

        {/* Search + filter */}
        <View className="px-5 mb-5 flex-row items-center gap-3">
          <View className="flex-1">
            <SearchField value={searchValue} onChange={setSearchValue}>
              <SearchField.Group className="bg-default border-0 rounded-xl h-12">
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search for an appointment..." className="text-sm" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </View>
        </View>

        {/* Appointment cards */}
        <View className="px-5 gap-3">
          {isLoading ? (
            <ActivityIndicator size="small" color="#6366f1" className="py-6" />
          ) : filteredAppointments.length > 0 ? (
            filteredAppointments.map((item) => {
              const d = new Date(item.appointment_date);
              const dayStr = d.toLocaleDateString("en-US", { weekday: "short" });
              const dateNum = d.getDate();
              const formattedDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              const isCompleted = item.status.toLowerCase() === "completed";

              return (
                <Pressable key={item.appointment_id} onPress={() => router.push("/(tabs)/appointment-detail")}>
                  <Card variant="secondary" className="bg-surface border-0 rounded-xl p-4 flex-row items-center gap-3">
                    <View className={`items-center justify-center w-12 rounded-xl py-2 ${isCompleted ? "bg-[#10b981]/15" : "bg-[#ef4444]/15"}`}>
                      <Text className={`text-sm font-semibold ${isCompleted ? "text-[#10b981]" : "text-[#ef4444]"}`}>{dayStr}</Text>
                      <Text className="text-foreground text-lg font-bold">{dateNum}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold text-base mb-0.5">{item.appointment_type}</Text>
                      <Text className="text-muted text-sm">{formattedDate} · {item.appointment_time}</Text>
                    </View>
                    {isCompleted ? (
                      <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                    ) : (
                      <View className="size-8 rounded-full bg-[#6366f1]/15 items-center justify-center">
                        <Ionicons name="chevron-forward" size={14} color="#6366f1" />
                      </View>
                    )}
                  </Card>
                </Pressable>
              );
            })
          ) : (
            <Card className="p-6 bg-surface rounded-xl border-0 items-center py-8">
              <Ionicons name="calendar-outline" size={28} color="#71717a" className="mb-2" />
              <Text className="text-foreground font-semibold text-base mb-1">No Appointments</Text>
              <Text className="text-muted text-sm text-center">
                You have no scheduled appointments.
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
