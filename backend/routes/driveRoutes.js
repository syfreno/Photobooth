const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer setup for temporary file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

// Google Drive setup
const CREDENTIALS_PATH = path.join(__dirname, '../config/google-drive-credentials.json');

// Initialize Google Drive API client
const initializeDriveClient = () => {
  try {
    // Verify credentials file exists
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error('Google Drive credentials file not found at: ' + CREDENTIALS_PATH);
    }

    // Load and verify credentials
    const credentials = require(CREDENTIALS_PATH);
    
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('Invalid credentials file: missing client_email or private_key');
    }

    console.log('Initializing with service account:', credentials.client_email);

    // Create auth client
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });

    // Create and return drive client
    return google.drive({ version: 'v3', auth });
  } catch (error) {
    console.error('Failed to initialize Google Drive client:', error);
    throw error;
  }
};

// Initialize drive client
let drive;
try {
  drive = initializeDriveClient();
  console.log('Google Drive client initialized successfully');
} catch (error) {
  console.error('Error initializing Google Drive client:', error);
}

// Middleware to check Drive client
const checkDriveClient = async (req, res, next) => {
  if (!drive) {
    try {
      drive = initializeDriveClient();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Google Drive client not available',
        error: error.message
      });
    }
  }

  // Verify connection
  try {
    await drive.about.get({
      fields: 'user'
    });
    next();
  } catch (error) {
    console.error('Drive client verification failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify Google Drive connection',
      error: error.message
    });
  }
};

// Create folder function
const createFolder = async (drive, folderName, parentFolderId) => {
  try {
    console.log(`Creating folder: ${folderName} under parent: ${parentFolderId}`);
    
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId]
    };

    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: 'id, name, webViewLink',
      supportsAllDrives: true
    });

    console.log('Folder created:', folder.data);

    // Set folder permissions to anyone with link can modify
    await drive.permissions.create({
      fileId: folder.data.id,
      requestBody: {
        role: 'writer',
        type: 'anyone'
      },
      supportsAllDrives: true
    });

    return folder.data;
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  }
};

// Modified upload route
router.post('/drive/upload', checkDriveClient, upload.single('photo'), async (req, res) => {
  console.log('=== DRIVE UPLOAD REQUEST START ===');
  
  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({ 
      success: false, 
      message: 'No file uploaded' 
    });
  }

  const filePath = req.file.path;
  const fileName = req.file.originalname;
  const mainFolderId = '1kI1u5PCnFFza1FRKkQHoWRChb625kDxH'; // Your main folder ID
  
  // Log detail file
  console.log('File mimetype:', req.file.mimetype);
  console.log('File size:', req.file.size);
  console.log('File path:', req.file.path);
  console.log('File name:', fileName);

  // Check if file exists and has content
  if (!fs.existsSync(filePath)) {
    console.error('File does not exist at path:', filePath);
    return res.status(400).json({
      success: false,
      message: 'Uploaded file not found'
    });
  }

  const fileStats = fs.statSync(filePath);
  console.log('File stats:', fileStats);

  // Jika file GIF corrupt/kosong/invalid, skip upload dan kirim response sukses
  if (req.file.mimetype === 'image/gif' && req.file.size < 1000) { // <1KB dianggap corrupt
    console.warn('GIF file too small or corrupt, skipping upload:', fileName);
    try { fs.unlinkSync(filePath); } catch (e) {}
    return res.json({
      success: true,
      message: 'GIF file corrupt/empty, skipped upload',
      fileName,
      fileType: req.file.mimetype
    });
  }

  try {
    console.log('Starting file upload process...');
    console.log('File details:', {
      name: fileName,
      path: filePath,
      size: fileStats.size,
      mimeType: req.file.mimetype
    });

    // Extract customer name from filename (assuming format: customerName_strip1.png)
    const customerName = fileName.split('_')[0];
    console.log('Extracted customer name:', customerName);
    
    // First, check if customer folder exists
    let customerFolder;
    try {
      console.log('Checking for existing customer folder...');
      const response = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${customerName}' and '${mainFolderId}' in parents and trashed=false`,
        fields: 'files(id, name, webViewLink)',
        supportsAllDrives: true
      });

      console.log('Folder search response:', response.data);

      if (response.data.files.length > 0) {
        customerFolder = response.data.files[0];
        console.log('Found existing customer folder:', customerFolder);
      } else {
        // Create new customer folder
        console.log('Creating new customer folder...');
        customerFolder = await createFolder(drive, customerName, mainFolderId);
        console.log('Created new customer folder:', customerFolder);
      }
    } catch (folderError) {
      console.error('Error checking/creating customer folder:', folderError);
      console.error('Folder error details:', {
        message: folderError.message,
        code: folderError.code,
        status: folderError.status
      });
      throw folderError;
    }

    // Upload file to customer folder
    const fileMetadata = {
      name: fileName,
      parents: [customerFolder.id]
    };

    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(filePath)
    };

    console.log('Uploading file with metadata:', fileMetadata);

    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink',
      supportsAllDrives: true
    });

    console.log('File uploaded successfully:', file.data);

    // Set file permissions
    console.log('Setting file permissions...');
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: {
        role: 'writer',
        type: 'anyone'
      },
      supportsAllDrives: true
    });

    // Transfer ownership to specific Google account (optional, only if email is set)
    const ownerEmail = process.env.GOOGLE_DRIVE_OWNER_EMAIL;
    if (ownerEmail) {
      try {
        console.log('Transferring ownership to:', ownerEmail);
        await drive.permissions.create({
          fileId: file.data.id,
          requestBody: {
            role: 'owner',
            type: 'user',
            emailAddress: ownerEmail
          },
          transferOwnership: true,
          supportsAllDrives: true
        });
        console.log('Ownership transferred to', ownerEmail);
      } catch (ownershipError) {
        console.error('Failed to transfer ownership:', ownershipError.message);
        // Tidak throw error, supaya upload tetap sukses
      }
    } else {
      console.warn('GOOGLE_DRIVE_OWNER_EMAIL is not set, skipping ownership transfer.');
    }

    // Clean up temporary file
    try {
      fs.unlinkSync(filePath);
      console.log('Temporary file cleaned up');
    } catch (cleanupError) {
      console.error('Failed to cleanup temp file:', cleanupError);
    }

    console.log('=== DRIVE UPLOAD SUCCESS ===');
    res.json({
      success: true,
      message: 'File uploaded successfully',
      folderUrl: customerFolder.webViewLink,
      fileUrl: file.data.webViewLink,
      fileId: file.data.id,
      fileName: file.data.name,
      customerFolder: {
        id: customerFolder.id,
        name: customerFolder.name,
        url: customerFolder.webViewLink
      }
    });

  } catch (error) {
    console.error('=== DRIVE UPLOAD ERROR ===');
    console.error('Upload error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      stack: error.stack
    });
    
    // Clean up temporary file on error
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Cleaned up temp file after error');
      }
    } catch (cleanupError) {
      console.error('Failed to cleanup temp file after error:', cleanupError);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload file to Google Drive',
      error: error.message,
      details: {
        code: error.code,
        status: error.status
      }
    });
  }
});

