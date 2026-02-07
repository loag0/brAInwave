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
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db as firestore } from "../../firebaseConfig";
import { User, AuthContextType, SignupData } from "../types";
import { LocalDB } from "../database/localDb";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    LocalDB.init();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const jwt = await firebaseUser.getIdToken();
        setToken(jwt);

        // 1. HYDRATE IMMEDIATELY FROM SQLITE
        const cachedUser = LocalDB.getUser(firebaseUser.uid) as any;
        if (cachedUser) {
          setUser({
            ...cachedUser,
            studyPreferences: JSON.parse(cachedUser.studyPreferences),
            hasFinishedSetup: !!cachedUser.hasFinishedSetup,
          });
          setIsLoading(false); // UI moves to Home immediately
        }

        try {
          // 2. BACKGROUND FETCH FROM FIRESTORE
          const userDocRef = doc(firestore, "users", firebaseUser.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const data = userSnap.data() as User;
            setUser(data);
            LocalDB.saveUser(data); // Update local cache
          }
        } catch (error) {
          console.log("Offline mode: Using cached profile.", error);
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
    setIsLoading(true); // Still needed for login as we need a real token
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfileData = async (updates: Partial<User>) => {
    if (!user?.id) return;

    // 1. OPTIMISTIC UI UPDATE (Instant)
    const updatedUser = {
      ...user,
      ...updates,
      studyPreferences: {
        ...user.studyPreferences,
        ...updates.studyPreferences,
      },
    };
    setUser(updatedUser);

    // 2. PERSIST TO SQLITE IMMEDIATELY
    LocalDB.saveUser(updatedUser);

    // 3. BACKGROUND SYNC TO FIRESTORE (No 'await', no 'loading' spinner)
    try {
      const userRef = doc(firestore, "users", user.id);
      updateDoc(userRef, updates);
    } catch (error) {
      console.error("Sync failed: queued for later reconnection", error);
    }
  };

  const logout = async () => {
    await signOut(auth);
    // Optional: Clear SQLite on logout if you want security
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        token,
        login,
        signup: async () => {},
        updateUser: () => {},
        updateProfileData,
        logout,
      }}
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
