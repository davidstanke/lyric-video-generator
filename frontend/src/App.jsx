import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import EditorPage from './pages/EditorPage';
import ResultPage from './pages/ResultPage';

function App() {
  const [appData, setAppData] = useState({
    audioPath: null,
    manifest: null,
    videoUrl: null
  });

  return (
    <Router>
      <div className="container">
        <header className="header animate-fade-in">
          <h1>Lyric Video Generator</h1>
          <p>Turn your audio into stunning lyric videos automatically.</p>
        </header>

        <Routes>
          <Route 
            path="/" 
            element={<UploadPage setAppData={setAppData} />} 
          />
          <Route 
            path="/editor" 
            element={
              appData.manifest ? (
                <EditorPage appData={appData} setAppData={setAppData} />
              ) : (
                <Navigate to="/" />
              )
            } 
          />
          <Route 
            path="/result" 
            element={
              appData.videoUrl ? (
                <ResultPage videoUrl={appData.videoUrl} />
              ) : (
                <Navigate to="/" />
              )
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
