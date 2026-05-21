import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

// SRT Utility Functions
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  
  const pad = (num, size = 2) => String(num).padStart(size, '0');
  
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function stringifySrt(manifestList) {
  return manifestList.map((seg, index) => {
    const seq = index + 1;
    const start = formatTime(seg.startTime);
    const end = formatTime(seg.endTime);
    return `${seq}\n${start} --> ${end}\n${seg.text || ''}`;
  }).join('\n\n');
}

function parseSrtTime(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.replace(',', '.').split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return parseFloat((hours * 3600 + minutes * 60 + seconds).toFixed(3));
  } else if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return parseFloat((minutes * 60 + seconds).toFixed(3));
  } else {
    return parseFloat(timeStr) || 0;
  }
}

function parseSrt(srtText) {
  const lines = srtText.split(/\r?\n/);
  const segments = [];
  let currentSeg = null;
  let tempTextLines = [];
  let nextId = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect timestamp line
    if (line.includes('-->')) {
      const timeMatch = line.match(/(\d{1,2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)\s*-->\s*(\d{1,2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)/);
      if (!timeMatch) {
        throw new Error(`Invalid timestamp format on line ${i + 1}: "${line}"`);
      }

      // Save previous segment
      if (currentSeg) {
        currentSeg.text = tempTextLines.join('\n').trim();
        segments.push(currentSeg);
        currentSeg = null;
        tempTextLines = [];
      }

      // Check if previous line was a sequence number
      let seq = nextId++;
      if (i > 0) {
        const prevLine = lines[i - 1].trim();
        if (/^\d+$/.test(prevLine)) {
          seq = parseInt(prevLine, 10);
          if (segments.length > 0) {
            const prevSegTextLines = segments[segments.length - 1].text.split('\n');
            if (prevSegTextLines[prevSegTextLines.length - 1].trim() === prevLine) {
              prevSegTextLines.pop();
              segments[segments.length - 1].text = prevSegTextLines.join('\n').trim();
            }
          }
        }
      }

      currentSeg = {
        id: seq,
        startTime: parseSrtTime(timeMatch[1]),
        endTime: parseSrtTime(timeMatch[2]),
        text: ''
      };
      continue;
    }

    if (currentSeg) {
      tempTextLines.push(lines[i]);
    }
  }

  if (currentSeg) {
    currentSeg.text = tempTextLines.join('\n').trim();
    segments.push(currentSeg);
  }

  // Strip trailing numbers
  for (let j = 0; j < segments.length; j++) {
    const seg = segments[j];
    const segLines = seg.text.split(/\r?\n/);
    if (segLines.length > 1 && /^\d+$/.test(segLines[segLines.length - 1].trim())) {
      segLines.pop();
      seg.text = segLines.join('\n').trim();
    }
  }

  if (srtText.trim() && segments.length === 0) {
    throw new Error('Could not parse any valid SRT segments. Check the formatting structure (sequence number, timestamp, and text block).');
  }

  return segments;
}

function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [manifest, setManifest] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState(null);

  // Raw SRT editing state
  const [editMode, setEditMode] = useState('table'); // 'table' or 'raw'
  const [srtText, setSrtText] = useState('');
  const [validationError, setValidationError] = useState(null);
  const [isRawDirty, setIsRawDirty] = useState(false);
  
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

  const handleSwitchToTable = () => {
    if (editMode === 'table') return;
    try {
      const parsedManifest = parseSrt(srtText);
      setManifest(parsedManifest);
      setValidationError(null);
      setIsRawDirty(false);
      setEditMode('table');
    } catch (err) {
      setValidationError(err.message || 'Failed to parse SRT. Please check formatting.');
    }
  };

  const handleSwitchToRaw = () => {
    if (editMode === 'raw') return;
    const rawSrt = stringifySrt(manifest);
    setSrtText(rawSrt);
    setValidationError(null);
    setIsRawDirty(false);
    setEditMode('raw');
  };

  const handleRawTextChange = (e) => {
    const val = e.target.value;
    setSrtText(val);
    setIsRawDirty(true);
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleRevertRawChanges = () => {
    setConfirmModal({
      title: 'Discard Raw Edits?',
      message: 'Are you sure you want to discard your raw SRT edits and revert to the last saved state? All unsaved text changes will be lost.',
      onConfirm: () => {
        const rawSrt = stringifySrt(manifest);
        setSrtText(rawSrt);
        setValidationError(null);
        setIsRawDirty(false);
        setConfirmModal(null);
      }
    });
  };

  const handleSaveManifest = async () => {
    setIsSaving(true);
    setError(null);
    setValidationError(null);
    try {
      let activeManifest = manifest;
      if (editMode === 'raw') {
        activeManifest = parseSrt(srtText);
        setManifest(activeManifest);
        setIsRawDirty(false);
      }
      await axios.put(`/api/projects/${id}/manifest`, { manifest: activeManifest });
      showToast('Manifest saved successfully!', 'success');
    } catch (err) {
      console.error(err);
      if (err.message && !err.response) {
        setValidationError(err.message);
        setError('Please fix the SRT formatting errors before saving.');
      } else {
        setError(err.response?.data?.error || 'Failed to save manifest.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRender = async () => {
    setIsRendering(true);
    setError(null);
    setValidationError(null);

    try {
      let activeManifest = manifest;
      if (editMode === 'raw') {
        activeManifest = parseSrt(srtText);
        setManifest(activeManifest);
        setIsRawDirty(false);
      }
      
      // First auto-save the manifest to ensure the video has the latest edits
      await axios.put(`/api/projects/${id}/manifest`, { manifest: activeManifest });
      
      await axios.post(`/api/projects/${id}/render`);
      
      navigate(`/projects/${id}/result`);
    } catch (err) {
      console.error(err);
      if (err.message && !err.response) {
        setValidationError(err.message);
        setError('Please fix the SRT formatting errors before rendering.');
      } else {
        setError(err.response?.data?.error || 'Failed to render video.');
      }
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
    
    if (field === 'endTime') {
      const index = manifest.findIndex(seg => seg.id === segId);
      if (index !== -1 && index < manifest.length - 1) {
        const nextSegment = manifest[index + 1];
        if (nextSegment.startTime === 0) {
          setManifest(manifest.map((seg, i) => {
            if (seg.id === segId) {
              return { ...seg, endTime: time };
            } else if (i === index + 1) {
              return { ...seg, startTime: time };
            }
            return seg;
          }));
          return;
        }
      }
    }
    
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

      {/* Mode Segmented Tab Control */}
      <div className="segmented-tabs-container">
        <div className="segmented-tabs">
          <button 
            className={`segmented-tab ${editMode === 'table' ? 'active' : ''}`}
            onClick={handleSwitchToTable}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            Line-by-Line Editor
          </button>
          <button 
            className={`segmented-tab ${editMode === 'raw' ? 'active' : ''}`}
            onClick={handleSwitchToRaw}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Raw SRT Editor
          </button>
        </div>
      </div>

      {editMode === 'table' ? (
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
      ) : (
        <div className="raw-srt-container animate-fade-in">
          <div className="raw-srt-header">
            <div className="raw-srt-tips">
              <span className="raw-srt-tip-badge">SRT Format Guide</span>
              <span className="raw-srt-tip-text">
                Format: <code>[Seq]</code>, <code>[Start Timestamp] --&gt; [End Timestamp]</code>, then <code>[Lyric text]</code>. Leave an empty line between segments.
              </span>
            </div>
            <button 
              className="btn btn-secondary revert-btn" 
              onClick={handleRevertRawChanges}
              disabled={!isRawDirty}
              title="Discard your raw SRT edits and restore back to original state"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', height: '32px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                <path d="M2.5 2v6h6M21.5 22v-6h-6"></path>
                <path d="M22 11.5A10 10 0 0 0 3.2 7.2L2.5 8M21.5 16l-.7 1.8A10 10 0 0 1 2 12.5"></path>
              </svg>
              Revert Changes
            </button>
          </div>

          <textarea
            className="raw-srt-textarea"
            value={srtText}
            onChange={handleRawTextChange}
            placeholder={`1\n00:00:01,000 --> 00:00:05,000\nType your lyric text here...\n\n2\n00:00:05,000 --> 00:00:10,000\nType the next line...`}
            spellCheck="false"
          />

          {validationError && (
            <div className="validation-alert-banner">
              <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <div>
                  <h4 style={{ color: '#ef4444', margin: '0 0 0.25rem 0', fontSize: '0.9rem', fontWeight: 'bold' }}>SRT Syntax Error</h4>
                  <p style={{ color: '#fca5a5', margin: 0, fontSize: '0.8rem', lineHeight: '1.4' }}>{validationError}</p>
                </div>
              </div>
            </div>
          )}
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
              <div className="modal-icon-container warning">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
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
              <button className="btn" style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }} onClick={confirmModal.onConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditorPage;
