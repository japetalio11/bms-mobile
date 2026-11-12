import { TurboModuleRegistry } from "react-native";

export function getNativePhoneAuthHandler() {
  if (!TurboModuleRegistry.get("NativeRNFBTurboApp")) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@react-native-firebase/app");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebaseAuthMod = require("@react-native-firebase/auth");

    let authObj: any = null;
    if (typeof firebaseAuthMod === "function") {
      try {
        authObj = firebaseAuthMod();
      } catch {}
    } else if (typeof firebaseAuthMod?.default === "function") {
      try {
        authObj = firebaseAuthMod.default();
      } catch {}
    }

    if (authObj && typeof authObj.signInWithPhoneNumber === "function") {
      return (phone: string) => authObj.signInWithPhoneNumber(phone);
    }

    if (typeof firebaseAuthMod?.getAuth === "function") {
      try {
        const authInst = firebaseAuthMod.getAuth();
        if (authInst && typeof authInst.signInWithPhoneNumber === "function") {
          return (phone: string) => authInst.signInWithPhoneNumber(phone);
        }
      } catch {}
    }

    if (typeof firebaseAuthMod?.signInWithPhoneNumber === "function") {
      return (phone: string) => {
        if (typeof firebaseAuthMod.getAuth === "function") {
          try {
            return firebaseAuthMod.signInWithPhoneNumber(firebaseAuthMod.getAuth(), phone);
          } catch {}
        }
        return firebaseAuthMod.signInWithPhoneNumber(phone);
      };
    }
  } catch (error) {
    console.warn("[Firebase Auth] Native module is unavailable:", error);
  }
  return null;
}
