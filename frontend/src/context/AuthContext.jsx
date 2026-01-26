import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getToken, removeToken } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check if user is logged in on mount
    useEffect(() => {
        const token = getToken();
        if (token) {
            api.getMe()
                .then(data => setUser(data.user))
                .catch(() => removeToken())
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = useCallback(async (email, password) => {
        const data = await api.login(email, password);
        setUser(data.user);
        return data;
    }, []);

    const register = useCallback(async (email, password, name) => {
        const data = await api.register(email, password, name);
        setUser(data.user);
        return data;
    }, []);

    const logout = useCallback(() => {
        api.logout();
        setUser(null);
    }, []);

    const value = {
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
