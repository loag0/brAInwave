import { Text, TextProps, StyleSheet } from "react-native";

const FONT_FAMILY_BY_WEIGHT: { [key in "400" | "500" | "600" | "700" | "normal" | "bold"]: string } = {
  "400": "Inter_400Regular",
  "500": "Inter_500Medium",
  "600": "Inter_600SemiBold",
  "700": "Inter_700Bold",
  normal: "Inter_400Regular",
  bold: "Inter_700Bold",
};

export default function AppText(props: TextProps) {
  // Get the weight from the style (default to 400)
  let fontWeight: keyof typeof FONT_FAMILY_BY_WEIGHT = "400";
  if (props.style) {
    const flat = StyleSheet.flatten(props.style);
    if (flat && flat.fontWeight) {
      fontWeight = flat.fontWeight.toString() as keyof typeof FONT_FAMILY_BY_WEIGHT;
    }
  }

  const fontFamily = FONT_FAMILY_BY_WEIGHT[fontWeight] || "Inter_400Regular";

  // Remove fontWeight so the fallback doesn’t confuse the renderer
  let { style, ...rest } = props;
  if (style) {
    const { fontWeight, ...restStyle } = StyleSheet.flatten(style);
    style = restStyle;
  }

  return (
    <Text {...rest} style={[{ fontFamily }, style]}>
      {props.children}
    </Text>
  );
}
