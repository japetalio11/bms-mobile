import { getDatabase } from "./db";
import type {
  AuthUser,
  MotherRecord,
  PregnancyRecord,
  PrenatalVisitRecord,
  AppointmentRecord,
  SupplementRecord,
  LabScreeningRecord,
} from "../config/api";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

export type SyncQueueItem = {
  id: string;
  action_type: string;
  endpoint: string;
  method: string;
  payload: string; // JSON string
  created_at: string;
  retry_count: number;
  status: "pending" | "failed" | "completed";
  error?: string;
};

// --- MVCC Record History ---
export async function saveRecordHistory(
  entityType: string,
  entityId: string,
  version: number,
  snapshot: any
) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO record_history (entity_type, entity_id, version, snapshot_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [entityType, entityId, version, JSON.stringify(snapshot), new Date().toISOString()]
  );
}

// --- Sync Queue Operations ---
export async function enqueueSyncAction(
  actionType: string,
  endpoint: string,
  method: string,
  payload: any
): Promise<string> {
  const db = await getDatabase();
  const queueId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sync_queue (id, action_type, endpoint, method, payload, created_at, retry_count, status)
     VALUES (?, ?, ?, ?, ?, ?, 0, 'pending')`,
    [queueId, actionType, endpoint, method, JSON.stringify(payload), now]
  );

  return queueId;
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC`
  );
  return rows;
}

export async function markSyncItemSuccess(id: string) {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [id]);
}

