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
  const progress = timeLeftInSeconds / totalSeconds;

  useEffect(() => {
    const handleFinish = () => {
      setIsRunning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({
        title: "Session Complete! 🏆",
        message: "You earned 25 XP. Take a 5-minute break.",
        confirmText: "LFG!",
      });
      resetTimer();
    };

    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev === 0) {
            if (minutes === 0) {
              handleFinish();
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

  const resetTimer = () => {
    setIsRunning(false);
    setMinutes(25);
    setSeconds(0);
    setTotalSeconds(25 * 60);
  };

  const toggleTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRunning(!isRunning);
  };

  return (
    <TimerContext.Provider
      value={{
        minutes,
        seconds,
        progress, // Shared with Nav Bar
        isRunning,
        setIsRunning,
        isKeepAwake,
        setIsKeepAwake,
        toggleTimer,
        resetTimer,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => useContext(TimerContext);
