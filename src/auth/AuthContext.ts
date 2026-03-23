import { createContext } from "react";
import type { AuthUser } from "../types/auth";

export interface AuthContextValue {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
