import React, { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { useAuth } from "../app/contexts/AuthContexts";
import { useTheme } from "../app/contexts/ThemeContexts";
import AppText from "./AppText";

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const { login } = useAuth();
  const { theme } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Google Auth
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .then((userCredential) => {
          console.log("Logged in user:", userCredential.user);
        })
        .catch((err) => console.error("Google login failed:", err));
    }
  }, [response]);

  const handleEmailLogin = async () => {
    try {
      await login(email, password);
    } catch (err) {
      console.error("Email login failed:", err);
    }
  };

  const handleGoogleSignIn = () => {
    promptAsync();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.content}>
        <Image
          source={require("../assets/images/react-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <AppText style={[styles.title, { color: theme.colors.text.primary }]}>
          Welcome
        </AppText>
        <AppText
          style={[styles.subtitle, { color: theme.colors.text.secondary }]}
        >
          Sign in to continue
        </AppText>

        {/* Email input */}
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={[
            styles.input,
            {
              borderColor: theme.colors.primary,
              color: theme.colors.text.primary,
            },
          ]}
          autoCapitalize="none"
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={[
            styles.input,
            {
              borderColor: theme.colors.primary,
              color: theme.colors.text.primary,
            },
          ]}
        />
        <TouchableOpacity
          style={[
            styles.loginButton,
            { backgroundColor: theme.colors.primary },
          ]}
          onPress={handleEmailLogin}
        >
          <AppText
            style={[styles.loginButtonText, { color: theme.colors.background }]}
          >
            Sign in
          </AppText>
        </TouchableOpacity>

        {/* Google login */}
        <TouchableOpacity
          style={[styles.googleButton, { borderColor: theme.colors.primary }]}
          onPress={handleGoogleSignIn}
        >
          <AppText
            style={[styles.googleButtonText, { color: theme.colors.primary }]}
          >
            Sign in with Google
          </AppText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  logo: { width: 120, height: 120, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  input: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  loginButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
  },
  loginButtonText: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  googleButtonText: { fontSize: 16, fontWeight: "600" },
});
