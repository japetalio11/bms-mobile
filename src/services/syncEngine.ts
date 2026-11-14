import { API_BASE_URL } from "../config/api";
import { getDatabase } from "../db/db";
import { getPendingSyncItems, markSyncItemSuccess, markSyncItemFailed } from "../db/repository";
import { getSecureToken } from "../lib/secureStorage";

export type SyncEvent = {
  type: "item_synced" | "item_failed" | "sync_started" | "sync_completed";
  actionType?: string;
  tempId?: string;
  serverId?: string;
  data?: any;
  error?: string;
};

type SyncListener = (event: SyncEvent) => void;
const syncListeners = new Set<SyncListener>();

export function subscribeSyncEvents(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

export function emitSyncEvent(event: SyncEvent): void {
  syncListeners.forEach((listener) => {
    try {
      listener(event);
    } catch {}
  });
}

let isSyncing = false;

export async function triggerOutboxSync(
  authToken?: string | null,
  currentUserId?: string
): Promise<void> {
  const token = authToken || (await getSecureToken());
  if (isSyncing || !token) return;

  try {
    isSyncing = true;
    const pendingItems = await getPendingSyncItems(currentUserId);
    if (pendingItems.length === 0) {
      isSyncing = false;
      return;
    }

    emitSyncEvent({ type: "sync_started" });

    const db = await getDatabase();

    for (const item of pendingItems) {
      try {
        let payload: any = {};
        try {
          payload = typeof item.payload === "string" ? JSON.parse(item.payload) : item.payload;
        } catch {
          payload = item.payload;
        }

        if (
          item.action_type === "CREATE_LAB_SCREENING" &&
          payload.localFileUri &&
          !payload.file_url
        ) {
          try {
            const fileUrl = await uploadLocalFile(payload.localFileUri, token);
            payload.file_url = fileUrl;
          } catch (uploadErr: any) {
            await markSyncItemFailed(item.id, uploadErr.message || "File upload failed");
            continue;
          }
        }

        if (
          item.action_type === "UPDATE_PROFILE" &&
          payload.localAvatarUri &&
          !payload.profile_url
        ) {
          try {
            const fileUrl = await uploadAvatarFile(payload.localAvatarUri, token);
            payload.profile_url = fileUrl;
          } catch {}
        }

        const cleanPayload = { ...payload };
        delete cleanPayload.localFileUri;
        delete cleanPayload.localAvatarUri;
        delete cleanPayload.fileSizeBytes;
        const tempId = cleanPayload.temp_id || cleanPayload.appointment_id || cleanPayload.screening_id;
        delete cleanPayload.temp_id;

        const isDeleteAction = item.method.toUpperCase() === "DELETE";
        const requestOptions: RequestInit = {
          method: item.method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        };

        if (!isDeleteAction && item.method.toUpperCase() !== "GET") {
          requestOptions.body = JSON.stringify(cleanPayload);
        }

        const response = await fetch(`${API_BASE_URL}${item.endpoint}`, requestOptions);

        if (response.ok) {
          let resData: any = {};
          try {
            resData = await response.json();
          } catch {}

          await markSyncItemSuccess(item.id);
          const serverId = await updateLocalRecordSynced(db, item.action_type, payload, resData, tempId);

          emitSyncEvent({
            type: "item_synced",
            actionType: item.action_type,
            tempId,
            serverId,
            data: resData,
          });
        } else {
          const errText = await response.text();
          if (response.status === 404 && isDeleteAction) {
            await markSyncItemSuccess(item.id);
          } else {
            await markSyncItemFailed(item.id, `HTTP ${response.status}: ${errText}`);
            emitSyncEvent({
              type: "item_failed",
              actionType: item.action_type,
              tempId,
              error: `HTTP ${response.status}: ${errText}`,
            });
          }
        }
      } catch (err: any) {
        await markSyncItemFailed(item.id, err.message || "Network request failed");
        emitSyncEvent({
          type: "item_failed",
          actionType: item.action_type,
          error: err.message || "Network request failed",
        });
      }
    }

    emitSyncEvent({ type: "sync_completed" });
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

async function uploadAvatarFile(localUri: string, token: string): Promise<string> {
  const formData = new FormData();
  const filename = localUri.split("/").pop() || "avatar.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append("file", {
    uri: localUri,
    name: filename,
    type,
  } as any);

  const response = await fetch(`${API_BASE_URL}/api/v1/mother/avatar/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to upload avatar");
  }

  return data.fileUrl || data.url || data.file_url;
}

async function updateLocalRecordSynced(
  db: any,
  actionType: string,
  payload: any,
  responseData: any,
  tempId?: string
): Promise<string | undefined> {
  const now = new Date().toISOString();

  if (actionType === "CREATE_APPOINTMENT") {
    const serverApptId =
      responseData?.appointment_id ||
      responseData?.data?.appointment_id ||
      responseData?.result?.appointment_id;
    const lookupId = tempId || payload.appointment_id || payload.id;
    if (serverApptId && lookupId) {
      await db.runAsync(
        `UPDATE appointments SET appointment_id = ?, sync_status = 'synced', updated_at = ? WHERE appointment_id = ?`,
        [serverApptId, now, lookupId]
      );
      return serverApptId;
    }
  } else if (actionType === "CANCEL_APPOINTMENT") {
    const targetId = payload.appointmentId || payload.appointment_id || tempId;
    if (targetId) {
      await db.runAsync(
        `UPDATE appointments SET status = 'Cancelled', sync_status = 'synced', updated_at = ? WHERE appointment_id = ?`,
        [now, targetId]
      );
      return targetId;
    }
  } else if (actionType === "UPDATE_SUPPLEMENT") {
    const suppId = payload.supplement_id || tempId;
    if (suppId) {
      await db.runAsync(
        `UPDATE supplements SET sync_status = 'synced', updated_at = ? WHERE supplement_id = ?`,
        [now, suppId]
      );
      return suppId;
    }
  } else if (actionType === "CREATE_LAB_SCREENING") {
    const serverScreeningId =
      responseData?.screening_id ||
      responseData?.data?.screening_id ||
      responseData?.result?.screening_id;
    const lookupId = tempId || payload.screening_id;
    if (lookupId) {
      await db.runAsync(
        `UPDATE lab_screenings SET screening_id = ?, file_url = ?, upload_status = 'synced', sync_status = 'synced', updated_at = ? WHERE screening_id = ?`,
        [
          serverScreeningId || lookupId,
          payload.file_url || null,
          now,
          lookupId,
        ]
      );
      return serverScreeningId || lookupId;
    }
  } else if (actionType === "DELETE_LAB_SCREENING") {
    const screeningId = payload.screening_id || tempId;
    if (screeningId) {
      await db.runAsync(`DELETE FROM lab_screenings WHERE screening_id = ?`, [screeningId]);
      return screeningId;
    }
  } else if (actionType === "CREATE_MESSAGE") {
    const serverMsg = responseData?.data || responseData;
    const serverId = serverMsg?.message_id;
    const lookupId = tempId || payload.temp_id || payload.message_id;
    if (serverId && lookupId) {
      await db.runAsync(
        `UPDATE messages SET message_id = ?, sync_status = 'synced', updated_at = ? WHERE message_id = ?`,
        [serverId, now, lookupId]
      );
      return serverId;
    }
  } else if (actionType === "UPDATE_PROFILE") {
    if (payload.user_id) {
      const updates: string[] = [];
      const params: any[] = [];
      if (payload.first_name) {
        updates.push("first_name = ?");
        params.push(payload.first_name);
      }
      if (payload.last_name) {
        updates.push("last_name = ?");
        params.push(payload.last_name);
      }
      if (payload.phone_number) {
        updates.push("phone_number = ?");
        params.push(payload.phone_number);
      }
      if (payload.profile_url) {
        updates.push("profile_url = ?");
        params.push(payload.profile_url);
      }
      if (updates.length > 0) {
        updates.push("updated_at = ?");
        params.push(now);
        params.push(payload.user_id);
        await db.runAsync(
          `UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`,
          params
        );
      }
      return payload.user_id;
    }
  } else if (actionType === "MARK_NOTIFICATION_READ") {
    const notifId = payload.notification_id || tempId;
    if (notifId) {
      await db.runAsync(
        `UPDATE notifications SET is_read = 1, updated_at = ? WHERE notification_id = ?`,
        [now, notifId]
      );
      return notifId;
    }
  }

  return undefined;
}
