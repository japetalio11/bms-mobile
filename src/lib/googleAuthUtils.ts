import { Platform } from "react-native";

/**
 * Safely retrieves native GoogleSignin module if available.
 * Returns null in Expo Go or Web environments where native module is missing.
 */
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
