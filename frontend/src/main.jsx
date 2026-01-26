import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'

const storedTheme = localStorage.getItem('fleet_theme');
if (storedTheme) {
    document.documentElement.setAttribute('data-theme', storedTheme);
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
