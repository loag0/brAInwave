import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons"; // Correct for Native
import { useRouter } from "expo-router";
import { useTheme } from "../contexts/ThemeContexts";

export default function Welcome() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Logo Section */}
        <View style={styles.header}>
          <View
            style={[
              styles.logoBox,
              { backgroundColor: theme.colors.text.primary },
            ]}
          >
            <FontAwesome5
              name="brain"
              size={40}
              color={theme.colors.background}
            />
          </View>
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>
            Welcome to brAInwave
          </Text>
          <Text
            style={[styles.subtitle, { color: theme.colors.text.secondary }]}
          >
            Your AI-powered study companion that adapts to your learning style
            and helps you achieve your goals
          </Text>
        </View>

        {/* Features Section */}
        <View style={styles.featuresContainer}>
          <FeatureItem
            icon="calendar-alt"
            title="Smart scheduling"
            desc="Manage classes and assignments effortlessly"
            theme={theme}
          />
          <FeatureItem
            icon="bullseye"
            title="Personalized plans"
            desc="AI-generated study plans tailored to you"
            theme={theme}
          />
          <FeatureItem
            icon="chart-line"
            title="Track progress"
            desc="Visualize your growth and stay motivated"
            theme={theme}
          />
        </View>

        {/* Buttons Section */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/(auth)/login", params: { mode: "signup" } })}
            style={[
              styles.primaryBtn,
              { backgroundColor: theme.colors.primary },
            ]}
          >
            <Text style={styles.primaryBtnText}>Get started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push({ pathname: "/(auth)/login", params: { mode: "signin" } })}
            style={styles.secondaryBtn}
          >
            <Text
              style={[
                styles.secondaryBtnText,
                { color: theme.colors.text.secondary },
              ]}
            >
              I already have an account
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Reusable Feature Component to keep it clean
const FeatureItem = ({ icon, title, desc, theme }: any) => (
  <View style={styles.featureRow}>
    <View style={styles.iconCircle}>
      <FontAwesome5 name={icon} size={18} color={theme.colors.text.primary} />
    </View>
    <View style={styles.featureTextCol}>
      <Text style={[styles.featureTitle, { color: theme.colors.text.primary }]}>
        {title}
      </Text>
      <Text
        style={[styles.featureDesc, { color: theme.colors.text.secondary }]}
      >
        {desc}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, flexGrow: 1, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 40 },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 12
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  featuresContainer: { gap: 24, marginBottom: 40 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  featureTextCol: { flex: 1 },
  featureTitle: {
    fontWeight: "600",
    fontSize: 16,
    marginBottom: 2,
  },
  featureDesc: { fontSize: 13},
  footer: { gap: 12 },
  primaryBtn: { padding: 16, borderRadius: 12, alignItems: "center" },
  primaryBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 18,
    paddingHorizontal: 20
  },
  secondaryBtn: { padding: 12, alignItems: "center" },
  secondaryBtnText: { fontWeight: "500", paddingHorizontal: 20 }
});
