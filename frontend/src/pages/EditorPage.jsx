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
  
  // Audio state & reference
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const fetchProject = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`/api/projects/${id}`);
        setProject(response.data);
        setManifest(response.data.manifest || []);
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
        <h2 style={{ marginBottom: '0.25rem' }}>{project.name}</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Original Audio Path: <code style={{ background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.3rem', borderRadius: '4px', wordBreak: 'break-all' }}>{project.audio_path}</code>
        </p>
      </div>

      {isManual && (
        <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', color: '#f59e0b', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
          ⚠️ <strong>Manual Creation Mode Active</strong>: Speech-to-text service is offline or unconfigured. Please type lyrics and capture timestamps manually.
        </div>
      )}

      {/* Integrated Audio Player */}
      <div className="audio-player-container" style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Audio Reference Player</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--accent-light)', fontFamily: 'monospace', fontWeight: 'bold' }}>
            Current Time: {currentTime.toFixed(1)}s
          </span>
        </div>
        <audio 
          ref={audioRef}
          src={project.audioUrl} 
          controls 
          onTimeUpdate={handleTimeUpdate}
          style={{ width: '100%', borderRadius: '8px' }}
        />
      </div>

      {error && (
        <div style={{ color: '#ef4444', marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 120px 1fr 40px', gap: '1rem', padding: '0 1rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>
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
                gridTemplateColumns: '120px 120px 1fr 40px', 
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
