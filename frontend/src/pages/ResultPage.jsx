import React from 'react';
import { useNavigate } from 'react-router-dom';

function ResultPage({ videoUrl }) {
  const navigate = useNavigate();

  return (
    <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ marginBottom: '1rem', background: '-webkit-linear-gradient(45deg, #10b981, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Video Generated Successfully!
      </h2>
      <p style={{ marginBottom: '2rem' }}>Your lyric video is ready. Preview it below or download it to your device.</p>

      <div style={{ background: '#000', borderRadius: '12px', overflow: 'hidden', marginBottom: '2rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <video 
          controls 
          src={videoUrl} 
          style={{ width: '100%', display: 'block', maxHeight: '500px' }}
        >
          Your browser does not support the video tag.
        </video>
      </div>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <a href={videoUrl} download="lyric_video.mp4" className="btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download Video
        </a>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          Start Over
        </button>
      </div>
    </div>
  );
}

export default ResultPage;
