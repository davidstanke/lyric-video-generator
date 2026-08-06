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
    <div className="rack-panel rack-unit animate-fade-in" style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="led-lamp cyan"></span>
            <h2 style={{ margin: 0, fontSize: '1.6rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>STUDIO SESSION ARCHIVE</h2>
          </div>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            19" Rack Mounting Bay • Audio Track Projects & Rendered Masters
          </p>
        </div>
        <Link to="/new" className="btn btn-record" style={{ padding: '0.6rem 1.25rem' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          NEW SESSION
        </Link>
      </div>

      {/* Session Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.75rem' }}>
        <div style={{ background: '#07090e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.85rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.2rem' }}>TOTAL SESSIONS</span>
          <span className="font-mono" style={{ fontSize: '1.4rem', color: 'var(--lcd-cyan-bright)', fontWeight: 'bold' }}>{projects.length}</span>
        </div>
        <div style={{ background: '#07090e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.85rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.2rem' }}>MASTER EXPORTS</span>
          <span className="font-mono" style={{ fontSize: '1.4rem', color: 'var(--vu-green)', fontWeight: 'bold' }}>{projects.filter(p => p.video_path).length}</span>
        </div>
        <div style={{ background: '#07090e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.85rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.2rem' }}>ACTIVE DRAFTS</span>
          <span className="font-mono" style={{ fontSize: '1.4rem', color: 'var(--lcd-amber)', fontWeight: 'bold' }}>{projects.filter(p => !p.video_path).length}</span>
        </div>
      </div>

      {error && (
        <div style={{ color: '#ef4444', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="lcd-display amber animate-pulse">READING RACK ARCHIVE MEMORY...</p>
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#07090e', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem', opacity: 0.5 }}>
            <circle cx="7" cy="12" r="5"></circle>
            <circle cx="17" cy="12" r="5"></circle>
            <path d="M7 17h10"></path>
          </svg>
          <h3 style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-main)' }}>RACK ARCHIVE EMPTY</h3>
          <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No recording sessions found in database. Ingest an audio track to start.</p>
          <Link to="/new" className="btn btn-secondary">LOAD AUDIO TRACK</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {projects.map((project, idx) => {
            const rackSlot = String(idx + 1).padStart(2, '0');
            const hasVideo = Boolean(project.video_path);
            return (
              <div 
                key={project.id} 
                className="channel-strip"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'linear-gradient(180deg, #131722 0%, #0d0f17 100%)',
                  padding: '1.1rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderLeft: `4px solid ${hasVideo ? 'var(--vu-green)' : 'var(--lcd-amber)'}`,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer'
                }}
                onClick={() => navigate(`/projects/${project.id}/edit`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className="channel-badge" style={{ fontSize: '0.8rem' }}>BAY {rackSlot}</span>
                  <div>
                    <h3 style={{ color: 'var(--text-main)', marginBottom: '0.2rem', fontSize: '1.1rem' }}>{project.name}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, fontFamily: 'var(--font-lcd)' }}>
                      TIMESTAMP: {new Date(project.created_at).toLocaleDateString()} • {new Date(project.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {hasVideo ? (
                    <button 
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', color: 'var(--vu-green)', borderColor: 'rgba(0, 255, 136, 0.4)', background: 'rgba(0, 255, 136, 0.08)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${project.id}/result`);
                      }}
                    >
                      ▶ MASTER VIDEO
                    </button>
                  ) : (
                    <span className="lcd-display amber" style={{ fontSize: '0.75rem' }}>
                      DRAFT IN EDIT
                    </span>
                  )}

                  <button 
                    className="btn" 
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                    onClick={() => navigate(`/projects/${project.id}/edit`)}
                  >
                    MIX / EDIT
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
                    title="Delete Session"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
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
