import React, { useState, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../../firebaseConfig"; // Adjust path
import { useAuth } from "../contexts/AuthContexts";
import { useTheme } from "../contexts/ThemeContexts";
import { FontAwesome5 } from "@expo/vector-icons";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const params = useLocalSearchParams();
  const [isLogin, setIsLogin] = useState(params.mode !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const validatePassword = (pass: string) => {
    const minLength = pass.length >= 6;
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);

    return minLength && hasUpper && hasLower && hasNumber && hasSpecial;
  };
  const [name, setName] = useState("");

  const { login, signup, isLoading } = useAuth();
  const { theme } = useTheme();

  // --- Google Auth Logic ---
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
    redirectUri: AuthSession.makeRedirectUri({
      native: "com.username0.brainwave:/oauth2redirect/google",
    }),
  });

  useEffect(() => {
    setEmail("");
    setPassword("");
    setName("");
  }, [isLogin]);

  useEffect(() => {
    setEmail("");
    setPassword("");
    setName("");
  }, []);

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).catch((err) =>
        console.error("Google login failed:", err)
      );
    }
  }, [response]);

  useEffect(() => {
    if (params.mode === "signup") {
      setIsLogin(false);
    } else if (params.mode === "signin") {
      setIsLogin(true);
    }
  }, [params.mode]);

  const handleAuth = async () => {
    if (!isLogin && !validatePassword(password)) {
      alert(
        "Password must be at least 6 characters long and include uppercase, lowercase, number, and special character."
      );
      return;
    }

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (!name) {
          alert("Please enter your name");
          return;
        }
        await signup({ name, email, password });
      }
    } catch (error: any) {
      alert("Authentication error: " + error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          {isLogin ? "Welcome back!" : "Join BrAInwave"}
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

        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword} // This toggles the dots
            style={[
              styles.input,
              styles.passwordInput, // Add this to ensure padding for the icon
              {
                borderColor: theme.colors.border,
                color: theme.colors.text.primary,
              },
            ]}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            <FontAwesome5
              name={showPassword ? "eye-slash" : "eye"}
              size={16}
              color={theme.colors.text.secondary}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleAuth}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isLogin ? "Sign In" : "Sign Up"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Google Button */}
        <TouchableOpacity
          style={[styles.googleButton, { borderColor: theme.colors.primary }]}
          onPress={() => promptAsync()}
          disabled={!request}
        >
          <FontAwesome5
            name="google"
            size={18}
            color={theme.colors.primary}
            style={{ marginRight: 10 }}
          />

          <Text style={{ color: theme.colors.primary, fontWeight: "bold" }}>
            Sign {isLogin ? "in" : "up"} with Google
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
  passwordContainer: {
    position: "relative",
    width: "100%",
    marginBottom: 16,
  },
  passwordInput: {
    marginBottom: 0, // Reset margin because it's now on the container
    paddingRight: 50, // Create space so text doesn't go under the eye
  },
  eyeIcon: {
    position: "absolute",
    right: 15,
    top: 7, // Adjust based on your input height/padding
    height: "75%",
    justifyContent: "center",
  },
  button: { padding: 16, borderRadius: 12, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  googleButton: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    borderWidth: 1,
  },
  toggle: { marginTop: 24, alignItems: "center" },
});
