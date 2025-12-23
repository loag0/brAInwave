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
import { doc, getDoc } from "firebase/firestore";
import { auth, db as firestore } from "../../firebaseConfig";
import { User, AuthContextType, SignupData } from "../types";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        const jwt = await firebaseUser.getIdToken();
        setToken(jwt);

        try {
          // Fetch additional profile data from Firestore
          const userDocRef = doc(firestore, "users", firebaseUser.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            setUser({
              id: firebaseUser.uid,
              name: firebaseUser.displayName || data.name || "User",
              email: firebaseUser.email || "",
              university: data.university || "Tech University",
              studyPreferences: data.studyPreferences,
              hasFinishedSetup: data.hasFinishedSetup ?? false,
            });
          } else {
            // Document doesn't exist yet (brand new signup)
            setUser({
              id: firebaseUser.uid,
              name: firebaseUser.displayName || "User",
              email: firebaseUser.email || "",
              university: "Tech University",
              studyPreferences: {
                isMorningPerson: true,
                preferredSessionLength: "medium",
                subjects: [],
              },
              hasFinishedSetup: false,
            });
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setUser(null);
        setToken(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData: SignupData) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        userData.password
      );
      await updateProfile(userCredential.user, { displayName: userData.name });
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (newData: Partial<User>) => {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            ...newData,
            studyPreferences: {
              ...prev.studyPreferences,
              ...newData.studyPreferences,
            },
          }
        : null
    );
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, token, login, signup, updateUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
