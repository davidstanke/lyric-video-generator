import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function EditorPage({ appData, setAppData }) {
  const [manifest, setManifest] = useState(appData.manifest || []);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleTextChange = (id, newText) => {
    setManifest(manifest.map(seg => seg.id === id ? { ...seg, text: newText } : seg));
  };

  const handleTimeChange = (id, field, newValue) => {
    setManifest(manifest.map(seg => seg.id === id ? { ...seg, [field]: parseFloat(newValue) || 0 } : seg));
  };

  const handleAddSegment = (index) => {
    const newId = Math.max(0, ...manifest.map(s => s.id)) + 1;
    const newSegment = { id: newId, startTime: 0, endTime: 0, text: '' };
    const newManifest = [...manifest];
    newManifest.splice(index + 1, 0, newSegment);
    setManifest(newManifest);
  };

  const handleDeleteSegment = (id) => {
    setManifest(manifest.filter(seg => seg.id !== id));
  };

  const handleRender = async () => {
    setIsRendering(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:3001/api/render', {
        audioPath: appData.audioPath,
        manifest: manifest
      });

      setAppData({
        ...appData,
        manifest,
        videoUrl: response.data.videoUrl
      });

      navigate('/result');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to render video.');
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Edit Lyrics Manifest</h2>
        <button 
          className="btn" 
          onClick={handleRender}
          disabled={isRendering}
        >
          {isRendering ? <span className="animate-pulse">Rendering...</span> : 'Save & Render Video'}
        </button>
      </div>

      {error && (
        <div style={{ color: '#ef4444', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 80px 1fr 40px', gap: '1rem', padding: '0 1rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>
          <div>Start (s)</div>
          <div>End (s)</div>
          <div>Lyric Text</div>
          <div></div>
        </div>

        {manifest.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            No lyrics found. Add a segment manually.
            <br/><br/>
            <button className="btn btn-secondary" onClick={() => handleAddSegment(-1)}>Add First Segment</button>
          </div>
        )}

        {manifest.map((segment, index) => (
          <div key={segment.id} style={{ display: 'grid', gridTemplateColumns: '80px 80px 1fr 40px', gap: '1rem', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <input 
              type="number" 
              step="0.1" 
              value={segment.startTime} 
              onChange={(e) => handleTimeChange(segment.id, 'startTime', e.target.value)} 
            />
            <input 
              type="number" 
              step="0.1" 
              value={segment.endTime} 
              onChange={(e) => handleTimeChange(segment.id, 'endTime', e.target.value)} 
            />
            <input 
              type="text" 
              value={segment.text} 
              onChange={(e) => handleTextChange(segment.id, e.target.value)} 
              placeholder="Enter lyric..."
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <button 
                onClick={() => handleDeleteSegment(segment.id)}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem' }}
                title="Delete"
              >
                ×
              </button>
              <button 
                onClick={() => handleAddSegment(index)}
                style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem' }}
                title="Add Below"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EditorPage;
