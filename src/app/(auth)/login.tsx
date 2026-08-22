import { View, ScrollView, Pressable } from "react-native";
import { useState } from "react";
import type { JSX } from "react";
import { Text, TextField, Label, Input, Button } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

export default function LoginScreen(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleLogin = () => {
    // In a real app, perform auth here.
    // For now, redirect to dashboard.
    router.replace("/(tabs)");
  };

  return (
    <ScrollView 
      className="flex-1 bg-background"
      contentContainerClassName="p-6 pt-24"
    >
      {/* Logo & Header */}
      <View className="items-center mb-12">
        <View className="flex-row items-center justify-center gap-3 mb-4">
          <View className="bg-primary h-14 w-14 rounded-2xl items-center justify-center">
            {/* Custom BMS Icon Placeholder */}
            <StyledIonicons name="body" size={32} color="white" />
          </View>
          <Text className="text-primary font-bold text-4xl tracking-tight">bms</Text>
        </View>
        <Text className="text-foreground font-medium text-center">
          Welcome back. Let's check on your journey.
        </Text>
      </View>

      <Text className="text-3xl font-bold text-foreground mb-8">Log in</Text>

      {/* Form Fields */}
      <View className="gap-6 mb-8">
        <TextField>
          <Label>Email</Label>
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

        <TextField>
          <View className="flex-row justify-between w-full items-center">
            <Label>Password</Label>
            <Link href="/" asChild>
              <Pressable>
                <Text className="text-primary font-medium text-sm">Forgot?</Text>
              </Pressable>
            </Link>
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

      <Button variant="primary" onPress={handleLogin} className="mb-8">
        <View className="flex-row items-center justify-center gap-2">
          <StyledIonicons name="arrow-forward" size={20} color="white" />
          <Button.Label>Log In</Button.Label>
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
    </ScrollView>
  );
}
