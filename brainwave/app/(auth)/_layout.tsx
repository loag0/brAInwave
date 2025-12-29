import { Stack } from "expo-router";
import { useTheme } from "../contexts/ThemeContext";

export default function AuthLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false, // Clean look for onboarding
        contentStyle: { backgroundColor: theme.colors.background },
        animation: "slide_from_right", // Native feel
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
    </Stack>
  );
}
