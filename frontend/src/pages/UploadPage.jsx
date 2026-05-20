import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function UploadPage({ setAppData }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('audio', file);

    try {
      const response = await axios.post('http://localhost:3001/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setAppData({
        audioPath: response.data.audioPath,
        manifest: response.data.manifest,
        videoUrl: null
      });

      navigate('/editor');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to upload and transcribe audio. Make sure backend is running and Google Cloud credentials are set.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ textAlign: 'center' }}>
      <h2>Upload Audio</h2>
      <p style={{ marginBottom: '2rem' }}>Select an MP3 file to automatically generate lyrics.</p>

      <div 
        style={{
          border: '2px dashed var(--glass-border)',
          borderRadius: '12px',
          padding: '3rem',
          marginBottom: '2rem',
          cursor: 'pointer',
          background: 'rgba(0,0,0,0.2)',
          transition: 'all 0.3s ease'
        }}
        onClick={() => !isUploading && fileInputRef.current.click()}
        onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-light)'}
        onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
      >
        <input 
          type="file" 
          accept="audio/mpeg, audio/mp3" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileChange}
        />
        {file ? (
          <div>
            <h3 style={{ color: 'var(--accent-light)' }}>{file.name}</h3>
            <p>({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
          </div>
        ) : (
          <div>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p>Click or drag to upload an MP3 file</p>
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: '#ef4444', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      <button 
        className="btn" 
        onClick={handleUpload} 
        disabled={!file || isUploading}
        style={{ width: '100%', maxWidth: '300px' }}
      >
        {isUploading ? (
          <span className="animate-pulse">Processing Audio...</span>
        ) : (
          'Generate Lyrics Manifest'
        )}
      </button>
    </div>
  );
}

export default UploadPage;
