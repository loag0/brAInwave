import React, { createContext, useContext, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Theme } from "../types";

const lightTheme: Theme = {
  colors: {
    primary: "#4772fa",
    secondary: "#f5f5f5",
    background: "#ffffff",
    surface: "#f8f9fa",
    text: {
      primary: "#1a1a1a",
      secondary: "#666666",
      accent: "#667eea",
    },
    border: "#e1e5e9",
    success: "#34c759",
    warning: "#ff9500",
    error: "#ff3b30",
  },
  fonts: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semiBold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
};

const darkTheme: Theme = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    background: "#1a1a1a",
    surface: "#2d2d2d",
    text: {
      primary: "#ffffff",
      secondary: "#cccccc",
      accent: "#667eea",
    },
    border: "#404040",
  },
};

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  const theme = isDark ? darkTheme : lightTheme;

  const toggleTheme = async () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    await AsyncStorage.setItem("isDarkMode", JSON.stringify(newTheme));
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
