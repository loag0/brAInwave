import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

const Skeleton = ({ width, height, borderRadius = 8, style }: any) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: "rgba(0,0,0,0.12)", // Subtle gray
          opacity,
        },
        style,
      ]}
    />
  );
};

export default Skeleton