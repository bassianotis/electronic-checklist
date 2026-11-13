import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'default' | 'scrapbook';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem('theme');
        return (saved as Theme) || 'default'; // Default to clean theme
    });

    useEffect(() => {
        // Apply theme to document root
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('theme', theme);

        // Load theme-specific fonts
        const existingFontLink = document.getElementById('theme-fonts');

        if (theme === 'scrapbook') {
            // Load typewriter font
            if (!existingFontLink || !existingFontLink.getAttribute('href')?.includes('Special+Elite')) {
                if (existingFontLink) existingFontLink.remove();
                const link = document.createElement('link');
                link.id = 'theme-fonts';
                link.rel = 'stylesheet';
                link.href = 'https://fonts.googleapis.com/css2?family=Special+Elite&family=Courier+Prime:wght@400;700&display=swap';
                document.head.appendChild(link);
            }
        } else if (theme === 'default') {
            // Load Inter font for clean, modern look
            if (!existingFontLink || !existingFontLink.getAttribute('href')?.includes('Inter')) {
                if (existingFontLink) existingFontLink.remove();
                const link = document.createElement('link');
                link.id = 'theme-fonts';
                link.rel = 'stylesheet';
                link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
                document.head.appendChild(link);
            }
        }
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
