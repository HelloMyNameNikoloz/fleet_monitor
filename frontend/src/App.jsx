import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RobotsProvider } from './context/RobotsContext';

// Pages
import Login from './pages/Login';
import Dashboard from './components/layout/Dashboard';
import LiveMonitor from './pages/LiveMonitor';
import Replay from './pages/Replay';
import Events from './pages/Events';
import Zones from './pages/Zones';
import Settings from './pages/Settings';

// Protected Route wrapper
function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner spinner-lg"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route
                path="/*"
                element={
                    <ProtectedRoute>
                        <RobotsProvider>
                            <Dashboard>
                                <Routes>
                                    <Route path="/" element={<Navigate to="/monitor" replace />} />
                                    <Route path="/monitor" element={<LiveMonitor />} />
                                    <Route path="/replay" element={<Replay />} />
                                    <Route path="/events" element={<Events />} />
                                    <Route path="/zones" element={<Zones />} />
                                    <Route path="/settings" element={<Settings />} />
                                </Routes>
                            </Dashboard>
                        </RobotsProvider>
                    </ProtectedRoute>
                }
            />
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}
