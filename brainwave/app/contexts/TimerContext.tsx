import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import * as Haptics from "expo-haptics";
import { useAlert } from "./AlertContext";
import { useAuth } from "./AuthContext";
import { LocalDB } from "../database/localDb";
import { AppState } from "react-native";
import { backgroundSync } from "@/utils/backgroundSync";

const TimerContext = createContext<any>(null);

export const TimerProvider = ({ children }: { children: React.ReactNode }) => {
  const { showAlert } = useAlert();
  const { user } = useAuth();
  // Derive initial duration from user preferences
  const getInitialMinutes = useCallback(() => {
    const pref = user?.studyPreferences?.preferredSessionLength;
    if (pref === "short") return 25;
    if (pref === "medium") return 45;
    if (pref === "long") return 90;
    return 25; // default
  }, [user]);

  const [minutes, setMinutes] = useState(getInitialMinutes());
  const [seconds, setSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(getInitialMinutes() * 60); // Total duration
  const [isRunning, setIsRunning] = useState(false);
  const [isKeepAwake, setIsKeepAwake] = useState(false); // Screen always on
  const intervalRef = useRef<any>(null);
  const expectedEndTimeRef = useRef<number | null>(null);

  // Update initial minutes if user preferences load/change while not running
  useEffect(() => {
    if (!isRunning) {
      const newMins = getInitialMinutes();
      setMinutes(newMins);
      setTotalSeconds(newMins * 60);
    }
  }, [getInitialMinutes, isRunning]);

  // Derived value for the progress ring: (Current Seconds / Total Seconds)
  const timeLeftInSeconds = minutes * 60 + seconds;
  const progress = totalSeconds > 0 ? timeLeftInSeconds / totalSeconds : 0;

  const [selectedModules, setSelectedModules] = useState<string | null>(null);

  const syncTimer = () => {
    if (!isRunning || !expectedEndTimeRef.current) return;
    const remainingMs = expectedEndTimeRef.current - Date.now();
    const totalSecsLeft = Math.ceil(remainingMs / 1000);

    if (totalSecsLeft <= 0) {
      setIsRunning(false);
      setMinutes(Math.floor(totalSeconds / 60));
      setSeconds(0);
      expectedEndTimeRef.current = null;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const studyMins = Math.round(totalSeconds / 60);
      const today = new Date().toISOString().split("T")[0];

      if (user?.id) {
        // Log locally for streaks/charts
        LocalDB.logStudyTime(user.id, today, studyMins, selectedModules ?? undefined);
        backgroundSync(user.id);
      }

      showAlert({
        title: "Session Complete!",
        message: `Nice work! You focused for ${studyMins} minutes.`,
        confirmText: "LFG!",
      });
    } else {
      setMinutes(Math.floor(totalSecsLeft / 60));
      setSeconds(totalSecsLeft % 60);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        syncTimer();
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  useEffect(() => {
    if (isRunning) {
      if (!expectedEndTimeRef.current) {
        expectedEndTimeRef.current =
          Date.now() + (minutes * 60 + seconds) * 1000;
      }

      intervalRef.current = setInterval(() => {
        syncTimer();
      }, 1000);
    } else {
      //expectedEndTimeRef.current = null;
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, showAlert]);

  const setDuration = (mins: number) => {
    if (isRunning) return;
    const total = mins * 60;
    setTotalSeconds(total);
    setMinutes(mins);
    setSeconds(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const startSession = (mins: number) => {
    const total = mins * 60;
    setTotalSeconds(total);
    setMinutes(mins);
    setSeconds(0);
    setIsRunning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const resetTimer = () => {
    setIsRunning(false);
    // Reset to the beginning of the CURRENTLY set totalSeconds
    setMinutes(Math.floor(totalSeconds / 60));
    setSeconds(totalSeconds % 60);
    expectedEndTimeRef.current = null;
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  return (
    <TimerContext.Provider
      value={{
        minutes,
        seconds,
        setMinutes,
        setSeconds,
        progress,
        isRunning,
        setIsRunning,
        isKeepAwake,
        setIsKeepAwake,
        resetTimer,
        startSession,
        setDuration,
        totalSeconds,
        selectedModules,
        setSelectedModules,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => useContext(TimerContext);
