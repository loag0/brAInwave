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
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "../../firebaseConfig";
import { User, AuthContextType, SignupData } from "../types";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // 1. SESSION DETECTOR & JWT UPDATER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get the fresh JWT
        const jwt = await firebaseUser.getIdToken();
        setToken(jwt);

        // Map to your custom User type
        const mappedUser: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || "User",
          email: firebaseUser.email || "",
          university: "Tech University", // Default for now
          studyPreferences: {
            isMorningPerson: true,
            preferredSessionLength: "medium", // Matches your type literal
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

    return unsubscribe;
  }, []);

  // 2. LOGIN FUNCTION
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Login error:", error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 3. SIGNUP FUNCTION
  const signup = async (userData: SignupData) => {
    try {
      setIsLoading(true);
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        userData.password
      );

      // Save the user's name to their Firebase profile
      await updateProfile(userCredential.user, {
        displayName: userData.name,
      });

      // Note: onAuthStateChanged will automatically pick up the new user
    } catch (error: any) {
      console.error("Signup error:", error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (newData: Partial<User>) => {
    setUser((prevUser) => {
      if (!prevUser) return null;
      return {
        ...prevUser,
        ...newData,
        studyPreferences: {
          ...prevUser.studyPreferences,
          ...newData.studyPreferences || {},
        },
      };
    });
  };

  // 4. LOGOUT FUNCTION
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, token, login, signup, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
