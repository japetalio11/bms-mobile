import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../config/api";

export type StaffSchedule = {
  staff_id: string;
  days: string[];
  intervals?: { start: string; end: string }[];
};

export type ClosedDateInfo = {
  date: string;
  reason?: string;
};

export type StaffAvailabilityCheck = {
  isAvailable: boolean;
  staffName: string;
  dayName: string;
  availableDays: string[];
};

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const DEFAULT_CLINIC_WORKING_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const CLOSED_DATES_CACHE_PREFIX = "@bms_facility_closed_dates_";
const STAFF_SCHEDULE_CACHE_PREFIX = "@bms_staff_schedule_";

const memoryClosedDates = new Map<string, Set<string>>();
const memoryClosedReasons = new Map<string, Map<string, string>>();
const memoryStaffSchedules = new Map<string, StaffSchedule>();

export function getWeekdayName(date: Date): string {
  return WEEKDAY_NAMES[date.getDay()];
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isFacilityDateClosed(
  date: Date,
  facilityId?: string | null
): boolean {
  if (isWeekend(date)) {
    return true;
  }

  const dateStr = formatDateKey(date);
  const targetFacilityId = facilityId || "default";
  const facilityDates = memoryClosedDates.get(targetFacilityId);
  if (facilityDates && facilityDates.has(dateStr)) {
    return true;
  }

  const defaultDates = memoryClosedDates.get("default");
  if (defaultDates && defaultDates.has(dateStr)) {
    return true;
  }

  return false;
}

export function getFacilityClosedReason(
  date: Date,
  facilityId?: string | null
): string | null {
  if (isWeekend(date)) {
    return "Weekend (Clinic Closed)";
  }

  const dateStr = formatDateKey(date);
  const targetFacilityId = facilityId || "default";

  const facilityReasons = memoryClosedReasons.get(targetFacilityId);
  if (facilityReasons && facilityReasons.has(dateStr)) {
    return facilityReasons.get(dateStr) || "Facility Closed";
  }

  const defaultReasons = memoryClosedReasons.get("default");
  if (defaultReasons && defaultReasons.has(dateStr)) {
    return defaultReasons.get(dateStr) || "Facility Closed";
  }

  return null;
}

export async function loadFacilityClosedDates(
  facilityId?: string | null,
  token?: string | null
): Promise<string[]> {
  const targetFacilityId = facilityId || "default";

  try {
    const cached = await AsyncStorage.getItem(
      `${CLOSED_DATES_CACHE_PREFIX}${targetFacilityId}`
    );
    if (cached) {
      const parsed = JSON.parse(cached) as ClosedDateInfo[];
      if (Array.isArray(parsed)) {
        applyClosedDatesToMemory(targetFacilityId, parsed);
      }
    }
  } catch {}

  if (facilityId && token) {
    try {
      let closedList: ClosedDateInfo[] = [];

      try {
        const closedRes = await fetch(
          `${API_BASE_URL}/api/v1/calendar/facility/${facilityId}/closed-dates`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (closedRes.ok) {
          const json = await closedRes.json();
          const records = Array.isArray(json?.data) ? json.data : [];
          for (const item of records) {
            const dateStr = item.date || (item.available_date ? formatDateKey(new Date(item.available_date)) : null);
            if (dateStr) {
              closedList.push({
                date: dateStr,
                reason: item.reason || item.available_time_slot || "Scheduled Facility Closure",
              });
            }
          }
        }
      } catch {}

      if (closedList.length === 0) {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/calendar/facility/${facilityId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.ok) {
          const json = await response.json();
          const records = Array.isArray(json?.data) ? json.data : [];
          for (const item of records) {
            if (item.is_available === false || item.max_slots === 0) {
              const rawDate = item.available_date
                ? new Date(item.available_date)
                : null;
              if (rawDate && !isNaN(rawDate.getTime())) {
                closedList.push({
                  date: formatDateKey(rawDate),
                  reason: item.available_time_slot || "Scheduled Facility Closure",
                });
              }
            }
          }
        }
      }

      if (closedList.length > 0) {
        applyClosedDatesToMemory(targetFacilityId, closedList);
        await AsyncStorage.setItem(
          `${CLOSED_DATES_CACHE_PREFIX}${targetFacilityId}`,
          JSON.stringify(closedList)
        );
      }
    } catch {}
  }

  const currentSet = memoryClosedDates.get(targetFacilityId);
  return currentSet ? Array.from(currentSet) : [];
}

function applyClosedDatesToMemory(
  facilityId: string,
  records: ClosedDateInfo[]
) {
  let dateSet = memoryClosedDates.get(facilityId);
  if (!dateSet) {
    dateSet = new Set<string>();
    memoryClosedDates.set(facilityId, dateSet);
  }

  let reasonMap = memoryClosedReasons.get(facilityId);
  if (!reasonMap) {
    reasonMap = new Map<string, string>();
    memoryClosedReasons.set(facilityId, reasonMap);
  }

  for (const item of records) {
    dateSet.add(item.date);
    if (item.reason) {
      reasonMap.set(item.date, item.reason);
    }
  }
}

export function registerLocalClosedDate(
  dateStr: string,
  reason: string,
  facilityId?: string | null
) {
  const targetFacilityId = facilityId || "default";
  applyClosedDatesToMemory(targetFacilityId, [{ date: dateStr, reason }]);
}

export async function loadStaffSchedule(
  staffId: string,
  token?: string | null
): Promise<StaffSchedule> {
  let fallbackSchedule: StaffSchedule | null = memoryStaffSchedules.get(staffId) || null;

  if (!fallbackSchedule) {
    try {
      const cached = await AsyncStorage.getItem(
        `${STAFF_SCHEDULE_CACHE_PREFIX}${staffId}`
      );
      if (cached) {
        const parsed = JSON.parse(cached) as StaffSchedule;
        if (parsed && Array.isArray(parsed.days)) {
          fallbackSchedule = parsed;
          memoryStaffSchedules.set(staffId, parsed);
        }
      }
    } catch {}
  }

  if (token) {
    try {
      const scheduleRes = await fetch(
        `${API_BASE_URL}/api/v1/user/${staffId}/schedule`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (scheduleRes.ok) {
        const json = await scheduleRes.json();
        const sched = json?.schedule || json?.data || json;
        const days = Array.isArray(sched?.days)
          ? sched.days
          : Array.isArray(json?.days)
          ? json.days
          : null;

        if (days && days.length > 0) {
          const schedule: StaffSchedule = {
            staff_id: staffId,
            days,
            intervals: sched?.intervals || [{ start: sched?.start_time || "08:00", end: sched?.end_time || "17:00" }],
          };
          memoryStaffSchedules.set(staffId, schedule);
          await AsyncStorage.setItem(
            `${STAFF_SCHEDULE_CACHE_PREFIX}${staffId}`,
            JSON.stringify(schedule)
          );
          return schedule;
        }
      }

      const response = await fetch(
        `${API_BASE_URL}/api/v1/user/${staffId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        const json = await response.json();
        const userData = json?.result || json?.data || json?.user;
        const userSched = userData?.schedule || userData?.staffSchedule;
        if (userSched && Array.isArray(userSched.days)) {
          const schedule: StaffSchedule = {
            staff_id: staffId,
            days: userSched.days,
            intervals: userSched.intervals || [{ start: "08:00", end: "17:00" }],
          };
          memoryStaffSchedules.set(staffId, schedule);
          await AsyncStorage.setItem(
            `${STAFF_SCHEDULE_CACHE_PREFIX}${staffId}`,
            JSON.stringify(schedule)
          );
          return schedule;
        }
      }
    } catch {}
  }

  if (fallbackSchedule) {
    return fallbackSchedule;
  }

  const defaultSchedule: StaffSchedule = {
    staff_id: staffId,
    days: DEFAULT_CLINIC_WORKING_DAYS,
    intervals: [{ start: "08:00", end: "17:00" }],
  };
  memoryStaffSchedules.set(staffId, defaultSchedule);
  return defaultSchedule;
}

export function checkStaffAvailability(
  date: Date,
  staff: {
    user_id?: string;
    first_name?: string;
    last_name?: string;
    role?: string;
  } | null | undefined,
  customSchedule?: StaffSchedule | null
): StaffAvailabilityCheck {
  const staffName = staff
    ? [staff.first_name, staff.last_name].filter(Boolean).join(" ") || "Assigned Healthcare Staff"
    : "Assigned Healthcare Staff";

  const dayName = getWeekdayName(date);

  if (!staff?.user_id) {
    return {
      isAvailable: true,
      staffName,
      dayName,
      availableDays: DEFAULT_CLINIC_WORKING_DAYS,
    };
  }

  const schedule =
    customSchedule ||
    memoryStaffSchedules.get(staff.user_id) || {
      staff_id: staff.user_id,
      days: DEFAULT_CLINIC_WORKING_DAYS,
      intervals: [{ start: "08:00", end: "17:00" }],
    };

  const isAvailable = schedule.days.includes(dayName);

  return {
    isAvailable,
    staffName,
    dayName,
    availableDays: schedule.days,
  };
}
