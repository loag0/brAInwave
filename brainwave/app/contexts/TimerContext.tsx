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
  const [isRunning, setIsRunning] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
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
  }, [isRunning, minutes]);

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

  const resetTimer = () => {
    setIsRunning(false);
    setMinutes(25);
    setSeconds(0);
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
        isRunning,
        toggleTimer,
        resetTimer,
        isModalVisible,
        setIsModalVisible,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => useContext(TimerContext);