export async function markSyncItemFailed(id: string, errorMsg: string) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sync_queue SET retry_count = retry_count + 1, error = ?, status = CASE WHEN retry_count >= 5 THEN 'failed' ELSE 'pending' END WHERE id = ?`,
    [errorMsg, id]
  );
}

// --- Profile & Mother Record Operations ---
export async function saveMotherProfileLocal(data: {
  user: AuthUser;
  mother_id?: string;
  family_serial_no?: string;
  birth_date?: string;
  age?: number;
  civil_status?: string;
  blood_type?: string;
  pregnancies?: PregnancyRecord[];
}) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  if (data.user) {
    await db.runAsync(
      `INSERT OR REPLACE INTO users (user_id, first_name, middle_name, last_name, role, email, phone_number, address, facility_id, facility_name, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user.user_id || "",
        data.user.first_name || "",
        data.user.middle_name || "",
        data.user.last_name || "",
        data.user.role || "",
        data.user.email || "",
        data.user.phone_number || "",
        data.user.address || "",
        data.user.facility_id || null,
        data.user.facility_name || null,
        now,
      ]
    );
  }

  if (data.mother_id) {
    await db.runAsync(
      `INSERT OR REPLACE INTO mother_records (mother_id, user_id, family_serial_no, birth_date, age, civil_status, blood_type, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.mother_id,
        data.user?.user_id || "",
        data.family_serial_no || "",
        data.birth_date || "",
        data.age || null,
        data.civil_status || "",
        data.blood_type || "",
        now,
      ]
    );
  }

  if (data.pregnancies && data.pregnancies.length > 0) {
    for (const preg of data.pregnancies) {
      await db.runAsync(
        `INSERT OR REPLACE INTO pregnancies (pregnancy_id, mother_id, date_of_registration, lmp_date, gravida, parity, pregnancy_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          preg.pregnancy_id,
          preg.mother_id,
          preg.date_of_registration || "",
          preg.lmp_date || "",
          preg.gravida || 0,
          preg.parity || 0,
          preg.pregnancy_status || "",
          now,
        ]
      );

      if (preg.prenatalVisits && preg.prenatalVisits.length > 0) {
        for (const visit of preg.prenatalVisits) {
          await db.runAsync(
            `INSERT OR REPLACE INTO prenatal_visits (visit_id, pregnancy_id, visit_date, trimester, visit_number, age_of_gestation_weeks, weight_kg, temperature_celsius, pulse_rate_bpm, bp_diastolic, bp_systolic, fundic_height_cm, fetal_heart_tone_bpm, chief_complaint, risk_level_assessed, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              visit.visit_id,
              visit.pregnancy_id,
              visit.visit_date || "",
              visit.trimester || 1,
              visit.visit_number || 1,
              visit.age_of_gestation_weeks || 0,
              Number(visit.weight_kg) || 0,
              Number(visit.temperature_celsius) || 0,
              visit.pulse_rate_bpm || 0,
              visit.bp_diastolic || 0,
              visit.bp_systolic || 0,
              Number(visit.fundic_height_cm) || 0,
              visit.fetal_heart_tone_bpm || 0,
              visit.chief_complaint || "",
              visit.risk_level_assessed || "",
              now,
            ]
          );
        }
      }
    }
  }
}

export async function getMotherProfileLocal(userId: string): Promise<{
  user: AuthUser | null;
  motherRecord: MotherRecord | null;
} | null> {
  const db = await getDatabase();
  const user = await db.getFirstAsync<AuthUser>(`SELECT * FROM users WHERE user_id = ?`, [userId]);
  if (!user) return null;

  const mRecord = await db.getFirstAsync<MotherRecord>(
    `SELECT * FROM mother_records WHERE user_id = ?`,
    [userId]
  );

  let pregnancies: PregnancyRecord[] = [];
  if (mRecord) {
    const pregs = await db.getAllAsync<PregnancyRecord>(
      `SELECT * FROM pregnancies WHERE mother_id = ?`,
      [mRecord.mother_id]
    );

    for (const p of pregs) {
      const visits = await db.getAllAsync<PrenatalVisitRecord>(
        `SELECT * FROM prenatal_visits WHERE pregnancy_id = ? ORDER BY visit_number ASC`,
        [p.pregnancy_id]
      );
      p.prenatalVisits = visits;
    }
    pregnancies = pregs;
  }

  return {
    user,
    motherRecord: mRecord
      ? {
          ...mRecord,
          pregnancies,
        }
      : null,
  };
}

// --- Appointments Operations ---
export async function getAppointmentsLocal(userId: string): Promise<AppointmentRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AppointmentRecord>(
    `SELECT * FROM appointments WHERE user_id = ? ORDER BY appointment_date DESC`,
    [userId]
  );
  return rows;
}

export async function saveAppointmentsLocal(
  appointments: AppointmentRecord[],
  isFromBackend = true
) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  for (const appt of appointments) {
    await db.runAsync(
      `INSERT OR REPLACE INTO appointments (appointment_id, user_id, facility_id, appointment_date, appointment_time, appointment_type, reason, status, version, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appt.appointment_id,
        appt.user_id,
        appt.facility_id || null,
        appt.appointment_date,
        appt.appointment_time,
        appt.appointment_type,
        appt.reason || "",
        appt.status,
        (appt as any).version || 1,
        isFromBackend ? "synced" : "pending",
        now,
      ]
    );
  }
}

export async function createAppointmentLocal(payload: any, isOnline: boolean): Promise<AppointmentRecord> {
  const db = await getDatabase();
  const appointmentId = payload.appointment_id || `appt_local_${Date.now()}`;
  const now = new Date().toISOString();

  const record: AppointmentRecord = {
    appointment_id: appointmentId,
    user_id: payload.user_id,
    facility_id: payload.facility_id,
    appointment_date: payload.appointment_date,
    appointment_time: payload.appointment_time,
    appointment_type: payload.appointment_type,
    reason: payload.reason,
    status: payload.status || "Pending",
  };

  await db.runAsync(
    `INSERT INTO appointments (appointment_id, user_id, facility_id, appointment_date, appointment_time, appointment_type, reason, status, version, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      record.appointment_id,
      record.user_id,
      record.facility_id || null,
      record.appointment_date,
      record.appointment_time,
      record.appointment_type,
      record.reason || "",
      record.status,
      isOnline ? "synced" : "pending",
      now,
    ]
  );

  if (!isOnline) {
    await enqueueSyncAction("CREATE_APPOINTMENT", "/api/v1/appointment/register", "POST", payload);
  }

  return record;
}

export async function cancelAppointmentLocal(
  appointmentId: string,
  isOnline: boolean
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<AppointmentRecord>(
    `SELECT * FROM appointments WHERE appointment_id = ?`,
    [appointmentId]
  );

  if (existing) {
    // MVCC Snapshot before mutation
    await saveRecordHistory(
      "appointment",
      appointmentId,
      (existing as any).version || 1,
      existing
    );

    const nextVersion = ((existing as any).version || 1) + 1;
    const now = new Date().toISOString();

    await db.runAsync(
      `UPDATE appointments SET status = 'Cancelled', version = ?, sync_status = ?, updated_at = ? WHERE appointment_id = ?`,
      [nextVersion, isOnline ? "synced" : "pending", now, appointmentId]
    );

    if (!isOnline) {
      await enqueueSyncAction(
        "CANCEL_APPOINTMENT",
        `/api/v1/appointment/cancel/${appointmentId}`,
        "PUT",
        { appointmentId, version: nextVersion }
      );
    }
  }
}

// --- Supplements Operations ---
export async function getSupplementsLocal(motherId: string): Promise<SupplementRecord[]> {
  const db = await getDatabase();
  // Join through pregnancies
  const rows = await db.getAllAsync<SupplementRecord>(
    `SELECT s.* FROM supplements s
     JOIN pregnancies p ON s.pregnancy_id = p.pregnancy_id
     WHERE p.mother_id = ? ORDER BY s.date_given DESC`,
    [motherId]
  );
  return rows.map((r: any) => ({
    ...r,
    is_completed: Boolean(r.is_completed),
  }));
}

export async function saveSupplementsLocal(
  supplements: SupplementRecord[],
  isFromBackend = true
) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  for (const s of supplements) {
    await db.runAsync(
      `INSERT OR REPLACE INTO supplements (supplement_id, pregnancy_id, visit_id, supplement_type, tablets_given_count, date_given, is_completed, version, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.supplement_id,
        s.pregnancy_id,
        s.visit_id,
        s.supplement_type,
        s.tablets_given_count,
        s.date_given,
        s.is_completed ? 1 : 0,
        (s as any).version || 1,
        isFromBackend ? "synced" : "pending",
        now,
      ]
    );
  }
}

