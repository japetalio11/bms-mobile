const assert = require("node:assert");

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DEFAULT_CLINIC_WORKING_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

function getWeekdayName(date) {
  return WEEKDAY_NAMES[date.getDay()];
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

const memoryClosedDates = new Map();
const memoryClosedReasons = new Map();

function applyClosedDatesToMemory(facilityId, records) {
  let dateSet = memoryClosedDates.get(facilityId);
  if (!dateSet) {
    dateSet = new Set();
    memoryClosedDates.set(facilityId, dateSet);
  }

  let reasonMap = memoryClosedReasons.get(facilityId);
  if (!reasonMap) {
    reasonMap = new Map();
    memoryClosedReasons.set(facilityId, reasonMap);
  }

  for (const item of records) {
    dateSet.add(item.date);
    if (item.reason) {
      reasonMap.set(item.date, item.reason);
    }
  }
}

function isFacilityDateClosed(date, facilityId) {
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

function getFacilityClosedReason(date, facilityId) {
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

function checkStaffAvailability(date, staff, customSchedule) {
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
    customSchedule || {
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

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`, err.message);
  }
}

console.log("Running Facility Schedule & Staff Availability Verification Tests...");

test("Sunday is marked as weekend closed", () => {
  const sunday = new Date(2026, 10, 15);
  assert.strictEqual(getWeekdayName(sunday), "Sunday");
  assert.strictEqual(isFacilityDateClosed(sunday, "fac-1"), true);
  assert.strictEqual(getFacilityClosedReason(sunday, "fac-1"), "Weekend (Clinic Closed)");
});

test("Saturday is marked as weekend closed", () => {
  const saturday = new Date(2026, 10, 14);
  assert.strictEqual(getWeekdayName(saturday), "Saturday");
  assert.strictEqual(isFacilityDateClosed(saturday, "fac-1"), true);
  assert.strictEqual(getFacilityClosedReason(saturday, "fac-1"), "Weekend (Clinic Closed)");
});

test("Normal weekday is open by default", () => {
  const monday = new Date(2026, 10, 16);
  assert.strictEqual(getWeekdayName(monday), "Monday");
  assert.strictEqual(isFacilityDateClosed(monday, "fac-1"), false);
  assert.strictEqual(getFacilityClosedReason(monday, "fac-1"), null);
});

test("Specific closed date is recognized for facility", () => {
  applyClosedDatesToMemory("fac-1", [
    { date: "2026-11-20", reason: "Clinic Sanitation & Disinfection" },
  ]);
  const friday = new Date(2026, 10, 20);
  assert.strictEqual(formatDateKey(friday), "2026-11-20");
  assert.strictEqual(isFacilityDateClosed(friday, "fac-1"), true);
  assert.strictEqual(
    getFacilityClosedReason(friday, "fac-1"),
    "Clinic Sanitation & Disinfection"
  );

  assert.strictEqual(isFacilityDateClosed(friday, "fac-2"), false);
});

test("Assigned staff available on scheduled working day", () => {
  const staff = {
    user_id: "staff-123",
    first_name: "Maria",
    last_name: "Santos",
    role: "Midwife",
  };
  const monday = new Date(2026, 10, 16);
  const result = checkStaffAvailability(monday, staff);
  assert.strictEqual(result.isAvailable, true);
  assert.strictEqual(result.staffName, "Maria Santos");
  assert.strictEqual(result.dayName, "Monday");
});

test("Assigned staff unavailable on weekend / non-duty day", () => {
  const staff = {
    user_id: "staff-123",
    first_name: "Maria",
    last_name: "Santos",
    role: "Midwife",
  };
  const saturday = new Date(2026, 10, 14);
  const result = checkStaffAvailability(saturday, staff);
  assert.strictEqual(result.isAvailable, false);
  assert.strictEqual(result.dayName, "Saturday");
});

test("Assigned staff with custom roster (Mon/Wed/Fri) unavailable on Tuesday and Thursday", () => {
  const staff = {
    user_id: "staff-456",
    first_name: "Dr. Juan",
    last_name: "Dela Cruz",
    role: "Doctor",
  };
  const customSchedule = {
    staff_id: "staff-456",
    days: ["Monday", "Wednesday", "Friday"],
  };

  const tuesday = new Date(2026, 10, 17);
  const resultTue = checkStaffAvailability(tuesday, staff, customSchedule);
  assert.strictEqual(resultTue.isAvailable, false);
  assert.strictEqual(resultTue.dayName, "Tuesday");

  const wednesday = new Date(2026, 10, 18);
  const resultWed = checkStaffAvailability(wednesday, staff, customSchedule);
  assert.strictEqual(resultWed.isAvailable, true);
  assert.strictEqual(resultWed.dayName, "Wednesday");

  const thursday = new Date(2026, 10, 19);
  const resultThu = checkStaffAvailability(thursday, staff, customSchedule);
  assert.strictEqual(resultThu.isAvailable, false);
  assert.strictEqual(resultThu.dayName, "Thursday");
});

test("Assigned staff available ONLY on Monday is marked unavailable on Thursday", () => {
  const staff = {
    user_id: "8aed60a1-4033-4210-8c40-b26ba8f89124",
    first_name: "Joseph",
    last_name: "Petalio",
    role: "Doctor",
  };
  const mondayOnlySchedule = {
    staff_id: "8aed60a1-4033-4210-8c40-b26ba8f89124",
    days: ["Monday"],
  };

  const monday = new Date(2026, 10, 23);
  const resultMon = checkStaffAvailability(monday, staff, mondayOnlySchedule);
  assert.strictEqual(resultMon.isAvailable, true);
  assert.strictEqual(resultMon.dayName, "Monday");

  const thursday = new Date(2026, 10, 26);
  const resultThu = checkStaffAvailability(thursday, staff, mondayOnlySchedule);
  assert.strictEqual(resultThu.isAvailable, false);
  assert.strictEqual(resultThu.dayName, "Thursday");
  assert.strictEqual(resultThu.staffName, "Joseph Petalio");
});

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
