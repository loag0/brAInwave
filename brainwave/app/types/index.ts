export interface User {
  id: string;
  name: string;
  email: string;
  university?: string;
  studyPreferences: {
    isMorningPerson: boolean;
    preferredSessionLength: "short" | "medium" | "long";
    subjects: string[];
  };
}

export interface AuthContextType {
  user: User | null;
  updateUser: (newData: Partial<User>) => void;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: SignupData) => Promise<void>;
  logout: () => Promise<void>;
  token: string | null;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
  university?: string;
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
