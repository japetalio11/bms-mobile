import { View, ScrollView, Pressable, ActivityIndicator, Platform, KeyboardAvoidingView, } from "react-native";
import { useState, useEffect, useCallback } from "react";
import type { JSX } from "react";
import { Text, Label } from "heroui-native";
import { AppTextField as TextField, AppInput as Input, AppButton as Button } from "../../components/FormControls";
import { AppIcon as Ionicons } from "../../components/AppIcon";
import { TermsPrivacyModal } from "../../components/TermsPrivacyModal";
import { Link, useRouter } from "expo-router";
import { withUniwind } from "uniwind";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { getNativeGoogleSignin } from "../../lib/googleAuthUtils";
import {
  loginApi,
  sendOtpApi,
  verifyOtpApi,
  setupPasswordApi,
  googleAuthApi,
} from "../../config/api";
import { useAuth } from "../../context/UserContext";
import { usePhoneAuth } from "../../hooks/usePhoneAuth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GoogleMark } from "../../components/GoogleMark";

WebBrowser.maybeCompleteAuthSession();

const StyledIonicons = withUniwind(Ionicons);

function decodeJwtPayload(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export default function LoginScreen(): JSX.Element {
  const router = useRouter();
  const { login } = useAuth();
  const insets = useSafeAreaInsets();

  const phoneAuth = usePhoneAuth({
    containerId: "recaptcha-container-login",
    cooldownDuration: 60,
  });

  const [, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  const [mode, setMode] = useState<"login" | "setup_otp" | "setup_password">("login");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const [otp, setOtp] = useState("");
  const [verifiedOtpCode, setVerifiedOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [termsTab, setTermsTab] = useState<"terms" | "privacy" | "data">("terms");

  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const googleResponseError = googleResponse?.type === "error"
    ? (googleResponse as any).error?.message || "Google Authentication failed. Ensure your Web Client ID & SHA-1 are registered in Google Cloud Console."
    : null;
  const visibleError = error || googleResponseError;

  useEffect(() => {
    if (Platform.OS !== "web") {
      const nativeGoogleSignin = getNativeGoogleSignin();
      if (nativeGoogleSignin) {
        try {
          nativeGoogleSignin.configure({
            webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
          });
        } catch (e) {
          console.warn("GoogleSignin configure warning:", e);
        }
      }
    }
  }, []);

  const handleGooglePress = async () => {
    if (Platform.OS === "web") {
      promptGoogleAsync();
      return;
    }
    setGoogleLoading(true);
    setError(null);

    const nativeGoogleSignin = getNativeGoogleSignin();
    if (!nativeGoogleSignin) {
      promptGoogleAsync();
      return;
    }

    try {
      await nativeGoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      try {
        await nativeGoogleSignin.signOut();
      } catch {}
      const response = await nativeGoogleSignin.signIn();
      const idToken = response.data?.idToken || (response as any).idToken;
      const user = response.data?.user || (response as any).user;

      if (idToken) {
        await handleGoogleBackendLogin(idToken, undefined, user);
      } else {
        setError("Failed to obtain Google authentication token.");
        setGoogleLoading(false);
      }
    } catch (err: any) {
      if (
        err.code === "CANCELED" ||
        err.code === "12501" ||
        err.code === "SIGN_IN_CANCELLED" ||
        err.code === "ASYNC_OP_IN_PROGRESS"
      ) {
        setGoogleLoading(false);
        return;
      }
      console.error("Google Sign-In Error:", err);
      promptGoogleAsync();
    }
  };

  const handleGoogleBackendLogin = useCallback(async (
    idToken?: string,
    accessToken?: string,
    nativeUser?: any
  ) => {
    setGoogleLoading(true);
    setError(null);
    try {
      let email: string | undefined = nativeUser?.email;
      let firstName: string | undefined = nativeUser?.givenName || nativeUser?.name;
      let lastName: string | undefined = nativeUser?.familyName;
      let profileUrl: string | undefined = nativeUser?.photo;

      if (idToken && (!email || !firstName)) {
        const decoded = decodeJwtPayload(idToken);
        if (decoded) {
          email = email || decoded.email;
          firstName = firstName || decoded.given_name || decoded.name;
          lastName = lastName || decoded.family_name;
          profileUrl = profileUrl || decoded.picture;
        }
      }

      if (accessToken && (!email || !firstName)) {
        try {
          const userInfoRes = await fetch("https://www.googleapis.com/userinfo/v2/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (userInfoRes.ok) {
            const userInfo = await userInfoRes.json();
            email = email || userInfo.email;
            firstName = firstName || userInfo.given_name;
            lastName = lastName || userInfo.family_name;
            profileUrl = profileUrl || userInfo.picture;
          }
        } catch (fetchErr) {
          console.warn("Could not fetch userinfo from Google:", fetchErr);
        }
      }

      const data = await googleAuthApi({
        idToken,
        email,
        first_name: firstName,
        last_name: lastName,
        profile_url: profileUrl,
        role: "Mother",
        auto_register: true,
      });

      login(data.user, data.token);
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err.message || "Google Sign-In failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }, [login, router]);

  useEffect(() => {
    if (googleResponse?.type !== "success") return;
    const responseAny = googleResponse as any;
    const idToken = responseAny.params?.id_token || responseAny.authentication?.idToken;
    const accessToken = responseAny.authentication?.accessToken || responseAny.params?.access_token;
    void handleGoogleBackendLogin(idToken, accessToken);
  }, [googleResponse, handleGoogleBackendLogin]);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleSendSetupOtp = async (targetIdentifier: string): Promise<boolean> => {
    const cleanId = targetIdentifier.trim();
    if (!cleanId) return false;

    setOtpLoading(true);
    setError(null);
    const isEmail = cleanId.includes("@");

    if (isEmail) {
      try {
        await sendOtpApi({
          identifier: cleanId,
          type: "email",
          purpose: "registration",
          provider: "email",
        });

        setTimer(60);
        setInfoMessage(`Verification code sent to ${cleanId}`);
        return true;
      } catch (err: any) {
        setError(err.message || "Failed to send verification code for password setup.");
        return false;
      } finally {
        setOtpLoading(false);
      }
    } else {
      try {
        const sent = await phoneAuth.sendOtp(cleanId, "registration");
        if (sent) {
          setTimer(phoneAuth.cooldown || 60);
          setInfoMessage(phoneAuth.statusMessage || `Verification code sent to ${cleanId}`);
          return true;
        } else {
          setError(phoneAuth.statusMessage || "Failed to send SMS OTP code.");
          return false;
        }
      } catch (err: any) {
        setError(err.message || "Failed to send SMS OTP code.");
        return false;
      } finally {
        setOtpLoading(false);
      }
    }
  };

  const handleLogin = async () => {
    const cleanId = identifier.trim();
    if (!cleanId) {
      setError("Please enter your email or phone number");
      return;
    }
    if (!password) {
      setError("Please enter your password");
      return;
    }

    setIsLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      const data = await loginApi({
        identifier: cleanId,
        password,
      });

      login(data.user, data.token);
      router.replace("/(tabs)");
    } catch (err: any) {
      if (err.requiresPasswordSetup) {
        setMode("setup_otp");
        setInfoMessage(
          "Your account was registered by facility staff. Please enter the verification code sent to your device to set up your password."
        );
        handleSendSetupOtp(cleanId);
      } else {
        setError(err.message || "Authentication failed. Please check your credentials.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtpStep = async () => {
    const cleanId = identifier.trim();
    if (!otp.trim()) {
      setError("Please enter the 6-digit verification code");
      return;
    }
    if (otp.trim().length < 6) {
      setError("Verification code must be 6 digits");
      return;
    }

    setIsLoading(true);
    setError(null);

    const isEmail = cleanId.includes("@");

    try {
      if (isEmail) {
        await verifyOtpApi({
          identifier: cleanId,
          code: otp.trim(),
          purpose: "registration",
        });
        setVerifiedOtpCode(otp.trim());
      } else {
        const verifyRes = await phoneAuth.verifyOtp(otp.trim());
        if (!verifyRes.success) {
          setError(verifyRes.error || "Invalid verification code. Please try again.");
          setIsLoading(false);
          return;
        }
        setVerifiedOtpCode(verifyRes.finalOtpCode);
      }

      setInfoMessage("OTP verified successfully! Now set a secure password for your account.");
      setMode("setup_password");
    } catch (err: any) {
      setError(err.message || "Invalid verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupPasswordSubmit = async () => {
    const cleanId = identifier.trim();
    if (!newPassword) {
      setError("Please enter a new password");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await setupPasswordApi({
        identifier: cleanId,
        otp: verifiedOtpCode || otp.trim(),
        newPassword,
      });

      login(data.user, data.token);
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err.message || "Failed to set password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        className="flex-1"
        style={{ backgroundColor: "#ffffff" }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 24,
          paddingBottom: Math.max(insets.bottom + 24, 36),
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={{ width: "100%", maxWidth: 350, alignSelf: "center" }}>
          <View className="mb-7">
            <Text
              style={{
                color: "#171717",
                fontFamily: "Manrope-SemiBold",
                fontSize: 24,
                lineHeight: 30,
                letterSpacing: -0.35,
              }}
            >
              {mode === "login"
                ? "Log in to Silang"
                : mode === "setup_otp"
                  ? "Verify your account"
                  : "Create your password"}
            </Text>
            {mode !== "login" && (
              <Text className="text-base mt-2 leading-5" style={{ color: "#737373" }}>
                {mode === "setup_otp"
                  ? `Enter the code sent to ${identifier.trim()}.`
                  : "Set a password to access your health information."}
              </Text>
            )}
          </View>

          {mode === "login" ? (
            <>
              <View className="gap-3">
                <TextField>
                  <Label><Label.Text style={{ color: "#262626", fontFamily: "Manrope", fontSize: 14, lineHeight: 20, fontWeight: "500" }}>Email</Label.Text></Label>
                  <Input
                    value={identifier}
                    onChangeText={setIdentifier}
                    placeholder="hello@company.com"
                    placeholderTextColor="#737373"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    className="h-10 rounded-md border text-base"
                    style={{ height: 44, borderRadius: 6, borderWidth: 1, borderColor: "#d4d4d4", backgroundColor: "#ffffff", color: "#171717", fontFamily: "Manrope", fontSize: 16 }}
                  />
                </TextField>

                <TextField>
                  <Label><Label.Text style={{ color: "#262626", fontFamily: "Manrope", fontSize: 14, lineHeight: 20, fontWeight: "500" }}>Password</Label.Text></Label>
                  <View className="justify-center">
                    <Input
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Your password"
                      placeholderTextColor="#737373"
                      secureTextEntry={!isPasswordVisible}
                      autoComplete="current-password"
                      className="h-10 rounded-md border text-base pr-12"
                      style={{ height: 44, borderRadius: 6, borderWidth: 1, borderColor: "#d4d4d4", backgroundColor: "#ffffff", color: "#171717", fontFamily: "Manrope", fontSize: 16 }}
                    />
                    <Pressable
                      onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                      accessibilityRole="button"
                      accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
                      className="absolute right-1 h-9 w-9 items-center justify-center"
                    >
                      <StyledIonicons
                        name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                        size={19}
                        color="#737373"
                      />
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => router.push("/(auth)/forgot-password")}
                    accessibilityRole="link"
                    accessibilityLabel="Forgot password?"
                    className="self-end pt-2"
                  >
                    <Text style={{ color: "#003f2c", fontFamily: "Manrope-Medium", fontSize: 16, lineHeight: 20 }}>Forgot Password?</Text>
                  </Pressable>
                </TextField>
              </View>

              {visibleError && (
                <Text className="mt-3 text-danger" style={{ fontFamily: "Manrope", fontSize: 16, lineHeight: 20 }} accessibilityRole="alert">
                  {visibleError}
                </Text>
              )}

              <Button
                variant="primary"
                onPress={handleLogin}
                isDisabled={isLoading || googleLoading}
                className="mt-4 h-10 rounded-md"
                style={{ height: 44, borderRadius: 6, backgroundColor: "#fffe8c" }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#171717" size="small" />
                ) : (
                  <Button.Label style={{ color: "#171717", fontFamily: "Manrope-Medium", fontSize: 16 }}>Login</Button.Label>
                )}
              </Button>

              <View className="flex-row items-center my-4 gap-3">
                <View className="h-px flex-1" style={{ backgroundColor: "#e5e5e5" }} />
                <Text style={{ color: "#737373", fontFamily: "Manrope", fontSize: 16, lineHeight: 20 }}>OR</Text>
                <View className="h-px flex-1" style={{ backgroundColor: "#e5e5e5" }} />
              </View>

              <View>
                <Button
                  variant="outline"
                  onPress={handleGooglePress}
                  isDisabled={googleLoading || isLoading}
                  className="relative h-10 rounded-md border"
                  style={{ height: 44, borderRadius: 6, borderWidth: 1, borderColor: "#d4d4d4", backgroundColor: "#ffffff" }}
                >
                  {googleLoading ? <ActivityIndicator size="small" color="#171717" /> : (
                    <>
                      <View className="absolute left-3"><GoogleMark size={18} /></View>
                      <Button.Label className="w-full text-center" style={{ color: "#171717", fontFamily: "Manrope-Medium", fontSize: 16 }}>Continue with Google</Button.Label>
                    </>
                  )}
                </Button>
              </View>

              {infoMessage && !visibleError && (
                <Text className="mt-3 text-center text-base" style={{ color: "#737373" }}>
                  {infoMessage}
                </Text>
              )}

              <View className="mt-6 flex-row items-center justify-center">
                <Text style={{ color: "#737373", fontFamily: "Manrope", fontSize: 16 }}>New to Silang? </Text>
                <Link href="/(auth)/signup" asChild>
                  <Pressable accessibilityRole="link" className="py-2">
                    <Text style={{ color: "#003f2c", fontFamily: "Manrope-Medium", fontSize: 16 }}>Create an account</Text>
                  </Pressable>
                </Link>
              </View>
              <Text className="mt-8 text-center" style={{ color: "#737373", fontFamily: "Manrope", fontSize: 16, lineHeight: 20 }}>
                By signing in, you agree to Silang&apos;s{" "}
                <Text
                  onPress={() => {
                    setTermsTab("terms");
                    setIsTermsModalOpen(true);
                  }}
                  style={{ color: "#003f2c", fontFamily: "Manrope-Medium" }}
                >
                  Terms of Service
                </Text>{" "}
                and{" "}
                <Text
                  onPress={() => {
                    setTermsTab("privacy");
                    setIsTermsModalOpen(true);
                  }}
                  style={{ color: "#003f2c", fontFamily: "Manrope-Medium" }}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            </>
          ) : mode === "setup_otp" ? (
            <>
              {Platform.OS === "web" && (
                <View className="my-2 w-full items-center justify-center overflow-visible">
                  <View
                    id="recaptcha-container-login"
                    nativeID="recaptcha-container-login"
                    style={{ minHeight: 78, minWidth: 304 }}
                  />
                </View>
              )}
              <TextField isRequired>
                <Label><Label.Text style={{ color: "#171717", fontSize: 16, lineHeight: 20 }}>Verification code</Label.Text></Label>
                <Input
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="6-digit code"
                  placeholderTextColor="#737373"
                  keyboardType="number-pad"
                  maxLength={6}
                  className="h-10 rounded-md border text-center text-base"
                  style={{ height: 44, borderRadius: 6, borderWidth: 1, borderColor: "#d4d4d4", backgroundColor: "#ffffff", color: "#171717" }}
                />
              </TextField>
              {visibleError && <Text className="mt-3 text-danger text-base" accessibilityRole="alert">{visibleError}</Text>}
              {infoMessage && !visibleError && <Text className="mt-3 text-base" style={{ color: "#737373" }}>{infoMessage}</Text>}
              <Button variant="primary" onPress={handleVerifyOtpStep} isDisabled={isLoading} className="mt-5 h-10 rounded-md" style={{ height: 44, borderRadius: 6, backgroundColor: "#fffe8c" }}>
                {isLoading ? <ActivityIndicator color="#171717" size="small" /> : <Button.Label className="text-base font-medium" style={{ color: "#171717" }}>Verify code</Button.Label>}
              </Button>
              <View className="mt-5 flex-row items-center justify-between">
                <Pressable onPress={() => { setMode("login"); setError(null); setInfoMessage(null); }} accessibilityRole="button" className="py-2 pr-2">
                  <Text className="text-base font-medium" style={{ color: "#003f2c" }}>Back to sign in</Text>
                </Pressable>
                <Pressable onPress={() => handleSendSetupOtp(identifier)} disabled={otpLoading || timer > 0} accessibilityRole="button" className="py-2 pl-2">
                  <Text className="text-base font-medium" style={{ color: "#003f2c" }}>{otpLoading ? "Sending…" : timer > 0 ? `Resend in ${timer}s` : "Resend code"}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View className="gap-4">
                <TextField isRequired>
                  <Label><Label.Text style={{ color: "#171717", fontSize: 16, lineHeight: 20 }}>New password</Label.Text></Label>
                  <View className="justify-center">
                    <Input value={newPassword} onChangeText={setNewPassword} placeholder="Your password" placeholderTextColor="#737373" secureTextEntry={!isNewPasswordVisible} autoComplete="new-password" className="h-10 rounded-md border pr-12 text-base" style={{ height: 44, borderRadius: 6, borderWidth: 1, borderColor: "#d4d4d4", backgroundColor: "#ffffff", color: "#171717" }} />
                    <Pressable onPress={() => setIsNewPasswordVisible(!isNewPasswordVisible)} accessibilityRole="button" accessibilityLabel={isNewPasswordVisible ? "Hide password" : "Show password"} className="absolute right-1 h-9 w-9 items-center justify-center">
                      <StyledIonicons name={isNewPasswordVisible ? "eye-off-outline" : "eye-outline"} size={16} color="#737373" />
                    </Pressable>
                  </View>
                </TextField>
                <TextField isRequired>
                  <Label><Label.Text style={{ color: "#171717", fontSize: 16, lineHeight: 20 }}>Confirm password</Label.Text></Label>
                  <Input value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm your password" placeholderTextColor="#737373" secureTextEntry={!isNewPasswordVisible} autoComplete="new-password" className="h-10 rounded-md border text-base" style={{ height: 44, borderRadius: 6, borderWidth: 1, borderColor: "#d4d4d4", backgroundColor: "#ffffff", color: "#171717" }} />
                </TextField>
              </View>
              {visibleError && <Text className="mt-3 text-danger text-base" accessibilityRole="alert">{visibleError}</Text>}
              <Button variant="primary" onPress={handleSetupPasswordSubmit} isDisabled={isLoading} className="mt-5 h-10 rounded-md" style={{ height: 44, borderRadius: 6, backgroundColor: "#fffe8c" }}>
                {isLoading ? <ActivityIndicator color="#171717" size="small" /> : <Button.Label className="text-base font-medium" style={{ color: "#171717" }}>Finish setup</Button.Label>}
              </Button>
              <Pressable onPress={() => { setMode("setup_otp"); setError(null); setInfoMessage(null); }} accessibilityRole="button" className="mt-5 self-start py-2">
                <Text className="text-base font-medium" style={{ color: "#003f2c" }}>Back to verification</Text>
              </Pressable>
            </>
          )}
          <TermsPrivacyModal
            visible={isTermsModalOpen}
            onClose={() => setIsTermsModalOpen(false)}
            initialTab={termsTab}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
