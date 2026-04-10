import { View, ActivityIndicator } from "react-native";
import { useAuth } from "./contexts/AuthContext";
import { useTheme } from "./contexts/ThemeContext";

export default function Index() {
  const { isLoading } = useAuth();
  const { theme } = useTheme();

  if (!isLoading) return null;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}
