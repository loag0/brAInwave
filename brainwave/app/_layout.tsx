import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { AuthProvider } from "./contexts/AuthContexts";
import { ThemeProvider, useTheme } from "./contexts/ThemeContexts";

export default function RootLayout() { // 'light', 'dark', or null
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return(
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  )

  function ThemedApp() {
    const { isDark } = useTheme();

    return (
      <>
        <StatusBar style={isDark ? "light" : "dark"} />
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
          </Stack>
        </AuthProvider>
      </>
    );
  }
}
