import { View, ScrollView, Pressable } from "react-native";
import { useState } from "react";
import type { JSX } from "react";
import { Text, TextField, Label, Input, Button, Checkbox } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

export default function SignupScreen(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleSignup = () => {
    // In a real app, perform auth here.
    router.replace("/(tabs)");
  };

  return (
    <ScrollView 
      className="flex-1 bg-background"
      contentContainerClassName="p-6 pt-24 pb-12"
    >
      {/* Logo & Header */}
      <View className="items-center mb-10">
        <View className="flex-row items-center justify-center gap-3 mb-4">
          <View className="bg-primary h-14 w-14 rounded-2xl items-center justify-center">
            <StyledIonicons name="body" size={32} color="white" />
          </View>
          <Text className="text-primary font-bold text-4xl tracking-tight">bms</Text>
        </View>
        <Text className="text-foreground font-medium text-center">
          Welcome back. Let's check on your journey.
        </Text>
      </View>

      <Text className="text-3xl font-bold text-foreground mb-8">Create an account</Text>

      {/* Form Fields */}
      <View className="gap-6 mb-8">
        <TextField isRequired>
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

        <TextField isRequired>
          <Label>Phone Number</Label>
          <View className="w-full flex-row items-center bg-surface border border-border rounded-xl px-4 h-12">
            <Pressable className="flex-row items-center gap-1 border-r border-border pr-3 mr-3 h-full">
              <Text className="text-foreground">+63</Text>
              <StyledIonicons name="chevron-down" size={16} className="text-muted-foreground" />
            </Pressable>
            <Input 
              value={phone}
              onChangeText={setPhone}
              placeholder="912 345 6789"
              keyboardType="phone-pad"
              className="flex-1 px-0 border-0 bg-transparent h-full"
            />
          </View>
        </TextField>

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

      <Button variant="primary" onPress={handleSignup} className="mb-8" isDisabled={!agreed}>
        <View className="flex-row items-center justify-center gap-2">
          <StyledIonicons name="arrow-forward" size={20} color="white" />
          <Button.Label>Get Started</Button.Label>
        </View>
      </Button>

      <View className="flex-row justify-center items-center">
        <Text className="text-foreground">Already have an account? </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable>
            <Text className="text-primary font-medium underline">Login in</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}
