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
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";
import { auth, db as firestore } from "../../firebaseConfig";
import { User, AuthContextType, SignupData } from "../types";
import { LocalDB } from "../database/localDb";

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const LAST_AUTH_USER_ID = "lastAuthUserId";
const EXPLICIT_LOGOUT = "explicitLogout";

const normalizeCachedUser = (cachedUser: any): User => {
  let studyPreferences: any = {};
  if (cachedUser.studyPreferences) {
    if (typeof cachedUser.studyPreferences === "string") {
      try {
        studyPreferences = JSON.parse(cachedUser.studyPreferences);
      } catch {
        studyPreferences = {};
      }
    } else {
      studyPreferences = cachedUser.studyPreferences;
    }
  }

  return {
    ...cachedUser,
    studyPreferences,
    hasFinishedSetup: !!cachedUser.hasFinishedSetup,
  };
};

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
        await AsyncStorage.multiSet([
          [LAST_AUTH_USER_ID, firebaseUser.uid],
          [EXPLICIT_LOGOUT, "false"],
        ]);

        //Allows the user to see the app immediately while fetching their profile in the background
        const loadingTimeout = setTimeout(() => setIsLoading(false), 5000);

        // tries to load cached user from SQLite for instant UI
        try {
          const cachedUser = LocalDB.getUser(firebaseUser.uid) as any;
          if (cachedUser) {
            setUser(normalizeCachedUser(cachedUser));
            setIsLoading(false); // UI unblocks immediately from cache
          }
        } catch (localDbError) {
          if (__DEV__) console.log("LocalDB Error:", localDbError);
        }

        // gets latest token in background (in case it changed or expired) but doesn't block UI
        firebaseUser.getIdToken().then(setToken).catch(() => {});

        // background fetch of latest profile from Firestore to ensure we have the most up-to-date data, then update cache and UI
        try {
          const userDocRef = doc(firestore, "users", firebaseUser.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const data = userSnap.data() as User;
            setUser(data);
            try {
              LocalDB.saveUser(data);
            } catch (saveError) {
              if (__DEV__) console.log("Failed to save to LocalDB:", saveError);
            }
          } else {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const retrySnap = await getDoc(userDocRef);
            if (retrySnap.exists()) {
              const data = retrySnap.data() as User;
              setUser(data);
              try {
                LocalDB.saveUser(data);
              } catch (saveError) {
                if (__DEV__) console.log("Failed to save to LocalDB:", saveError);
              }
            }
          }
        } catch (error) {
          if (__DEV__) console.log("Offline mode: Using cached profile or fetching failed.", error);
        } finally {
          clearTimeout(loadingTimeout);
          setIsLoading(false);
        }
      } else {
        try {
          const [explicitLogout, lastUserId] = await Promise.all([
            AsyncStorage.getItem(EXPLICIT_LOGOUT),
            AsyncStorage.getItem(LAST_AUTH_USER_ID),
          ]);
          const state = await NetInfo.fetch();
          const online = !!(state.isConnected && state.isInternetReachable);

          if (!online && explicitLogout !== "true") {
            const cachedUser = lastUserId
              ? (LocalDB.getUser(lastUserId) as any)
              : (LocalDB.getLastCachedUser() as any);
            if (cachedUser) {
              setUser(normalizeCachedUser(cachedUser));
              await AsyncStorage.setItem(LAST_AUTH_USER_ID, cachedUser.id);
              setIsLoading(false);
              return;
            }
          }
        } catch (localDbError) {
          if (__DEV__) console.log("Offline cached auth failed:", localDbError);
        }

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
      await AsyncStorage.multiSet([
        [LAST_AUTH_USER_ID, userCredential.user.uid],
        [EXPLICIT_LOGOUT, "false"],
      ]);

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
      await AsyncStorage.multiSet([
        [LAST_AUTH_USER_ID, userCredential.user.uid],
        [EXPLICIT_LOGOUT, "false"],
      ]);
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
      Toast.show({
        type: "warning",
        text1: "Profile saved locally",
        text2: "Cloud sync failed. Reopen settings when you're online to retry.",
        position: "bottom",
        visibilityTime: 5000,
      });
    }
  };

  const logout = async () => {
    // if (user?.id) LocalDB.clearUser(user.id);
    await AsyncStorage.setItem(EXPLICIT_LOGOUT, "true");
    await signOut(auth);
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
      Toast.show({
        type: "error",
        text1: "Account deletion failed",
        text2: "Please check your connection and try again.",
        position: "bottom",
        visibilityTime: 5000,
      });
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