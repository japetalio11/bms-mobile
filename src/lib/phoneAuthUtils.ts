export function formatToE164(phone: string, defaultCountryPrefix: string = "+63"): string {
  if (!phone) return "";

  let cleaned = phone.replace(/[^0-9+]/g, "");

  if (cleaned.startsWith("0")) {
    const cleanPrefix = defaultCountryPrefix.startsWith("+")
      ? defaultCountryPrefix
      : `+${defaultCountryPrefix}`;
    return `${cleanPrefix}${cleaned.slice(1)}`;
  }

  if (cleaned.startsWith("63")) {
    return `+${cleaned}`;
  }

  if (!cleaned.startsWith("+")) {
    return `+${cleaned}`;
  }

  return cleaned;
}

export function isValidE164(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

export const MOCK_TEST_NUMBERS: string[] = [
  "+639170000000",
  "+639171111111",
  "+639999999999",
  "+16505553434"
];

export function isTestPhoneNumber(phone: string): boolean {
  const formatted = formatToE164(phone);
  return MOCK_TEST_NUMBERS.includes(formatted);
}

export function getFirebaseErrorMessage(errorCodeOrMessage: string): string {
  const code = (errorCodeOrMessage || "").toLowerCase();

  if (code.includes("auth/too-many-requests")) {
    return "⚠️ Security limit reached: Too many SMS attempts from this device or number. Please wait 15-30 minutes before trying again, or use a configured test phone number.";
  }

  if (code.includes("auth/invalid-phone-number")) {
    return "❌ Invalid phone number format. Please check the digits and try again (e.g., 09171234567 or +639171234567).";
  }

  if (code.includes("auth/captcha-check-failed")) {
    return "⚠️ Security verification (reCAPTCHA) failed or timed out. Please try sending the SMS code again.";
  }

  if (code.includes("auth/quota-exceeded")) {
    return "🚨 SMS quota for this project has been exceeded for today. Please contact system support or try again later.";
  }

  if (code.includes("auth/invalid-verification-code") || code.includes("auth/wrong-type-of-verification-code")) {
    return "❌ Incorrect 6-digit OTP code. Please re-check the code sent to your phone and try again.";
  }

  if (code.includes("auth/code-expired")) {
    return "⌛ The OTP verification code has expired. Please request a new SMS code.";
  }

  if (code.includes("auth/user-disabled")) {
    return "🚫 This account or phone number has been temporarily disabled.";
  }

  if (code.includes("auth/network-request-failed")) {
    return "📡 Network error. Please check your internet connection and try again.";
  }

  if (code.includes("auth/invalid-app-credential")) {
    return "🔒 Firebase Setup Error (auth/invalid-app-credential):\n1) Ensure 'Phone' provider is enabled in Firebase Console (Authentication > Sign-in method).\n2) If on Web, ensure your domain/IP (e.g. localhost) is in Firebase Authorized Domains.\n3) Ensure Philippines (+63) is allowed in Firebase Console > Authentication > Settings > SMS Region Policy.\n4) If using an Android key, note that Web browser requires Web reCAPTCHA or Firebase Test Numbers.";
  }

  if (code.includes("auth/operation-not-allowed")) {
    return "🚫 Phone authentication is not enabled in your Firebase project. Enable 'Phone' provider under Firebase Console > Authentication > Sign-in method.";
  }

  return errorCodeOrMessage || "An unexpected error occurred during phone verification. Please try again.";
}
