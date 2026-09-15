import { API_BASE_URL } from "../config/api";
import { getDatabase } from "../db/db";
import {
  getPendingSyncItems,
  markSyncItemSuccess,
  markSyncItemFailed,
} from "../db/repository";

let isSyncing = false;

export async function triggerOutboxSync(authToken: string | null): Promise<void> {
  if (isSyncing || !authToken) return;

  try {
    isSyncing = true;
    const pendingItems = await getPendingSyncItems();
    if (pendingItems.length === 0) {
      isSyncing = false;
      return;
    }

    console.log(`[SyncEngine] Starting outbox sync for ${pendingItems.length} pending items...`);

    for (const item of pendingItems) {
      try {
        const payload = JSON.parse(item.payload);

        // Handle offline image/file upload first if creating lab screening
        if (item.action_type === "CREATE_LAB_SCREENING" && payload.localFileUri && !payload.file_url) {
          console.log(`[SyncEngine] Uploading local file for screening: ${payload.localFileUri}`);
          const fileUrl = await uploadLocalFile(payload.localFileUri, authToken);
          payload.file_url = fileUrl;
        }

        // Clean out transient fields before endpoint submission
        const cleanPayload = { ...payload };
        delete cleanPayload.localFileUri;
        delete cleanPayload.fileSizeBytes;

        const response = await fetch(`${API_BASE_URL}${item.endpoint}`, {
          method: item.method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(cleanPayload),
        });

        if (response.ok) {
          const resData = await response.json();
          await markSyncItemSuccess(item.id);
          await updateLocalRecordSynced(item.action_type, payload, resData);
          console.log(`[SyncEngine] Successfully synced item ${item.id} (${item.action_type})`);
        } else {
          const errText = await response.text();
          console.warn(`[SyncEngine] Item ${item.id} returned status ${response.status}: ${errText}`);
          await markSyncItemFailed(item.id, `HTTP ${response.status}: ${errText}`);
        }
      } catch (err: any) {
        console.error(`[SyncEngine] Failed syncing item ${item.id}:`, err);
        await markSyncItemFailed(item.id, err.message || "Network request failed");
      }
    }
  } finally {
    isSyncing = false;
  }
}

async function uploadLocalFile(localFileUri: string, token: string): Promise<string> {
  const formData = new FormData();
  const filename = localFileUri.split("/").pop() || "lab_file.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append("file", {
    uri: localFileUri,
    name: filename,
    type,
  } as any);

  const response = await fetch(`${API_BASE_URL}/api/v1/lab-screening/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to upload file to storage");
  }

  return data.fileUrl || data.url || data.file_url;
}

async function updateLocalRecordSynced(actionType: string, payload: any, responseData: any) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  if (actionType === "CREATE_APPOINTMENT") {
    const serverApptId = responseData?.appointment_id || responseData?.result?.appointment_id;
    if (serverApptId && payload.appointment_id) {
      await db.runAsync(
        `UPDATE appointments SET appointment_id = ?, sync_status = 'synced', updated_at = ? WHERE appointment_id = ?`,
        [serverApptId, now, payload.appointment_id]
      );
    }
  } else if (actionType === "CANCEL_APPOINTMENT") {
    await db.runAsync(
      `UPDATE appointments SET sync_status = 'synced', updated_at = ? WHERE appointment_id = ?`,
      [now, payload.appointmentId]
    );
  } else if (actionType === "UPDATE_SUPPLEMENT") {
    await db.runAsync(
      `UPDATE supplements SET sync_status = 'synced', updated_at = ? WHERE supplement_id = ?`,
      [now, payload.supplement_id]
    );
  } else if (actionType === "CREATE_LAB_SCREENING") {
    const serverScreeningId = responseData?.screening_id || responseData?.result?.screening_id;
    await db.runAsync(
      `UPDATE lab_screenings SET screening_id = ?, file_url = ?, upload_status = 'synced', sync_status = 'synced', updated_at = ? WHERE screening_id = ?`,
      [
        serverScreeningId || payload.screening_id,
        payload.file_url || null,
        now,
        payload.screening_id,
      ]
    );
  }
}
