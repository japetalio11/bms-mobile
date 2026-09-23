import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "bms_secure_auth_token";
const CIPHER_KEY = "bms_local_cipher_key";

export async function getSecureToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return await AsyncStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (err) {
    console.warn("[SecureStorage] Failed to read secure token, falling back:", err);
    return await AsyncStorage.getItem(TOKEN_KEY);
  }
}

export async function setSecureToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(TOKEN_KEY, token);
      return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  } catch (err) {
    console.warn("[SecureStorage] Failed to write secure token, falling back to AsyncStorage:", err);
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }
}

export async function deleteSecureToken(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(TOKEN_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (err) {
    console.warn("[SecureStorage] Failed to delete secure token:", err);
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export async function getOrCreateMasterCipherKey(): Promise<string> {
  try {
    let key: string | null = null;
    if (Platform.OS === "web") {
      key = await AsyncStorage.getItem(CIPHER_KEY);
      if (!key) {
        key = generateHexKey(32);
        await AsyncStorage.setItem(CIPHER_KEY, key);
      }
      return key;
    }

    key = await SecureStore.getItemAsync(CIPHER_KEY);
    if (!key) {
      key = generateHexKey(32);
      await SecureStore.setItemAsync(CIPHER_KEY, key, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    }
    return key;
  } catch (err) {
    console.warn("[SecureStorage] Failed to access master cipher key, fallback:", err);
    let key = await AsyncStorage.getItem(CIPHER_KEY);
    if (!key) {
      key = generateHexKey(32);
      await AsyncStorage.setItem(CIPHER_KEY, key);
    }
    return key;
  }
}

function generateHexKey(byteLength: number): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < byteLength * 2; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
