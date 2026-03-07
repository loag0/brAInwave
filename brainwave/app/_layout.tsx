import { useEffect, useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useKeepAwake } from "expo-keep-awake";
import Toast from "react-native-toast-message";
import { AlertProvider } from "./contexts/AlertContext";
import { TimerProvider } from "./contexts/TimerContext";
import { LocalDB } from "./database/localDb";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return (
    <GestureHandlerRootView>
      <ThemeProvider>
        <AuthProvider>
          <AlertProvider>
            <TimerProvider>
              <NavigationHandler fontsLoaded={fontsLoaded} />
              <Toast />
            </TimerProvider>
          </AlertProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function NavigationHandler({ fontsLoaded }: { fontsLoaded: boolean }) {
  useKeepAwake();
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { theme, isDark, isThemeLoading } = useTheme();
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);

  useEffect(() => {
    if (fontsLoaded && !isLoading && !isThemeLoading) {
      setTimeout(() => {
        SplashScreen.hideAsync();
      }, 100);
    }
  }, [fontsLoaded, isLoading, isThemeLoading]);

  useEffect(() => {
    AsyncStorage.getItem("hasSeenWelcome").then((val) => {
      setHasSeenWelcome(val === "true");
    });
  }, []);

  useEffect(() => {
    const currentGroup = segments[0] as string | undefined;
    if (currentGroup === "oauth2redirect") return;

    const timeout = setTimeout(() => {
      if(user){
        if(!user.hasFinishedSetup) {
          router.replace("/(onboarding)");
        } else{
          router.replace("/(tabs)");
        }
      } else{
        router.replace("/(auth)/login");
      }
    }, 4000);

    return () => clearTimeout(timeout);
  }, [segments, user, router]);

  useEffect(() => {
    if (isLoading || !fontsLoaded || hasSeenWelcome === null) return;

    //initializes the db tables
    LocalDB.init();

    const currentGroup = segments[0] as string | undefined;
    const isRedirecting = currentGroup === "oauth2redirect";

    if (user) {
      if(isRedirecting) return; //while on oauth2redirect, don't redirect to avoid navigation conflicts

      if (!user.hasFinishedSetup) {
        // Force to onboarding
        if (currentGroup !== "(onboarding)") {
          router.replace("/(onboarding)");
        }
      } else {
        if (
          currentGroup === "(auth)" ||
          currentGroup === "(onboarding)" ||
          !currentGroup // Handles the root index reload
        ) {
          router.replace("/(tabs)");
        }
      }
    } else {
      if(isRedirecting) return;

      if(!hasSeenWelcome){
        router.replace("/(auth)/welcome");
        AsyncStorage.setItem("hasSeenWelcome", "true").then(() => setHasSeenWelcome(true));
      } else{
      // Not logged in: only allow (auth) and redirect
      if (currentGroup !== "(auth)") {
        router.replace("/(auth)/login");
      }}
    }
  }, [user, isLoading, hasSeenWelcome, segments, fontsLoaded, router]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
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
        <Stack.Screen
          name="priorities"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.text.primary,
            headerTitleStyle: { fontWeight: "bold" },
            headerShadowVisible: false,
            title: "AI Priorities",
          }}
        />
        <Stack.Screen
          name="material/[id]"
          options={{
            headerShown: true, // Show header so user can go back
            title: "Study Plan",
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.text.primary,
            headerTitleStyle: { fontFamily: theme.fonts.bold },
            headerShadowVisible: false,
            animation: "slide_from_bottom",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="assignment/[id]"
          options={{
            headerShown: true, // Show header so user can go back
            title: "Assignment Plan",
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.text.primary,
            headerTitleStyle: { fontFamily: theme.fonts.bold },
            headerShadowVisible: false,
            animation: "slide_from_bottom",
            presentation: "card",
          }}
        />
      </Stack>
    </>
  );
}
