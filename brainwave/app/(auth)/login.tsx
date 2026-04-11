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
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db as firestore } from "../../firebaseConfig";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAlert } from "../contexts/AlertContext";
import Svg, { Path } from "react-native-svg";
import { ICONS, GoogleIcon } from "@/components/Icons";
import Toast from "react-native-toast-message";

WebBrowser.maybeCompleteAuthSession();

interface IconProps {
  size: number;
  color: string;
}

export default function LoginScreen() {
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const { login, signup, isLoading: authLoading } = useAuth();

  // --- States ---
  const [isLogin, setIsLogin] = useState(params.mode !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const isInitialMount = authLoading || isProcessing;

  const VisibiltyIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d={
          showPassword
            ? "M607.5-372.5Q660-425 660-500t-52.5-127.5Q555-680 480-680t-127.5 52.5Q300-575 300-500t52.5 127.5Q405-320 480-320t127.5-52.5Zm-204-51Q372-455 372-500t31.5-76.5Q435-608 480-608t76.5 31.5Q588-545 588-500t-31.5 76.5Q525-392 480-392t-76.5-31.5ZM214-281.5Q94-363 40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200q-146 0-266-81.5ZM480-500Zm207.5 160.5Q782-399 832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280q113 0 207.5-59.5Z"
            : "m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t37.5-4q75 0 127.5 52.5T660-500q0 20-4 37.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56ZM222-624q-29 26-53 57t-41 67q50 101 143.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21l-84-82Zm319 93Zm-151 75Z"
        }
        fill={color}
      />
    </Svg>
  );

  useEffect(() => {
    setEmail("");
    setPassword("");
    setName("");
    setShowPassword(false);
  }, [isLogin]);

  // --- Google Auth Configuration ---
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
    redirectUri: AuthSession.makeRedirectUri({
      scheme: "com.username0.brainwave",
      path: "/oauth2redirect/google",
    }),
  });

  // --- Handle Google Auth Response ---
  useEffect(() => {
    if (response?.type !== "success") return;

    setIsProcessing(true);
    const { id_token } = response.params;
    const credential = GoogleAuthProvider.credential(id_token);

    const handleGoogleFirebaseSync = async () => {
      try {
        const userCredential = await signInWithCredential(auth, credential);
        const firebaseUser = userCredential.user;
        const userDocRef = doc(firestore, "users", firebaseUser.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          const newProfile = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || "User",
            email: firebaseUser.email || "",
            hasFinishedSetup: false,
            studyPreferences: {
              isMorningPerson: true,
              preferredSessionLength: "medium" as const,
            },
            createdAt: new Date().toISOString(),
          };
          await setDoc(userDocRef, newProfile);
        }
      } catch (err: any) {
        setIsProcessing(false);
        showAlert({
          title: "Google Sync Error",
          message: (__DEV__) ? err.message : "Failed to sync with Google. Please try again.",
          iconColor: theme.colors.error,
        });
      }
    };

      handleGoogleFirebaseSync();
  }, [response, showAlert, theme.colors.error]);

  // --- Helper Functions ---
  const validatePassword = (pass: string) => {
    return (
      pass.length >= 6 &&
      /[A-Z]/.test(pass) &&
      /[a-z]/.test(pass) &&
      /[0-9]/.test(pass)
    );
  };

  const handleAuth = async () => {
    setIsProcessing(true);

    if (!isLogin && !name){
      setIsProcessing(false);
      return showAlert({ title: "Error",
        message: "Please enter your name",
        iconColor: theme.colors.error,
        iconPath: ICONS.ERROR
      });
    }

    if (!isLogin && !validatePassword(password)) {
      setIsProcessing(false);
      return showAlert({
        title: "Weak Password",
        message: "Password needs 6+ chars, uppercase, lowercase, and a number.",
        iconColor: theme.colors.error,
        iconPath: ICONS.ERROR
      });
    }

    try {
      if(isLogin) await login(email, password);
      else await signup({name, email, password});

    } catch (error: any) {
      showAlert({
        title: "Authentication Error!",
        message: (__DEV__) ? error.message : "Failed to authenticate. Please try again.",
        iconPath: ICONS.ERROR,
        iconColor: theme.colors.error
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- STANDALONE LOADING VIEW ---
    if (isProcessing) {
      return (
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.colors.background,
              justifyContent: "center",
              alignItems: "center",
            },
          ]}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text
            style={{
              marginTop: 16,
              color: theme.colors.text.secondary,
              fontSize: 16,
            }}
          >
            Authenticating...
          </Text>
        </View>
      );
    }

  if (isInitialMount)
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }} />
    );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          {isLogin ? "Welcome back!" : "Join brAInwave"}
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
            <VisibiltyIcon size={22} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleAuth}
        >
          <Text style={styles.buttonText}>
            {isLogin ? "Sign In" : "Sign Up"}
          </Text>
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
          onPress={async () => {
            setIsGoogleLoading(true);
            const result = await promptAsync();
            setIsGoogleLoading(false);
            if (result?.type === "cancel" || result?.type === "dismiss") {
              Toast.show({
                type: "error",
                text1: "Sign in cancelled",
                position: "bottom",
                visibilityTime: 2000,
              });
            }
          }}
          disabled={!request || isGoogleLoading}
        >
          {isGoogleLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <GoogleIcon size={18} color={theme.colors.primary} />
          )}
          <Text style={{ color: theme.colors.primary, fontWeight: "bold", marginLeft: 8 }}>
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
