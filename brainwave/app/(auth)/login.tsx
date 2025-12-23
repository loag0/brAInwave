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
  Alert,
} from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db as firestore } from "../../firebaseConfig";
import { useAuth } from "../contexts/AuthContexts";
import { useTheme } from "../contexts/ThemeContexts";
import { FontAwesome5 } from "@expo/vector-icons";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const params = useLocalSearchParams();
  const [isLogin, setIsLogin] = useState(params.mode !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { login, signup, updateUser, isLoading } = useAuth();
  const { theme } = useTheme();

  // --- Google Auth Configuration ---
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
    redirectUri: AuthSession.makeRedirectUri({
      native: "com.username0.brainwave:/oauth2redirect/google",
    }),
  });

  // Handle Google Auth Response
  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);

      const handleGoogleFirebaseSync = async () => {
        try {
          const userCredential = await signInWithCredential(auth, credential);
          const firebaseUser = userCredential.user;

          // Check if this Google user already has a Firestore profile
          const userDocRef = doc(firestore, "users", firebaseUser.uid);
          const userSnap = await getDoc(userDocRef);

          if (!userSnap.exists()) {
            // New Google User: Create their profile
            const newProfile = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || "User",
              email: firebaseUser.email || "",
              university: "Tech University",
              hasFinishedSetup: false,
              studyPreferences: {
                isMorningPerson: true,
                preferredSessionLength: "medium" as const, // <--- Add 'as const' here
                subjects: [],
              },
              createdAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, newProfile);
            updateUser(newProfile);
          } else {
            // Existing User: Update local context with Firestore data
            updateUser(userSnap.data());
          }
        } catch (err: any) {
          Alert.alert("Google Sync Error", err.message);
        }
      };

      handleGoogleFirebaseSync();
    }
  }, [response]);

  const validatePassword = (pass: string) => {
    return (
      pass.length >= 6 &&
      /[A-Z]/.test(pass) &&
      /[a-z]/.test(pass) &&
      /[0-9]/.test(pass)
    );
  };

  const handleAuth = async () => {
    if (!isLogin) {
      if (!name) return Alert.alert("Error", "Please enter your name");
      if (!validatePassword(password)) {
        return Alert.alert(
          "Weak Password",
          "Password needs 6+ chars, uppercase, lowercase, and a number."
        );
      }
    }

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        // 1. Firebase Auth Signup
        await signup({ name, email, password });

        // Note: AuthContext handles the onAuthStateChanged which usually
        // triggers the navigation to Onboarding because hasFinishedSetup is false.
      }
    } catch (error: any) {
      Alert.alert("Authentication Error", error.message);
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
            placeholderTextColor={theme.colors.text.secondary}
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
          placeholderTextColor={theme.colors.text.secondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
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
            placeholderTextColor={theme.colors.text.secondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            style={[
              styles.input,
              styles.passwordInput,
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
              size={18}
              color={theme.colors.text.secondary}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleAuth}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isLogin ? "Sign In" : "Sign Up"}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View
            style={[styles.divider, { backgroundColor: theme.colors.border }]}
          />
          <Text
            style={[styles.dividerText, { color: theme.colors.text.secondary }]}
          >
            OR
          </Text>
          <View
            style={[styles.divider, { backgroundColor: theme.colors.border }]}
          />
        </View>

        <TouchableOpacity
          style={[styles.googleButton, { borderColor: theme.colors.primary }]}
          onPress={() => promptAsync()}
          disabled={!request || isLoading}
        >
          <FontAwesome5
            name="google"
            size={18}
            color={theme.colors.primary}
            style={{ marginRight: 12 }}
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
    marginBottom: 32,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  passwordContainer: { position: "relative", width: "100%", marginBottom: 16 },
  passwordInput: { marginBottom: 0, paddingRight: 55 },
  eyeIcon: {
    position: "absolute",
    right: 16,
    top: 0,
    height: "100%",
    justifyContent: "center",
  },
  button: { padding: 18, borderRadius: 12, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  divider: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 10, fontSize: 12, fontWeight: "600" },
  googleButton: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  toggle: { marginTop: 24, alignItems: "center" },
});
