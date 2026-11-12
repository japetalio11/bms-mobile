import { Platform, TurboModuleRegistry } from "react-native";

export function getNativeGoogleSignin() {
  if (Platform.OS === "web") return null;
  // The package entry point calls getEnforcing during import. Check first so
  // Expo Go or an older native build can safely fall back to web auth.
  if (!TurboModuleRegistry.get("RNGoogleSignin")) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@react-native-google-signin/google-signin");
    if (mod && mod.GoogleSignin) {
      return mod.GoogleSignin;
    }
    return null;
  } catch {
    return null;
  }
}

export async function signOutNativeGoogle() {
  const nativeGoogleSignin = getNativeGoogleSignin();
  if (!nativeGoogleSignin) return;
  try {
    await nativeGoogleSignin.signOut();
  } catch {
    return;
  }
}
