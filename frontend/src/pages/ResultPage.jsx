import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

function ResultPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProject = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await axios.get(`/api/projects/${id}`);
        setProject(response.data);
      } catch (err) {
        console.error(err);
        setError('Failed to load project details. Make sure the project exists.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  if (isLoading) {
    return (
      <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <p className="animate-pulse">Loading generated video details...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h3 style={{ color: '#ef4444', marginBottom: '1rem' }}>Error</h3>
        <p style={{ marginBottom: '2rem' }}>{error || 'Project not found.'}</p>
        <Link to="/" className="btn">Back to Projects</Link>
      </div>
    );
  }

  if (!project.videoUrl) {
    return (
      <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h3 style={{ color: '#eab308', marginBottom: '1rem' }}>Video Not Rendered Yet</h3>
        <p style={{ marginBottom: '2rem' }}>This project has not been rendered to video yet.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link to={`/projects/${id}/edit`} className="btn">Go to Editor</Link>
          <Link to="/" className="btn btn-secondary">Back to Projects</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ marginBottom: '0.5rem', background: '-webkit-linear-gradient(45deg, #10b981, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Video Generated Successfully!
      </h2>
      <p style={{ marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-main)' }}>{project.name}</p>
      <p style={{ marginBottom: '2rem' }}>Your lyric video is ready. Preview it below or download it to your device.</p>

      <div style={{ background: '#000', borderRadius: '12px', overflow: 'hidden', marginBottom: '2rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <video 
          controls 
          src={project.videoUrl} 
          style={{ width: '100%', display: 'block', maxHeight: '500px' }}
        >
          Your browser does not support the video tag.
        </video>
      </div>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <a href={project.videoUrl} download={`${project.name.replace(/\s+/g, '_')}.mp4`} className="btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download Video
        </a>
        <Link to="/" className="btn btn-secondary">
          Back to Projects
        </Link>
      </div>
    </div>
  );
}

export default ResultPage;

