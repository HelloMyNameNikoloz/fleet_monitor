import Header from './Header';
import Sidebar from './Sidebar';

export default function Dashboard({ children }) {
    return (
        <div className="app-layout">
            <Header />
            <div className="app-main">
                <Sidebar />
                <main className="app-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
