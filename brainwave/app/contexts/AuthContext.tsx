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
  getAuth,
  deleteUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
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

        // Never stuck loading
        const loadingTimeout = setTimeout(() => {
          setIsLoading(false);
        }, 5000);

        try {
          // 1. HYDRATE IMMEDIATELY FROM SQLITE
          try {
            const cachedUser = LocalDB.getUser(firebaseUser.uid) as any;
            if (cachedUser) {
              setUser({
                ...cachedUser,
                studyPreferences: JSON.parse(cachedUser.studyPreferences),
                hasFinishedSetup: !!cachedUser.hasFinishedSetup,
              });
              setIsLoading(false); // UI moves to Home immediately
            }
          } catch (localDbError) {
            if(__DEV__) console.log("LocalDB Error:", localDbError);
          }

          // 2. BACKGROUND FETCH FROM FIRESTORE
          const userDocRef = doc(firestore, "users", firebaseUser.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const data = userSnap.data() as User;
            setUser(data);

            try{
              LocalDB.saveUser(data); // Update local cache with latest data
            } catch (saveError) {
              if(__DEV__) console.log("Failed to save to LocalDB:", saveError);
            }
          } else{
              await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate network delay
              const retrySnap = await getDoc(userDocRef);
              if(retrySnap.exists()){
                const data = retrySnap.data() as User;
                setUser(data);
            try {
              LocalDB.saveUser(data); // Update local cache
            } catch (saveError) {
              if(__DEV__) console.log("Failed to save to LocalDB:", saveError);
            }
          }
          }
        } catch (error) {
          if(__DEV__) console.log("Offline mode: Using cached profile or fetching failed.", error);
        } finally {
          clearTimeout(loadingTimeout);
          setIsLoading(false);
        }
      } else {
        setUser(null);
        setToken(null);
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signup = async ({ name, email, password }: SignupData) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      await updateProfile(userCredential.user, { displayName: name });

      // create Firestore doc
      const userRef = doc(firestore, "users", userCredential.user.uid);
      await setDoc(userRef, {
        id: userCredential.user.uid,
        name,
        email,
        hasFinishedSetup: false,
        studyPreferences: {},
        createdAt: new Date().toISOString(),
      });

      return userCredential;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      return userCredential;
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
        ...(updates.studyPreferences?.notifications && {
          notifications: {
            ...user.studyPreferences?.notifications,
            ...updates.studyPreferences.notifications,
          },
        }),
      },
    };
    setUser(updatedUser);

    // 2. PERSIST TO SQLITE IMMEDIATELY
    LocalDB.saveUser(updatedUser);

    // 3. BACKGROUND SYNC TO FIRESTORE
    try {
      const userRef = doc(firestore, "users", user.id);
      const flatUpdates: Record<string, any> = {};

      if (updates.studyPreferences) {
        Object.entries(updates.studyPreferences).forEach(([key, value]) => {
          if (key === "notifications" && typeof value === "object" && value !== null) {
            // Go one level deeper for notifications
            Object.entries(value).forEach(([nKey, nValue]) => {
              flatUpdates[`studyPreferences.notifications.${nKey}`] = nValue;
            });
          } else {
            flatUpdates[`studyPreferences.${key}`] = value;
          }
        });
      }

      // for top level fields like name or email
      Object.entries(updates).forEach(([key, value]) => {
        if (key !== "studyPreferences") {
          flatUpdates[key] = value;
        }
      });

      updateDoc(userRef, flatUpdates);
    } catch (error) {
      console.error("Sync failed:", error);
    }
  };

  const logout = async () => {
    await signOut(auth);
    // Optional: Clear SQLite on logout if you want security
  };

  const deleteAccount = async () => {
    if (!user) return;

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      // 1. Delete Firestore user document
      const userRef = doc(firestore, "users", currentUser.uid);
      await deleteDoc(userRef);

      // 2. Delete Firebase auth account
      await deleteUser(currentUser);

      // 3. Clear local cache
      //LocalDB.clearUser?.(currentUser.uid);

      // 4. Reset state
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error("Account deletion failed:", error);
    }
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        token,
        login,
        signup,
        updateUser: () => {},
        updateProfileData,
        logout,
        getAuth,
        deleteAccount,
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