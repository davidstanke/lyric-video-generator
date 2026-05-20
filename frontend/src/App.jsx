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
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              <circle cx="8" cy="12" r="2" fill="var(--accent-light)"></circle>
              <line x1="8" y1="10" x2="8" y2="14" stroke="var(--text-main)" strokeWidth="1.5"></line>
            </svg>
            <span className="navbar-title">Lyric Video Generator</span>
          </Link>
          <div className="navbar-links">
            <Link to="/new" className="navbar-link-btn">
              Create New
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
