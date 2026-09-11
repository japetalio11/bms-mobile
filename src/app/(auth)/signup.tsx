import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import type { JSX } from "react";
import { Text, TextField, Label, Input, Button, Checkbox } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { withUniwind } from "uniwind";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import { sendOtpApi, registerApi, googleAuthApi } from "../../config/api";
import { useAuth } from "../../context/UserContext";

WebBrowser.maybeCompleteAuthSession();

const StyledIonicons = withUniwind(Ionicons);

export default function SignupScreen(): JSX.Element {
  const router = useRouter();
  const { login } = useAuth();

  // Google OAuth Hook
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    redirectUri: makeRedirectUri({ scheme: "bmsmobile" }),
  });

  // Step state: 1 = Form, 2 = OTP Verification
  const [step, setStep] = useState<1 | 2>(1);

  // Form Fields
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // OTP Verification state
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(0);

  // UX Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (googleResponse?.type === "success") {
      const responseAny = googleResponse as any;
      const idToken = responseAny.params?.id_token || responseAny.authentication?.idToken;
      const accessToken = responseAny.authentication?.accessToken || responseAny.params?.access_token;
      handleGoogleBackendRegister(idToken, accessToken);
    }
  }, [googleResponse]);

  const handleGoogleBackendRegister = async (idToken?: string, accessToken?: string) => {
    setGoogleLoading(true);
    setError(null);
    try {
      let googleEmail: string | undefined = undefined;
      let googleFirstName: string | undefined = undefined;
      let googleLastName: string | undefined = undefined;
      let profileUrl: string | undefined = undefined;

      if (accessToken && !idToken) {
        const userInfoRes = await fetch("https://www.googleapis.com/userinfo/v2/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (userInfoRes.ok) {
          const userInfo = await userInfoRes.json();
          googleEmail = userInfo.email;
          googleFirstName = userInfo.given_name;
          googleLastName = userInfo.family_name;
          profileUrl = userInfo.picture;
        }
      }

      const data = await googleAuthApi({
        idToken,
        email: googleEmail,
        first_name: googleFirstName,
        last_name: googleLastName,
        profile_url: profileUrl,
      });

      login(data.user, data.token);
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err.message || "Google Sign-Up failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  // Timer countdown hook
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Request OTP API trigger
  const handleRequestOtp = async (): Promise<boolean> => {
    const identifier = email.trim() || phone.trim();
    if (!identifier) {
      setError("Please provide an email or phone number to receive the verification code.");
      return false;
    }

    setOtpLoading(true);
    setError(null);

    const type = email.trim() ? "email" : "sms";

    try {
      await sendOtpApi({
        identifier,
        type,
        purpose: "registration",
        provider: type,
      });

      setTimer(60);
      setInfoMessage(`Verification code sent to ${identifier}`);
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to send verification code. Please try again.");
      return false;
    } finally {
      setOtpLoading(false);
    }
  };

  // Step 1 handler: validate form & proceed to OTP
  const handleProceedToOtp = async () => {
    setError(null);

    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }
    if (!lastName.trim()) {
      setError("Last name is required");
      return;
    }
    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }
    if (!agreed) {
      setError("You must agree to the Maternal Consent and Terms");
      return;
    }

    const success = await handleRequestOtp();
    if (success) {
      setStep(2);
    }
  };

  // Step 2 handler: verify OTP & complete registration
  const handleRegister = async () => {
    if (!otp.trim()) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await registerApi({
        first_name: firstName.trim(),
        middle_name: middleName.trim() || undefined,
        last_name: lastName.trim(),
        role: "Mother", // Mobile self-registration role for mothers
        phone_number: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        password,
        otp: otp.trim(),
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
    <ScrollView 
      className="flex-1 bg-background"
      contentContainerClassName="p-6 pt-24 pb-12"
      keyboardShouldPersistTaps="handled"
    >
      {/* Logo & Header */}
      <View className="items-center mb-8">
        <View className="flex-row items-center justify-center gap-3 mb-4">
          <View className="bg-primary h-14 w-14 rounded-2xl items-center justify-center">
            <StyledIonicons name="body" size={32} color="white" />
          </View>
          <Text className="text-primary font-bold text-4xl tracking-tight">bms</Text>
        </View>
        <Text className="text-foreground font-medium text-center">
          {step === 1 ? "Begin your maternal care journey." : "Verify your account to complete registration."}
        </Text>
      </View>

      <Text className="text-3xl font-bold text-foreground mb-6">
        {step === 1 ? "Create an account" : "Enter Verification Code"}
      </Text>

      {/* Error Alert */}
      {error && (
        <View className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex-row items-center gap-3">
          <StyledIonicons name="alert-circle-outline" size={22} className="text-red-500" />
          <Text className="text-red-500 text-sm flex-1">{error}</Text>
        </View>
      )}

      {/* Info Alert */}
      {infoMessage && (
        <View className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex-row items-center gap-3">
          <StyledIonicons name="checkmark-circle-outline" size={22} className="text-green-500" />
          <Text className="text-green-600 dark:text-green-400 text-sm flex-1">{infoMessage}</Text>
        </View>
      )}

      {step === 1 ? (
        /* STEP 1: Registration Form */
        <>
          <View className="gap-5 mb-6">
            {/* First & Last Name */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField isRequired>
                  <Label>First Name</Label>
                  <Input 
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Jane"
                  />
                </TextField>
              </View>
              <View className="flex-1">
                <TextField isRequired>
                  <Label>Last Name</Label>
                  <Input 
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Doe"
                  />
                </TextField>
              </View>
            </View>

            {/* Middle Name (Optional) */}
            <TextField>
              <Label>Middle Name (Optional)</Label>
              <Input 
                value={middleName}
                onChangeText={setMiddleName}
                placeholder="Santos"
              />
            </TextField>

            {/* Phone Number */}
            <TextField isRequired>
              <Label>Phone Number</Label>
              <View className="w-full flex-row items-center bg-surface border border-border rounded-xl px-4 h-12">
                <View className="flex-row items-center gap-1 border-r border-border pr-3 mr-3 h-full">
                  <Text className="text-foreground">+63</Text>
                </View>
                <Input 
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="9123456789"
                  keyboardType="phone-pad"
                  className="flex-1 px-0 border-0 bg-transparent h-full"
                />
              </View>
            </TextField>

            {/* Email Address */}
            <TextField>
              <Label>Email Address (Optional)</Label>
              <View className="w-full justify-center">
                <Input 
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@email.com" 
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="pr-12"
                />
                <StyledIonicons 
                  name="mail-outline" 
                  size={20} 
                  className="absolute right-4 text-muted-foreground" 
                  pointerEvents="none"
                />
              </View>
            </TextField>

            {/* Address */}
            <TextField>
              <Label>Home Address (Optional)</Label>
              <Input 
                value={address}
                onChangeText={setAddress}
                placeholder="Pili, Camarines Sur"
              />
            </TextField>

            {/* Password */}
            <TextField isRequired>
              <Label>Password</Label>
              <View className="w-full justify-center">
                <Input 
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••••••" 
                  secureTextEntry={!isPasswordVisible}
                  className="pr-12"
                />
                <Pressable 
                  className="absolute right-4"
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                >
                  <StyledIonicons 
                    name={isPasswordVisible ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    className="text-muted-foreground" 
                  />
                </Pressable>
              </View>
            </TextField>
          </View>

          {/* Maternal Consent Checkbox */}
          <View className="flex-row gap-3 mb-8">
            <Checkbox isSelected={agreed} onSelectedChange={setAgreed} />
            <View className="flex-1 pr-4">
              <Text className="text-foreground font-medium mb-1 leading-5">
                I provide my maternal consent and agree to the Terms.
              </Text>
              <Text className="text-muted-foreground text-sm">
                I agree to the terms outlined in the <Text className="text-primary underline">Maternal Consent Form</Text>
              </Text>
            </View>
          </View>

          <Button 
            variant="primary" 
            onPress={handleProceedToOtp} 
            className="mb-4" 
            isDisabled={!agreed || otpLoading || googleLoading}
          >
            <View className="flex-row items-center justify-center gap-2">
              {otpLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <StyledIonicons name="arrow-forward" size={20} color="white" />
              )}
              <Button.Label>
                {otpLoading ? "Sending Verification Code..." : "Continue to Verification"}
              </Button.Label>
            </View>
          </Button>

          <View className="flex-row items-center my-4">
            <View className="flex-1 h-[1px] bg-border" />
            <Text className="mx-4 text-xs font-semibold text-muted-foreground uppercase">OR</Text>
            <View className="flex-1 h-[1px] bg-border" />
          </View>

          <Pressable
            onPress={() => promptGoogleAsync()}
            disabled={!googleRequest || googleLoading || isLoading}
            className="flex-row items-center justify-center gap-3 bg-card border border-border rounded-xl h-13 px-4 mb-8 shadow-sm active:opacity-80"
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <StyledIonicons name="logo-google" size={20} color="#EA4335" />
            )}
            <Text className="text-foreground font-semibold text-base">
              {googleLoading ? "Connecting to Google..." : "Sign up with Google"}
            </Text>
          </Pressable>
        </>
      ) : (
        /* STEP 2: OTP Verification Screen */
        <>
          <View className="gap-6 mb-8">
            <Text className="text-foreground text-base">
              Please enter the 6-digit verification code sent to{" "}
              <Text className="font-bold text-primary">{email.trim() || phone.trim()}</Text>
            </Text>

            <TextField isRequired>
              <Label>Verification Code (OTP)</Label>
              <Input 
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                className="text-center text-xl font-bold tracking-widest h-14"
              />
            </TextField>

            <View className="flex-row justify-between items-center">
              <Pressable onPress={() => setStep(1)} className="flex-row items-center gap-1">
                <StyledIonicons name="arrow-back" size={16} className="text-primary" />
                <Text className="text-primary font-medium text-sm">Back to details</Text>
              </Pressable>

              <Pressable 
                onPress={handleRequestOtp} 
                disabled={otpLoading || timer > 0}
              >
                <Text className={`text-sm font-medium ${timer > 0 || otpLoading ? "text-muted-foreground" : "text-primary underline"}`}>
                  {otpLoading ? "Sending..." : timer > 0 ? `Resend in ${timer}s` : "Resend Code"}
                </Text>
              </Pressable>
            </View>
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

      {/* Footer link to Login */}
      <View className="flex-row justify-center items-center">
        <Text className="text-foreground">Already have an account? </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable>
            <Text className="text-primary font-medium underline">Log in</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}
