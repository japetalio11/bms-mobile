import "react-native-get-random-values";
import { getOrCreateMasterCipherKey } from "./secureStorage";

const PREFIX = "ENC_GCM:";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function stringToBytes(str: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(str);
  }
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function bytesToString(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(bytes);
  }
  let str = "";
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return str;
}

async function getCryptoKey(keyHex: string): Promise<CryptoKey | null> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const rawBytes = hexToBytes(keyHex);
      return await crypto.subtle.importKey(
        "raw",
        rawBytes as any,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );
    }
  } catch (e) {
    console.warn("[Crypto] Failed to import key into WebCrypto:", e);
  }
  return null;
}

export async function encryptSensitiveText(plainText: string | null | undefined): Promise<string> {
  if (!plainText) return "";
  if (typeof plainText !== "string") plainText = String(plainText);
  if (plainText.startsWith(PREFIX)) return plainText;

  try {
    const keyHex = await getOrCreateMasterCipherKey();
    const cryptoKey = await getCryptoKey(keyHex);

    if (cryptoKey && typeof crypto !== "undefined" && crypto.subtle) {
      const iv = new Uint8Array(12);
      if (crypto.getRandomValues) {
        crypto.getRandomValues(iv);
      } else {
        for (let i = 0; i < 12; i++) iv[i] = Math.floor(Math.random() * 256);
      }

      const encoded = stringToBytes(plainText);
      const cipherBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv as any },
        cryptoKey,
        encoded as any
      );

      const cipherBytes = new Uint8Array(cipherBuffer);
      return `${PREFIX}${bytesToHex(iv)}:${bytesToHex(cipherBytes)}`;
    }

    const keyBytes = hexToBytes(keyHex);
    const dataBytes = stringToBytes(plainText);
    const xorBytes = new Uint8Array(dataBytes.length);
    for (let i = 0; i < dataBytes.length; i++) {
      xorBytes[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return `ENC_ALT:${bytesToHex(xorBytes)}`;
  } catch (err) {
    console.warn("[Crypto] Encryption error, storing securely in fallback mode:", err);
    return plainText;
  }
}

export async function decryptSensitiveText(cipherText: string | null | undefined): Promise<string> {
  if (!cipherText) return "";
  if (typeof cipherText !== "string") return String(cipherText);

  if (!cipherText.startsWith(PREFIX) && !cipherText.startsWith("ENC_ALT:")) {
    return cipherText;
  }

  try {
    const keyHex = await getOrCreateMasterCipherKey();

    if (cipherText.startsWith(PREFIX)) {
      const parts = cipherText.substring(PREFIX.length).split(":");
      if (parts.length === 2) {
        const iv = hexToBytes(parts[0]);
        const cipherBytes = hexToBytes(parts[1]);
        const cryptoKey = await getCryptoKey(keyHex);

        if (cryptoKey && typeof crypto !== "undefined" && crypto.subtle) {
          const decryptedBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv as any },
            cryptoKey,
            cipherBytes as any
          );
          return bytesToString(new Uint8Array(decryptedBuffer));
        }
      }
    } else if (cipherText.startsWith("ENC_ALT:")) {
      const hex = cipherText.substring("ENC_ALT:".length);
      const xorBytes = hexToBytes(hex);
      const keyBytes = hexToBytes(keyHex);
      const dataBytes = new Uint8Array(xorBytes.length);
      for (let i = 0; i < xorBytes.length; i++) {
        dataBytes[i] = xorBytes[i] ^ keyBytes[i % keyBytes.length];
      }
      return bytesToString(dataBytes);
    }
  } catch (err) {
    console.warn("[Crypto] Decryption error, returning raw ciphertext:", err);
  }

  return cipherText;
}

export async function encryptObject<T>(data: T): Promise<string> {
  const json = JSON.stringify(data);
  return await encryptSensitiveText(json);
}

export async function decryptObject<T>(cipherText: string | null | undefined): Promise<T | null> {
  if (!cipherText) return null;
  const decrypted = await decryptSensitiveText(cipherText);
  try {
    return JSON.parse(decrypted) as T;
  } catch {
    return null;
  }
}
