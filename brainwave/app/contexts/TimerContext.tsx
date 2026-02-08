import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import * as Haptics from "expo-haptics";
import { useAlert } from "./AlertContext";

const TimerContext = createContext<any>(null);

export const TimerProvider = ({ children }: { children: React.ReactNode }) => {
  const { showAlert } = useAlert();
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(25 * 60); // Total duration
  const [isRunning, setIsRunning] = useState(false);
  const [isKeepAwake, setIsKeepAwake] = useState(false); // Screen always on
  const intervalRef = useRef<any>(null);

  // Derived value for the progress ring: (Current Seconds / Total Seconds)
  const timeLeftInSeconds = minutes * 60 + seconds;
  const progress = totalSeconds > 0 ? timeLeftInSeconds / totalSeconds : 0;

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev === 0) {
            if (minutes === 0) {
              setIsRunning(false);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              showAlert({
                title: "Session Complete! 🏆",
                message: "You earned 25 XP.",
                confirmText: "LFG!",
              });
              return 0;
            }
            setMinutes((m) => m - 1);
            return 59;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [showAlert, isRunning, minutes]);

  const startSession = (mins: number) => {
    const total = mins * 60;
    setTotalSeconds(total);
    setMinutes(mins);
    setSeconds(0);
    setIsRunning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  useEffect(() => {
    if(!isRunning){
      setTotalSeconds(minutes * 60 + seconds);
    }
  }, [minutes, seconds, isRunning])

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
        totalSeconds
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => useContext(TimerContext);
