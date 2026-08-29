import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";

let dbInstance: any = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    if (Platform.OS === "web") {
      dbInstance = createWebFallbackDatabase() as any;
    } else {
      dbInstance = await SQLite.openDatabaseAsync("bms.db");
      await initTables(dbInstance);
    }
  }
  return dbInstance as SQLite.SQLiteDatabase;
}

async function initTables(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      first_name TEXT,
      middle_name TEXT,
      last_name TEXT,
      role TEXT,
      email TEXT,
      phone_number TEXT,
      address TEXT,
      facility_id TEXT,
      facility_name TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS mother_records (
      mother_id TEXT PRIMARY KEY,
      user_id TEXT,
      family_serial_no TEXT,
      birth_date TEXT,
      age INTEGER,
      civil_status TEXT,
      blood_type TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pregnancies (
      pregnancy_id TEXT PRIMARY KEY,
      mother_id TEXT,
      date_of_registration TEXT,
      lmp_date TEXT,
      gravida INTEGER,
      parity INTEGER,
      pregnancy_status TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS prenatal_visits (
      visit_id TEXT PRIMARY KEY,
      pregnancy_id TEXT,
      visit_date TEXT,
      trimester INTEGER,
      visit_number INTEGER,
      age_of_gestation_weeks INTEGER,
      weight_kg REAL,
      temperature_celsius REAL,
      pulse_rate_bpm INTEGER,
      bp_diastolic INTEGER,
      bp_systolic INTEGER,
      fundic_height_cm REAL,
      fetal_heart_tone_bpm INTEGER,
      chief_complaint TEXT,
      risk_level_assessed TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS appointments (
      appointment_id TEXT PRIMARY KEY,
      user_id TEXT,
      facility_id TEXT,
      appointment_date TEXT,
      appointment_time TEXT,
      appointment_type TEXT,
      reason TEXT,
      status TEXT,
      version INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'synced',
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS supplements (
      supplement_id TEXT PRIMARY KEY,
      pregnancy_id TEXT,
      visit_id TEXT,
      supplement_type TEXT,
      tablets_given_count INTEGER,
      date_given TEXT,
      is_completed INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'synced',
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS lab_screenings (
      screening_id TEXT PRIMARY KEY,
      pregnancy_id TEXT,
      visit_id TEXT,
      screening_type TEXT,
      result TEXT,
      file_url TEXT,
      local_file_uri TEXT,
      file_size_bytes INTEGER,
      upload_status TEXT DEFAULT 'synced',
      date_of_screening TEXT,
      remarks TEXT,
      version INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'synced',
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS record_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      action_type TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      error TEXT
    );
  `);
}

function createWebFallbackDatabase() {
  const getTable = async (table: string): Promise<any[]> => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(`@sqlite_web_${table}`);
        if (raw) return JSON.parse(raw);
      }
      const raw = await AsyncStorage.getItem(`@sqlite_web_${table}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveTable = async (table: string, data: any[]) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(`@sqlite_web_${table}`, JSON.stringify(data));
      }
      await AsyncStorage.setItem(`@sqlite_web_${table}`, JSON.stringify(data));
    } catch (e) {
      console.warn(`Failed saving web table ${table}:`, e);
    }
  };

  const parseTableName = (sql: string): string => {
    const s = sql.toLowerCase();
    for (const table of [
      "users",
      "mother_records",
      "pregnancies",
      "prenatal_visits",
      "appointments",
      "supplements",
      "lab_screenings",
      "record_history",
      "sync_queue",
    ]) {
      if (s.includes(`from ${table}`) || s.includes(`into ${table}`) || s.includes(`update ${table}`)) {
        return table;
      }
    }
    return "appointments";
  };

  return {
    execAsync: async () => {},
    runAsync: async (sql: string, params: any[] = []) => {
      const table = parseTableName(sql);
      const rows = await getTable(table);
      const s = sql.toUpperCase();

      if (s.startsWith("INSERT")) {
        let pkField = "id";
        if (table === "users") pkField = "user_id";
        else if (table === "mother_records") pkField = "mother_id";
        else if (table === "pregnancies") pkField = "pregnancy_id";
        else if (table === "prenatal_visits") pkField = "visit_id";
        else if (table === "appointments") pkField = "appointment_id";
        else if (table === "supplements") pkField = "supplement_id";
        else if (table === "lab_screenings") pkField = "screening_id";
        else if (table === "sync_queue") pkField = "id";

        const item: any = {};
        if (table === "appointments") {
          item.appointment_id = params[0];
          item.user_id = params[1];
          item.facility_id = params[2];
          item.appointment_date = params[3];
          item.appointment_time = params[4];
          item.appointment_type = params[5];
          item.reason = params[6];
          item.status = params[7];
          item.version = params[8] || 1;
          item.sync_status = params[9] || "pending";
          item.updated_at = params[10];
        } else if (table === "sync_queue") {
          item.id = params[0];
          item.action_type = params[1];
          item.endpoint = params[2];
          item.method = params[3];
          item.payload = params[4];
          item.created_at = params[5];
          item.retry_count = params[6] || 0;
          item.status = params[7] || "pending";
        } else if (table === "supplements") {
          item.supplement_id = params[0];
          item.pregnancy_id = params[1];
          item.visit_id = params[2];
          item.supplement_type = params[3];
          item.tablets_given_count = params[4];
          item.date_given = params[5];
          item.is_completed = params[6];
          item.version = params[7] || 1;
          item.sync_status = params[8] || "synced";
          item.updated_at = params[9];
        } else if (table === "lab_screenings") {
          item.screening_id = params[0];
          item.pregnancy_id = params[1];
          item.visit_id = params[2];
          item.screening_type = params[3];
          item.result = params[4];
          item.file_url = params[5];
          item.local_file_uri = params[6];
          item.file_size_bytes = params[7];
          item.upload_status = params[8];
          item.date_of_screening = params[9];
          item.remarks = params[10];
          item.version = params[11] || 1;
          item.sync_status = params[12] || "synced";
          item.updated_at = params[13];
        } else if (table === "users") {
          item.user_id = params[0];
          item.first_name = params[1];
          item.middle_name = params[2];
          item.last_name = params[3];
          item.role = params[4];
          item.email = params[5];
          item.phone_number = params[6];
          item.address = params[7];
          item.facility_id = params[8];
          item.facility_name = params[9];
          item.updated_at = params[10];
        } else if (table === "mother_records") {
          item.mother_id = params[0];
          item.user_id = params[1];
          item.family_serial_no = params[2];
          item.birth_date = params[3];
          item.age = params[4];
          item.civil_status = params[5];
          item.blood_type = params[6];
          item.updated_at = params[7];
        } else if (table === "pregnancies") {
          item.pregnancy_id = params[0];
          item.mother_id = params[1];
          item.date_of_registration = params[2];
          item.lmp_date = params[3];
          item.gravida = params[4];
          item.parity = params[5];
          item.pregnancy_status = params[6];
          item.updated_at = params[7];
        }

        const existingIdx = rows.findIndex((r) => r[pkField] === item[pkField]);
        if (existingIdx >= 0) {
          rows[existingIdx] = { ...rows[existingIdx], ...item };
        } else {
          rows.push(item);
        }
        await saveTable(table, rows);
      } else if (s.startsWith("DELETE")) {
        const pk = params[0];
        const newRows = rows.filter((r) => r.id !== pk && r.appointment_id !== pk && r.supplement_id !== pk);
        await saveTable(table, newRows);
      } else if (s.startsWith("UPDATE")) {
        const pk = params[params.length - 1];
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].id === pk || rows[i].appointment_id === pk || rows[i].supplement_id === pk) {
            if (table === "appointments") {
              if (sql.includes("status = 'Cancelled'")) rows[i].status = "Cancelled";
              if (sql.includes("sync_status = 'synced'")) rows[i].sync_status = "synced";
            } else if (table === "supplements") {
              if (sql.includes("is_completed = ?")) rows[i].is_completed = params[0];
            } else if (table === "sync_queue") {
              if (sql.includes("retry_count = retry_count + 1")) rows[i].retry_count = (rows[i].retry_count || 0) + 1;
            }
          }
        }
        await saveTable(table, rows);
      }
      return { changes: 1, lastInsertRowId: 1 };
    },
    getAllAsync: async <T>(sql: string, params: any[] = []): Promise<T[]> => {
      const table = parseTableName(sql);
      const rows = await getTable(table);
      if (params.length > 0) {
        const filterVal = params[0];
        return rows.filter(
          (r) =>
            r.user_id === filterVal ||
            r.mother_id === filterVal ||
            r.pregnancy_id === filterVal ||
            r.status === filterVal
        ) as T[];
      }
      return rows as T[];
    },
    getFirstAsync: async <T>(sql: string, params: any[] = []): Promise<T | null> => {
      const table = parseTableName(sql);
      const rows = await getTable(table);
      if (params.length > 0) {
        const filterVal = params[0];
        const match = rows.find(
          (r) =>
            r.user_id === filterVal ||
            r.mother_id === filterVal ||
            r.pregnancy_id === filterVal ||
            r.appointment_id === filterVal ||
            r.supplement_id === filterVal ||
            r.screening_id === filterVal
        );
        return (match as T) || null;
      }
      return (rows[0] as T) || null;
    },
  };
}
