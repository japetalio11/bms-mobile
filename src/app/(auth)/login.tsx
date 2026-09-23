import { View, ScrollView, Pressable, ActivityIndicator, Platform, Image } from "react-native";
import { useState, useEffect } from "react";
import type { JSX } from "react";
import { Text, TextField, Label, Input, Button } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { withUniwind } from "uniwind";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { getNativeGoogleSignin } from "../../lib/googleAuthUtils";
import { makeRedirectUri } from "expo-auth-session";
import { loginApi, sendOtpApi, verifyOtpApi, setupPasswordApi, googleAuthApi } from "../../config/api";
import { useAuth } from "../../context/UserContext";
import { usePhoneAuth } from "../../hooks/usePhoneAuth";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
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

  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (googleResponse?.type === "success") {
      const responseAny = googleResponse as any;
      const idToken = responseAny.params?.id_token || responseAny.authentication?.idToken;
      const accessToken = responseAny.authentication?.accessToken || responseAny.params?.access_token;
      handleGoogleBackendLogin(idToken, accessToken);
    } else if (googleResponse?.type === "error") {
      const errRes = googleResponse as any;
      setError(errRes.error?.message || "Google Authentication failed. Ensure your Web Client ID & SHA-1 are registered in Google Cloud Console.");
    }
  }, [googleResponse]);

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
      if (err.code === "CANCELED" || err.code === "12501" || err.code === "SIGN_IN_CANCELLED" || err.code === "ASYNC_OP_IN_PROGRESS") {
        setGoogleLoading(false);
        return;
      }
      console.error("Google Sign-In Error:", err);
      promptGoogleAsync();
    }
  };

  const handleGoogleBackendLogin = async (idToken?: string, accessToken?: string, nativeUser?: any) => {
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
  };

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
    <ScrollView 
      className="flex-1 bg-background"
      contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 48, paddingBottom: Math.max(insets.bottom + 48, 64) }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="items-center mb-8">
        <Image
          source={require("../../../assets/images/logo.png")}
          style={{ width: 88, height: 88, borderRadius: 20, marginBottom: 16 }}
          resizeMode="contain"
        />
        <Text className="text-foreground font-semibold text-center text-base" style={{ lineHeight: 22 }}>
          {mode === "login"
            ? "Welcome back.\nLet's check on your journey."
            : mode === "setup_otp"
            ? "Account Verification"
            : "Create Account Password"}
        </Text>
      </View>

      {mode !== "login" && (
        <Text className="text-lg font-bold text-foreground mb-6">
          {mode === "setup_otp" ? "Enter Verification Code" : "Create Password"}
        </Text>
      )}

      {error && (
        <View className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex-row items-center gap-3">
          <StyledIonicons name="alert-circle-outline" size={22} className="text-red-500" />
          <Text className="text-red-500 text-sm flex-1">{error}</Text>
        </View>
      )}

      {infoMessage && (
        <View className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex-row items-center gap-3">
          <StyledIonicons name="checkmark-circle-outline" size={22} className="text-green-500" />
          <Text className="text-green-600 dark:text-green-400 text-sm flex-1">{infoMessage}</Text>
        </View>
      )}

      {mode === "login" ? (
        <>
          <View className="gap-5 mb-8">
            <TextField>
              <Label>Email or Phone Number</Label>
              <View className="w-full justify-center">
                <Input 
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="Enter email or phone number" 
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="pr-12"
                  style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
                />
                <StyledIonicons 
                  name="person-outline" 
                  size={20} 
                  color="#9ca3af"
                  className="absolute right-4" 
                  pointerEvents="none"
                />
              </View>
            </TextField>

            <TextField>
              <View className="flex-row justify-between w-full items-center">
                <Label>Password</Label>
                <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
                  <Text className="text-primary font-medium text-sm">Forgot?</Text>
                </Pressable>
              </View>
              <View className="w-full justify-center">
                <Input 
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••••••" 
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!isPasswordVisible}
                  className="pr-12"
                  style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
                />
                <Pressable 
                  className="absolute right-4"
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                >
                  <StyledIonicons 
                    name={isPasswordVisible ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color="#9ca3af"
                  />
                </Pressable>
              </View>
            </TextField>
          </View>

          <Button variant="primary" onPress={handleLogin} className="mb-5" isDisabled={isLoading || googleLoading}>
            <View className="flex-row items-center justify-center gap-2">
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <StyledIonicons name="arrow-forward" size={20} color="white" />
              )}
              <Button.Label>{isLoading ? "Logging in..." : "Log In"}</Button.Label>
            </View>
          </Button>

          <View className="flex-row items-center my-5">
            <View className="flex-1 h-[1px]" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <Text className="mx-4 text-sm font-semibold uppercase" style={{ color: '#6b7280' }}>OR</Text>
            <View className="flex-1 h-[1px]" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
          </View>

          <Pressable
            onPress={handleGooglePress}
            disabled={googleLoading || isLoading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              backgroundColor: '#ffffff',
              borderRadius: 12,
              height: 52,
              paddingHorizontal: 16,
              marginBottom: 32,
              opacity: (googleLoading || isLoading) ? 0.5 : 1,
            }}
            className="active:opacity-90"
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <StyledIonicons name="logo-google" size={20} color="#4285F4" />
            )}
            <Text style={{ color: '#1f1f1f', fontWeight: '600', fontSize: 15 }}>
              {googleLoading ? "Connecting to Google..." : "Sign in with Google"}
            </Text>
          </Pressable>

          <View className="flex-row justify-center items-center">
            <Text style={{ color: '#9ca3af' }}>Beginning your journey? </Text>
            <Link href="/(auth)/signup" asChild>
              <Pressable>
                <Text className="text-primary font-semibold">Sign up here</Text>
              </Pressable>
            </Link>
          </View>
        </>
      ) : mode === "setup_otp" ? (
        <>
          {Platform.OS === "web" && (
            <View className="my-2 w-full items-center justify-center overflow-visible">
              <View 
                id="recaptcha-container-login"
                nativeID="recaptcha-container-login"
                style={{
                  minHeight: 78,
                  minWidth: 304,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              />
            </View>
          )}

          <View className="gap-6 mb-8">
            <Text className="text-foreground text-base">
              Verification code sent to{" "}
              <Text className="font-bold text-primary">{identifier.trim()}</Text>
            </Text>

            <TextField isRequired>
              <Label>Verification Code (OTP)</Label>
              <Input 
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                className="text-center text-lg font-bold tracking-widest h-14"
              />
            </TextField>

            <View className="flex-row justify-between items-center mt-2">
              <Pressable onPress={() => { setMode("login"); setError(null); setInfoMessage(null); }} className="flex-row items-center gap-1">
                <StyledIonicons name="arrow-back" size={16} className="text-primary" />
                <Text className="text-primary font-medium text-sm">Back to Log In</Text>
              </Pressable>

              <Pressable 
                onPress={() => handleSendSetupOtp(identifier)} 
                disabled={otpLoading || timer > 0}
              >
                <Text className={`text-sm font-medium ${timer > 0 || otpLoading ? "text-zinc-400-foreground" : "text-primary underline"}`}>
                  {otpLoading ? "Sending..." : timer > 0 ? `Resend in ${timer}s` : "Resend Code"}
                </Text>
              </Pressable>
            </View>
          </View>

          <Button 
            variant="primary" 
            onPress={handleVerifyOtpStep} 
            className="mb-8" 
            isDisabled={isLoading}
          >
            <View className="flex-row items-center justify-center gap-2">
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <StyledIonicons name="checkmark-circle" size={20} color="white" />
              )}
              <Button.Label>
                {isLoading ? "Verifying..." : "Verify & Continue"}
              </Button.Label>
            </View>
          </Button>
        </>
      ) : (
        <>
          <View className="gap-5 mb-8">
            <Text className="text-foreground text-base">
              Set a secure password for your account (<Text className="font-bold text-primary">{identifier.trim()}</Text>).
            </Text>

            <TextField isRequired>
              <Label>New Password</Label>
              <View className="w-full justify-center">
                <Input 
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="••••••••••••" 
                  secureTextEntry={!isNewPasswordVisible}
                  className="pr-12"
                />
                <Pressable 
                  className="absolute right-4"
                  onPress={() => setIsNewPasswordVisible(!isNewPasswordVisible)}
                >
                  <StyledIonicons 
                    name={isNewPasswordVisible ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    className="text-zinc-400-foreground" 
                  />
                </Pressable>
              </View>
            </TextField>

            <TextField isRequired>
              <Label>Confirm New Password</Label>
              <Input 
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••••••" 
                secureTextEntry={!isNewPasswordVisible}
              />
            </TextField>

            <View className="flex-row justify-between items-center mt-2">
              <Pressable onPress={() => { setMode("setup_otp"); setError(null); setInfoMessage(null); }} className="flex-row items-center gap-1">
                <StyledIonicons name="arrow-back" size={16} className="text-primary" />
                <Text className="text-primary font-medium text-sm">Back to OTP Verification</Text>
              </Pressable>
            </View>
          </View>

          <Button 
            variant="primary" 
            onPress={handleSetupPasswordSubmit} 
            className="mb-8" 
            isDisabled={isLoading}
          >
            <View className="flex-row items-center justify-center gap-2">
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <StyledIonicons name="key-outline" size={20} color="white" />
              )}
              <Button.Label>
                {isLoading ? "Setting Password..." : "Set Password & Log In"}
              </Button.Label>
            </View>
          </Button>
        </>
      )}
    </ScrollView>
  );
}
