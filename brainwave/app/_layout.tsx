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
    // Wait for everything to load
    if (isLoading || !fontsLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboardingGroup = segments[0] === "(onboarding)";
    const inTabsGroup = segments[0] === "(tabs)";

    if (!user) {
      // 1. Not Logged In: Only allow (auth)
      if (!inAuthGroup) {
        router.replace("/(auth)/login");
      }
    } else {
      // 2. Logged In: Determine if Onboarding is complete
      // Best Practice: Use a dedicated boolean flag from Firestore
      const hasFinishedSetup =
        user.hasFinishedSetup || user.studyPreferences.subjects.length > 0;

      if (!hasFinishedSetup) {
        // Force onboarding if not finished
        if (!inOnboardingGroup) {
          router.replace("/(onboarding)/goals");
        }
      } else {
        // 3. Fully Logged In & Setup: Only allow (tabs)
        if (inAuthGroup || inOnboardingGroup || !inTabsGroup) {
          router.replace("/(tabs)");
        }
      }
    }
  }, [user, isLoading, segments, fontsLoaded]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Defining the screens here helps with gesture handling and transitions */}
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen
          name="(onboarding)"
          options={{ gestureEnabled: false, animation: "slide_from_right" }}
        />
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
      </Stack>
    </>
  );
}