import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

const BrainwaveLoader = ({ theme }: { theme: any }) => {
  const bars = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];

  useEffect(() => {
    const animations = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(bar, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  });

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 48,
      }}
    >
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={{
            width: 5,
            height: 36,
            borderRadius: 4,
            backgroundColor: theme.colors.primary,
            opacity: bar,
            transform: [{ scaleY: bar }],
          }}
        />
      ))}
    </View>
  );
};

export default BrainwaveLoader;