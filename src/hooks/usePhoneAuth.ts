import { useState, useRef, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import {
  formatToE164,
  isValidE164,
  isTestPhoneNumber,
  getFirebaseErrorMessage,
} from "../lib/phoneAuthUtils";
import { sendOtpApi } from "../config/api";

let nativeAuth: any = null;
if (Platform.OS !== "web") {
  try {
    nativeAuth = require("@react-native-firebase/auth").default;
  } catch (err) {
    console.warn("[Native Firebase Auth Module Notice]:", err);
  }
}

export interface UsePhoneAuthOptions {
  containerId?: string;
  recaptchaSize?: "normal" | "invisible";
  cooldownDuration?: number;
  defaultCountryPrefix?: string;
}

export interface VerifyResult {
  success: boolean;
  finalOtpCode: string;
  error?: string;
}

export interface UsePhoneAuthReturn {
  sendOtp: (phoneInput: string, purpose?: "registration" | "reset_password") => Promise<boolean>;
  verifyOtp: (code: string) => Promise<VerifyResult>;
  resetAuth: () => void;
  initRecaptcha: () => Promise<void>;
  cooldown: number;
  isSubmitting: boolean;
  isOtpSent: boolean;
  isVerified: boolean;
  isRecaptchaSolved: boolean;
  statusMessage: string;
  statusType: "info" | "success" | "error" | "";
  formattedPhone: string;
  activeMethod: "firebase" | "backend" | "test";
}

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    grecaptcha?: {
      reset: (widgetId?: number) => void;
    };
  }
}

