import { getDatabase } from "./db";
import type {
  AuthUser,
  MotherRecord,
  PregnancyRecord,
  PrenatalVisitRecord,
  AppointmentRecord,
  SupplementRecord,
  LabScreeningRecord,
  DeliveryOutcomeRecord,
  NewbornRecord,
  InAppMessage,
  ChatContact,
} from "../config/api";
import {
  encryptSensitiveText,
  decryptSensitiveText,
  encryptObject,
  decryptObject,
} from "../lib/crypto";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

export type SyncQueueItem = {
  id: string;
  user_id?: string;
  action_type: string;
  endpoint: string;
  method: string;
  payload: string; // Decrypted or JSON string
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
  const encryptedSnapshot = await encryptObject(snapshot);
  await db.runAsync(
    `INSERT INTO record_history (entity_type, entity_id, version, snapshot_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [entityType, entityId, version, encryptedSnapshot, new Date().toISOString()]
  );
}

// --- Sync Queue Operations (Strictly Isolated by user_id) ---
export async function enqueueSyncAction(
  actionType: string,
  endpoint: string,
  method: string,
  payload: any,
  userId?: string
): Promise<string> {
  const db = await getDatabase();
  const queueId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  const targetUserId = userId || payload.user_id || payload.userId || "";

  // Encrypt payload at rest for offline privacy
  const encryptedPayload = await encryptObject(payload);

  await db.runAsync(
    `INSERT INTO sync_queue (id, user_id, action_type, endpoint, method, payload, created_at, retry_count, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'pending')`,
    [queueId, targetUserId, actionType, endpoint, method, encryptedPayload, now]
  );

  return queueId;
}

export async function getPendingSyncItems(userId?: string): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const rows = userId
    ? await db.getAllAsync<SyncQueueItem>(
        `SELECT * FROM sync_queue WHERE status = 'pending' AND (user_id = ? OR user_id IS NULL OR user_id = '') ORDER BY created_at ASC`,
        [userId]
      )
    : await db.getAllAsync<SyncQueueItem>(
        `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC`
      );

  // Decrypt payloads before passing to the sync engine
  const decryptedItems: SyncQueueItem[] = [];
  for (const row of rows) {
    const rawPayload = await decryptSensitiveText(row.payload);
    decryptedItems.push({
      ...row,
      payload: rawPayload,
    });
  }
  return decryptedItems;
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
  assigned_worker_id?: string | null;
  created_by_id?: string | null;
  assignedWorker?: any;
  creator?: any;
  pregnancies?: PregnancyRecord[];
}) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  if (data.user) {
    await db.runAsync(
      `INSERT OR REPLACE INTO users (user_id, first_name, middle_name, last_name, role, email, phone_number, address, facility_id, facility_name, profile_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        (data.user as any).profile_url || null,
        now,
      ]
    );
  }

  if (data.mother_id) {
    const assignedWorkerJson = data.assignedWorker ? JSON.stringify(data.assignedWorker) : null;
    const creatorJson = data.creator ? JSON.stringify(data.creator) : null;
    await db.runAsync(
      `INSERT OR REPLACE INTO mother_records (mother_id, user_id, family_serial_no, birth_date, age, civil_status, blood_type, assigned_worker_id, created_by_id, assigned_worker_json, creator_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.mother_id,
        data.user?.user_id || "",
        data.family_serial_no || "",
        data.birth_date || "",
        data.age || null,
        data.civil_status || "",
        data.blood_type || "",
        data.assigned_worker_id || data.assignedWorker?.user_id || null,
        data.created_by_id || data.creator?.user_id || null,
        assignedWorkerJson,
        creatorJson,
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
          preg.mother_id || data.mother_id || "",
          preg.date_of_registration || "",
          preg.lmp_date || "",
          preg.gravida || 0,
          preg.parity || 0,
          preg.pregnancy_status || "",
          now,
        ]
      );

      // Save prenatal visits with encrypted clinical notes
      if (preg.prenatalVisits && preg.prenatalVisits.length > 0) {
        for (const visit of preg.prenatalVisits) {
          const encComplaint = await encryptSensitiveText(visit.chief_complaint || "");
          const encRisk = await encryptSensitiveText(visit.risk_level_assessed || "");

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
              encComplaint,
              encRisk,
              now,
            ]
          );
        }
      }

      // Save delivery outcomes and newborn records if present
      if (preg.deliveryOutcomes && preg.deliveryOutcomes.length > 0) {
        await saveDeliveryOutcomesLocal(preg.pregnancy_id, data.mother_id || "", preg.deliveryOutcomes);
      }
    }
  }
}

export async function saveDeliveryOutcomesLocal(
  pregnancyId: string,
  motherId: string,
  outcomes: DeliveryOutcomeRecord[]
) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  for (const outcome of outcomes) {
    await db.runAsync(
      `INSERT OR REPLACE INTO delivery_outcomes (delivery_id, pregnancy_id, mother_id, delivery_date, place_of_delivery, mode_of_delivery, duration_of_labor_hours, blood_loss_ml, delivery_complications, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        outcome.delivery_id,
        pregnancyId,
        motherId,
        outcome.delivery_date || "",
        outcome.place_of_delivery || "",
        outcome.mode_of_delivery || "",
        Number(outcome.duration_of_labor_hours) || 0,
        Number(outcome.blood_loss_ml) || 0,
        outcome.delivery_complications || "",
        now,
      ]
    );

    if (outcome.newbornRecords && outcome.newbornRecords.length > 0) {
      for (const nb of outcome.newbornRecords) {
        await db.runAsync(
          `INSERT OR REPLACE INTO newborn_records (newborn_id, delivery_id, sex, birth_weight_kg, status_at_birth, apgar_score, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nb.newborn_id,
            outcome.delivery_id,
            nb.sex || "",
            Number(nb.birth_weight_kg) || 0,
            nb.status_at_birth || "",
            Number(nb.apgar_score) || 0,
            nb.created_at || now,
            now,
          ]
        );
      }
    }
  }
}

export async function getDeliveryOutcomesLocal(motherId: string): Promise<DeliveryOutcomeRecord[]> {
  const db = await getDatabase();
  const outcomes = await db.getAllAsync<DeliveryOutcomeRecord>(
    `SELECT d.* FROM delivery_outcomes d
     JOIN pregnancies p ON d.pregnancy_id = p.pregnancy_id
     WHERE p.mother_id = ? OR d.mother_id = ? ORDER BY d.delivery_date DESC`,
    [motherId, motherId]
  );

  for (const outcome of outcomes) {
    const newborns = await db.getAllAsync<NewbornRecord>(
      `SELECT * FROM newborn_records WHERE delivery_id = ?`,
      [outcome.delivery_id]
    );
    outcome.newbornRecords = newborns;
  }
  return outcomes;
}

export async function getMotherProfileLocal(userId: string): Promise<{
  user: AuthUser | null;
  motherRecord: MotherRecord | null;
} | null> {
  const db = await getDatabase();
  const user = await db.getFirstAsync<AuthUser>(`SELECT * FROM users WHERE user_id = ?`, [userId]);
  if (!user) return null;

  const rawMRecord = await db.getFirstAsync<any>(
    `SELECT * FROM mother_records WHERE user_id = ?`,
    [userId]
  );

  let pregnancies: PregnancyRecord[] = [];
  let mRecord: MotherRecord | null = null;
  if (rawMRecord) {
    let assignedWorker = null;
    let creator = null;
    try {
      if (rawMRecord.assigned_worker_json) {
        assignedWorker = JSON.parse(rawMRecord.assigned_worker_json);
      }
    } catch {}
    try {
      if (rawMRecord.creator_json) {
        creator = JSON.parse(rawMRecord.creator_json);
      }
    } catch {}

    mRecord = {
      ...rawMRecord,
      assigned_worker_id: rawMRecord.assigned_worker_id || assignedWorker?.user_id || null,
      created_by_id: rawMRecord.created_by_id || creator?.user_id || null,
      assignedWorker: assignedWorker || (rawMRecord.assigned_worker_id ? { user_id: rawMRecord.assigned_worker_id, first_name: "Assigned", last_name: "Health Worker", role: "HealthWorker" } : null),
      creator: creator,
    };

    const pregs = await db.getAllAsync<PregnancyRecord>(
      `SELECT * FROM pregnancies WHERE mother_id = ?`,
      [rawMRecord.mother_id]
    );

    for (const p of pregs) {
      const visits = await db.getAllAsync<PrenatalVisitRecord>(
        `SELECT * FROM prenatal_visits WHERE pregnancy_id = ? ORDER BY visit_number ASC`,
        [p.pregnancy_id]
      );

      // Decrypt clinical notes
      for (const v of visits) {
        v.chief_complaint = await decryptSensitiveText(v.chief_complaint);
        v.risk_level_assessed = await decryptSensitiveText(v.risk_level_assessed);
      }
      p.prenatalVisits = visits;

      // Attach delivery outcomes
      const deliveries = await getDeliveryOutcomesLocal(rawMRecord.mother_id);
      p.deliveryOutcomes = deliveries.filter((d) => d.pregnancy_id === p.pregnancy_id);
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

export async function updateUserProfileLocal(
  userId: string,
  updates: {
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    phone_number?: string;
    email?: string;
    address?: string;
    profile_url?: string;
    birth_date?: string;
    civil_status?: string;
    blood_type?: string;
  }
) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // 1. Update users table
  const userFields: string[] = [];
  const userParams: any[] = [];
  if (updates.first_name !== undefined) { userFields.push("first_name = ?"); userParams.push(updates.first_name); }
  if (updates.middle_name !== undefined) { userFields.push("middle_name = ?"); userParams.push(updates.middle_name); }
  if (updates.last_name !== undefined) { userFields.push("last_name = ?"); userParams.push(updates.last_name); }
  if (updates.phone_number !== undefined) { userFields.push("phone_number = ?"); userParams.push(updates.phone_number); }
  if (updates.email !== undefined) { userFields.push("email = ?"); userParams.push(updates.email); }
  if (updates.address !== undefined) { userFields.push("address = ?"); userParams.push(updates.address); }
  if (updates.profile_url !== undefined) { userFields.push("profile_url = ?"); userParams.push(updates.profile_url); }

  if (userFields.length > 0) {
    userFields.push("updated_at = ?");
    userParams.push(now);
    userParams.push(userId);
    await db.runAsync(`UPDATE users SET ${userFields.join(", ")} WHERE user_id = ?`, userParams);
  }

  // 2. Update mother_records table
  const motherFields: string[] = [];
  const motherParams: any[] = [];
  if (updates.birth_date !== undefined) { motherFields.push("birth_date = ?"); motherParams.push(updates.birth_date); }
  if (updates.civil_status !== undefined) { motherFields.push("civil_status = ?"); motherParams.push(updates.civil_status); }
  if (updates.blood_type !== undefined) { motherFields.push("blood_type = ?"); motherParams.push(updates.blood_type); }

  if (motherFields.length > 0) {
    motherFields.push("updated_at = ?");
    motherParams.push(now);
    motherParams.push(userId);
    await db.runAsync(`UPDATE mother_records SET ${motherFields.join(", ")} WHERE user_id = ?`, motherParams);
  }
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

export async function getAppointmentByIdLocal(appointmentId: string): Promise<AppointmentRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AppointmentRecord>(
    `SELECT * FROM appointments WHERE appointment_id = ?`,
    [appointmentId]
  );
  return row || null;
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
    status: payload.status || "scheduled",
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
      record.reason || null,
      record.status,
      isOnline ? "synced" : "pending",
      now,
    ]
  );

  if (!isOnline) {
    await enqueueSyncAction(
      "CREATE_APPOINTMENT",
      "/api/v1/appointment/register",
      "POST",
      payload,
      payload.user_id
    );
  }

  return record;
}

export async function cancelAppointmentLocal(
  appointmentId: string,
  isOnline: boolean,
  userId?: string
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<AppointmentRecord>(
    `SELECT * FROM appointments WHERE appointment_id = ?`,
    [appointmentId]
  );

  if (existing) {
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
        { appointmentId, version: nextVersion },
        userId || existing.user_id
      );
    }
  }
}

// --- Supplements Operations ---
export async function getSupplementsLocal(motherId: string): Promise<SupplementRecord[]> {
  if (!motherId) return [];
  const db = await getDatabase();
  const rows = await db.getAllAsync<SupplementRecord>(
    `SELECT s.* FROM supplements s
     LEFT JOIN pregnancies p ON s.pregnancy_id = p.pregnancy_id
     WHERE p.mother_id = ? OR p.mother_id IS NULL OR s.pregnancy_id IN (SELECT pregnancy_id FROM pregnancies WHERE mother_id = ?)
     ORDER BY s.date_given DESC`,
    [motherId, motherId]
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
  isOnline: boolean,
  userId?: string
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<SupplementRecord>(
    `SELECT * FROM supplements WHERE supplement_id = ?`,
    [supplementId]
  );

  if (existing) {
    await saveRecordHistory("supplement", supplementId, (existing as any).version || 1, existing);

    const nextVersion = ((existing as any).version || 1) + 1;
    const now = new Date().toISOString();

    await db.runAsync(
      `UPDATE supplements SET is_completed = ?, version = ?, sync_status = ?, updated_at = ? WHERE supplement_id = ?`,
      [isCompleted ? 1 : 0, nextVersion, isOnline ? "synced" : "pending", now, supplementId]
    );

    if (!isOnline) {
      await enqueueSyncAction(
        "UPDATE_SUPPLEMENT",
        "/api/v1/supplement/update",
        "PUT",
        {
          supplement_id: supplementId,
          is_completed: isCompleted,
          version: nextVersion,
        },
        userId
      );
    }
  }
}

// --- Lab Screenings Operations ---
export async function getLabScreeningsLocal(motherId: string): Promise<LabScreeningRecord[]> {
  if (!motherId) return [];
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM lab_screenings WHERE screening_id IS NULL OR screening_id = 'null' OR screening_id = 'undefined'`).catch(() => {});

  const rows = await db.getAllAsync<LabScreeningRecord>(
    `SELECT ls.* FROM lab_screenings ls
     LEFT JOIN pregnancies p ON ls.pregnancy_id = p.pregnancy_id
     WHERE ls.mother_id = ? OR p.mother_id = ?
     ORDER BY ls.date_of_screening DESC`,
    [motherId, motherId]
  );

  for (const r of rows) {
    r.result = await decryptSensitiveText(r.result);
    r.remarks = await decryptSensitiveText(r.remarks);
  }
  return rows.filter((r) => Boolean(r.screening_id && r.screening_id !== "null" && r.screening_id !== "undefined"));
}

export async function saveLabScreeningsLocal(
  screenings: LabScreeningRecord[],
  isFromBackend = true,
  motherId?: string,
  isFullSync = false
) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(`DELETE FROM lab_screenings WHERE screening_id IS NULL OR screening_id = 'null' OR screening_id = 'undefined'`).catch(() => {});

  if (isFromBackend && motherId && isFullSync) {
    const validIds = new Set(screenings.map((s) => s.screening_id || (s as any).data?.screening_id).filter((id): id is string => Boolean(id && id !== "null" && id !== "undefined")));
    const currentRecords = await getLabScreeningsLocal(motherId);

    for (const item of currentRecords) {
      if ((item as any).sync_status === "synced" && !validIds.has(item.screening_id)) {
        await db.runAsync(`DELETE FROM lab_screenings WHERE screening_id = ?`, [item.screening_id]);
      }
    }
  }

  for (const rawLs of screenings) {
    const ls: any = (rawLs as any).data || rawLs;
    const sId = ls.screening_id;
    if (!sId || sId === "null" || sId === "undefined") continue;

    const encResult = await encryptSensitiveText(ls.result || "");
    const encRemarks = await encryptSensitiveText(ls.remarks || "");

    await db.runAsync(
      `INSERT OR REPLACE INTO lab_screenings (screening_id, mother_id, pregnancy_id, visit_id, screening_type, result, file_url, local_file_uri, file_size_bytes, upload_status, date_of_screening, remarks, version, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sId,
        motherId || ls.mother_id || null,
        ls.pregnancy_id,
        ls.visit_id,
        ls.screening_type,
        encResult,
        ls.file_url || null,
        ls.local_file_uri || null,
        ls.file_size_bytes || null,
        ls.upload_status || (isFromBackend ? "synced" : "pending"),
        ls.date_of_screening,
        encRemarks,
        ls.version || 1,
        isFromBackend ? "synced" : "pending",
        now,
      ]
    );
  }
}

export async function deleteLabScreeningLocal(screeningId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM lab_screenings WHERE screening_id = ?`, [screeningId]);
  await db.runAsync(`DELETE FROM sync_outbox WHERE payload LIKE ?`, [`%${screeningId}%`]).catch(() => {});
}

export async function createLabScreeningLocal(
  payload: any,
  localFileUri: string | null,
  fileSizeBytes: number | null,
  isOnline: boolean,
  motherId?: string
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

  const encResult = await encryptSensitiveText(record.result || "");
  const encRemarks = await encryptSensitiveText(record.remarks || "");

  await db.runAsync(
    `INSERT INTO lab_screenings (screening_id, mother_id, pregnancy_id, visit_id, screening_type, result, file_url, local_file_uri, file_size_bytes, upload_status, date_of_screening, remarks, version, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      record.screening_id,
      motherId || payload.mother_id || null,
      record.pregnancy_id,
      record.visit_id,
      record.screening_type,
      encResult,
      record.file_url || null,
      localFileUri || null,
      fileSizeBytes || null,
      localFileUri && !payload.file_url ? "pending" : "synced",
      record.date_of_screening,
      encRemarks,
      isOnline ? "synced" : "pending",
      now,
    ]
  );

  if (!isOnline) {
    await enqueueSyncAction(
      "CREATE_LAB_SCREENING",
      "/api/v1/lab-screening/register",
      "POST",
      {
        ...payload,
        mother_id: motherId || payload.mother_id,
        screening_id: screeningId,
        localFileUri,
        fileSizeBytes,
      },
      payload.user_id || motherId
    );
  }

  return record;
}

// --- Messages & Chat Operations (Encrypted & Isolated) ---
export async function getMessagesLocal(userId: string, contactId?: string): Promise<InAppMessage[]> {
  const db = await getDatabase();
  let query = `SELECT * FROM messages WHERE (sender_id = ? OR receiver_id = ?)`;
  const params: any[] = [userId, userId];

  if (contactId) {
    query += ` AND (sender_id = ? OR receiver_id = ?)`;
    params.push(contactId, contactId);
  }
  query += ` ORDER BY message_date ASC`;

  const rows = await db.getAllAsync<any>(query, params);
  const result: InAppMessage[] = [];

  for (const r of rows) {
    const plainContent = await decryptSensitiveText(r.message_content);
    result.push({
      message_id: r.message_id,
      sender_id: r.sender_id,
      receiver_id: r.receiver_id,
      message_type: r.message_type || "text",
      message_content: plainContent,
      message_date: r.message_date,
      is_read: Boolean(r.is_read),
    });
  }
  return result;
}

export async function saveMessagesLocal(messages: InAppMessage[]) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  for (const m of messages) {
    const encContent = await encryptSensitiveText(m.message_content || "");
    await db.runAsync(
      `INSERT OR REPLACE INTO messages (message_id, sender_id, receiver_id, message_type, message_content, message_date, is_read, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.message_id,
        m.sender_id,
        m.receiver_id,
        m.message_type || "text",
        encContent,
        m.message_date,
        m.is_read ? 1 : 0,
        (m as any).sync_status || "synced",
        now,
      ]
    );

    // If this is a confirmed server message (not starting with local_), clean up any old local_ messages that had matching metadata
    if (!m.message_id.startsWith("local_")) {
      await db.runAsync(
        `DELETE FROM messages 
         WHERE message_id LIKE 'local_%' 
           AND sender_id = ? 
           AND receiver_id = ? 
           AND sync_status = 'synced'`,
        [m.sender_id, m.receiver_id]
      ).catch(() => {});
    }
  }
}

export async function deleteLocalMessage(messageId: string) {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM messages WHERE message_id = ?`, [messageId]);
}

export async function saveOutgoingMessageLocal(
  message: InAppMessage,
  isOnline: boolean
): Promise<InAppMessage> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const encContent = await encryptSensitiveText(message.message_content);

  await db.runAsync(
    `INSERT OR REPLACE INTO messages (message_id, sender_id, receiver_id, message_type, message_content, message_date, is_read, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.message_id,
      message.sender_id,
      message.receiver_id,
      message.message_type || "text",
      encContent,
      message.message_date,
      0,
      isOnline ? "synced" : "pending",
      now,
    ]
  );

  if (!isOnline) {
    await enqueueSyncAction(
      "CREATE_MESSAGE",
      "/api/v1/message/create",
      "POST",
      {
        temp_id: message.message_id,
        receiver_id: message.receiver_id,
        message_content: message.message_content,
        message_type: message.message_type,
        message_date: message.message_date,
      },
      message.sender_id
    );
  }

  return message;
}

