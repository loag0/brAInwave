import { UserCredential } from "firebase/auth";

export interface User {
  id: string;
  name: string;
  email: string;
  studyPreferences: {
    isMorningPerson?: boolean | null;
    preferredSessionLength?: "short" | "medium" | "long";
    mode?: "stay_consistent" | "exam_prep" | "catch_up";
    subjectPriorities?: string[];
    notificationLeadMinutes?: number;
    notifications?: NotificationPreferences
  };
  hasFinishedSetup: boolean;
}
export interface NotificationPreferences {
  studyReminders: boolean;
  assignmentDeadlines: boolean;
  goalAchievements: boolean;
  dailySummary: boolean;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  updateUser: (newData: Partial<User>) => void;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserCredential>;
  signup: (userData: SignupData) => Promise<UserCredential>;
  updateProfileData: (updates: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
}

export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: {
      primary: string;
      secondary: string;
      accent: string;
    };
    border: string;
    success: string;
    warning: string;
    error: string;
  };
  fonts: {
    regular: string;
    medium: string;
    semiBold: string;
    bold: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
}
