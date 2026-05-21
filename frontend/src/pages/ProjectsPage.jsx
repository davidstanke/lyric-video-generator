import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Custom toast and confirm modal states
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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

  const handleDelete = (id, e) => {
    e.stopPropagation();
    setConfirmModal({
      title: 'Delete Project?',
      message: 'Are you sure you want to delete this project and all its associated files from disk? This action is permanent and cannot be undone.',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await axios.delete(`/api/projects/${id}`);
          setProjects(projects.filter(p => p.id !== id));
          showToast('Project deleted successfully.', 'success');
        } catch (err) {
          console.error(err);
          showToast('Failed to delete project.', 'error');
        } finally {
          setConfirmModal(null);
        }
      }
    });
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

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <div className={`toast-icon ${toast.type}`}>
              {toast.type === 'success' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              )}
            </div>
            <div className="toast-content">{toast.message}</div>
            <button className="toast-close" onClick={() => setToast(null)} title="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div className={`modal-icon-container ${confirmModal.isDestructive ? 'danger' : 'warning'}`}>
                {confirmModal.isDestructive ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                )}
              </div>
              <h3 className="modal-title">{confirmModal.title}</h3>
            </div>
            <div className="modal-body">
              {confirmModal.message}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }} onClick={() => setConfirmModal(null)}>
                Cancel
              </button>
              <button 
                className={`btn ${confirmModal.isDestructive ? 'btn-danger' : ''}`} 
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }} 
                onClick={confirmModal.onConfirm}
              >
                {confirmModal.confirmText || (confirmModal.isDestructive ? 'Delete' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectsPage;
