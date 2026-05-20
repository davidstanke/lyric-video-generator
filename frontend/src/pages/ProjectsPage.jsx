import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const fetchProjects = async () => {
      try {
        const response = await axios.get('/api/projects');
        if (isMounted) {
          setProjects(response.data);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setError('Failed to fetch projects list.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchProjects();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project and all its associated files from disk?')) {
      return;
    }

    try {
      await axios.delete(`/api/projects/${id}`);
      setProjects(projects.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete project.');
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>My Lyric Video Projects</h2>
        <Link to="/new" className="btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Create New Video
        </Link>
      </div>

      {error && (
        <div style={{ color: '#ef4444', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }} className="animate-pulse">
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem', opacity: 0.5 }}>
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
          <h3>No projects yet</h3>
          <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>Upload an audio file to generate your first synchronized lyric video!</p>
          <Link to="/new" className="btn btn-secondary">Get Started</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {projects.map((project) => (
            <div 
              key={project.id} 
              className="project-row"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(0,0,0,0.2)',
                padding: '1.25rem',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onClick={() => navigate(`/projects/${project.id}/edit`)}
              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-light)'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
            >
              <div>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>{project.name}</h3>
                <p style={{ fontSize: '0.85rem' }}>
                  Created: {new Date(project.created_at).toLocaleDateString()} at {new Date(project.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {project.video_path ? (
                  <button 
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', color: '#10b981', borderColor: '#10b981' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/projects/${project.id}/result`);
                    }}
                  >
                    Play Video
                  </button>
                ) : (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.75rem', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                    Draft
                  </span>
                )}

                <button 
                  className="btn" 
                  style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                  onClick={() => navigate(`/projects/${project.id}/edit`)}
                >
                  Edit
                </button>

                <button 
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  onClick={(e) => handleDelete(project.id, e)}
                  title="Delete Project"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectsPage;
