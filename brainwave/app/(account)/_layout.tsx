import { Stack } from "expo-router";
import { useTheme } from "../contexts/ThemeContexts";

export default function AccountLayout() {
    const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true, // Show it here instead
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text.primary,
        headerTitleStyle: { fontWeight: "bold" },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="profile" options={{ title: "Account Details" }} />
      <Stack.Screen name="mfa-setup" options={{ title: "2FA Authentication" }} />
    </Stack>
  );
}
