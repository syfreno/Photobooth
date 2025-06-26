const express = require('express');
const router = express.Router();
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Configure Google Drive
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '../config/google-drive-credentials.json'),
  scopes: SCOPES,
});

const drive = google.drive({ version: 'v3', auth });

// Create a folder for the day if it doesn't exist
async function createOrGetDailyFolder() {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');
  
  const folderName = `Photobooth_${today}`;

  try {
    // Check if folder exists
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });

    if (response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    // Create new folder
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    const folder = await drive.files.create({
      resource: fileMetadata,
      fields: 'id',
    });

    return folder.data.id;
  } catch (error) {
    console.error('Error creating/getting folder:', error);
    throw error;
  }
}

// Upload photo to Google Drive
router.post('/drive/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    console.log('File received:', req.file); // Debug log

    // Get or create daily folder
    const folderId = await createOrGetDailyFolder();
    console.log('Folder ID:', folderId); // Debug log

    // Upload file to Google Drive
    const response = await drive.files.create({
      requestBody: {
        name: req.file.originalname,
        parents: [folderId],
      },
      media: {
        mimeType: req.file.mimetype,
        body: fs.createReadStream(req.file.path),
      },
      fields: 'id, webViewLink',
    });

    console.log('Upload response:', response.data); // Debug log

    // Make file accessible to anyone with the link
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Clean up the temporary file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    res.json({
      success: true,
      driveLink: response.data.webViewLink,
      message: 'File uploaded successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading file to Google Drive',
      error: error.message
    });
  }
});

module.exports = router; 