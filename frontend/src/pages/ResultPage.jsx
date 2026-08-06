import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

function ResultPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProject = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await axios.get(`/api/projects/${id}`);
        setProject(response.data);
      } catch (err) {
        console.error(err);
        setError('Failed to load project details. Make sure the project exists.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  if (isLoading) {
    return (
      <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <p className="animate-pulse">Loading generated video details...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h3 style={{ color: '#ef4444', marginBottom: '1rem' }}>Error</h3>
        <p style={{ marginBottom: '2rem' }}>{error || 'Project not found.'}</p>
        <Link to="/" className="btn">Back to Projects</Link>
      </div>
    );
  }

  if (!project.videoUrl) {
    return (
      <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h3 style={{ color: '#eab308', marginBottom: '1rem' }}>Video Not Rendered Yet</h3>
        <p style={{ marginBottom: '2rem' }}>This project has not been rendered to video yet.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link to={`/projects/${id}/edit`} className="btn">Go to Editor</Link>
          <Link to="/" className="btn btn-secondary">Back to Projects</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rack-panel rack-unit animate-fade-in" style={{ textAlign: 'center', maxWidth: '850px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="led-lamp green"></span>
          <h2 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>MASTERING & EXPORT STUDIO</h2>
        </div>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold' }}>
          ← SESSIONS ARCHIVE
        </Link>
      </div>

      <p style={{ marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--lcd-cyan-bright)', fontFamily: 'var(--font-heading)' }}>
        {project.name}
      </p>
      <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
        Rendered master output verified. Play back on the studio monitor below or export directly to storage.
      </p>

      {/* Studio Video Monitor Bezel */}
      <div style={{
        background: '#040609',
        borderRadius: '12px',
        border: '2px solid rgba(255, 255, 255, 0.12)',
        padding: '0.75rem',
        marginBottom: '2rem',
        boxShadow: '0 25px 50px rgba(0,0,0,0.8), inset 0 0 15px rgba(0,0,0,0.9)',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0.5rem 0.75rem 0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-lcd)', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="led-lamp green"></span> MONITOR FEED 01: ONLINE
          </span>
          <span className="lcd-display" style={{ fontSize: '0.7rem' }}>FORMAT: MP4 • 1080p</span>
        </div>

        <video 
          controls 
          src={project.videoUrl} 
          style={{ width: '100%', display: 'block', maxHeight: '480px', borderRadius: '6px', background: '#000' }}
        >
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Export Action Controls */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <a href={project.videoUrl} download={`${project.name.replace(/\s+/g, '_')}.mp4`} className="btn" style={{ padding: '0.65rem 1.5rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          EXPORT MASTER VIDEO FILE
        </a>
        <Link to={`/projects/${id}/edit`} className="btn btn-secondary" style={{ padding: '0.65rem 1.25rem' }}>
          RE-MIX IN EDITOR
        </Link>
      </div>
    </div>
  );
}

export default ResultPage;

