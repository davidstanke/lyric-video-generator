import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [manifest, setManifest] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState(null);
  
  // Title renaming state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  
  // Audio state & reference
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  // Sticky state for player
  const [isScrolled, setIsScrolled] = useState(false);

  // Scroll listener to toggle sticky mode
  useEffect(() => {
    const handleScroll = () => {
      // Toggle sticky state if scrolled past 140px
      if (window.scrollY > 140) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Global keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle play/pause on Alt/Option + Space or Ctrl + Space
      const isAltSpace = e.altKey && e.code === 'Space';
      const isCtrlSpace = e.ctrlKey && e.code === 'Space';

      if ((isAltSpace || isCtrlSpace) && audioRef.current) {
        e.preventDefault(); // Prevent scrolling page or adding spaces in inputs
        if (audioRef.current.paused) {
          audioRef.current.play().catch(err => {
            console.error('Failed to play audio via shortcut:', err);
          });
        } else {
          audioRef.current.pause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const fetchProject = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`/api/projects/${id}`);
        setProject(response.data);
        setManifest(response.data.manifest || []);
        setEditedTitle(response.data.name || '');
      } catch (err) {
        console.error(err);
        setError('Failed to load project details. Make sure the backend is running.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  const handleTextChange = (segId, newText) => {
    setManifest(manifest.map(seg => seg.id === segId ? { ...seg, text: newText } : seg));
  };

  const handleTimeChange = (segId, field, newValue) => {
    setManifest(manifest.map(seg => seg.id === segId ? { ...seg, [field]: parseFloat(newValue) || 0 } : seg));
  };

  const handleAddSegment = (index) => {
    const newId = Math.max(0, ...manifest.map(s => s.id)) + 1;
    const newSegment = { id: newId, startTime: 0, endTime: 0, text: '' };
    const newManifest = [...manifest];
    newManifest.splice(index + 1, 0, newSegment);
    setManifest(newManifest);
  };

  const handleDeleteSegment = (segId) => {
    setManifest(manifest.filter(seg => seg.id !== segId));
  };

  const handleRenameTitle = async () => {
    if (!editedTitle.trim() || editedTitle.trim() === project.name) {
      setIsEditingTitle(false);
      return;
    }

    setIsRenaming(true);
    try {
      const response = await axios.put(`/api/projects/${id}/rename`, { name: editedTitle.trim() });
      setProject({ ...project, name: response.data.name });
      setIsEditingTitle(false);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to rename project.');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleSaveManifest = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await axios.put(`/api/projects/${id}/manifest`, { manifest });
      alert('Manifest saved successfully!');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save manifest.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRender = async () => {
    setIsRendering(true);
    setError(null);

    try {
      // First auto-save the manifest to ensure the video has the latest edits
      await axios.put(`/api/projects/${id}/manifest`, { manifest });
      
      await axios.post(`/api/projects/${id}/render`);
      
      navigate(`/projects/${id}/result`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to render video.');
    } finally {
      setIsRendering(false);
    }
  };

  const handleTimeUpdate = (e) => {
    setCurrentTime(e.target.currentTime);
  };

  const setTimeToCurrent = (segId, field) => {
    if (!audioRef.current) return;
    const time = parseFloat(audioRef.current.currentTime.toFixed(1));
    handleTimeChange(segId, field, time);
  };

  const handleJumpToSegment = (startTime) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = startTime;
    audioRef.current.play().catch(err => {
      console.error('Failed to play audio on jump:', err);
    });
  };

  if (isLoading) {
    return (
      <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <p className="animate-pulse">Loading project details...</p>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h3 style={{ color: '#ef4444', marginBottom: '1rem' }}>Error</h3>
        <p style={{ marginBottom: '2rem' }}>{error}</p>
        <Link to="/" className="btn">Back to Projects</Link>
      </div>
    );
  }

  const isManual = project?.transcriptionStatus === 'manual';

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: '950px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Back to Projects
        </Link>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={handleSaveManifest}
            disabled={isSaving || isRendering}
            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          >
            {isSaving ? 'Saving...' : 'Save Draft'}
          </button>
          <button 
            className="btn" 
            onClick={handleRender}
            disabled={isRendering || isSaving}
            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          >
            {isRendering ? <span className="animate-pulse">Rendering...</span> : 'Render Video'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        {isEditingTitle ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <input 
              type="text" 
              value={editedTitle} 
              onChange={(e) => setEditedTitle(e.target.value)} 
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameTitle();
                if (e.key === 'Escape') {
                  setEditedTitle(project.name);
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              style={{
                fontSize: '1.75rem',
                fontWeight: 'bold',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--accent-light)',
                borderRadius: '8px',
                padding: '0.25rem 0.75rem',
                color: 'var(--text-main)',
                maxWidth: '500px',
                width: '100%',
                boxSizing: 'border-box'
              }}
              disabled={isRenaming}
            />
            <button 
              onClick={handleRenameTitle}
              disabled={isRenaming}
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                borderRadius: '6px',
                color: '#10b981',
                padding: '0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px'
              }}
              title="Save Name"
            >
              {isRenaming ? (
                <span className="animate-pulse">...</span>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
            </button>
            <button 
              onClick={() => {
                setEditedTitle(project.name);
                setIsEditingTitle(false);
              }}
              disabled={isRenaming}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                borderRadius: '6px',
                color: '#ef4444',
                padding: '0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px'
              }}
              title="Cancel"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h2 
              style={{ margin: 0, cursor: 'pointer' }}
              onDoubleClick={() => setIsEditingTitle(true)}
              title="Double click to edit"
            >
              {project.name}
            </h2>
            <button 
              onClick={() => setIsEditingTitle(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-light)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              title="Edit Project Name"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
          </div>
        )}
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          Original Audio Path: <code style={{ background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.3rem', borderRadius: '4px', wordBreak: 'break-all' }}>{project.audio_path}</code>
        </p>
      </div>

      {isManual && (
        <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', color: '#f59e0b', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
          ⚠️ <strong>Manual Creation Mode Active</strong>: Speech-to-text service is offline or unconfigured. Please type lyrics and capture timestamps manually.
        </div>
      )}

      {/* Integrated Audio Player */}
      <div className={`audio-player-container ${isScrolled ? 'is-sticky' : ''}`}>
        <div className="audio-player-inner">
          <div className="audio-player-meta">
            <span className="audio-player-title-badge">Audio Reference Player</span>
            <span className="audio-player-time">
              Current Time: {currentTime.toFixed(1)}s
            </span>
          </div>
          <audio 
            ref={audioRef}
            src={project.audioUrl} 
            controls 
            onTimeUpdate={handleTimeUpdate}
          />
        </div>
      </div>

      {error && (
        <div style={{ color: '#ef4444', marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 120px 120px 1fr 40px', gap: '1rem', padding: '0 1rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>
          <div></div>
          <div>Start (s)</div>
          <div>End (s)</div>
          <div>Lyric Text</div>
          <div></div>
        </div>

        {manifest.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No lyric segments generated. Add one manually.
            <br/><br/>
            <button className="btn btn-secondary" onClick={() => handleAddSegment(-1)}>Add First Segment</button>
          </div>
        )}

        {manifest.map((segment, index) => {
          const isActive = currentTime >= segment.startTime && currentTime <= segment.endTime;
          return (
            <div 
              key={segment.id} 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: '40px 120px 120px 1fr 40px', 
                gap: '1rem', 
                alignItems: 'center', 
                background: isActive ? 'rgba(139, 92, 246, 0.12)' : 'rgba(0,0,0,0.2)', 
                padding: '0.85rem 1rem', 
                borderRadius: '8px', 
                border: '1px solid',
                borderColor: isActive ? 'var(--accent-light)' : 'var(--glass-border)',
                boxShadow: isActive ? '0 0 12px rgba(139, 92, 246, 0.2)' : 'none',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <button
                  onClick={() => handleJumpToSegment(segment.startTime)}
                  style={{
                    background: isActive ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--accent-light)' : 'var(--glass-border)',
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? '0 0 8px rgba(139, 92, 246, 0.4)' : 'none'
                  }}
                  onMouseOver={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                      e.currentTarget.style.borderColor = 'var(--accent-light)';
                      e.currentTarget.style.color = 'var(--accent-light)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'var(--glass-border)';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }
                  }}
                  title="Seek player to segment start"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ marginLeft: '1px' }}>
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <input 
                  type="number" 
                  step="0.1" 
                  value={segment.startTime} 
                  onChange={(e) => handleTimeChange(segment.id, 'startTime', e.target.value)} 
                />
                <button 
                  className="btn btn-secondary"
                  onClick={() => setTimeToCurrent(segment.id, 'startTime')}
                  style={{ padding: '0.2rem', fontSize: '0.7rem', borderRadius: '4px', minHeight: 'auto', display: 'block', width: '100%', textTransform: 'uppercase', letterSpacing: '0.02em' }}
                  title="Capture current audio time"
                >
                  ⏱ Capture
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <input 
                  type="number" 
                  step="0.1" 
                  value={segment.endTime} 
                  onChange={(e) => handleTimeChange(segment.id, 'endTime', e.target.value)} 
                />
                <button 
                  className="btn btn-secondary"
                  onClick={() => setTimeToCurrent(segment.id, 'endTime')}
                  style={{ padding: '0.2rem', fontSize: '0.7rem', borderRadius: '4px', minHeight: 'auto', display: 'block', width: '100%', textTransform: 'uppercase', letterSpacing: '0.02em' }}
                  title="Capture current audio time"
                >
                  ⏱ Capture
                </button>
              </div>

              <input 
                type="text" 
                value={segment.text} 
                onChange={(e) => handleTextChange(segment.id, e.target.value)} 
                placeholder="Enter lyric sentence..."
                style={{ height: '42px', border: isActive ? '1px solid var(--accent-light)' : '1px solid var(--glass-border)' }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
                <button 
                  onClick={() => handleDeleteSegment(segment.id)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', padding: '0.1rem', lineHeight: 1 }}
                  title="Delete Row"
                >
                  ×
                </button>
                <button 
                  onClick={() => handleAddSegment(index)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.1rem', lineHeight: 1 }}
                  title="Add Row Below"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EditorPage;
