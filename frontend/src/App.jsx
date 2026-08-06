import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ProjectsPage from './pages/ProjectsPage';
import UploadPage from './pages/UploadPage';
import EditorPage from './pages/EditorPage';
import ResultPage from './pages/ResultPage';

function App() {
  return (
    <Router>
      <header className="site-navbar">
        <div className="navbar-container">
          <Link to="/" className="navbar-brand">
            <svg className="navbar-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Studio Reel-to-Reel / Mic Icon */}
              <circle cx="6" cy="12" r="4" stroke="var(--accent-light)" strokeWidth="2"></circle>
              <circle cx="18" cy="12" r="4" stroke="var(--accent-light)" strokeWidth="2"></circle>
              <path d="M6 16h12" stroke="var(--lcd-cyan-bright)" strokeWidth="1.5"></path>
              <path d="M6 8h12" stroke="var(--lcd-cyan-bright)" strokeWidth="1.5"></path>
              <circle cx="6" cy="12" r="1.5" fill="var(--vu-green)"></circle>
              <circle cx="18" cy="12" r="1.5" fill="var(--vu-green)"></circle>
            </svg>
            <span className="navbar-title" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.02em' }}>
              LYRIC STUDIO <span style={{ fontSize: '0.75rem', color: 'var(--lcd-cyan)', fontWeight: 'bold', verticalAlign: 'super' }}>DAW v2.0</span>
            </span>
          </Link>

          <div className="navbar-status-bar">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="led-lamp green"></span> 48kHz / 24-BIT
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="led-lamp amber"></span> SYNC LOCK
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="led-lamp red"></span> MASTER REC
            </span>
          </div>

          <div className="navbar-links">
            <Link to="/" className="navbar-link-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              SESSIONS
            </Link>
            <Link to="/new" className="navbar-link-btn" style={{ background: 'linear-gradient(180deg, var(--accent-light) 0%, var(--accent) 100%)', color: '#fff' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              NEW SESSION
            </Link>
          </div>
        </div>
      </header>

      <div className="container">
        <Routes>
          <Route 
            path="/" 
            element={<ProjectsPage />} 
          />
          <Route 
            path="/new" 
            element={<UploadPage />} 
          />
          <Route 
            path="/projects/:id/edit" 
            element={<EditorPage />} 
          />
          <Route 
            path="/projects/:id/result" 
            element={<ResultPage />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
