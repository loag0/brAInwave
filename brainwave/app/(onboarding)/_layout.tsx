import { Stack } from "expo-router";
import { useTheme } from "../contexts/ThemeContext";

export default function OnboardingLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        gestureEnabled: false,
        animation: "fade_from_bottom",
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
