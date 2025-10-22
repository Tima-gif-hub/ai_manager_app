import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { settingsApi } from "@/lib/database";

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>("light");
  const { user } = useAuth();

  useEffect(() => {
    const loadTheme = async () => {
      if (!user) return;

      try {
        const settings = await settingsApi.getSettings();
        if (settings.theme) {
          setThemeState(settings.theme);
        }
      } catch (error) {
        console.error("Failed to load theme", error);
      }
    };

    loadTheme();
  }, [user]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);

    if (user) {
      try {
        await settingsApi.updateSettings({ theme: newTheme });
      } catch (error) {
        console.error("Failed to persist theme", error);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