export function usePhoneAuth(options: UsePhoneAuthOptions = {}): UsePhoneAuthReturn {
  const {
    containerId = "recaptcha-container",
    recaptchaSize = "normal",
    cooldownDuration = 60,
    defaultCountryPrefix = "+63",
  } = options;

  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);

  const [cooldown, setCooldown] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isOtpSent, setIsOtpSent] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [isRecaptchaSolved, setIsRecaptchaSolved] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error" | "">("");
  const [formattedPhone, setFormattedPhone] = useState<string>("");
  const [activeMethod, setActiveMethod] = useState<"firebase" | "backend" | "test">("firebase");

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const cleanupRecaptcha = useCallback(() => {
    setIsRecaptchaSolved(false);
    if (Platform.OS !== "web") return;
    try {
      if (verifierRef.current) {
        try {
          verifierRef.current.clear();
        } catch {}
        verifierRef.current = null;
      }
      if (typeof window !== "undefined" && window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch {}
        window.recaptchaVerifier = undefined;
      }
      if (typeof document !== "undefined") {
        const container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = "";
        }
      }
    } catch {}
  }, [containerId]);

  useEffect(() => {
    return () => {
      cleanupRecaptcha();
    };
  }, [cleanupRecaptcha]);

  const getOrInitRecaptcha = useCallback((): RecaptchaVerifier | null => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      return null;
    }

    if (verifierRef.current) {
      return verifierRef.current;
    }

    cleanupRecaptcha();

    const container = document.getElementById(containerId);
    if (!container) {
      return null;
    }

    const newVerifier = new RecaptchaVerifier(auth, containerId, {
      size: recaptchaSize,
      callback: () => {
        console.log("✅ [reCAPTCHA] Verification Callback Fired");
        setIsRecaptchaSolved(true);
      },
      "expired-callback": () => {
        console.warn("⚠️ [reCAPTCHA] Token Expired Callback Fired");
        setIsRecaptchaSolved(false);
        cleanupRecaptcha();
      },
    });

    verifierRef.current = newVerifier;
    if (typeof window !== "undefined") {
      window.recaptchaVerifier = newVerifier;
    }
    return newVerifier;
  }, [containerId, recaptchaSize, cleanupRecaptcha]);

  const initRecaptcha = useCallback(async () => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    try {
      const container = document.getElementById(containerId);
      if (!container) {
        return;
      }
      // If container was remounted and has no children, clean up previous verifier instance
      if (verifierRef.current && container.children.length === 0) {
        cleanupRecaptcha();
      }
      // If widget is already mounted in this container, do not re-render
      if (container.children.length > 0 && verifierRef.current) {
        return;
      }
      const verifier = getOrInitRecaptcha();
      if (verifier) {
        await verifier.render();
      }
    } catch (err: any) {
      console.warn("[reCAPTCHA Render Notice]:", err?.message || err);
    }
  }, [containerId, getOrInitRecaptcha, cleanupRecaptcha]);

  // Pre-render visible reCAPTCHA on web after DOM is ready
  useEffect(() => {
    if (Platform.OS === "web") {
      const timer = setTimeout(() => {
        initRecaptcha();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [initRecaptcha]);

  const sendOtp = useCallback(
    async (phoneInput: string, purpose: "registration" | "reset_password" = "registration"): Promise<boolean> => {
      if (cooldown > 0) {
        setStatusType("error");
        setStatusMessage(`Please wait ${cooldown} seconds before requesting a new OTP.`);
        return false;
      }

      if (isSubmitting) return false;

      const formatted = formatToE164(phoneInput, defaultCountryPrefix);
      setFormattedPhone(formatted);

      if (!isValidE164(formatted)) {
        setStatusType("error");
        setStatusMessage(
          `Invalid phone number format: "${phoneInput}". Please enter a valid number (e.g., 09171234567).`
        );
        return false;
      }

      setIsSubmitting(true);
      setStatusType("info");
      setStatusMessage(`Initiating SMS verification for ${formatted}...`);

      const isTestNum = isTestPhoneNumber(formatted);

      // Handle test phone numbers
      if (isTestNum) {
        setActiveMethod("test");
        setIsOtpSent(true);
        setStatusType("success");
        setStatusMessage(`📲 Dev Test Number! Enter test code "123456" for ${formatted}.`);
        setCooldown(cooldownDuration);
        setIsSubmitting(false);
        return true;
      }

      // If running on Web, use Firebase Phone Auth with reCAPTCHA as the default & primary
      if (Platform.OS === "web") {
        if (recaptchaSize === "normal" && !isRecaptchaSolved) {
          console.warn("[PhoneAuth Diagnostic] ⚠️ reCAPTCHA checkbox is not solved yet.");
          setIsSubmitting(false);
          setStatusType("error");
          setStatusMessage("Please check the 'I\'m not a robot' verification box before continuing.");
          return false;
        }

        try {
          console.group("📱 [Firebase Phone Auth Web - Dispatching SMS]");
          console.log("Target Phone (E.164):", formatted);
          console.log("Firebase Project ID:", auth?.app?.options?.projectId);
          console.log("Firebase Auth Domain:", auth?.app?.options?.authDomain);
          console.log("Current Origin:", typeof window !== "undefined" ? window.location.origin : "N/A");
          console.log("reCAPTCHA Solved State:", isRecaptchaSolved);
          console.groupEnd();

          let appVerifier = getOrInitRecaptcha();

          if (!appVerifier) {
            let container = document.getElementById(containerId);
            if (!container) {
              container = document.createElement("div");
              container.id = containerId;
              document.body.appendChild(container);
            }
            appVerifier = new RecaptchaVerifier(auth, containerId, {
              size: recaptchaSize,
              callback: () => {
                console.log("✅ [reCAPTCHA] Verification Callback Fired");
                setIsRecaptchaSolved(true);
              },
              "expired-callback": () => {
                console.warn("⚠️ [reCAPTCHA] Token Expired Callback Fired");
                setIsRecaptchaSolved(false);
                cleanupRecaptcha();
              },
            });
            verifierRef.current = appVerifier;
          }

          console.log("⏳ [PhoneAuth Web] Rendering appVerifier and invoking signInWithPhoneNumber...");
          await appVerifier.render();
          const confirmationResult = await signInWithPhoneNumber(auth, formatted, appVerifier);
          confirmationResultRef.current = confirmationResult;

          console.log("🎉 [PhoneAuth Web] signInWithPhoneNumber SUCCEEDED! ConfirmationResult captured.");
          setActiveMethod("firebase");
          setIsOtpSent(true);
          setStatusType("success");
          setStatusMessage(`📲 SMS OTP sent via Firebase to ${formatted}! Please check your phone.`);
          setCooldown(cooldownDuration);
          setIsSubmitting(false);
          return true;
        } catch (firebaseErr: any) {
          console.group("❌ [Firebase Phone Auth Error - Detailed Diagnostic Report]");
          console.error("Error Code:", firebaseErr?.code);
          console.error("Error Message:", firebaseErr?.message);
          if (firebaseErr?.customData) {
            console.error("Server Payload / CustomData:", firebaseErr.customData);
          }
          console.error("Full Error Object:", firebaseErr);
          
          const currentOrigin = typeof window !== "undefined" ? window.location.origin : "N/A";
          const currentHostname = typeof window !== "undefined" ? window.location.hostname : "localhost";

          console.info(
            `🔎 Setup vs Coding Diagnostic Breakdown:
--------------------------------------------------
1. Error: "${firebaseErr?.code}"
2. Platform: Web (${currentOrigin})
3. Target: ${formatted}
4. Firebase Config: Project="${auth?.app?.options?.projectId}", Domain="${auth?.app?.options?.authDomain}"

⚠️ Root Cause Checklist for "auth/invalid-app-credential":
• [Firebase Console] Sign-in Provider: Go to Authentication > Sign-in method > Ensure "Phone" provider is ENABLED.
• [Firebase Console] Authorized Domains: Go to Authentication > Settings > Authorized Domains. Ensure "${currentHostname}" is listed.
• [Firebase Console] SMS Region Policy: Go to Authentication > Settings > SMS Region Policy. Make sure "Philippines (+63)" is ALLOWED (Firebase now restricts countries by default to prevent toll fraud).
• [Key Type Mismatch]: You are running in a Web browser (Chrome/Edge). An Android reCAPTCHA key (restricted to package com.bms.mobile) CANNOT verify web requests; it causes Google Identity Toolkit to reject the credentials with 400 Bad Request.
• [Quick Dev Test Solution]: You can test immediately using Firebase Test Phone Numbers (e.g. +639170000000 with code 123456) configured in Firebase Console > Authentication > Sign-in method > Phone > "Phone numbers for testing".
--------------------------------------------------`
          );
          console.groupEnd();

          setIsSubmitting(false);
          setStatusType("error");
          const humanMsg = getFirebaseErrorMessage(firebaseErr?.code || firebaseErr?.message || "");
          setStatusMessage(humanMsg);
          // Do not fall back to broken backend iProg SMS
          return false;
        }
      }

      // If running on Native (non-web) -> Use Native Firebase Phone Auth
      try {
        console.group("📱 [Firebase Native Phone Auth Android - Dispatching SMS]");
        console.log("Target Phone (E.164):", formatted);
        console.log("Platform:", Platform.OS);

        let nativeFirebase = nativeAuth;
        if (!nativeFirebase) {
          try {
            nativeFirebase = require("@react-native-firebase/auth").default;
          } catch (loadErr) {
            console.error("[Native Firebase Auth Load Error]:", loadErr);
          }
        }

        if (!nativeFirebase) {
          throw new Error("Native Firebase Auth module is not available. Please rebuild the app with npx expo run:android.");
        }

        console.log("⏳ Invoking native Firebase signInWithPhoneNumber(formatted)...");
        const confirmation = await nativeFirebase().signInWithPhoneNumber(formatted);
        confirmationResultRef.current = confirmation;
        console.log("🎉 [Native Phone Auth] SMS successfully dispatched by Firebase! Verification ID:", confirmation.verificationId);
        console.groupEnd();

        setActiveMethod("firebase");
        setIsOtpSent(true);
        setStatusType("success");
        setStatusMessage(`📲 SMS OTP sent via Firebase to ${formatted}! Please check your phone.`);
        setCooldown(cooldownDuration);
        return true;
      } catch (nativeErr: any) {
        console.group("❌ [Firebase Native Phone Auth Error]");
        console.error("Native Phone Auth Error Code:", nativeErr?.code);
        console.error("Native Phone Auth Error Message:", nativeErr?.message);
        console.error("Full Native Error:", nativeErr);
        console.groupEnd();

        setStatusType("error");
        const humanMsg = getFirebaseErrorMessage(nativeErr?.code || nativeErr?.message || "");
        setStatusMessage(humanMsg);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [cooldown, isSubmitting, defaultCountryPrefix, cooldownDuration, getOrInitRecaptcha, cleanupRecaptcha, recaptchaSize, isRecaptchaSolved, containerId]
  );

  const verifyOtp = useCallback(
    async (code: string): Promise<VerifyResult> => {
      const cleanCode = code.trim();
      if (!cleanCode || cleanCode.length < 6) {
        const errorMsg = "Please enter the complete 6-digit verification code.";
        setStatusType("error");
        setStatusMessage(errorMsg);
        return { success: false, finalOtpCode: "", error: errorMsg };
      }

      setIsSubmitting(true);
      setStatusType("info");
      setStatusMessage("Verifying code...");

      // 1. Dev test number verification
      if (activeMethod === "test") {
        if (cleanCode === "123456") {
          setIsVerified(true);
          setStatusType("success");
          setStatusMessage("✅ Test OTP code verified successfully!");
          setIsSubmitting(false);
          return { success: true, finalOtpCode: "FIREBASE_VERIFIED" };
        } else {
          const errorMsg = "Incorrect test code. Please enter '123456'.";
          setStatusType("error");
          setStatusMessage(errorMsg);
          setIsSubmitting(false);
          return { success: false, finalOtpCode: "", error: errorMsg };
        }
      }

      // 2. Firebase Phone Auth client verification
      if (activeMethod === "firebase" && confirmationResultRef.current) {
        try {
          await confirmationResultRef.current.confirm(cleanCode);
          setIsVerified(true);
          setStatusType("success");
          setStatusMessage("✅ SMS verification confirmed via Firebase!");
          return { success: true, finalOtpCode: "FIREBASE_VERIFIED" };
        } catch (firebaseErr: any) {
          const humanMsg = getFirebaseErrorMessage(firebaseErr?.code || firebaseErr?.message || "");
          setStatusType("error");
          setStatusMessage(humanMsg);
          return { success: false, finalOtpCode: "", error: humanMsg };
        } finally {
          setIsSubmitting(false);
        }
      }

      // 3. Backend SMS Verification: Code will be verified by the backend API
      setIsVerified(true);
      setStatusType("success");
      setStatusMessage("Code confirmed. Ready to submit.");
      setIsSubmitting(false);
      return { success: true, finalOtpCode: cleanCode };
    },
    [activeMethod]
  );

  const resetAuth = useCallback(() => {
    confirmationResultRef.current = null;
    setIsOtpSent(false);
    setIsVerified(false);
    setIsRecaptchaSolved(false);
    setStatusMessage("");
    setStatusType("");
    cleanupRecaptcha();
  }, [cleanupRecaptcha]);

  return {
    sendOtp,
    verifyOtp,
    resetAuth,
    initRecaptcha,
    cooldown,
    isSubmitting,
    isOtpSent,
    isVerified,
    isRecaptchaSolved,
    statusMessage,
    statusType,
    formattedPhone,
    activeMethod,
  };
}
