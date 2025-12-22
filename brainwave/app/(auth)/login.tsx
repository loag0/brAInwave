import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../../firebaseConfig"; // Adjust path
import { useAuth } from "../contexts/AuthContexts";
import { useTheme } from "../contexts/ThemeContexts";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const { login, signup, isLoading } = useAuth();
  const { theme } = useTheme();

  // --- Google Auth Logic ---
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).catch((err) =>
        console.error("Google login failed:", err)
      );
    }
  }, [response]);

  const handleAuth = async () => {
    if (isLogin) {
      await login(email, password);
    } else {
      await signup({ name, email, password });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          {isLogin ? "Welcome" : "Join BrAInwave"}
        </Text>

        {!isLogin && (
          <TextInput
            placeholder="Name"
            value={name}
            onChangeText={setName}
            style={[
              styles.input,
              {
                borderColor: theme.colors.border,
                color: theme.colors.text.primary,
              },
            ]}
          />
        )}

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          style={[
            styles.input,
            {
              borderColor: theme.colors.border,
              color: theme.colors.text.primary,
            },
          ]}
        />

        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={[
            styles.input,
            {
              borderColor: theme.colors.border,
              color: theme.colors.text.primary,
            },
          ]}
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleAuth}
        >
          <Text style={styles.buttonText}>
            {isLogin ? "Sign In" : "Sign Up"}
          </Text>
        </TouchableOpacity>

        {/* Google Button */}
        <TouchableOpacity
          style={[styles.googleButton, { borderColor: theme.colors.primary }]}
          onPress={() => promptAsync()}
          disabled={!request}
        >
          <Text style={{ color: theme.colors.primary, fontWeight: "bold" }}>
            Sign in with Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setIsLogin(!isLogin)}
          style={styles.toggle}
        >
          <Text style={{ color: theme.colors.text.secondary }}>
            {isLogin ? "Need an account? Sign Up" : "Have an account? Login"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: "center", padding: 24 },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  input: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 16 },
  button: { padding: 16, borderRadius: 12, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  googleButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
  },
  toggle: { marginTop: 24, alignItems: "center" },
});
