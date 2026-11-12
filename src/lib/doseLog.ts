import AsyncStorage from "@react-native-async-storage/async-storage";
import { decryptObject, encryptObject } from "./crypto";

export function localDoseDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function doseLogKey(userId: string, date: string): string {
  return `@silang:doses:${userId}:${date}`;
}

export async function getLoggedDoseIds(userId: string, date: string): Promise<string[]> {
  const saved = await AsyncStorage.getItem(doseLogKey(userId, date));
  const ids = await decryptObject<unknown>(saved);
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

export async function setLoggedDoseIds(userId: string, date: string, ids: string[]): Promise<void> {
  await AsyncStorage.setItem(doseLogKey(userId, date), await encryptObject(ids));
}
