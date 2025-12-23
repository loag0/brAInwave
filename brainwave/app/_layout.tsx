import { useEffect } from "react";
import { Stack, 
  //Slot, 
  useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { AuthProvider, useAuth } from "./contexts/AuthContexts";
import { ThemeProvider, useTheme } from "./contexts/ThemeContexts";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationHandler fontsLoaded={fontsLoaded} />
      </AuthProvider>
    </ThemeProvider>
  );
}

function NavigationHandler({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { isDark } = useTheme();

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  useEffect(() => {
    // 1. Wait until everything is ready
    if (isLoading || !fontsLoaded) return;

    // 2. Identify current location
    const currentGroup = segments[0];
    const isRedirecting = currentGroup === "oauth2redirect";

    // 3. Navigation Logic
    if (user) {
      if (!user.hasFinishedSetup) {
        // If logged in but setup not done, force to onboarding
        if (currentGroup !== "(onboarding)" && !isRedirecting) {
          router.replace("/(onboarding)/goals");
        }
      } else {
        // If setup IS done, and they are in auth/onboarding/redirect, send to tabs
        if (
          currentGroup === "(auth)" ||
          currentGroup === "(onboarding)" ||
          isRedirecting
        ) {
          router.replace("/(tabs)");
        }
      }
    } else {
      // If NOT logged in, and not already in auth or redirect, send to login
      if (currentGroup !== "(auth)" && !isRedirecting) {
        router.replace("/(auth)/login");
      }
    }
  }, [user, isLoading, segments, fontsLoaded]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Remove the Stack.Screen declarations completely */}
        {/* Expo Router will automatically handle routes based on file structure */}
      </Stack>
    </>
  );
}