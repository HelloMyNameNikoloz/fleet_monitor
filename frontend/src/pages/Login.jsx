import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { isAuthenticated, login, register } = useAuth();
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (isAuthenticated) {
        return <Navigate to="/monitor" replace />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isRegister) {
                await register(email, password, name);
            } else {
                await login(email, password);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <div className="login-logo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="10" rx="2" />
                            <circle cx="12" cy="5" r="2" />
                            <path d="M12 7v4" />
                            <circle cx="8" cy="16" r="1" />
                            <circle cx="16" cy="16" r="1" />
                        </svg>
                    </div>
                    <h1>Mini Fleet Monitor</h1>
                    <p>Real-time robot fleet monitoring dashboard</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    {error && (
                        <div className="login-error">
                            {error}
                        </div>
                    )}

                    {isRegister && (
                        <div className="form-group">
                            <label className="form-label">Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Enter your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg login-btn"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="spinner spinner-sm"></span>
                        ) : (
                            isRegister ? 'Create Account' : 'Sign In'
                        )}
                    </button>

                    <div className="login-switch">
                        {isRegister ? (
                            <>
                                Already have an account?{' '}
                                <button type="button" onClick={() => setIsRegister(false)}>
                                    Sign In
                                </button>
                            </>
                        ) : (
                            <>
                                Don't have an account?{' '}
                                <button type="button" onClick={() => setIsRegister(true)}>
                                    Register
                                </button>
                            </>
                        )}
                    </div>

                    <div className="login-demo">
                        <p>Demo credentials:</p>
                        <code>admin@test.com / test123</code>
                    </div>
                </form>
            </div>

            <style>{`
                .login-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--base-bg);
                    padding: var(--spacing-lg);
                }

                .login-container {
                    width: 100%;
                    max-width: 400px;
                    background: var(--base-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-xl);
                    padding: var(--spacing-2xl);
                    animation: slideInUp var(--transition-base);
                }

                .login-header {
                    text-align: center;
                    margin-bottom: var(--spacing-2xl);
                }

                .login-logo {
                    width: 64px;
                    height: 64px;
                    margin: 0 auto var(--spacing-md);
                    color: var(--primary-color);
                }

                .login-logo svg {
                    width: 100%;
                    height: 100%;
                }

                .login-header h1 {
                    font-size: var(--font-size-2xl);
                    margin-bottom: var(--spacing-xs);
                }

                .login-header p {
                    color: var(--text-muted);
                    font-size: var(--font-size-sm);
                }

                .login-form {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                }

                .login-error {
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: var(--error-bg);
                    color: var(--error);
                    border-radius: var(--radius-md);
                    font-size: var(--font-size-sm);
                }

                .login-btn {
                    width: 100%;
                    margin-top: var(--spacing-sm);
                }

                .login-switch {
                    text-align: center;
                    color: var(--text-secondary);
                    font-size: var(--font-size-sm);
                }

                .login-switch button {
                    background: none;
                    border: none;
                    color: var(--primary-color);
                    cursor: pointer;
                    font-weight: var(--font-weight-medium);
                }

                .login-switch button:hover {
                    color: var(--primary-light);
                }

                .login-demo {
                    margin-top: var(--spacing-lg);
                    padding: var(--spacing-md);
                    background: var(--secondary-bg);
                    border-radius: var(--radius-md);
                    text-align: center;
                    font-size: var(--font-size-sm);
                }

                .login-demo p {
                    color: var(--text-muted);
                    margin-bottom: var(--spacing-xs);
                }

                .login-demo code {
                    color: var(--primary-light);
                    font-family: var(--font-mono);
                }
            `}</style>
        </div>
    );
}
