import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../../firebaseConfig"; // Ensure this is your updated auth
import { User, AuthContextType } from "../types";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // 1. SESSION DETECTOR (The "Listener")
    // This runs automatically whenever the user logs in, logs out, or the app starts
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // 2. JWT IMPLEMENTATION
        // Get the JWT (ID Token) to send to your backend for extra security
        const jwt = await firebaseUser.getIdToken();
        setToken(jwt);

        // Map Firebase user to your custom User type
        const mappedUser: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || "New User",
          email: firebaseUser.email || "",
          university: "Tech University", // You can fetch this from Firestore later
          studyPreferences: {
            isMorningPerson: true,
            preferredSessionLength: "medium",
            subjects: [],
          },
        };
        setUser(mappedUser);
      } else {
        setUser(null);
        setToken(null);
      }
      setIsLoading(false);
    });

    return unsubscribe; // Cleanup listener on unmount
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, token, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
