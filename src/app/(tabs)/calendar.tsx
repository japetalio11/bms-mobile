import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import type { JSX } from "react";
import { useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { Card } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { useAuth } from "../../context/UserContext";
import { useNetwork } from "../../context/NetworkContext";
import { getAppointmentsByUserApi } from "../../config/api";
import type { AppointmentRecord } from "../../config/api";
import { getAppointmentsLocal, saveAppointmentsLocal } from "../../db/repository";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarScreen(): JSX.Element {
  const { user, token } = useAuth();
  const { isOnline } = useNetwork();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadAppointments = useCallback(async () => {
    if (!user?.user_id) return;

    // 1. Read from local SQLite immediately
    try {
      const local = await getAppointmentsLocal(user.user_id);
      if (local && local.length > 0) {
        setAppointments(local);
      }
    } catch (e) {
      console.warn("Failed reading local appointments:", e);
    }

    // 2. Fetch fresh from backend if online
    if (isOnline && token) {
      setIsLoading(true);
      try {
        const res = await getAppointmentsByUserApi(user.user_id, token);
        if (Array.isArray(res)) {
          setAppointments(res);
          await saveAppointmentsLocal(res, true);
        }
      } catch (err) {
        console.warn("Backend fetch failed, preserving local data:", err);
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

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const cleanStr = dateStr.split("T")[0];
    const parts = cleanStr.split("-");
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(dateStr);
  };

  const calendarRows: (number | null)[][] = [];
  let dayCounter = 1;
  while (dayCounter <= daysInMonth) {
    const row: (number | null)[] = [];
    for (let c = 0; c < 7; c++) {
      if ((calendarRows.length === 0 && c < firstDay) || dayCounter > daysInMonth) {
        row.push(null);
      } else {
        row.push(dayCounter++);
      }
    }
    calendarRows.push(row);
  }

  const upcomingEvents = appointments.filter((a) => {
    const d = parseLocalDate(a.appointment_date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  return (
    <View className="flex-1 bg-background pb-24">
      <Header rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Month Header */}
        <View className="px-5 mb-4 flex-row items-center justify-between">
          <Text className="text-primary text-lg font-semibold">{monthName}</Text>
          <View className="flex-row gap-2">
            <Pressable
              className="size-8 items-center justify-center"
              onPress={() => setCurrentDate(new Date(year, month - 1, 1))}
            >
              <Ionicons name="chevron-back" size={20} color="#a1a1aa" />
            </Pressable>
            <Pressable
              className="size-8 items-center justify-center"
              onPress={() => setCurrentDate(new Date(year, month + 1, 1))}
            >
              <Ionicons name="chevron-forward" size={20} color="#a1a1aa" />
            </Pressable>
          </View>
        </View>

        {/* Calendar Grid */}
        <Card variant="secondary" className="mx-5 mb-6 rounded-xl p-5 bg-surface border-0">
          <View className="flex-row justify-between mb-4">
            {DAYS.map((day) => (
              <Text key={day} className="text-muted text-sm flex-1 text-center font-medium">
                {day}
              </Text>
            ))}
          </View>
          {calendarRows.map((row, rowIndex) => (
            <View key={rowIndex} className="flex-row justify-between mb-3">
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

                return (
                  <View key={colIndex} className="flex-1 items-center justify-center h-10">
                    <View
                      className={`size-8 items-center justify-center rounded-full ${
                        isToday ? "bg-primary" : ""
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          dateNum === null
                            ? "opacity-0"
                            : isToday
                            ? "text-white font-bold"
                            : "text-foreground font-medium"
                        }`}
                      >
                        {dateNum || ""}
                      </Text>
                    </View>
                    {hasEvent && (
                      <View
                        className={`size-1.5 rounded-full ${
                          isToday ? "bg-white" : "bg-blue-500"
                        } mt-0.5`}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </Card>

        {/* Upcoming Events */}
        <View className="px-5">
          <Text className="text-foreground text-lg font-semibold mb-1">Upcoming Events</Text>
          <Text className="text-muted text-sm mb-4">Scheduled appointments for {monthName}.</Text>

          {isLoading && appointments.length === 0 ? (
            <ActivityIndicator size="small" color="#6366f1" className="py-6" />
          ) : upcomingEvents.length > 0 ? (
            <View className="gap-3">
              {upcomingEvents.map((item) => {
                const d = parseLocalDate(item.appointment_date);
                const dayStr = d.toLocaleDateString("en-US", { weekday: "short" });
                const dateNum = d.getDate();
                const formattedDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

                return (
                  <Card
                    key={item.appointment_id}
                    variant="secondary"
                    className="bg-surface border-0 rounded-xl p-4 flex-row items-center"
                  >
                    <View className="items-center justify-center mr-4 w-12">
                      <Text className="text-primary text-sm font-bold">{dayStr}</Text>
                      <Text className="text-foreground text-lg font-bold">{dateNum}</Text>
                    </View>
                    <View className="w-px h-10 bg-separator mx-2" />
                    <View className="flex-1 ml-2">
                      <Text className="text-foreground text-base font-semibold mb-1">{item.appointment_type}</Text>
                      <Text className="text-muted text-sm">{formattedDate} · {item.appointment_time}</Text>
                    </View>
                  </Card>
                );
              })}
            </View>
          ) : (
            <Card variant="secondary" className="bg-surface border-0 rounded-xl p-6 items-center py-8">
              <Ionicons name="calendar-outline" size={28} color="#71717a" className="mb-2" />
              <Text className="text-foreground font-semibold text-base mb-1">No Appointments</Text>
              <Text className="text-muted text-sm text-center">
                No scheduled appointments for this month.
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
