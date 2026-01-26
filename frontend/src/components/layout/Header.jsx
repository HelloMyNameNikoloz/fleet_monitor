import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRobots } from '../../context/RobotsContext';

import './Header.css';

// Icons as simple SVG components
const SearchIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
    </svg>
);

const RobotIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <line x1="8" y1="16" x2="8" y2="16" />
        <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
);

const SunIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
);

const MoonIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
);

const LogOutIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
        <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
);

export default function Header() {
    const { user, logout } = useAuth();
    const { operatorsOnline, robotsMap, setSelectedRobotId } = useRobots();
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('fleet_theme') || document.documentElement.getAttribute('data-theme') || 'light';
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const blurTimeoutRef = useRef(null);

    const robots = useMemo(() => Object.values(robotsMap || {}), [robotsMap]);
    const filteredRobots = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const list = query
            ? robots.filter((robot) => robot.name.toLowerCase().includes(query))
            : robots;
        return list; // Show all matching robots (scrollable)
    }, [robots, searchQuery]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('fleet_theme', theme);
    }, [theme]);

    useEffect(() => {
        return () => {
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    };

    const handleLogout = () => {
        logout();
        window.location.href = '/login';
    };

    const handleSearchFocus = () => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        setSearchOpen(true);
    };

    const handleSearchBlur = () => {
        blurTimeoutRef.current = setTimeout(() => {
            setSearchOpen(false);
        }, 150);
    };

    const handleSelectRobot = (robotId) => {
        setSelectedRobotId(robotId);
        setSearchQuery('');
        setSearchOpen(false);
    };

    return (
        <header className="header">
            <div className="header-left">
                <div className="header-logo">
                    <RobotIcon />
                    <span>Mini Fleet Monitor</span>
                </div>
                <span className="header-env-badge">
                    {import.meta.env.MODE === 'production' ? 'PROD' : 'DEV'}
                </span>
            </div>

            <div className="header-center">
                <div className="header-search">
                    <span className="header-search-icon">
                        <SearchIcon />
                    </span>
                    <input
                        type="text"
                        placeholder="Search robot name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={handleSearchFocus}
                        onBlur={handleSearchBlur}
                    />
                    {searchOpen && (
                        <div className="header-search-dropdown">
                            {filteredRobots.length === 0 ? (
                                <div className="header-search-empty">
                                    No robots found.
                                </div>
                            ) : (
                                filteredRobots.map((robot) => (
                                    <button
                                        key={robot.id}
                                        type="button"
                                        className="header-search-item"
                                        onMouseDown={() => handleSelectRobot(robot.id)}
                                    >
                                        <span className={`status-dot ${robot.status}`}></span>
                                        <span className="header-search-name">{robot.name}</span>
                                        <span className={`badge badge-${robot.status === 'moving' ? 'success' : robot.status === 'idle' ? 'warning' : 'error'}`}>
                                            {robot.status}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="header-right">
                <div className="header-status-badges">
                    <div className="header-badge success">
                        <span className="header-badge-dot"></span>
                        WS ONLINE
                    </div>
                    <div className="header-badge success">
                        <span className="header-badge-dot"></span>
                        STATUS OK
                    </div>
                </div>

                <div className="header-presence">
                    <span className="header-presence-dot"></span>
                    <span>Operators online: {operatorsOnline}</span>
                </div>

                <button
                    className="btn btn-icon btn-ghost"
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>

                <div className="header-user">
                    <div className="header-user-avatar">
                        {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <span>{user?.email}</span>
                </div>

                <button
                    className="btn btn-icon btn-ghost"
                    onClick={handleLogout}
                    title="Logout"
                >
                    <LogOutIcon />
                </button>
            </div>
        </header>
    );
}
