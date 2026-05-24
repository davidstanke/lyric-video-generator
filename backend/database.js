const path = require('path');
const fs = require('fs');

const isProd = process.env.NODE_ENV === 'production';

// Ensure storage directory exists at the root (for local mode)
const storageDir = path.join(__dirname, '..', 'storage');
if (!isProd && !fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// Subdirectories inside storage (for local mode)
const subdirs = ['audio', 'video', 'subtitles'];
if (!isProd) {
  subdirs.forEach(dir => {
    const p = path.join(storageDir, dir);
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
    }
  });
}

const dbPath = path.join(storageDir, 'database.sqlite');
let db;
let firestoreClient;

if (!isProd) {
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err.message);
    } else {
      console.log('Connected to SQLite database at', dbPath);
      initializeDatabase();
    }
  });
} else {
  console.log('Production environment detected. Initializing Cloud Firestore...');
  const { Firestore } = require('@google-cloud/firestore');
  firestoreClient = new Firestore({
    projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'lyric-video-generator-2026',
  });
  
  // Provide a safe mock database object for build-time initialization scripts
  db = {
    close() {
      console.log('Closing mock database connection.');
    }
  };
}

function initializeDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        audio_path TEXT NOT NULL,
        manifest TEXT NOT NULL,
        video_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating projects table:', err.message);
      } else {
        console.log('Database tables initialized successfully.');
        
        // Run schema migration to add background_color column if missing
        db.all("PRAGMA table_info(projects)", (pragmaErr, columns) => {
          if (pragmaErr) {
            console.error('Error reading projects table schema:', pragmaErr.message);
            return;
          }
          if (columns) {
            const hasBgColor = columns.some(col => col.name === 'background_color');
            if (!hasBgColor) {
              db.run("ALTER TABLE projects ADD COLUMN background_color TEXT DEFAULT '#0f111a'", (alterErr) => {
                if (alterErr) {
                  console.error('Error adding background_color column:', alterErr.message);
                } else {
                  console.log('Successfully added background_color column with default value.');
                }
              });
            }
          }
        });
      }
    });
  });
}

// Map Firestore document data to standard schema structure
function mapFirestoreDoc(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    audio_path: data.audio_path,
    manifest: data.manifest,
    video_path: data.video_path || null,
    created_at: data.created_at ? data.created_at.toDate().toISOString() : null,
    updated_at: data.updated_at ? data.updated_at.toDate().toISOString() : null,
    background_color: data.background_color || '#0f111a'
  };
}

// Unified repository queries (NO ORM!)
const dbQuery = {
  // Legacy raw SQLite support to prevent breaking any un-refactored scripts
  all(sql, params = []) {
    if (isProd) {
      throw new Error('Raw SQL queries are not supported in production (Firestore). Use named database methods.');
    }
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  
  get(sql, params = []) {
    if (isProd) {
      throw new Error('Raw SQL queries are not supported in production (Firestore). Use named database methods.');
    }
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  
  run(sql, params = []) {
    if (isProd) {
      throw new Error('Raw SQL queries are not supported in production (Firestore). Use named database methods.');
    }
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },

  // Named database operations for clean abstraction
  async getAllProjects() {
    if (isProd) {
      const snapshot = await firestoreClient.collection('projects')
        .orderBy('created_at', 'desc')
        .get();
      const projects = [];
      snapshot.forEach(doc => {
        projects.push(mapFirestoreDoc(doc));
      });
      return projects;
    } else {
      return new Promise((resolve, reject) => {
        db.all('SELECT id, name, audio_path, video_path, created_at, updated_at, background_color FROM projects ORDER BY created_at DESC', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
  },

  async getProjectById(id) {
    if (isProd) {
      const docRef = firestoreClient.collection('projects').doc(id.toString());
      const doc = await docRef.get();
      if (!doc.exists) return null;
      return mapFirestoreDoc(doc);
    } else {
      return new Promise((resolve, reject) => {
        db.get('SELECT * FROM projects WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    }
  },

  async createProject({ name, audio_path, manifest, background_color = '#0f111a' }) {
    if (isProd) {
      const docRef = firestoreClient.collection('projects').doc();
      const projectData = {
        name,
        audio_path,
        manifest,
        video_path: null,
        created_at: new Date(),
        updated_at: new Date(),
        background_color
      };
      await docRef.set(projectData);
      return { id: docRef.id };
    } else {
      return new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO projects (name, audio_path, manifest, background_color) VALUES (?, ?, ?, ?)',
          [name, audio_path, manifest, background_color],
          function (err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          }
        );
      });
    }
  },

  async updateProjectManifest(id, manifest) {
    if (isProd) {
      const docRef = firestoreClient.collection('projects').doc(id.toString());
      await docRef.update({
        manifest,
        updated_at: new Date()
      });
      return { success: true };
    } else {
      return new Promise((resolve, reject) => {
        db.run(
          'UPDATE projects SET manifest = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [manifest, id],
          (err) => {
            if (err) reject(err);
            else resolve({ success: true });
          }
        );
      });
    }
  },

  async renameProject(id, name) {
    if (isProd) {
      const docRef = firestoreClient.collection('projects').doc(id.toString());
      await docRef.update({
        name,
        updated_at: new Date()
      });
      return { success: true };
    } else {
      return new Promise((resolve, reject) => {
        db.run(
          'UPDATE projects SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [name, id],
          (err) => {
            if (err) reject(err);
            else resolve({ success: true });
          }
        );
      });
    }
  },

  async updateProjectBackgroundColor(id, backgroundColor) {
    if (isProd) {
      const docRef = firestoreClient.collection('projects').doc(id.toString());
      await docRef.update({
        background_color: backgroundColor,
        updated_at: new Date()
      });
      return { success: true };
    } else {
      return new Promise((resolve, reject) => {
        db.run(
          'UPDATE projects SET background_color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [backgroundColor, id],
          (err) => {
            if (err) reject(err);
            else resolve({ success: true });
          }
        );
      });
    }
  },

  async updateProjectVideoPath(id, videoPath) {
    if (isProd) {
      const docRef = firestoreClient.collection('projects').doc(id.toString());
      await docRef.update({
        video_path: videoPath,
        updated_at: new Date()
      });
      return { success: true };
    } else {
      return new Promise((resolve, reject) => {
        db.run(
          'UPDATE projects SET video_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [videoPath, id],
          (err) => {
            if (err) reject(err);
            else resolve({ success: true });
          }
        );
      });
    }
  },

  async deleteProject(id) {
    if (isProd) {
      const docRef = firestoreClient.collection('projects').doc(id.toString());
      await docRef.delete();
      return { success: true };
    } else {
      return new Promise((resolve, reject) => {
        db.run('DELETE FROM projects WHERE id = ?', [id], (err) => {
          if (err) reject(err);
          else resolve({ success: true });
        });
      });
    }
  }
};

module.exports = { db, dbQuery, storageDir };