// --- Chat Contacts Operations ---
export async function getChatContactsLocal(facilityId?: string): Promise<ChatContact[]> {
  const db = await getDatabase();
  let query = `SELECT * FROM chat_contacts`;
  const params: any[] = [];

  if (facilityId) {
    query += ` WHERE facility_id = ?`;
    params.push(facilityId);
  }
  query += ` ORDER BY first_name ASC`;

  const rows = await db.getAllAsync<any>(query, params);
  return rows.map((r) => ({
    user_id: r.user_id,
    first_name: r.first_name,
    last_name: r.last_name,
    role: r.role,
    facility_id: r.facility_id,
    profile_url: r.profile_url,
    facility: r.facility_name ? { facility_id: r.facility_id, facility_name: r.facility_name } : undefined,
  }));
}

export async function saveChatContactsLocal(contacts: ChatContact[]) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  for (const c of contacts) {
    await db.runAsync(
      `INSERT OR REPLACE INTO chat_contacts (user_id, first_name, last_name, role, facility_id, facility_name, profile_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.user_id,
        c.first_name || "",
        c.last_name || "",
        c.role || "Staff",
        c.facility_id || c.facility?.facility_id || null,
        c.facility?.facility_name || null,
        c.profile_url || null,
        now,
      ]
    );
  }
}

export type NotificationRecordLocal = {
  notification_id: string;
  user_id: string;
  notification_type: string;
  notification_message: string;
  notification_date: string;
  is_read: boolean;
  sender?: string;
  category?: string;
};

export async function getNotificationsLocal(userId: string): Promise<NotificationRecordLocal[]> {
  if (!userId) return [];
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY notification_date DESC`,
    [userId]
  );
  return rows.map((r) => ({
    notification_id: r.notification_id,
    user_id: r.user_id,
    notification_type: r.notification_type || "system",
    notification_message: r.notification_message || "",
    notification_date: r.notification_date || new Date().toISOString(),
    is_read: Boolean(r.is_read),
    sender: r.sender || "System",
    category: r.category || "system",
  }));
}

export async function getUnreadNotificationCountLocal(userId: string): Promise<number> {
  if (!userId) return 0;
  const db = await getDatabase();
  const res = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
    [userId]
  );
  return res?.count || 0;
}

export async function saveNotificationsLocal(notifications: NotificationRecordLocal[]) {
  if (!Array.isArray(notifications) || notifications.length === 0) return;
  const db = await getDatabase();
  const now = new Date().toISOString();

  for (const n of notifications) {
    await db.runAsync(
      `INSERT OR REPLACE INTO notifications (notification_id, user_id, notification_type, notification_message, notification_date, is_read, sender, category, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        n.notification_id,
        n.user_id,
        n.notification_type || "system",
        n.notification_message || "",
        n.notification_date || now,
        n.is_read ? 1 : 0,
        n.sender || "System",
        n.category || "system",
        now,
      ]
    );
  }
}

export async function markAllNotificationsReadLocal(userId: string) {
  if (!userId) return;
  const db = await getDatabase();
  await db.runAsync(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [userId]);
}

export async function markNotificationReadLocal(notificationId: string) {
  if (!notificationId) return;
  const db = await getDatabase();
  await db.runAsync(`UPDATE notifications SET is_read = 1 WHERE notification_id = ?`, [notificationId]);
}
