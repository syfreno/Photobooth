const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup storage untuk pattern
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const patternsDir = path.join(__dirname, '../uploads/patterns');
    if (!fs.existsSync(patternsDir)) {
      fs.mkdirSync(patternsDir, { recursive: true });
    }
    cb(null, patternsDir);
  },
  filename: (req, file, cb) => {
    // Gunakan timestamp + nama asli file untuk menghindari konflik nama
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// File untuk menyimpan metadata pattern
const patternsDbPath = path.join(__dirname, '../data/patterns.json');

// Pastikan direktori data ada
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Inisialisasi file database jika belum ada
if (!fs.existsSync(patternsDbPath)) {
  fs.writeFileSync(patternsDbPath, JSON.stringify({ patterns: [] }));
}

// Helper function untuk membaca database
const readPatternsDb = () => {
  try {
    const data = fs.readFileSync(patternsDbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading patterns database:', error);
    return { patterns: [] };
  }
};

// Helper function untuk menulis ke database
const writePatternsDb = (data) => {
  try {
    fs.writeFileSync(patternsDbPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing patterns database:', error);
    return false;
  }
};

// Get all patterns
router.get('/patterns', (req, res) => {
  const db = readPatternsDb();
  res.json(db.patterns);
});

// Upload new pattern
router.post('/patterns', upload.single('patternImage'), (req, res) => {
  try {
    if (!req.file || !req.body.name) {
      return res.status(400).json({ error: 'Pattern image and name are required' });
    }

    const db = readPatternsDb();
    const newPattern = {
      id: Date.now().toString(),
      name: req.body.name,
      filename: req.file.filename,
      url: `/uploads/patterns/${req.file.filename}`,
      createdAt: new Date().toISOString()
    };

    db.patterns.push(newPattern);
    writePatternsDb(db);

    res.json(newPattern);
  } catch (error) {
    console.error('Error uploading pattern:', error);
    res.status(500).json({ error: 'Failed to upload pattern' });
  }
});

// Delete pattern
router.delete('/patterns/:id', (req, res) => {
  try {
    const db = readPatternsDb();
    const pattern = db.patterns.find(p => p.id === req.params.id);
    
    if (!pattern) {
      return res.status(404).json({ error: 'Pattern not found' });
    }

    // Hapus file pattern
    const filePath = path.join(__dirname, '../uploads/patterns', pattern.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Update database
    db.patterns = db.patterns.filter(p => p.id !== req.params.id);
    writePatternsDb(db);

    res.json({ message: 'Pattern deleted successfully' });
  } catch (error) {
    console.error('Error deleting pattern:', error);
    res.status(500).json({ error: 'Failed to delete pattern' });
  }
});

module.exports = router; 