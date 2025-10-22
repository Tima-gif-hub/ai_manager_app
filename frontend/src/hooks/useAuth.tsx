import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, AuthState, AuthSession } from "@/types";
import { authApi } from "@/lib/database";

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  session: AuthSession | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const unauthenticatedState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: true,
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>(unauthenticatedState);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let mounted = true;

    const setSignedIn = (user: User) => {
      if (!mounted) return;
      setAuthState({
        isAuthenticated: true,
        user,
        loading: false,
      });
    };

    const setSignedOut = () => {
      if (!mounted) return;
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
      });
    };

    const existingSession = authApi.getSession();
    if (existingSession) {
      setSession(existingSession);
      setSignedIn(existingSession.user);
      authApi
        .getCurrentUser()
        .then((user) => {
          if (user) {
            setSignedIn(user);
          } else {
            setSignedOut();
          }
        })
        .catch(() => setSignedOut());
    } else {
      setSignedOut();
    }

    const subscription = authApi.onAuthStateChange((nextSession) => {
      if (!mounted) {
        return;
      }

      setSession(nextSession);
      if (nextSession) {
        setSignedIn(nextSession.user);
      } else {
        setSignedOut();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    await authApi.login(email, password);
  };

  const register = async (email: string, password: string, name: string) => {
    await authApi.register(email, password, name);
  };

  const logout = async () => {
    await authApi.logout();
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        register,
        logout,
        session,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