// Test endpoint to verify Google Drive connection
router.get('/drive/test', async (req, res) => {
  console.log('=== DRIVE TEST REQUEST ===');
  
  try {
    if (!drive) {
      console.log('Drive client not initialized, attempting to initialize...');
      drive = initializeDriveClient();
    }

    console.log('Testing Google Drive connection...');
    
    // Test basic connection
    const about = await drive.about.get({
      fields: 'user'
    });
    
    console.log('Drive connection successful:', about.data);
    
    // Test folder access
    const mainFolderId = '1kI1u5PCnFFza1FRKkQHoWRChb625kDxH';
    const folder = await drive.files.get({
      fileId: mainFolderId,
      fields: 'id, name, capabilities'
    });
    
    console.log('Folder access successful:', folder.data);
    
    res.json({
      success: true,
      message: 'Google Drive connection test successful',
      serviceAccount: about.data.user,
      folder: {
        name: folder.data.name,
        capabilities: folder.data.capabilities
      }
    });
    
  } catch (error) {
    console.error('=== DRIVE TEST ERROR ===');
    console.error('Test error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
    
    res.status(500).json({
      success: false,
      message: 'Google Drive connection test failed',
      error: error.message,
      details: {
        code: error.code,
        status: error.status
      }
    });
  }
});

// Verify credentials route
router.get('/drive/verify-credentials', async (req, res) => {
  try {
    const folderId = '1kI1u5PCnFFza1FRKkQHoWRChb625kDxH';
    
    // Initialize results object
    const results = {
      credentialsFound: false,
      credentialsValid: false,
      serviceAccountEmail: null,
      folderAccessible: false,
      canWrite: false,
      details: {}
    };

    // 1. Check if credentials file exists
    if (fs.existsSync(CREDENTIALS_PATH)) {
      results.credentialsFound = true;
      results.details.credentialsPath = CREDENTIALS_PATH;
      
      // Load credentials
      const credentials = require(CREDENTIALS_PATH);
      if (credentials.client_email) {
        results.serviceAccountEmail = credentials.client_email;
      }
    } else {
      throw new Error('Credentials file not found');
    }

    // 2. Verify credentials by making a test API call
    try {
      if (!drive) {
        drive = initializeDriveClient();
      }
      
      const about = await drive.about.get({
        fields: 'user'
      });
      
      results.credentialsValid = true;
      results.details.serviceAccount = about.data.user;
      console.log('Service account verified:', about.data.user);
    } catch (error) {
      console.error('Credentials verification failed:', error);
      results.details.credentialsError = error.message;
      throw error;
    }

    // 3. Check folder access
    if (results.credentialsValid) {
      try {
        const folder = await drive.files.get({
          fileId: folderId,
          fields: 'id, name, capabilities'
        });
        
        results.folderAccessible = true;
        results.canWrite = folder.data.capabilities?.canAddChildren || false;
        results.details.folder = {
          name: folder.data.name,
          capabilities: folder.data.capabilities
        };
        
        console.log('Folder access verified:', folder.data);
      } catch (error) {
        console.error('Folder access check failed:', error);
        results.details.folderError = error.message;
      }
    }

    // Send response with instructions if needed
    res.json({
      success: true,
      ...results,
      instructions: results.credentialsValid && !results.folderAccessible ? 
        `Please share the folder with ${results.serviceAccountEmail} and grant Editor access` : 
        null
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete file route
router.delete('/drive/delete/:fileId', checkDriveClient, async (req, res) => {
  const { fileId } = req.params;

  try {
    console.log(`Attempting to delete file: ${fileId}`);

    // Check if file exists and is accessible
    try {
      await drive.files.get({
        fileId: fileId,
        fields: 'id, name',
        supportsAllDrives: true
      });
    } catch (error) {
      console.error('File not found or not accessible:', error);
      return res.status(404).json({
        success: false,
        message: 'File not found or not accessible',
        error: error.message
      });
    }

    // Delete the file
    await drive.files.delete({
      fileId: fileId,
      supportsAllDrives: true
    });

    console.log(`File ${fileId} deleted successfully`);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message
    });
  }
});

module.exports = router; 