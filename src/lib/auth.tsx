"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  api,
  getToken,
  setTokens,
  clearToken,
  setUnauthorizedHandler,
} from "@/lib/api";
import type { CurrentUser } from "@/lib/types";

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isCentre: boolean; // ← ajoute
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Déconnexion : vide le token, l'utilisateur, et renvoie au login.
  const logout = useCallback(async () => {
    await api.logout(); // révoque le refresh côté serveur
    clearToken();
    setUser(null);
    router.push("/login");
  }, [router]);

  // Branche le handler 401 du client API sur le logout.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken();
      setUser(null);
      // On évite de rediriger si on est déjà sur /login.
      if (window.location.pathname !== "/login") {
        router.push("/login");
      }
    });
  }, [router]);

  // Au démarrage : si un token existe, on récupère l'utilisateur.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((u) => setUser(u))
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const { access_token, refresh_token } = await api.login(
        username,
        password,
      );
      setTokens(access_token, refresh_token);
      const u = await api.me();
      setUser(u);
      // Le centre n'a qu'un module → on l'y envoie directement.
      router.push(u.role === "centre" ? "/centres" : "/accueil");
    },
    [router],
  );
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAdmin: user?.role === "admin",
        isCentre: user?.role === "centre", // ← ajoute
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider.");
  return ctx;
}
