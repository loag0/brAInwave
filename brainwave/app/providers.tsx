import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AlertProvider } from "./contexts/AlertContext";
import { TimerProvider } from "./contexts/TimerContext";
import { DatePickerProvider } from "./contexts/DatePickerContext";
import Toast from "react-native-toast-message";

export const Providers = ({ children }: { children: React.ReactNode }) => (
  <GestureHandlerRootView>
    <ThemeProvider>
      <AuthProvider>
        <AlertProvider>
          <TimerProvider>
            <DatePickerProvider>
              {children}
              <Toast />
            </DatePickerProvider>
          </TimerProvider>
        </AlertProvider>
      </AuthProvider>
    </ThemeProvider>
  </GestureHandlerRootView>
);