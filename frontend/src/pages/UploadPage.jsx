import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

function UploadPage() {
  const [file, setFile] = useState(null);
  const [isProbing, setIsProbing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [tempPath, setTempPath] = useState('');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(null);
      setTempPath('');
      setTitle('');
      setDuration(0);

      // Trigger pre-upload probe in the background
      setIsProbing(true);
      const formData = new FormData();
      formData.append('audio', selectedFile);

      try {
        const response = await axios.post('/api/projects/probe', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        setTempPath(response.data.tempPath);
        setTitle(response.data.guessedTitle);
        setDuration(response.data.duration);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || 'Failed to analyze audio file. Make sure backend is running and the file is valid.');
      } finally {
        setIsProbing(false);
      }
    }
  };

  const handleUpload = async () => {
    if (!tempPath || !title.trim()) return;

    setIsUploading(true);
    setError(null);

    try {
      const response = await axios.post('/api/projects', {
        tempPath,
        title: title.trim()
      });

      // Redirect to the newly created project's edit screen
      navigate(`/projects/${response.data.id}/edit`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to generate lyrics. Make sure backend is running and Google Cloud credentials are set.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ margin: 0 }}>Upload Audio</h2>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem' }}>
          ← Back to Projects
        </Link>
      </div>
      <p style={{ marginBottom: '2rem', textAlign: 'left' }}>Select an audio file (MP3, M4A, WAV, etc.) to automatically analyze metadata, edit the song title, and synchronize lyrics.</p>

      <div 
        style={{
          border: '2px dashed var(--glass-border)',
          borderRadius: '12px',
          padding: '3rem',
          marginBottom: '2rem',
          cursor: (isUploading || isProbing) ? 'default' : 'pointer',
          background: 'rgba(0,0,0,0.2)',
          transition: 'all 0.3s ease'
        }}
        onClick={() => !(isUploading || isProbing) && fileInputRef.current.click()}
        onMouseOver={(e) => !(isUploading || isProbing) && (e.currentTarget.style.borderColor = 'var(--accent-light)')}
        onMouseOut={(e) => !(isUploading || isProbing) && (e.currentTarget.style.borderColor = 'var(--glass-border)')}
      >
        <input 
          type="file" 
          accept="audio/*" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          disabled={isUploading || isProbing}
          onChange={handleFileChange}
        />
        {isProbing ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <svg className="animate-spin" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="2" x2="12" y2="6"></line>
              <line x1="12" y1="18" x2="12" y2="22"></line>
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
              <line x1="2" y1="12" x2="6" y2="12"></line>
              <line x1="18" y1="12" x2="22" y2="12"></line>
              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
            </svg>
            <p style={{ color: 'var(--accent-light)', fontWeight: '600' }}>Analyzing Audio & Extracting Metadata...</p>
          </div>
        ) : file ? (
          <div>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
              <path d="M9 18V5l12-2v13"></path>
              <circle cx="6" cy="18" r="3"></circle>
              <circle cx="18" cy="16" r="3"></circle>
            </svg>
            <h3 style={{ color: 'var(--text-main)', wordBreak: 'break-all', marginBottom: '0.5rem' }}>{file.name}</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              {(file.size / 1024 / 1024).toFixed(2)} MB {duration > 0 && `• ${Math.floor(duration / 60)}m ${Math.round(duration % 60)}s`}
            </p>
            {tempPath && (
              <p style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                ✓ Audio Analyzed Successfully
              </p>
            )}
          </div>
        ) : (
          <div>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p>Click or drag to upload an audio file (MP3, M4A, WAV, etc.)</p>
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: '#ef4444', marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', textAlign: 'left' }}>
          {error}
        </div>
      )}

      {tempPath && (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          textAlign: 'left'
        }}>
          <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Song Title / Project Name
          </label>
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            placeholder="Enter song title..."
            disabled={isUploading}
            style={{ 
              width: '100%', 
              height: '46px', 
              fontSize: '1rem', 
              fontWeight: '600', 
              borderRadius: '8px', 
              padding: '0 1rem', 
              background: 'rgba(0, 0, 0, 0.3)', 
              border: '1px solid var(--glass-border)', 
              color: 'var(--text-main)',
              boxSizing: 'border-box'
            }}
          />
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', margin: 0 }}>
            We've guessed this title. You can customize it before starting transcription.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button 
          className="btn" 
          onClick={handleUpload} 
          disabled={!tempPath || !title.trim() || isUploading || isProbing}
          style={{ flex: 1, maxWidth: '250px' }}
        >
          {isUploading ? (
            <span className="animate-pulse">Processing Audio...</span>
          ) : (
            'Generate Lyrics'
          )}
        </button>
        <Link to="/" className="btn btn-secondary" style={{ flex: 1, maxWidth: '150px' }}>
          Cancel
        </Link>
      </div>
    </div>
  );
}

export default UploadPage;
