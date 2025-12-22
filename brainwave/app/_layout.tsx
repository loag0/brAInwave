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
    if (isLoading || !fontsLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboardingGroup = segments[0] === "(onboarding)";

    if (!user) {
      if (!inAuthGroup) {
        router.replace("/(auth)/login");
      }
    } else {
      // Check if user has finished setup
      const hasFinishedSetup = user.studyPreferences.subjects.length > 0;

      if (!hasFinishedSetup) {
        if (!inOnboardingGroup) {
          router.replace("/(onboarding)/goals");
        }
      } else {
        // If finished, and currently in auth or onboarding, go to main app
        if (inAuthGroup || inOnboardingGroup) {
          router.replace("/(tabs)");
        }
      }
    } // <--- Added the missing closing brace for 'else' here!
  }, [user, isLoading, segments, fontsLoaded]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}