import { Platform } from "react-native";

export function getNativeGoogleSignin() {
  if (Platform.OS === "web") return null;
  try {
    const mod = require("@react-native-google-signin/google-signin");
    if (mod && mod.GoogleSignin) {
      return mod.GoogleSignin;
    }
    return null;
  } catch (e) {
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
