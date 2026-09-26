import { View, ScrollView, Pressable, ActivityIndicator, Platform, Modal, Image, KeyboardAvoidingView } from "react-native";
import { useState, useEffect } from "react";
import type { JSX } from "react";
import { Text, TextField, Label, Input, Button, Checkbox } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { withUniwind } from "uniwind";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { getNativeGoogleSignin } from "../../lib/googleAuthUtils";
import { makeRedirectUri } from "expo-auth-session";
import { sendOtpApi, registerApi, googleAuthApi } from "../../config/api";
import { useAuth } from "../../context/UserContext";
import { usePhoneAuth } from "../../hooks/usePhoneAuth";
import { formatToE164, isTestPhoneNumber } from "../../lib/phoneAuthUtils";
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

export default function SignupScreen(): JSX.Element {
  const router = useRouter();
  const { login } = useAuth();
  const insets = useSafeAreaInsets();

  const phoneAuth = usePhoneAuth({
    containerId: "recaptcha-container",
    cooldownDuration: 60,
  });

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  const [step, setStep] = useState<1 | 2>(1);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [termsTab, setTermsTab] = useState<"terms" | "privacy" | "data">("terms");

  const [otp, setOtp] = useState("");
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
      handleGoogleBackendRegister(idToken, accessToken);
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
        await handleGoogleBackendRegister(idToken, undefined, user);
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

  const handleGoogleBackendRegister = async (idToken?: string, accessToken?: string, nativeUser?: any) => {
    setGoogleLoading(true);
    setError(null);
    try {
      let googleEmail: string | undefined = nativeUser?.email;
      let googleFirstName: string | undefined = nativeUser?.givenName || nativeUser?.name;
      let googleLastName: string | undefined = nativeUser?.familyName;
      let profileUrl: string | undefined = nativeUser?.photo;

      if (idToken && (!googleEmail || !googleFirstName)) {
        const decoded = decodeJwtPayload(idToken);
        if (decoded) {
          googleEmail = googleEmail || decoded.email;
          googleFirstName = googleFirstName || decoded.given_name || decoded.name;
          googleLastName = googleLastName || decoded.family_name;
          profileUrl = profileUrl || decoded.picture;
        }
      }

      if (accessToken && (!googleEmail || !googleFirstName)) {
        try {
          const userInfoRes = await fetch("https://www.googleapis.com/userinfo/v2/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (userInfoRes.ok) {
            const userInfo = await userInfoRes.json();
            googleEmail = googleEmail || userInfo.email;
            googleFirstName = googleFirstName || userInfo.given_name;
            googleLastName = googleLastName || userInfo.family_name;
            profileUrl = profileUrl || userInfo.picture;
          }
        } catch (fetchErr) {
          console.warn("Could not fetch userinfo from Google:", fetchErr);
        }
      }

      const data = await googleAuthApi({
        idToken,
        email: googleEmail,
        first_name: googleFirstName,
        last_name: googleLastName,
        profile_url: profileUrl,
        role: "Mother",
        is_signup: true,
      });

      login(data.user, data.token);
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err.message || "Google Sign-Up failed. Please try again.");
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

  const { initRecaptcha } = phoneAuth;

  useEffect(() => {
    if (!email.trim() && Platform.OS === "web") {
      const t = setTimeout(() => {
        initRecaptcha();
      }, 300);
      return () => clearTimeout(t);
    }
  }, [email, initRecaptcha]);

  const handleRequestOtp = async (): Promise<boolean> => {
    const isEmailMode = Boolean(email.trim());
    const targetIdentifier = isEmailMode ? email.trim() : phone.trim();

    console.group(" [Signup Flow - Request OTP]");
    console.log("Mode:", isEmailMode ? "Email OTP" : "SMS OTP (Firebase)");
    console.log("Target Identifier:", targetIdentifier);
    console.log("Platform:", Platform.OS);

    if (!targetIdentifier) {
      console.warn(" No identifier provided");
      console.groupEnd();
      setError("Please provide an email or phone number to receive the verification code.");
      return false;
    }

    setOtpLoading(true);
    setError(null);

    if (isEmailMode) {
      try {
        console.log(" Sending OTP via Backend Email Service...");
        await sendOtpApi({
          identifier: targetIdentifier,
          type: "email",
          purpose: "registration",
          provider: "email",
        });

        console.log(" Email OTP Sent Successfully to:", targetIdentifier);
        console.groupEnd();
        setTimer(60);
        setInfoMessage(`Verification code sent to ${targetIdentifier}`);
        return true;
      } catch (err: any) {
        console.error(" Email OTP Failed:", err);
        console.groupEnd();
        setError(err.message || "Failed to send verification code. Please try again.");
        return false;
      } finally {
        setOtpLoading(false);
      }
    } else {
      try {
        console.log(" Initiating Phone Auth via Firebase SMS...");
        const sent = await phoneAuth.sendOtp(targetIdentifier, "registration");
        if (sent) {
          console.log(" Firebase Phone Auth sendOtp succeeded!");
          console.groupEnd();
          setTimer(phoneAuth.cooldown || 60);
          setInfoMessage(phoneAuth.statusMessage || `Verification code sent to ${targetIdentifier}`);
          return true;
        } else {
          console.warn(" Phone Auth sendOtp returned false:", phoneAuth.statusMessage);
          console.groupEnd();
          setError(phoneAuth.statusMessage || "Failed to send SMS OTP code.");
          return false;
        }
      } catch (err: any) {
        console.error(" Phone Auth Exception caught in Signup:", err);
        console.groupEnd();
        setError(err.message || "Failed to send SMS OTP code.");
        return false;
      } finally {
        setOtpLoading(false);
      }
    }
  };

  const handleProceedToOtp = async () => {
    setError(null);

    console.group("📋 [Signup Step 1: Validate & Proceed]");
    console.log("Form Values:", {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      hasEmail: Boolean(email.trim()),
      email: email.trim(),
      agreed,
      platform: Platform.OS,
      reCAPTCHASolved: phoneAuth.isRecaptchaSolved,
    });

    if (!firstName.trim()) {
      setError("First name is required");
      console.warn("Validation failed: First name is required");
      console.groupEnd();
      return;
    }
    if (!lastName.trim()) {
      setError("Last name is required");
      console.warn("Validation failed: Last name is required");
      console.groupEnd();
      return;
    }
    if (!email.trim()) {
      setError("Email address is required");
      console.warn("Validation failed: Email address is required");
      console.groupEnd();
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address.");
      console.warn("Validation failed: Invalid email format");
      console.groupEnd();
      return;
    }
    if (!password) {
      setError("Password is required");
      console.warn("Validation failed: Password is required");
      console.groupEnd();
      return;
    }
    if (!agreed) {
      setError("You must agree to the Maternal Consent and Terms");
      console.warn("Validation failed: Consent required");
      console.groupEnd();
      return;
    }
    console.groupEnd();

    const success = await handleRequestOtp();
    if (success) {
      setStep(2);
    }
  };

  const handleRegister = async () => {
    if (!otp.trim()) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let finalOtpCode = otp.trim();
      const isEmailMode = Boolean(email.trim());

      if (!isEmailMode) {
        const verifyRes = await phoneAuth.verifyOtp(otp);
        if (!verifyRes.success) {
          setError(verifyRes.error || "Invalid or expired OTP code.");
          setIsLoading(false);
          return;
        }
        finalOtpCode = verifyRes.finalOtpCode;
      }

      const data = await registerApi({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: "Mother", 
        phone_number: phone.trim(),
        email: email.trim() || undefined,
        address: "Not specified",
        password,
        otp: finalOtpCode,
      });

      login(data.user, data.token);
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please check your verification code.");
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
        className="flex-1 bg-background"
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 48, paddingBottom: Math.max(insets.bottom + 48, 64) }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
      >
      <View className="items-center mb-8">
        <Image
          source={require("../../../assets/images/logo.png")}
          style={{ width: 88, height: 88, borderRadius: 20, marginBottom: 16 }}
          resizeMode="contain"
        />
        <Text className="text-foreground font-semibold text-center text-base" style={{ lineHeight: 22 }}>
          {step === 1 ? "Begin your maternal care journey." : "Verify your account\nto complete registration."}
        </Text>
      </View>

      {step !== 1 && (
        <Text className="text-lg font-bold text-foreground mb-6">Enter Verification Code</Text>
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

      {step === 1 ? (
        <>
          <Pressable
            onPress={handleGooglePress}
            disabled={googleLoading || otpLoading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              backgroundColor: '#ffffff',
              borderRadius: 12,
              height: 52,
              paddingHorizontal: 16,
              marginBottom: 20,
              opacity: (googleLoading || otpLoading) ? 0.5 : 1,
            }}
            className="active:opacity-90"
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <StyledIonicons name="logo-google" size={20} color="#4285F4" />
            )}
            <Text style={{ color: '#1f1f1f', fontWeight: '600', fontSize: 15 }}>
              {googleLoading ? "Signing in with Google..." : "Continue with Google"}
            </Text>
          </Pressable>

          <View className="flex-row items-center mb-6">
            <View className="flex-1 h-[1px]" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <Text className="px-4 text-sm uppercase font-semibold" style={{ color: '#6b7280' }}>Or register with details</Text>
            <View className="flex-1 h-[1px]" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
          </View>

          <View className="gap-5 mb-6">
            <TextField>
              <Label>First Name</Label>
              <Input 
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Jane"
                placeholderTextColor="#9ca3af"
                style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
              />
            </TextField>

            <TextField>
              <Label>Last Name</Label>
              <Input 
                value={lastName}
                onChangeText={setLastName}
                placeholder="Doe"
                placeholderTextColor="#9ca3af"
                style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
              />
            </TextField>

            <TextField>
              <Label>Email Address</Label>
              <View className="w-full justify-center">
                <Input 
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@email.com" 
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="pr-12"
                  style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
                />
                <StyledIonicons 
                  name="mail-outline" 
                  size={20} 
                  color="#9ca3af"
                  className="absolute right-4" 
                  pointerEvents="none"
                />
              </View>
            </TextField>

            <TextField>
              <Label>Phone Number (Optional)</Label>
              <View 
                className="w-full flex-row items-center bg-surface rounded-xl px-4 h-12"
                style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
              >
                <View className="flex-row items-center gap-1 pr-3 mr-3 h-full" style={{ borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.15)' }}>
                  <Text className="text-foreground">+63</Text>
                </View>
                <Input 
                  value={phone}
                  onChangeText={(val) => {
                    setPhone(val);
                    if (val.trim().length >= 10) {
                      phoneAuth.initRecaptcha();
                    }
                  }}
                  placeholder="9123456789"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  className="flex-1 px-0 border-0 bg-transparent h-full"
                />
              </View>
            </TextField>

            <TextField>
              <Label>Password</Label>
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

            {Platform.OS === "web" && !email.trim() && (
              <View className="my-2 w-full items-center justify-center overflow-visible">
                <View 
                  id="recaptcha-container"
                  nativeID="recaptcha-container"
                  style={{
                    minHeight: 78,
                    minWidth: 304,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />
              </View>
            )}
          </View>

          <View className="flex-row items-start gap-3 mb-6">
            <Checkbox 
              isSelected={agreed} 
              onSelectedChange={setAgreed} 
              className="mt-0.5"
            />
            <View className="flex-1 pr-2">
              <Text className="text-foreground text-sm leading-5">
                I agree to the{" "}
                <Text 
                  onPress={() => { setTermsTab("terms"); setIsTermsModalOpen(true); }}
                  className="text-primary font-semibold underline"
                >
                  Terms of Service
                </Text>{" "}
                and{" "}
                <Text 
                  onPress={() => { setTermsTab("privacy"); setIsTermsModalOpen(true); }}
                  className="text-primary font-semibold underline"
                >
                  Privacy Policy
                </Text>
                , and consent to the processing of my{" "}
                <Text 
                  onPress={() => { setTermsTab("data"); setIsTermsModalOpen(true); }}
                  className="text-primary font-semibold underline"
                >
                  health data
                </Text>
                .
              </Text>
            </View>
          </View>

          <Button 
            variant="primary" 
            onPress={handleProceedToOtp} 
            className="mb-6" 
            isDisabled={!agreed || otpLoading || googleLoading}
          >
            <View className="flex-row items-center justify-center gap-2">
              {otpLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <StyledIonicons name="arrow-forward" size={20} color="white" />
              )}
              <Button.Label>
                {otpLoading ? "Sending Verification Code..." : "Proceed to Verification"}
              </Button.Label>
            </View>
          </Button>
        </>
      ) : (
        <>
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-foreground font-medium">Verification Code</Text>
              <Pressable onPress={() => setStep(1)} className="p-1">
                <Text className="text-primary text-sm font-semibold">Change Info</Text>
              </Pressable>
            </View>
            <Text className="text-zinc-400 text-sm mb-4">
              Enter the 6-digit code sent to{" "}
              <Text className="text-foreground font-semibold">
                {email.trim() ? email.trim() : `+63 ${phone.trim()}`}
              </Text>
            </Text>

            <TextField isRequired>
              <Input 
                value={otp}
                onChangeText={setOtp}
                placeholder="123456" 
                keyboardType="number-pad"
                maxLength={6}
                className="text-center text-lg tracking-[8px] font-bold h-14"
                autoFocus
              />
            </TextField>
          </View>

          <View className="flex-row justify-between items-center mb-8">
            <Text className="text-zinc-400 text-sm">Didn't receive code?</Text>
            <Pressable 
              onPress={handleRequestOtp}
              disabled={timer > 0 || otpLoading}
              className="p-1"
            >
              <Text className={`text-sm font-semibold ${timer > 0 ? "text-zinc-400" : "text-primary underline"}`}>
                {timer > 0 ? `Resend in ${timer}s` : "Resend Code"}
              </Text>
            </Pressable>
          </View>

          <Button 
            variant="primary" 
            onPress={handleRegister} 
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
                {isLoading ? "Verifying & Registering..." : "Complete Registration"}
              </Button.Label>
            </View>
          </Button>
        </>
      )}

      <View className="flex-row justify-center items-center">
        <Text style={{ color: '#9ca3af' }}>Already have an account? </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable>
            <Text className="text-primary font-semibold">Log in</Text>
          </Pressable>
        </Link>
      </View>

      <Modal
        visible={isTermsModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsTermsModalOpen(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <Pressable 
            className="flex-1" 
            onPress={() => setIsTermsModalOpen(false)} 
          />
          
          <View 
            className="bg-background rounded-t-3xl border-t border-border px-6 pt-4 max-h-[82%] shadow-2xl"
            style={{ paddingBottom: Math.max(insets.bottom + 16, 28) }}
          >
            
            <View className="items-center mb-3">
              <View className="w-12 h-1.5 bg-muted/60 rounded-full" />
            </View>

            <View className="flex-row justify-between items-center mb-3 pb-3 border-b border-border">
              <View className="flex-1 pr-2">
                <Text className="text-lg font-bold text-foreground">
                  Terms & Data Privacy
                </Text>
                <Text className="text-sm text-zinc-400-foreground mt-0.5">
                  Birth Monitoring System (BMS) • Maternal Care
                </Text>
              </View>
              <Pressable 
                onPress={() => setIsTermsModalOpen(false)}
                className="p-2 bg-muted/30 rounded-full active:opacity-70"
              >
                <StyledIonicons name="close" size={20} className="text-foreground" />
              </Pressable>
            </View>

            <View className="flex-row bg-muted/40 p-1.5 rounded-2xl mb-4 border border-border items-center">
              <Pressable
                onPress={() => setTermsTab("terms")}
                className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
                  termsTab === "terms" 
                    ? "bg-primary shadow border border-primary/50" 
                    : "bg-transparent active:bg-muted/30"
                }`}
              >
                <Text className={`text-sm ${
                  termsTab === "terms" 
                    ? "text-primary-foreground font-bold" 
                    : "text-zinc-400-foreground font-medium"
                }`}>
                  Terms
                </Text>
              </Pressable>

              <View className={`w-[1px] h-4 mx-0.5 ${termsTab === "terms" || termsTab === "privacy" ? "bg-transparent" : "bg-border"}`} />

              <Pressable
                onPress={() => setTermsTab("privacy")}
                className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
                  termsTab === "privacy" 
                    ? "bg-primary shadow border border-primary/50" 
                    : "bg-transparent active:bg-muted/30"
                }`}
              >
                <Text className={`text-sm ${
                  termsTab === "privacy" 
                    ? "text-primary-foreground font-bold" 
                    : "text-zinc-400-foreground font-medium"
                }`}>
                  Privacy
                </Text>
              </Pressable>

              <View className={`w-[1px] h-4 mx-0.5 ${termsTab === "privacy" || termsTab === "data" ? "bg-transparent" : "bg-border"}`} />

              <Pressable
                onPress={() => setTermsTab("data")}
                className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
                  termsTab === "data" 
                    ? "bg-primary shadow border border-primary/50" 
                    : "bg-transparent active:bg-muted/30"
                }`}
              >
                <Text className={`text-sm ${
                  termsTab === "data" 
                    ? "text-primary-foreground font-bold" 
                    : "text-zinc-400-foreground font-medium"
                }`}>
                  Health Data
                </Text>
              </Pressable>
            </View>

            <ScrollView className="mb-4 px-1 max-h-[300px]" showsVerticalScrollIndicator={true}>
              {termsTab === "terms" && (
                <View className="gap-3">
                  <Text className="text-base font-bold text-foreground">1. Acceptance of Terms</Text>
                  <Text className="text-sm text-foreground/80 leading-6">
                    By registering an account on the Birth Monitoring System (BMS) Mobile Application, you agree to use the platform solely for managing maternal healthcare, tracking pregnancy progress, scheduling clinic appointments, and receiving prenatal guidelines.
                  </Text>

                  <Text className="text-base font-bold text-foreground">2. Purpose of BMS Mobile</Text>
                  <Text className="text-sm text-foreground/80 leading-6">
                    BMS Mobile connects expecting mothers with authorized healthcare personnel (midwives, nurses, and doctors) in public health facilities. It assists in monitoring high-risk pregnancy indicators, recording vital signs, and coordinating referral services.
                  </Text>

                  <Text className="text-base font-bold text-foreground">3. User Responsibilities</Text>
                  <Text className="text-sm text-foreground/80 leading-6">
                    You agree to provide accurate personal and health information. You are responsible for safeguarding your login credentials and verification OTPs.
                  </Text>

                  <Text className="text-base font-bold text-foreground">4. Emergency Disclaimer</Text>
                  <Text className="text-sm text-foreground/80 leading-6">
                    While BMS provides automated risk alerts and appointment reminders, it does not replace immediate emergency medical care. In acute medical emergencies, please proceed immediately to the nearest healthcare facility.
                  </Text>
                </View>
              )}

              {termsTab === "privacy" && (
                <View className="gap-3">
                  <Text className="text-base font-bold text-foreground">1. Data Privacy Compliance</Text>
                  <Text className="text-sm text-foreground/80 leading-6">
                    In compliance with Republic Act No. 10173 (Data Privacy Act of 2012), the Birth Monitoring System is committed to protecting your personal information and sensitive health records.
                  </Text>

                  <Text className="text-base font-bold text-foreground">2. Data We Collect</Text>
                  <Text className="text-sm text-foreground/80 leading-6">
                    We collect your full name, contact number, age, pregnancy history (Gravida/Parity, LMP), prenatal visit vitals (blood pressure, weight, gestational age), and clinic appointment logs.
                  </Text>

                  <Text className="text-base font-bold text-foreground">3. Data Usage & Access</Text>
                  <Text className="text-sm text-foreground/80 leading-6">
                    Your data is strictly restricted to assigned medical staff and health officers managing your maternal care. Your records will never be sold, leased, or shared with unauthorized third parties.
                  </Text>

                  <Text className="text-base font-bold text-foreground">4. Security Measures</Text>
                  <Text className="text-sm text-foreground/80 leading-6">
                    All stored records and API transmissions are secured using HTTPS encryption, JWT authentication, and database access controls.
                  </Text>
                </View>
              )}

              {termsTab === "data" && (
                <View className="gap-3">
                  <Text className="text-base font-bold text-foreground">Consent for Processing Health Data</Text>
                  <Text className="text-sm text-foreground/80 leading-6">
                    By checking the consent box, you grant explicit authorization to the Birth Monitoring System and its healthcare partner facilities to process your medical records for the following maternal care services:
                  </Text>
                  <View className="gap-2 pl-2">
                    <Text className="text-sm text-foreground/80 leading-6">• Real-time risk level assessment (Normal, Moderate, High Risk) during prenatal care.</Text>
                    <Text className="text-sm text-foreground/80 leading-6">• Generating automated appointment SMS reminders and vaccination schedules.</Text>
                    <Text className="text-sm text-foreground/80 leading-6">• Coordinating referral transfers between rural health units and hospital facilities when high-risk complications arise.</Text>
                    <Text className="text-sm text-foreground/80 leading-6">• Recording labor and delivery outcomes for mother and newborn care records.</Text>
                  </View>
                  <Text className="text-sm text-foreground/80 leading-6 mt-2">
                    You retain the right to request access to your recorded health data or request account deactivation through your attending healthcare provider.
                  </Text>
                </View>
              )}
            </ScrollView>

            <View className="pt-3 border-t border-border/60 gap-2">
              <Button
                variant="primary"
                onPress={() => {
                  setAgreed(true);
                  setIsTermsModalOpen(false);
                }}
              >
                I Agree & Accept Terms
              </Button>

              <Pressable
                onPress={() => setIsTermsModalOpen(false)}
                className="py-2.5 items-center justify-center active:opacity-70"
              >
                <Text className="text-zinc-400-foreground text-sm font-semibold">Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
