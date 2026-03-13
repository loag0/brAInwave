import { useEffect, useRef, useState } from "react";
import {
  Stack,
  //Slot,
  useRouter,
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
  const router = useRouter();
  const { theme, isDark, isThemeLoading } = useTheme();
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);

  // Ref to track if we've already navigated to prevent multiple redirects
  const hasNavigated = useRef(false);
  const prevUserRef = useRef<any>(undefined);

  useEffect(() => {
    AsyncStorage.getItem("hasSeenWelcome").then((val) => {
      setHasSeenWelcome(val === "true");
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded && !isLoading && !isThemeLoading) {
      setTimeout(() => SplashScreen.hideAsync(), 100);
    }
  }, [fontsLoaded, isLoading, isThemeLoading]);

  useEffect(() => {
    if (isLoading || !fontsLoaded || isThemeLoading || hasSeenWelcome === null)
      return;

    // Detect any user state transition (login or logout)
    const prevUser = prevUserRef.current;
    const userChanged = prevUser !== undefined && (!!prevUser !== !!user);
    prevUserRef.current = user;

    if (userChanged) hasNavigated.current = false; // Reset on login OR logout

    if (hasNavigated.current) return; // Prevent multiple navigations

    hasNavigated.current = true;

    //initializes the db tables
    LocalDB.init();

    if(user) {
      router.replace(user.hasFinishedSetup ? "/(tabs)" : "/(onboarding)");
    } else{
      if(!hasSeenWelcome){
        AsyncStorage.setItem("hasSeenWelcome", "true");
        setHasSeenWelcome(true);
        router.replace("/(auth)/welcome");
      } else{
        router.replace("/(auth)/login");
      }
    }
  }, [user, isLoading, fontsLoaded, isThemeLoading, hasSeenWelcome, router]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false, animation: "slide_from_right" }}/>
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
        <Stack.Screen name="oauth2redirect/google" options={{ headerShown: false }}/>
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
