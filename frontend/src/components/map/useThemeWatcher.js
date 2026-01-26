import { useEffect, useState } from 'react';

export function useThemeWatcher() {
    const [theme, setTheme] = useState(
        document.documentElement.getAttribute('data-theme') || 'light'
    );

    useEffect(() => {
        const observer = new MutationObserver(() => {
            const nextTheme = document.documentElement.getAttribute('data-theme') || 'light';
            setTheme(nextTheme);
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, []);

    return theme;
}
