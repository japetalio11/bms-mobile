import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import type { JSX } from "react";
import { Text, TextField, Label, Input, Button } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { withUniwind } from "uniwind";
import { sendOtpApi, resetPasswordApi } from "../../config/api";
import { useAuth } from "../../context/UserContext";

const StyledIonicons = withUniwind(Ionicons);

export default function ForgotPasswordScreen(): JSX.Element {
  const router = useRouter();
  const { login } = useAuth();

  // Mode: "enter_identifier" | "verify_otp" | "reset_password" | "success"
  const [mode, setMode] = useState<"enter_identifier" | "verify_otp" | "reset_password" | "success">("enter_identifier");

  // Form Fields
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

  // Timer for OTP Resend
  const [timer, setTimer] = useState(0);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Timer Countdown Effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Determine provider format
  const isEmail = identifier.includes("@");
  const provider = isEmail ? "email" : "sms";

  // Step 1: Send OTP for Reset Password
  const handleRequestOtp = async () => {
    if (!identifier.trim()) {
      setError("Please enter your registered email or phone number.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      await sendOtpApi({
        identifier: identifier.trim(),
        type: provider,
        purpose: "reset_password",
        provider: provider,
      });

      setInfoMessage(`Verification code sent to ${identifier.trim()}.`);
      setTimer(60);
      setMode("verify_otp");
    } catch (err: any) {
      setError(err.message || "Failed to send verification code. Please verify your details.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Proceed to Reset Password input stage
  const handleProceedToReset = () => {
    if (!otp.trim()) {
      setError("Please enter the 6-digit OTP verification code.");
      return;
    }
    if (otp.trim().length < 6) {
      setError("OTP code must be 6 digits.");
      return;
    }

    setError(null);
    setMode("reset_password");
  };

  // Step 3: Reset Password Submission
  const handleResetPassword = async () => {
    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      const res = await resetPasswordApi({
        identifier: identifier.trim(),
        otp: otp.trim(),
        newPassword: newPassword,
      });

      setInfoMessage("Password reset successfully!");
      setMode("success");

      // Auto-login user if token and user object are provided
      if (res.user && res.token) {
        setTimeout(() => {
          login(res.user, res.token);
          router.replace("/(tabs)");
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Please verify your OTP code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="bg-background px-6 pt-12 pb-8">
      {/* Header with Back Button */}
      <View className="flex-row items-center mb-8">
        <Pressable 
          onPress={() => {
            if (mode === "verify_otp") setMode("enter_identifier");
            else if (mode === "reset_password") setMode("verify_otp");
            else router.back();
          }}
          className="p-2 -ml-2 rounded-full active:bg-muted/30"
        >
          <StyledIonicons name="arrow-back" size={24} className="text-foreground" />
        </Pressable>
        <Text className="text-xl font-bold text-foreground ml-2">
          {mode === "enter_identifier" && "Forgot Password"}
          {mode === "verify_otp" && "Verify OTP"}
          {mode === "reset_password" && "Reset Password"}
          {mode === "success" && "Password Reset Successful"}
        </Text>
      </View>

      <View className="flex-1 justify-between">
        <View className="gap-6">
          {/* Main Illustration/Icon Hero Header */}
          <View className="items-center my-4">
            <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-4">
              <StyledIonicons 
                name={
                  mode === "enter_identifier" ? "lock-open-outline" :
                  mode === "verify_otp" ? "key-outline" :
                  mode === "reset_password" ? "shield-checkmark-outline" :
                  "checkmark-circle-outline"
                } 
                size={40} 
                className="text-primary" 
              />
            </View>

            <Text className="text-2xl font-bold text-foreground text-center">
              {mode === "enter_identifier" && "Reset Your Password"}
              {mode === "verify_otp" && "Enter Verification Code"}
              {mode === "reset_password" && "Create New Password"}
              {mode === "success" && "All Set!"}
            </Text>

            <Text className="text-sm text-muted-foreground text-center mt-2 px-4">
              {mode === "enter_identifier" && "Enter the email address or phone number associated with your Mother account to receive an OTP code."}
              {mode === "verify_otp" && `Enter the 6-digit code sent to ${identifier}.`}
              {mode === "reset_password" && "Your new password must be at least 6 characters long."}
              {mode === "success" && "Your password has been successfully updated. Redirecting you..."}
            </Text>
          </View>

          {/* Feedback Messages */}
          {error && (
            <View className="bg-destructive/15 border border-destructive/30 rounded-xl p-4 flex-row items-center gap-3">
              <StyledIonicons name="alert-circle-outline" size={20} className="text-destructive" />
              <Text className="text-destructive font-medium text-sm flex-1">{error}</Text>
            </View>
          )}

          {infoMessage && (
            <View className="bg-primary/15 border border-primary/30 rounded-xl p-4 flex-row items-center gap-3">
              <StyledIonicons name="information-circle-outline" size={20} className="text-primary" />
              <Text className="text-primary font-medium text-sm flex-1">{infoMessage}</Text>
            </View>
          )}

          {/* STEP 1: Enter Identifier */}
          {mode === "enter_identifier" && (
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
                  name={isEmail ? "mail-outline" : "call-outline"} 
                  size={20} 
                  className="absolute right-4 text-muted-foreground" 
                  pointerEvents="none"
                />
              </View>
            </TextField>
          )}

          {/* STEP 2: Verify OTP */}
          {mode === "verify_otp" && (
            <View className="gap-4">
              <TextField isRequired>
                <Label>6-Digit Verification Code</Label>
                <View className="w-full justify-center">
                  <Input 
                    value={otp}
                    onChangeText={setOtp}
                    placeholder="123456" 
                    keyboardType="number-pad"
                    maxLength={6}
                    className="tracking-widest text-center text-lg font-bold"
                  />
                </View>
              </TextField>

              <View className="flex-row justify-between items-center px-1">
                <Pressable onPress={() => setMode("enter_identifier")}>
                  <Text className="text-sm text-muted-foreground underline">Change Identifier</Text>
                </Pressable>

                <Pressable 
                  onPress={handleRequestOtp} 
                  disabled={isLoading || timer > 0}
                >
                  <Text className={`text-sm font-medium ${timer > 0 || isLoading ? "text-muted-foreground" : "text-primary underline"}`}>
                    {isLoading ? "Sending..." : timer > 0 ? `Resend in ${timer}s` : "Resend Code"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* STEP 3: Reset Password */}
          {mode === "reset_password" && (
            <View className="gap-4">
              <TextField isRequired>
                <Label>New Password</Label>
                <View className="w-full justify-center">
                  <Input 
                    value={newPassword}
                    onChangeText={setNewPassword}
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

              <TextField isRequired>
                <Label>Confirm New Password</Label>
                <View className="w-full justify-center">
                  <Input 
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••••••••" 
                    secureTextEntry={!isConfirmPasswordVisible}
                    className="pr-12"
                  />
                  <Pressable 
                    className="absolute right-4"
                    onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}
                  >
                    <StyledIonicons 
                      name={isConfirmPasswordVisible ? "eye-outline" : "eye-off-outline"} 
                      size={20} 
                      className="text-muted-foreground" 
                    />
                  </Pressable>
                </View>
              </TextField>
            </View>
          )}
        </View>

        {/* Bottom Action Button */}
        <View className="mt-8 gap-4">
          {mode === "enter_identifier" && (
            <Button 
              onPress={handleRequestOtp} 
              isDisabled={isLoading || !identifier.trim()}
              className="w-full"
            >
              {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text className="font-semibold text-primary-foreground">Send Verification Code</Text>}
            </Button>
          )}

          {mode === "verify_otp" && (
            <Button 
              onPress={handleProceedToReset} 
              isDisabled={otp.length < 6}
              className="w-full"
            >
              <Text className="font-semibold text-primary-foreground">Verify & Continue</Text>
            </Button>
          )}

          {mode === "reset_password" && (
            <Button 
              onPress={handleResetPassword} 
              isDisabled={isLoading || !newPassword || newPassword.length < 6}
              className="w-full"
            >
              {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text className="font-semibold text-primary-foreground">Reset Password</Text>}
            </Button>
          )}

          {mode === "success" && (
            <Button 
              onPress={() => router.replace("/(auth)/login")} 
              className="w-full"
            >
              <Text className="font-semibold text-primary-foreground">Return to Login</Text>
            </Button>
          )}

          {mode !== "success" && (
            <Pressable onPress={() => router.replace("/(auth)/login")} className="items-center py-2">
              <Text className="text-sm text-muted-foreground">
                Remember your password? <Text className="text-primary font-medium underline">Log In</Text>
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
