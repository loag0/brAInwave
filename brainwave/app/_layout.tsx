import React, { useEffect, useRef, useState, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { useAuth } from "./contexts/AuthContext";
import { useTheme } from "./contexts/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useKeepAwake } from "expo-keep-awake";
import { useAlert } from "./contexts/AlertContext";
import { LocalDB } from "./database/localDb";
import {
  isBatteryOptimizationEnabled,
  requestBatteryOptimizationExemption,
  setupAndroidNotificationChannel,
} from "@/utils/notifications";
import { ICONS } from "@/components/Icons";
import { Providers } from "./providers";
import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";
import * as Updates from "expo-updates";

SplashScreen.preventAutoHideAsync();

const checkForUpdates = async () => {
  try{
    if (__DEV__) {
      console.log("[OTA] Channel:", Updates.channel);
      console.log("[OTA] Update ID:", Updates.updateId ?? "embedded build");
      console.log("[OTA] Is embedded launch:", Updates.isEmbeddedLaunch);
    }

    const update = await Updates.checkForUpdateAsync();
    if (__DEV__) console.log("[OTA] Update available:", update.isAvailable);

    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      if (__DEV__) console.log("[OTA] Update fetched, reloading...");
      await Updates.reloadAsync();
    }
  } catch (e) {
    if (__DEV__) console.error("[OTA] Error checking for updates:", e);
  }
};

checkForUpdates();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Set up Android notification channel once on boot
  useEffect(() => {
    setupAndroidNotificationChannel();
  }, []);

  return (
    <Providers>
      <NavigationHandler fontsLoaded={fontsLoaded} />
    </Providers>
  );
}

function NavigationHandler({ fontsLoaded }: { fontsLoaded: boolean }) {
  useKeepAwake();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { theme, isDark, isThemeLoading } = useTheme();
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);
  const [isOptimized, setIsOptimized] = useState<boolean | null>(null);
  const hasShownBatteryPrompt = useRef(false);
  const { showAlert } = useAlert();

  const appState = useRef(AppState.currentState);

  const checkBatteryStatus = useCallback(async () => {
    const enabled = await isBatteryOptimizationEnabled();
    if (__DEV__) {
      console.log(
        "Battery optimization is: ",
        enabled ? "ENABLED (BAD)" : "DISABLED (GOOD)",
      );
      console.log("hasShownBatteryPrompt:", hasShownBatteryPrompt.current);
    }
    setIsOptimized(enabled);
  }, []);

  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        if (__DEV__)
          console.log("App foregrounded - rechecking battery status");
        await checkBatteryStatus();
      }
      appState.current = nextAppState;
    },
    [checkBatteryStatus],
  );

  // Check battery on mount + re-check whenever app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [handleAppStateChange]);

  // Show battery optimization alert (once a day tho)
  useEffect(() => {
    const checkSnoozeAndShow = async () => {
      if (isOptimized !== true) return;
      if (!user) return;

      const lastPrompt = await AsyncStorage.getItem("lastBatteryPromptTime");
      const now = Date.now();
      if (lastPrompt && now - parseInt(lastPrompt) < 86400000) return;

      await AsyncStorage.setItem("lastBatteryPromptTime", now.toString());

      showAlert({
        title: "Battery Optimization",
        message:
          "To ensure your Pomodoro timer and task reminders ring exactly on time, please disable battery optimization for brAInwave.",
        confirmText: "Fix Now",
        cancelText: "Later",
        showCancel: true,
        iconPath: ICONS.BATTERY,
        iconColor: theme.colors.error,
        onConfirm: () => {
          requestBatteryOptimizationExemption();
        },
      });
    };

    checkSnoozeAndShow();
  }, [isOptimized, user, showAlert, theme.colors.error]);

  const hasNavigated = useRef(false);
  const prevUserRef = useRef<any>(undefined);

  useEffect(() => {
    AsyncStorage.getItem("hasSeenWelcome")
      .then((val) => setHasSeenWelcome(val === "true"))
      .catch(() => setHasSeenWelcome(false));
  }, []);

  // Hide splash as soon as fonts and theme are ready
  useEffect(() => {
    if (fontsLoaded && !isThemeLoading && hasSeenWelcome !== null) {
      setTimeout(() => SplashScreen.hideAsync(), 150);
    }
  }, [fontsLoaded, isThemeLoading, hasSeenWelcome]);

  useEffect(() => {
    if (isLoading || !fontsLoaded || isThemeLoading || hasSeenWelcome === null)
      return;

    // Let oauth2redirect handle its own post-auth navigation
    if (segments[0] === "oauth2redirect") return;

    const prevUser = prevUserRef.current;
    const userChanged = prevUser !== undefined && !!prevUser !== !!user;
    prevUserRef.current = user;

    if (userChanged) hasNavigated.current = false;
    if (hasNavigated.current) return;

    hasNavigated.current = true;
    LocalDB.init();

    if (user) {
      router.replace(user.hasFinishedSetup ? "/(tabs)" : "/(onboarding)");
    } else {
      if (!hasSeenWelcome) {
        AsyncStorage.setItem("hasSeenWelcome", "true");
        setHasSeenWelcome(true);
        router.replace("/(auth)/welcome");
      } else {
        router.replace("/(auth)/login");
      }
    }

    // Show offline toast after the screen is visible
    NetInfo.fetch().then((state) => {
      if (!state.isConnected) {
        setTimeout(() => {
          Toast.show({
            type: "info",
            text1: "You're offline",
            text2: user
              ? "Showing your last synced data."
              : "bro thinks he can sign in while offline im crine 😭😭.",
            visibilityTime: 4000,
          });
        }, 700);
      }
    });
  }, [user, isLoading, fontsLoaded, isThemeLoading, hasSeenWelcome, router, segments]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen
          name="(onboarding)"
          options={{ gestureEnabled: false, animation: "slide_from_right" }}
        />
        <Stack.Screen name="(tabs)" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen
          name="(account)"
          options={{
            headerShown: false,
            presentation: "card",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="oauth2redirect/google"
          options={{ headerShown: false, animation: "none" }}
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
            headerShown: true,
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
            headerShown: true,
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
