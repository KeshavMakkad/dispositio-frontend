import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { supabase } from "./supabaseClient";
import type { AuthUser } from "../types/auth";
import { AuthContext } from "./AuthContext";
import type { AuthContextValue } from "./AuthContext";

interface AuthResponse {
    message: string;
    user: AuthUser;
}

const syncBackendLogin = async (accessToken: string) => {
    const response = await apiClient.post<AuthResponse>(
        "/auth/login",
        { token: accessToken },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
    );
    return response.data.user;
};

const applySupabaseUser = async (accessToken?: string | null) => {
    if (!accessToken) {
        throw new Error("Supabase did not return an access token.");
    }

    return syncBackendLogin(accessToken);
};

const getReadableAuthError = (error: unknown) => {
    if (axios.isAxiosError(error)) {
        if (!error.response) {
            return "Could not reach backend API after Google sign-in. Check VITE_API_BASE_URL and make sure your backend is reachable from this device.";
        }

        const serverMessage =
            typeof error.response.data === "object" && error.response.data !== null && "message" in error.response.data
                ? String((error.response.data as { message?: unknown }).message ?? "")
                : "";

        if (serverMessage) {
            return serverMessage;
        }

        if (error.response.status === 401 || error.response.status === 403) {
            return "Login failed. Your account may be inactive.";
        }

        return "Login failed while syncing with backend.";
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "Login failed. Please try again.";
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const navigate = useNavigate();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const fetchCurrentUser = useCallback(async () => {
        const response = await apiClient.get<AuthResponse>("/auth/me");
        return response.data.user;
    }, []);

    useEffect(() => {
        let isMounted = true;

        const initializeAuth = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const currentUser = await fetchCurrentUser();
                if (isMounted) {
                    setUser(currentUser);
                }
            } catch {
                const [{ data, error: getUserError }, { data: sessionData }] = await Promise.all([
                    supabase.auth.getUser(),
                    supabase.auth.getSession(),
                ]);

                if (!isMounted) {
                    return;
                }

                if (getUserError || !data.user) {
                    setUser(null);
                    return;
                }

                try {
                    const syncedUser = await applySupabaseUser(sessionData.session?.access_token);
                    if (isMounted) {
                        setUser(syncedUser);
                    }
                } catch (syncError) {
                    if (isMounted) {
                        setUser(null);
                        setError(getReadableAuthError(syncError));
                    }
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        initializeAuth().catch(() => {
            if (isMounted) {
                setError("Could not initialize authentication.");
                setIsLoading(false);
            }
        });

        const onAuthExpired = () => {
            if (!isMounted) {
                return;
            }

            setUser(null);
            setError("Your session has expired. Please login again.");
            setIsLoading(false);
            navigate("/login", { replace: true });
        };

        const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) {
                return;
            }

            if (event === "SIGNED_OUT") {
                setUser(null);
                setError(null);
                setIsLoading(false);
                return;
            }

            if (event === "TOKEN_REFRESHED") {
                return;
            }

            if (!session?.user) {
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const syncedUser = await applySupabaseUser(session.access_token);
                if (isMounted) {
                    setUser(syncedUser);
                }
            } catch (syncError) {
                if (isMounted) {
                    setUser(null);
                    setError(getReadableAuthError(syncError));
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        });

        window.addEventListener("auth:expired", onAuthExpired);

        return () => {
            isMounted = false;
            listener.subscription.unsubscribe();
            window.removeEventListener("auth:expired", onAuthExpired);
        };
    }, [fetchCurrentUser, navigate]);

    const signInWithGoogle = useCallback(async () => {
        setError(null);
        setIsLoading(true);

        try {
            const { error: signInError } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}/dashboard`,
                },
            });

            if (signInError) {
                setError(signInError.message);
                setIsLoading(false);
            }
        } catch {
            setError("Could not start Google login.");
            setIsLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        setError(null);
        setIsLoading(true);

        try {
            await apiClient.post("/auth/logout");
        } catch {
            // Continue to clear client-side session state even if backend logout fails.
        } finally {
            await supabase.auth.signOut();
            setUser(null);
            navigate("/login", { replace: true });
            setIsLoading(false);
        }
    }, [navigate]);

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            isAuthenticated: Boolean(user),
            isLoading,
            error,
            signInWithGoogle,
            logout,
            clearError,
        }),
        [user, isLoading, error, signInWithGoogle, logout, clearError],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
