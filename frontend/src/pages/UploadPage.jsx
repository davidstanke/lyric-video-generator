import { useState, useRef, useEffect } from 'react';
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
  const [isConfigured, setIsConfigured] = useState(true);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkConfig = async () => {
      try {
        const response = await axios.get('/api/config');
        setIsConfigured(response.data.speechConfigured);
      } catch (err) {
        console.error('Failed to fetch config status', err);
        setIsConfigured(true); // default to true to not block if endpoint fails
      }
    };
    checkConfig();
  }, []);

  const renderSetupInstructions = () => {
    return (
      <div className="animate-fade-in" style={{
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1.5px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '16px',
        padding: '2rem',
        marginTop: '0.5rem',
        marginBottom: '2rem',
        textAlign: 'left'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)',
            borderRadius: '50%',
            padding: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#f87171', fontSize: '1.25rem', fontWeight: '700' }}>Google Cloud Service Account Required</h3>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Automatic lyric generation (Speech-to-Text) is unavailable because credentials are not configured.
            </p>
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Setup Instructions:
          </h4>
          <ol style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
            <li style={{ marginBottom: '0.75rem' }}>
              <strong style={{ color: 'var(--text-main)' }}>Enable API:</strong> Go to the <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-light)', textDecoration: 'underline' }}>Google Cloud Console</a> and enable the <strong style={{ color: 'var(--text-main)' }}>Cloud Speech-to-Text API</strong>.
            </li>
            <li style={{ marginBottom: '0.75rem' }}>
              <strong style={{ color: 'var(--text-main)' }}>Create Service Account:</strong> Navigate to <em style={{ fontStyle: 'normal', color: 'var(--text-main)' }}>IAM & Admin → Service Accounts</em> and create a service account.
            </li>
            <li style={{ marginBottom: '0.75rem' }}>
              <strong style={{ color: 'var(--text-main)' }}>Download JSON Key:</strong> Select the service account, go to the <em style={{ fontStyle: 'normal', color: 'var(--text-main)' }}>Keys</em> tab, click <em style={{ fontStyle: 'normal', color: 'var(--text-main)' }}>Add Key → Create new key</em>, select <strong style={{ color: 'var(--text-main)' }}>JSON</strong>, and download the key.
            </li>
            <li>
              <strong style={{ color: 'var(--text-main)' }}>Save Key File:</strong> Save the downloaded JSON file as <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontFamily: 'monospace', color: 'var(--text-main)' }}>service-account-key.json</code> in the project's root folder.
            </li>
          </ol>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            className="btn" 
            onClick={() => window.location.reload()}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          >
            🔄 Check Again
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            After saving the file, restart the application services to apply changes.
          </span>
        </div>
      </div>
    );
  };

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
      const errResponse = err.response?.data;
      if (errResponse?.error === 'MissingCredentials') {
        setIsConfigured(false);
      }
      setError(errResponse?.message || errResponse?.error || 'Failed to generate lyrics. Make sure backend is running and Google Cloud credentials are set.');
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

      {!isConfigured ? (
        renderSetupInstructions()
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

export default UploadPage;
