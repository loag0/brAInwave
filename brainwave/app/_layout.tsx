import { useEffect } from "react";
import {
  Stack,
  //Slot,
  useRouter,
  useSegments,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { useKeepAwake } from "expo-keep-awake";
import Toast from "react-native-toast-message";
import { AlertProvider } from "./contexts/AlertContext";
import { TimerProvider } from "./contexts/TimerContext";
import { PomodoroModal } from "@/components/PomodoroModal";

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
      <AlertProvider>
        <TimerProvider>
          <AuthProvider>
            <NavigationHandler fontsLoaded={fontsLoaded} />
            <PomodoroModal/>
            <Toast />
          </AuthProvider>
        </TimerProvider>
      </AlertProvider>
    </ThemeProvider>
  );
}

function NavigationHandler({ fontsLoaded }: { fontsLoaded: boolean }) {
  useKeepAwake();
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { isDark, isThemeLoading } = useTheme();

  useEffect(() => {
    if (fontsLoaded && !isLoading && !isThemeLoading) {
      setTimeout(() => {
        SplashScreen.hideAsync();
      }, 100);
    }
  }, [fontsLoaded, isLoading, isThemeLoading]);

  useEffect(() => {
    if (isLoading || !fontsLoaded) return;

    const currentGroup = segments[0];
    const currentScreen = segments[1];
    const isRedirecting = currentGroup === "oauth2redirect";

    if (user) {
      if (!user.hasFinishedSetup) {
        // Force to onboarding
        if (currentGroup !== "(onboarding)" && !isRedirecting) {
          router.replace("/(onboarding)/goals");
        }
      } else {
        if (
          currentGroup === "(auth)" ||
          currentGroup === "(onboarding)" ||
          isRedirecting ||
          !currentGroup // Handles the root index reload
        ) {
          router.replace("/(tabs)");
        }
      }
    } else if (!currentScreen || currentScreen === "welcome") {
      router.replace("/(auth)/welcome");
    } else {
      // Not logged in: only allow (auth) and redirect
      if (currentGroup !== "(auth)" && !isRedirecting) {
        router.replace("/(auth)/welcome");
      }
    }
  }, [user, isLoading, segments, fontsLoaded]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        {/* We list these to define animations/presentations, NOT to 'create' the routes */}
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen
          name="(onboarding)"
          options={{ gestureEnabled: false, animation: "slide_from_right" }}
        />
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
        <Stack.Screen
          name="(account)"
          options={{
            headerShown: false,
            presentation: "card",
            animation: "slide_from_right",
          }}
        />
        {/* Keep this hidden as it's just a logic handler */}
        <Stack.Screen
          name="oauth2redirect/google"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="priorities" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
