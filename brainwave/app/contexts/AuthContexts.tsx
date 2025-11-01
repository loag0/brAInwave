import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User, AuthContextType, SignupData } from "../types";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already logged in on app start
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const userData = await AsyncStorage.getItem("user");
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error("Error checking auth state:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      // TODO: Replace with actual API call
      // For now, simulate login
      const mockUser: User = {
        id: "1",
        name: "David Student",
        email: email,
        university: "Tech University",
        studyPreferences: {
          isMorningPerson: true,
          preferredSessionLength: "medium",
          subjects: ["Math", "Chemistry"],
        },
      };

      await AsyncStorage.setItem("user", JSON.stringify(mockUser));
      setUser(mockUser);
    } catch (error) {
      console.error("Login error:", error);
      throw new Error("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData: SignupData) => {
    try {
      setIsLoading(true);

      // TODO: Replace with actual API call
      const newUser: User = {
        id: Date.now().toString(),
        name: userData.name,
        email: userData.email,
        university: userData.university,
        studyPreferences: {
          isMorningPerson: true,
          preferredSessionLength: "medium",
          subjects: [],
        },
      };

      await AsyncStorage.setItem("user", JSON.stringify(newUser));
      setUser(newUser);
    } catch (error) {
      console.error("Signup error:", error);
      throw new Error("Signup failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("user");
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
