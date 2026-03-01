import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import * as Haptics from "expo-haptics";
import { useAlert } from "./AlertContext";
import { AppState } from "react-native";

const TimerContext = createContext<any>(null);

export const TimerProvider = ({ children }: { children: React.ReactNode }) => {
  const { showAlert } = useAlert();
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(25 * 60); // Total duration
  const [isRunning, setIsRunning] = useState(false);
  const [isKeepAwake, setIsKeepAwake] = useState(false); // Screen always on
  const intervalRef = useRef<any>(null);
  const expectedEndTimeRef = useRef<number | null>(null);

  // Derived value for the progress ring: (Current Seconds / Total Seconds)
  const timeLeftInSeconds = minutes * 60 + seconds;
  const progress = totalSeconds > 0 ? timeLeftInSeconds / totalSeconds : 0;

  const syncTimer = () => {
    if (!isRunning || !expectedEndTimeRef.current) return;
    const remainingMs = expectedEndTimeRef.current - Date.now();
    const totalSecsLeft = Math.ceil(remainingMs / 1000);

    if (totalSecsLeft <= 0) {
      setIsRunning(false);
      setMinutes(0);
      setSeconds(0);
      expectedEndTimeRef.current = null;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({
        title: "Session Complete! 🏆",
        message: "You earned 25 XP.",
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
      expectedEndTimeRef.current = null;
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, showAlert]);

  const startSession = (mins: number) => {
    const total = mins * 60;
    setTotalSeconds(total);
    setMinutes(mins);
    setSeconds(0);
    setIsRunning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  useEffect(() => {
    if (!isRunning) {
      setTotalSeconds(minutes * 60 + seconds);
    }
  }, [minutes, seconds, isRunning]);

  const resetTimer = () => {
    setIsRunning(false);
    setMinutes(25);
    setSeconds(0);
    setTotalSeconds(25 * 60);
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
        totalSeconds,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => useContext(TimerContext);
