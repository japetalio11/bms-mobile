import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import type { JSX } from "react";
import { Text, TextField, Label, Input, Button } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { withUniwind } from "uniwind";
import { loginApi, sendOtpApi, verifyOtpApi, setupPasswordApi } from "../../config/api";
import { useAuth } from "../../context/UserContext";

const StyledIonicons = withUniwind(Ionicons);

export default function LoginScreen(): JSX.Element {
  const router = useRouter();
  const { login } = useAuth();

  // Mode: "login" -> "setup_otp" -> "setup_password"
  const [mode, setMode] = useState<"login" | "setup_otp" | "setup_password">("login");

  // Form Fields
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // Setup Password Fields
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [timer, setTimer] = useState(0);

  // Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Timer countdown hook for OTP resend
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Trigger OTP generation for password setup
  const handleSendSetupOtp = async (targetIdentifier: string): Promise<boolean> => {
    const cleanId = targetIdentifier.trim();
    if (!cleanId) return false;

    setOtpLoading(true);
    setError(null);
    const isEmail = cleanId.includes("@");
    const type = isEmail ? "email" : "sms";

    try {
      await sendOtpApi({
        identifier: cleanId,
        type,
        purpose: "registration",
        provider: type,
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
        // Account exists (created by staff) but has no password set yet
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

  // Step 1: Verify OTP Code
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

    try {
      await verifyOtpApi({
        identifier: cleanId,
        code: otp.trim(),
        purpose: "registration",
      });

      setInfoMessage("OTP verified successfully! Now set a secure password for your account.");
      setMode("setup_password");
    } catch (err: any) {
      setError(err.message || "Invalid verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Set New Password & Submit
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
        otp: otp.trim(),
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
          {mode === "login"
            ? "Welcome back. Let's check on your journey."
            : mode === "setup_otp"
            ? "Account Verification"
            : "Create Account Password"}
        </Text>
      </View>

      <Text className="text-3xl font-bold text-foreground mb-6">
        {mode === "login"
          ? "Log in"
          : mode === "setup_otp"
          ? "Enter Verification Code"
          : "Create Password"}
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

      {mode === "login" ? (
        /* MODE 1: STANDARD LOGIN FORM */
        <>
          <View className="gap-6 mb-8">
            <TextField isRequired>
              <Label>Email or Phone Number</Label>
              <View className="w-full justify-center">
                <Input 
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="Enter email or phone number" 
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="pr-12"
                />
                <StyledIonicons 
                  name="person-outline" 
                  size={20} 
                  className="absolute right-4 text-muted-foreground" 
                  pointerEvents="none"
                />
              </View>
            </TextField>

            <TextField isRequired>
              <View className="flex-row justify-between w-full items-center">
                <Label>Password</Label>
                <Pressable onPress={() => setError("Password reset link will be sent to your registered email.")}>
                  <Text className="text-primary font-medium text-sm">Forgot?</Text>
                </Pressable>
              </View>
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

          <Button variant="primary" onPress={handleLogin} className="mb-8" isDisabled={isLoading}>
            <View className="flex-row items-center justify-center gap-2">
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <StyledIonicons name="arrow-forward" size={20} color="white" />
              )}
              <Button.Label>{isLoading ? "Logging in..." : "Log In"}</Button.Label>
            </View>
          </Button>

          <View className="flex-row justify-center items-center">
            <Text className="text-foreground">Beginning your journey? </Text>
            <Link href="/(auth)/signup" asChild>
              <Pressable>
                <Text className="text-primary font-medium underline">Sign up here</Text>
              </Pressable>
            </Link>
          </View>
        </>
      ) : mode === "setup_otp" ? (
        /* MODE 2: STEP 1 - OTP VERIFICATION FOR PASSWORD SETUP */
        <>
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
                className="text-center text-xl font-bold tracking-widest h-14"
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
                <Text className={`text-sm font-medium ${timer > 0 || otpLoading ? "text-muted-foreground" : "text-primary underline"}`}>
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
        /* MODE 3: STEP 2 - SET NEW PASSWORD FOR ACCOUNT */
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
                    className="text-muted-foreground" 
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