export async function updateSupplementStatusLocal(
  supplementId: string,
  isCompleted: boolean,
  isOnline: boolean
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<SupplementRecord>(
    `SELECT * FROM supplements WHERE supplement_id = ?`,
    [supplementId]
  );

  if (existing) {
    // MVCC Snapshot before mutation
    await saveRecordHistory("supplement", supplementId, (existing as any).version || 1, existing);

    const nextVersion = ((existing as any).version || 1) + 1;
    const now = new Date().toISOString();

    await db.runAsync(
      `UPDATE supplements SET is_completed = ?, version = ?, sync_status = ?, updated_at = ? WHERE supplement_id = ?`,
      [isCompleted ? 1 : 0, nextVersion, isOnline ? "synced" : "pending", now, supplementId]
    );

    if (!isOnline) {
      await enqueueSyncAction("UPDATE_SUPPLEMENT", "/api/v1/supplement/update", "PUT", {
        supplement_id: supplementId,
        is_completed: isCompleted,
        version: nextVersion,
      });
    }
  }
}

// --- Lab Screenings Operations ---
export async function getLabScreeningsLocal(motherId: string): Promise<LabScreeningRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LabScreeningRecord>(
    `SELECT * FROM lab_screenings ORDER BY date_of_screening DESC`
  );
  return rows;
}

export async function saveLabScreeningsLocal(
  screenings: LabScreeningRecord[],
  isFromBackend = true
) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  for (const ls of screenings) {
    await db.runAsync(
      `INSERT OR REPLACE INTO lab_screenings (screening_id, pregnancy_id, visit_id, screening_type, result, file_url, local_file_uri, file_size_bytes, upload_status, date_of_screening, remarks, version, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ls.screening_id,
        ls.pregnancy_id,
        ls.visit_id,
        ls.screening_type,
        ls.result,
        ls.file_url || null,
        (ls as any).local_file_uri || null,
        (ls as any).file_size_bytes || null,
        (ls as any).upload_status || (isFromBackend ? "synced" : "pending"),
        ls.date_of_screening,
        ls.remarks || "",
        (ls as any).version || 1,
        isFromBackend ? "synced" : "pending",
        now,
      ]
    );
  }
}

export async function createLabScreeningLocal(
  payload: any,
  localFileUri: string | null,
  fileSizeBytes: number | null,
  isOnline: boolean
): Promise<LabScreeningRecord> {
  if (fileSizeBytes && fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size (${(fileSizeBytes / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 10MB.`
    );
  }

  const db = await getDatabase();
  const screeningId = payload.screening_id || `lab_local_${Date.now()}`;
  const now = new Date().toISOString();

  const record: LabScreeningRecord = {
    screening_id: screeningId,
    pregnancy_id: payload.pregnancy_id,
    visit_id: payload.visit_id,
    screening_type: payload.screening_type,
    result: payload.result,
    file_url: payload.file_url || undefined,
    date_of_screening: payload.date_of_screening || now,
    remarks: payload.remarks,
  };

  await db.runAsync(
    `INSERT INTO lab_screenings (screening_id, pregnancy_id, visit_id, screening_type, result, file_url, local_file_uri, file_size_bytes, upload_status, date_of_screening, remarks, version, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      record.screening_id,
      record.pregnancy_id,
      record.visit_id,
      record.screening_type,
      record.result,
      record.file_url || null,
      localFileUri || null,
      fileSizeBytes || null,
      localFileUri && !payload.file_url ? "pending" : "synced",
      record.date_of_screening,
      record.remarks || "",
      isOnline ? "synced" : "pending",
      now,
    ]
  );

  if (!isOnline) {
    await enqueueSyncAction("CREATE_LAB_SCREENING", "/api/v1/lab-screening/register", "POST", {
      ...payload,
      screening_id: screeningId,
      localFileUri,
      fileSizeBytes,
    });
  }

  return record;
}
