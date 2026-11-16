import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Text } from "heroui-native";
import { AppIcon } from "./AppIcon";
import { AppButton } from "./FormControls";
import {
  isFacilityDateClosed,
  getFacilityClosedReason,
} from "../services/facilityScheduleService";

type AppointmentDatePickerModalProps = {
  visible: boolean;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
  minDate?: Date;
  facilityId?: string | null;
  isDateClosedFn?: (date: Date) => boolean;
  getClosedReasonFn?: (date: Date) => string | null;
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function AppointmentDatePickerModal({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
  minDate = new Date(),
  facilityId,
  isDateClosedFn,
  getClosedReasonFn,
}: AppointmentDatePickerModalProps) {
  const normalizedMinDate = useMemo(() => startOfDay(minDate), [minDate]);

  const checkClosed = useMemo(() => {
    return isDateClosedFn || ((d: Date) => isFacilityDateClosed(d, facilityId));
  }, [isDateClosedFn, facilityId]);

  const checkReason = useMemo(() => {
    return getClosedReasonFn || ((d: Date) => getFacilityClosedReason(d, facilityId));
  }, [getClosedReasonFn, facilityId]);

  const [currentYear, setCurrentYear] = useState(() => selectedDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => selectedDate.getMonth());
  const [tempDate, setTempDate] = useState<Date>(() => startOfDay(selectedDate));

  useEffect(() => {
    if (visible) {
      const normalized = startOfDay(selectedDate);
      setTempDate(normalized);
      setCurrentYear(normalized.getFullYear());
      setCurrentMonth(normalized.getMonth());
    }
  }, [visible, selectedDate]);

  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  const firstDayWeekday = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).getDay();
  }, [currentYear, currentMonth]);

  const canGoPrevious = useMemo(() => {
    const prevMonthDate = new Date(currentYear, currentMonth, 0);
    return prevMonthDate >= new Date(normalizedMinDate.getFullYear(), normalizedMinDate.getMonth(), 1);
  }, [currentYear, currentMonth, normalizedMinDate]);

  const handlePrevMonth = () => {
    if (!canGoPrevious) return;
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleQuickSelect = (daysToAdd: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysToAdd);
    const normalized = startOfDay(target);
    if (checkClosed(normalized)) {
      return;
    }
    setTempDate(normalized);
    setCurrentYear(normalized.getFullYear());
    setCurrentMonth(normalized.getMonth());
  };

  const handleDayPress = (dayNumber: number) => {
    const candidate = new Date(currentYear, currentMonth, dayNumber);
    const normalizedCandidate = startOfDay(candidate);
    if (normalizedCandidate < normalizedMinDate) return;
    if (checkClosed(normalizedCandidate)) return;
    setTempDate(normalizedCandidate);
  };

  const isTempDateClosed = checkClosed(tempDate);

  const handleConfirm = () => {
    if (isTempDateClosed) return;
    onSelectDate(tempDate);
    onClose();
  };

  const emptyCells = Array.from({ length: firstDayWeekday });
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const today = startOfDay(new Date());

  const tomorrowDate = new Date(today.getTime() + 86400000);
  const nextWeekDate = new Date(today.getTime() + 86400000 * 7);

  const isTodayClosed = checkClosed(today);
  const isTomorrowClosed = checkClosed(tomorrowDate);
  const isNextWeekClosed = checkClosed(nextWeekDate);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 px-5">
        <View className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-2xl">
          <View className="flex-row items-center justify-between pb-3">
            <View>
              <Text className="text-base font-bold text-foreground">Select Date</Text>
              <Text className="text-xs text-muted-foreground">
                {tempDate.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close date selector"
              className="size-8 items-center justify-center rounded-full active:opacity-70"
            >
              <AppIcon name="close" size={16} color="#737373" />
            </Pressable>
          </View>

          <View className="my-2 flex-row gap-2">
            <Pressable
              onPress={() => handleQuickSelect(0)}
              disabled={isTodayClosed}
              className={`rounded-full px-3 py-1.5 border ${
                isTodayClosed
                  ? "border-border/60 bg-muted/40 opacity-40"
                  : isSameDay(tempDate, today)
                  ? "border-[#171717] bg-[#fffe8c] dark:border-white"
                  : "border-border bg-surface"
              } active:opacity-75`}
            >
              <Text
                className={`text-xs ${
                  isTodayClosed
                    ? "text-muted-foreground/60 line-through"
                    : isSameDay(tempDate, today)
                    ? "font-bold text-[#171717]"
                    : "font-semibold text-muted-foreground"
                }`}
              >
                Today{isTodayClosed ? " (Closed)" : ""}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleQuickSelect(1)}
              disabled={isTomorrowClosed}
              className={`rounded-full px-3 py-1.5 border ${
                isTomorrowClosed
                  ? "border-border/60 bg-muted/40 opacity-40"
                  : isSameDay(tempDate, tomorrowDate)
                  ? "border-[#171717] bg-[#fffe8c] dark:border-white"
                  : "border-border bg-surface"
              } active:opacity-75`}
            >
              <Text
                className={`text-xs ${
                  isTomorrowClosed
                    ? "text-muted-foreground/60 line-through"
                    : isSameDay(tempDate, tomorrowDate)
                    ? "font-bold text-[#171717]"
                    : "font-semibold text-muted-foreground"
                }`}
              >
                Tomorrow{isTomorrowClosed ? " (Closed)" : ""}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleQuickSelect(7)}
              disabled={isNextWeekClosed}
              className={`rounded-full px-3 py-1.5 border ${
                isNextWeekClosed
                  ? "border-border/60 bg-muted/40 opacity-40"
                  : isSameDay(tempDate, nextWeekDate)
                  ? "border-[#171717] bg-[#fffe8c] dark:border-white"
                  : "border-border bg-surface"
              } active:opacity-75`}
            >
              <Text
                className={`text-xs ${
                  isNextWeekClosed
                    ? "text-muted-foreground/60 line-through"
                    : isSameDay(tempDate, nextWeekDate)
                    ? "font-bold text-[#171717]"
                    : "font-semibold text-muted-foreground"
                }`}
              >
                +1 Week
              </Text>
            </Pressable>
          </View>

          <View className="mb-2 mt-3 flex-row items-center justify-between px-1">
            <Text className="text-sm font-semibold text-foreground">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </Text>
            <View className="flex-row items-center gap-1">
              <Pressable
                onPress={handlePrevMonth}
                disabled={!canGoPrevious}
                className={`size-8 items-center justify-center rounded-full border border-border bg-surface ${
                  canGoPrevious ? "active:opacity-70" : "opacity-30"
                }`}
              >
                <AppIcon name="chevron-back" size={16} color="#737373" />
              </Pressable>
              <Pressable
                onPress={handleNextMonth}
                className="size-8 items-center justify-center rounded-full border border-border bg-surface active:opacity-70"
              >
                <AppIcon name="chevron-forward" size={16} color="#737373" />
              </Pressable>
            </View>
          </View>

          <View className="mb-1 flex-row">
            {WEEKDAYS.map((wd) => (
              <View key={wd} className="flex-1 items-center py-1">
                <Text className="text-xs font-semibold text-muted-foreground">{wd}</Text>
              </View>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {emptyCells.map((_, i) => (
              <View key={`empty-${i}`} className="h-10 w-[14.28%]" />
            ))}
            {dayNumbers.map((dayNum) => {
              const cellDate = new Date(currentYear, currentMonth, dayNum);
              const normalizedCell = startOfDay(cellDate);
              const isPast = normalizedCell < normalizedMinDate;
              const isSelected = isSameDay(cellDate, tempDate);
              const isTodayCell = isSameDay(cellDate, today);
              const isClosed = checkClosed(normalizedCell);

              return (
                <View key={`day-${dayNum}`} className="h-10 w-[14.28%] items-center justify-center">
                  <Pressable
                    onPress={() => handleDayPress(dayNum)}
                    disabled={isPast || isClosed}
                    accessibilityState={{ disabled: isPast || isClosed }}
                    accessibilityLabel={`${dayNum} ${MONTH_NAMES[currentMonth]}${isClosed ? " Closed" : ""}`}
                    className={`size-8 items-center justify-center rounded-full ${
                      isSelected
                        ? "border-2 border-[#171717] bg-[#fffe8c] dark:border-white shadow-xs"
                        : isTodayCell
                        ? "border-2 border-[#171717] bg-surface dark:border-white"
                        : isClosed
                        ? "bg-muted/40 opacity-40 border border-dashed border-border"
                        : isPast
                        ? "opacity-25"
                        : "active:bg-surface"
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        isSelected
                          ? "font-bold text-[#171717]"
                          : isTodayCell
                          ? "font-bold text-foreground"
                          : isClosed
                          ? "text-muted-foreground/60 line-through"
                          : isPast
                          ? "text-muted-foreground"
                          : "font-medium text-foreground"
                      }`}
                    >
                      {dayNum}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View className="mt-2.5 flex-row items-center justify-center gap-3">
            <View className="flex-row items-center gap-1">
              <View className="size-2 rounded-full bg-[#fffe8c] border border-black/30 dark:border-white/40" />
              <Text className="text-[10px] text-muted-foreground">Selected</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <View className="size-2 rounded-full border border-foreground/40 bg-surface" />
              <Text className="text-[10px] text-muted-foreground">Today</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <View className="size-2 rounded-full bg-muted/70 border border-dashed border-border" />
              <Text className="text-[10px] text-muted-foreground">Closed</Text>
            </View>
          </View>

          {isTempDateClosed && (
            <View className="mt-3 flex-row items-center gap-1.5 rounded-lg border border-destructive/25 bg-destructive/10 px-2.5 py-1.5">
              <AppIcon name="alert-circle-outline" size={14} color="#ef4444" />
              <Text className="text-[11px] font-medium text-destructive">
                {checkReason(tempDate) || "Facility is closed on this date"}
              </Text>
            </View>
          )}

          <View className="mt-4 flex-row items-center gap-2">
            <AppButton variant="outline" className="flex-1 rounded-md" onPress={onClose}>
              <AppButton.Label>Cancel</AppButton.Label>
            </AppButton>
            <AppButton
              variant="primary"
              isDisabled={isTempDateClosed}
              className={`flex-1 rounded-md border border-black/20 ${
                isTempDateClosed ? "bg-muted opacity-50" : "bg-[#fffe8c]"
              } dark:border-white/20`}
              onPress={handleConfirm}
            >
              <AppButton.Label
                className={`font-bold ${isTempDateClosed ? "text-muted-foreground" : "text-[#171717]"}`}
              >
                Select Date
              </AppButton.Label>
            </AppButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}
