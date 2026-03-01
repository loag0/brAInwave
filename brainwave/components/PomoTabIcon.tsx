import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTimer } from "../app/contexts/TimerContext";
import { useTheme } from "@/app/contexts/ThemeContext";

export const PomoTabIcon = ({ color, focused, size = 20 }: any) => {
  const { isRunning, progress } = useTimer();
  const { theme } = useTheme();

  // Constants for the Progress Circle
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  if (!isRunning) {
    // Google "Circle Circle" Icon (Idle State)
    return (
      <Svg width={24} height={24} viewBox="0 -960 960 960">
        <Path
          d="M480-260q-91 0-155.5-64.5T260-480q0-91 64.5-155.5T480-700q91 0 155.5 64.5T700-480q0 91-64.5 155.5T480-260Zm0-60q66 0 113-47t47-113q0-66-47-113t-113-47q-66 0-113 47t-47 113q0 66 47 113t113 47ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"
          fill={color}
        />
      </Svg>
    );
  }

  // Active Countdown State
  return (
    <View
      style={{
        width: size,
        height: size,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={focused ? "rgba(0,0,0,0.1)" : "transparent"}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.primary}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={(circumference * (1 - progress))}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
};
