import { View, ScrollView, Pressable, ActivityIndicator, Platform, KeyboardAvoidingView, } from "react-native";
import { useState, useEffect, useCallback } from "react";
import type { JSX } from "react";
import { Text, Label, Checkbox } from "heroui-native";
import { AppTextField as TextField, AppInput as Input, AppButton as Button } from "../../components/FormControls";
import { AppIcon as Ionicons } from "../../components/AppIcon";
import { TermsPrivacyModal } from "../../components/TermsPrivacyModal";
import { Link, useRouter } from "expo-router";
import { withUniwind } from "uniwind";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { getNativeGoogleSignin } from "../../lib/googleAuthUtils";
import { sendOtpApi, registerApi, googleAuthApi } from "../../config/api";
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

export default function SignupScreen(): JSX.Element {
  const router = useRouter();
  const { login } = useAuth();
  const insets = useSafeAreaInsets();

  const phoneAuth = usePhoneAuth({
    containerId: "recaptcha-container",
    cooldownDuration: 60,
  });

  const [, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  const [step, setStep] = useState<1 | 2 | 3>(1);

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
    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy before continuing with Google.");
      return;
    }
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
        await handleGoogleBackendRegister(idToken, undefined, user);
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

  const handleGoogleBackendRegister = useCallback(async (
    idToken?: string,
    accessToken?: string,
    nativeUser?: any
  ) => {
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
  }, [login, router]);

  useEffect(() => {
    if (googleResponse?.type !== "success") return;
    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy before continuing with Google.");
      return;
    }
    const responseAny = googleResponse as any;
    const idToken = responseAny.params?.id_token || responseAny.authentication?.idToken;
    const accessToken = responseAny.authentication?.accessToken || responseAny.params?.access_token;
    void handleGoogleBackendRegister(idToken, accessToken);
  }, [googleResponse, agreed, handleGoogleBackendRegister]);

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
          setInfoMessage(
            phoneAuth.statusMessage || `Verification code sent to ${targetIdentifier}`
          );
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
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      console.warn("Validation failed: Password too short");
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
      setStep(3);
    }
  };

  const handleEmailContinue = () => {
    setError(null);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setError("Email address is required");
      return;
    }
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setStep(2);
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
        className="flex-1"
        style={{ backgroundColor: "#ffffff" }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: Math.max(insets.bottom + 24, 36),
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
      >
        <View style={{ width: "100%", maxWidth: 350, alignSelf: "center" }}>
        <Pressable
          onPress={() => {
            if (step === 3) setStep(2);
            else if (step === 2) setStep(1);
            else if (router.canGoBack()) router.back();
            else router.replace("/(auth)/login");
          }}
          accessibilityRole="button"
          accessibilityLabel={step === 1 ? "Go back" : "Previous step"}
          className="mb-5 h-7 w-7 items-center justify-center"
        >
          <StyledIonicons name="arrow-back" size={15} weight="regular" color="#171717" />
        </Pressable>
        <View className="mb-7">
          <Text style={{ color: "#171717", fontFamily: "Manrope-SemiBold", fontSize: 24, lineHeight: 30, letterSpacing: -0.35 }}>
            {step === 1 ? "Get your free account" : step === 2 ? "Your details" : "Verify your account"}
          </Text>
        </View>

        {visibleError && (
          <Text className="mb-4" style={{ color: "#f87171", fontFamily: "Manrope", fontSize: 16, lineHeight: 20 }} accessibilityRole="alert">
            {visibleError}
          </Text>
        )}

        {infoMessage && (
          <Text className="mb-4" style={{ color: "#003f2c", fontFamily: "Manrope", fontSize: 16, lineHeight: 20 }}>
            {infoMessage}
          </Text>
        )}

        {step === 1 ? (
          <>
            <View>
              <Button
                variant="outline"
                onPress={handleGooglePress}
                isDisabled={googleLoading}
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
            <View className="my-4 flex-row items-center gap-3">
              <View className="h-px flex-1" style={{ backgroundColor: "#e5e5e5" }} />
              <Text style={{ color: "#737373", fontFamily: "Manrope", fontSize: 16, lineHeight: 20 }}>OR</Text>
              <View className="h-px flex-1" style={{ backgroundColor: "#e5e5e5" }} />
            </View>
            <TextField>
              <Label isRequired>
                <Label.Text
                  style={{ color: "#262626", fontFamily: "Manrope", fontSize: 16, lineHeight: 20 }}
                  styles={{ asterisk: { color: "#003f2c", fontFamily: "Manrope", fontSize: 16 } }}
                >
                  Email
                </Label.Text>
              </Label>
              <Input value={email} onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor="#737373" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} className="h-10 rounded-md border" style={{ height: 44, borderRadius: 6, borderWidth: 1, borderColor: "#d4d4d4", backgroundColor: "#ffffff", color: "#171717", fontFamily: "Manrope", fontSize: 16 }} />
            </TextField>
            <View className="mt-4 flex-row items-start gap-2">
              <Checkbox isSelected={agreed} onSelectedChange={setAgreed} className="mt-0.5" />
              <Text className="flex-1 text-sm leading-5" style={{ color: "#525252" }}>
                I agree to the{" "}
                <Text onPress={() => { setTermsTab("terms"); setIsTermsModalOpen(true); }} style={{ color: "#003f2c", fontFamily: "Manrope-Medium" }}>
                  Terms of Service
                </Text>{" "}
                and{" "}
                <Text onPress={() => { setTermsTab("privacy"); setIsTermsModalOpen(true); }} style={{ color: "#003f2c", fontFamily: "Manrope-Medium" }}>
                  Privacy Policy
                </Text>
                , and consent to the processing of my{" "}
                <Text onPress={() => { setTermsTab("data"); setIsTermsModalOpen(true); }} style={{ color: "#003f2c", fontFamily: "Manrope-Medium" }}>
                  health data
                </Text>
                .
              </Text>
            </View>
            <Button variant="primary" onPress={handleEmailContinue} className="mt-4 h-10 rounded-md" style={{ height: 44, borderRadius: 6, backgroundColor: "#fffe8c" }}>
              <Button.Label style={{ color: "#171717", fontFamily: "Manrope-Medium", fontSize: 16 }}>Continue with Email</Button.Label>
            </Button>
            <View className="mt-6 flex-row items-center justify-center">
              <Text style={{ color: "#737373", fontFamily: "Manrope", fontSize: 16 }}>Already have an account? </Text>
              <Link href="/(auth)/login" asChild><Pressable><Text style={{ color: "#003f2c", fontFamily: "Manrope-Medium", fontSize: 16 }}>Login</Text></Pressable></Link>
            </View>
          </>
        ) : step === 2 ? (
          <>
            <View className="mb-5 flex-row items-center justify-between">
              <Text style={{ color: "#737373", fontFamily: "Manrope", fontSize: 16 }}>{email}</Text>
              <Pressable onPress={() => setStep(1)}><Text style={{ color: "#003f2c", fontFamily: "Manrope-Medium", fontSize: 16 }}>Change</Text></Pressable>
            </View>
            <View className="gap-4">
              <TextField isRequired><Label isRequired><Label.Text style={{ color: "#262626", fontFamily: "Manrope", fontSize: 16, lineHeight: 20 }}>First Name</Label.Text></Label><Input value={firstName} onChangeText={setFirstName} placeholder="Jane" placeholderTextColor="#737373" className="h-10 rounded-md border" style={{ height: 44, borderRadius: 6, borderWidth: 1, borderColor: "#d4d4d4", backgroundColor: "#ffffff", color: "#171717", fontFamily: "Manrope", fontSize: 16 }} /></TextField>
              <TextField isRequired><Label isRequired><Label.Text style={{ color: "#262626", fontFamily: "Manrope", fontSize: 16, lineHeight: 20 }}>Last Name</Label.Text></Label><Input value={lastName} onChangeText={setLastName} placeholder="Doe" placeholderTextColor="#737373" className="h-10 rounded-md border" style={{ height: 44, borderRadius: 6, borderWidth: 1, borderColor: "#d4d4d4", backgroundColor: "#ffffff", color: "#171717", fontFamily: "Manrope", fontSize: 16 }} /></TextField>
              <TextField><Label><Label.Text style={{ color: "#262626", fontFamily: "Manrope", fontSize: 16, lineHeight: 20 }}>Phone Number (Optional)</Label.Text></Label><View className="h-10 flex-row items-center rounded-md border px-3" style={{ height: 44, borderRadius: 6, borderWidth: 1, borderColor: "#d4d4d4", backgroundColor: "#ffffff" }}><Text className="mr-3 border-r pr-3" style={{ color: "#171717", borderColor: "#d4d4d4", fontFamily: "Manrope", fontSize: 16 }}>+63</Text><Input value={phone} onChangeText={(value) => { setPhone(value); if (value.trim().length >= 10) phoneAuth.initRecaptcha(); }} placeholder="9123456789" placeholderTextColor="#737373" keyboardType="phone-pad" className="h-full flex-1 border-0 bg-transparent px-0" style={{ height: "100%", borderWidth: 0, borderColor: "transparent", backgroundColor: "transparent", color: "#171717", fontFamily: "Manrope", fontSize: 16 }} /></View></TextField>
              <TextField isRequired><Label isRequired><Label.Text style={{ color: "#262626", fontFamily: "Manrope", fontSize: 14, lineHeight: 20, fontWeight: "500" }}>Password</Label.Text></Label><View className="justify-center"><Input value={password} onChangeText={setPassword} placeholder="Your password" placeholderTextColor="#737373" secureTextEntry={!isPasswordVisible} className="h-10 rounded-md border pr-10" style={{ height: 44, borderRadius: 6, borderWidth: 1, borderColor: "#d4d4d4", backgroundColor: "#ffffff", color: "#171717", fontFamily: "Manrope", fontSize: 16 }} /><Pressable onPress={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute right-1 h-9 w-9 items-center justify-center"><StyledIonicons name={isPasswordVisible ? "eye-outline" : "eye-off-outline"} size={16} color="#737373" /></Pressable></View></TextField>
            </View>
            {Platform.OS === "web" && !email.trim() && <View className="my-2 w-full items-center justify-center"><View id="recaptcha-container" nativeID="recaptcha-container" style={{ minHeight: 78, minWidth: 304 }} /></View>}
            <View className="mt-5 flex-row items-start gap-2">
              <Checkbox isSelected={agreed} onSelectedChange={setAgreed} className="mt-0.5" />
              <Text className="flex-1 text-base leading-5" style={{ color: "#525252" }}>I agree to the <Text onPress={() => { setTermsTab("terms"); setIsTermsModalOpen(true); }} style={{ color: "#003f2c" }}>Terms of Service</Text> and <Text onPress={() => { setTermsTab("privacy"); setIsTermsModalOpen(true); }} style={{ color: "#003f2c" }}>Privacy Policy</Text>, and consent to the processing of my <Text onPress={() => { setTermsTab("data"); setIsTermsModalOpen(true); }} style={{ color: "#003f2c" }}>health data</Text>.</Text>
            </View>
            <Button variant="primary" onPress={handleProceedToOtp} className="mt-5 h-10 rounded-md" isDisabled={!agreed || otpLoading || googleLoading} style={{ height: 44, borderRadius: 6, backgroundColor: "#fffe8c" }}>
              {otpLoading ? <ActivityIndicator color="#171717" size="small" /> : <Button.Label className="text-base font-medium" style={{ color: "#171717" }}>Continue</Button.Label>}
            </Button>
          </>
        ) : (
          <>
            <View className="mb-5 flex-row items-center justify-between">
              <Text className="text-base" style={{ color: "#737373" }}>Code sent to {email}</Text>
              <Pressable onPress={() => setStep(1)}><Text className="text-base font-medium" style={{ color: "#003f2c" }}>Change</Text></Pressable>
            </View>
            <TextField isRequired><Label isRequired><Label.Text style={{ color: "#171717", fontFamily: "Manrope-Medium", fontSize: 16, lineHeight: 20 }}>Verification Code</Label.Text></Label><Input value={otp} onChangeText={setOtp} placeholder="123456" placeholderTextColor="#737373" keyboardType="number-pad" maxLength={6} autoFocus className="h-10 rounded-md border text-center" style={{ height: 44, borderRadius: 6, borderWidth: 1, borderColor: "#d4d4d4", backgroundColor: "#ffffff", color: "#171717", letterSpacing: 3, fontFamily: "Manrope-Medium", fontSize: 16 }} /></TextField>
            <View className="mt-4 flex-row items-center justify-between"><Text className="text-base" style={{ color: "#737373" }}>Didn&apos;t receive code?</Text><Pressable onPress={handleRequestOtp} disabled={timer > 0 || otpLoading}><Text className="text-base font-medium" style={{ color: timer > 0 ? "#737373" : "#003f2c" }}>{timer > 0 ? `Resend in ${timer}s` : "Resend Code"}</Text></Pressable></View>
            <Button variant="primary" onPress={handleRegister} className="mt-5 h-10 rounded-md" isDisabled={isLoading} style={{ height: 44, borderRadius: 6, backgroundColor: "#fffe8c" }}>{isLoading ? <ActivityIndicator color="#171717" size="small" /> : <Button.Label className="text-base font-medium" style={{ color: "#171717" }}>Complete Registration</Button.Label>}</Button>
          </>
        )}

        <TermsPrivacyModal
          visible={isTermsModalOpen}
          onClose={() => setIsTermsModalOpen(false)}
          onAccept={() => {
            setAgreed(true);
            setIsTermsModalOpen(false);
          }}
          initialTab={termsTab}
        />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
