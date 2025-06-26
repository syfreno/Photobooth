const express = require("express");
const { exec } = require('child_process');
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
const { log } = require("console");
require("dotenv").config();
const bodyParser = require('body-parser');
const app = express();
const driveRoutes = require("./routes/driveRoutes");
const patternRoutes = require("./routes/patternRoutes");

// Set PORT dan pastikan tidak bentrok
const PORT = process.env.PORT || 5000; // Gunakan port dari env atau 5000

// Tambahkan domain frontend production kamu di sini
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://photobooth-vxcb-cc7o7hc3u-muhamad-syfarenos-projects.vercel.app',
  // tambahkan custom domain kamu jika ada
];

// Enable CORS with specific options
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
  exposedHeaders: ['Access-Control-Allow-Origin'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '10mb' }));

// Camera settings storage
let photoboothSettings = {
  framesPerStrip: 4,    // Jumlah frame dalam satu strip
  numberOfStrips: 1,    // Jumlah strip yang akan dibuat
  printCount: 2,        // Jumlah print per strip
  selectedPrinter: 'HP Deskjet',  // Default printer selection
  camera: {
    type: 'webcam',
    deviceId: '',
    model: '',
    settings: {
      iso: 'auto',
      shutterSpeed: 'auto',
      aperture: 'auto',
      whiteBalance: 'auto'
    }
  }
};

// Setup directories
const uploadsDir = path.join(__dirname, "uploads");
const patternsDir = path.join(uploadsDir, "patterns");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`Created uploads directory at: ${uploadsDir}`);
}
if (!fs.existsSync(patternsDir)) {
  fs.mkdirSync(patternsDir, { recursive: true });
  console.log(`Created patterns directory at: ${patternsDir}`);
}

// Serve static files with proper CORS headers
const staticFileMiddleware = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
};

// Serve uploads directory
app.use('/uploads', staticFileMiddleware, express.static(uploadsDir, {
  setHeaders: (res, path, stat) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

// Serve patterns directory specifically
app.use('/uploads/patterns', staticFileMiddleware, express.static(patternsDir, {
  setHeaders: (res, path, stat) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

console.log(`Serving uploads from: ${uploadsDir}`);
console.log(`Serving patterns from: ${patternsDir}`);

// Email validation and utilities
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && 
         !email.includes('..') && 
         !email.endsWith('.') && 
         !email.startsWith('@');
};

const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_APP_PASS
    },
    tls: { rejectUnauthorized: false },
    pool: true,
    maxConnections: 5
  });
};

// Multer setup for photos
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `photo-${Date.now()}${path.extname(file.originalname)}`)
});

const uploadPhoto = multer({ storage: photoStorage });

// Multer setup for patterns
const patternStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    console.log('Uploading pattern:', file.originalname);
    const filename = `pattern-${Date.now()}${path.extname(file.originalname)}`;
    console.log('Generated pattern filename:', filename);
    cb(null, filename);
  }
});

const uploadPattern = multer({ 
  storage: patternStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Routes
app.use('/api', driveRoutes);
app.use('/api', patternRoutes);

app.post("/send-email", async (req, res) => {
  const { recipientEmail, imageData, name } = req.body;

  if (!recipientEmail || !validateEmail(recipientEmail)) {
    return res.status(400).json({ success: false, message: "Email tidak valid" });
  }

  try {
    const transporter = createTransporter();
    const base64Data = imageData.replace(/^data:image\/jpeg;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const mailOptions = {
      from: `"Nusanarrative Photobooth" <${process.env.EMAIL}>`,
      to: recipientEmail,
      subject: `Foto Anda - ${name}`,
      text: `Halo! Berikut foto photobooth Anda. Terima kasih telah menggunakan layanan kami!`,
      attachments: [{
        filename: `${name}_photobooth.jpg`,
        content: buffer,
        contentType: 'image/jpeg'
      }]
    };

    await transporter.sendMail(mailOptions);
    
    // Simpan log email
    const emailLog = {
      timestamp: new Date(),
      recipient: recipientEmail
    };
    fs.appendFileSync(path.join(__dirname, "email_logs/emails.log"), 
      JSON.stringify(emailLog) + "\n");

    res.json({ success: true, message: "Email terkirim" });
  } catch (error) {
    console.error("Email send error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Gagal mengirim email",
      error: error.message 
    });
  }
});

// Fungsi untuk validasi printer
function validatePrinter(printerName) {
    return new Promise((resolve, reject) => {
        exec('wmic printer get name', (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            
            const printers = stdout.split('\n')
                .slice(1)
                .map(line => line.trim())
                .filter(name => name.length > 0);
            
            // Check for exact match first
            let isValid = printers.some(printer => 
                printer.toLowerCase() === printerName.toLowerCase()
            );
            
            // If no exact match, check for partial match (for HP Deskjet variants)
            if (!isValid) {
                const hpDeskjetModels = [
                    'hp deskjet 2130',
                    'hp deskjet 2135', 
                    'hp deskjet 2130 series',
                    'hp dj 2130',
                    'hp dj 2135',
                    'hp dj 2130 series',
                    'hp deskjet',
                    'hp dj'
                ];
                
                // Check if the requested printer is an HP Deskjet variant
                const isHPDeskjetRequest = hpDeskjetModels.some(model => 
                    printerName.toLowerCase().includes(model.toLowerCase())
                );
                
                if (isHPDeskjetRequest) {
                    // Find any HP Deskjet printer as a match
                    const hpDeskjetMatch = printers.find(printer => 
                        hpDeskjetModels.some(model => 
                            printer.toLowerCase().includes(model.toLowerCase())
                        )
                    );
                    
                    if (hpDeskjetMatch) {
                        isValid = true;
                        console.log(`HP Deskjet variant matched: "${printerName}" -> "${hpDeskjetMatch}"`);
                    }
                }
            }
            
            resolve({ isValid, printers });
        });
    });
}

app.post('/api/print', async (req, res) => {
    if (!req.body.imageData) {
        return res.status(400).json({ error: 'Image data is required' });
    }

    const { imageData, printerName = 'HP Deskjet 2130', stripIndex = 0 } = req.body;
    
    try {
        // Validasi printer terlebih dahulu
        let actualPrinterName = printerName;
        try {
            const { isValid, printers } = await validatePrinter(printerName);
            if (!isValid) {
                console.error(`Printer "${printerName}" not found. Available printers:`, printers);
                return res.status(400).json({ 
                    error: `Printer "${printerName}" not found`,
                    availablePrinters: printers
                });
            }
            
            // Find the actual printer name in the system
            const hpDeskjetModels = [
                'hp deskjet 2130',
                'hp deskjet 2135', 
                'hp deskjet 2130 series',
                'hp dj 2130',
                'hp dj 2135',
                'hp dj 2130 series',
                'hp deskjet',
                'hp dj'
            ];
            
            // If it's an HP Deskjet variant, find the actual printer name
            const isHPDeskjetRequest = hpDeskjetModels.some(model => 
                printerName.toLowerCase().includes(model.toLowerCase())
            );
            
            if (isHPDeskjetRequest) {
                const actualPrinter = printers.find(printer => 
                    hpDeskjetModels.some(model => 
                        printer.toLowerCase().includes(model.toLowerCase())
                    )
                );
                if (actualPrinter) {
                    actualPrinterName = actualPrinter;
                    console.log(`Using actual printer name: "${actualPrinterName}" instead of "${printerName}"`);
                }
            }
            
            console.log(`Printer "${actualPrinterName}" validated successfully`);
        } catch (validationError) {
            console.error('Error validating printer:', validationError);
            return res.status(500).json({ error: 'Failed to validate printer' });
        }

        // Validasi base64
        if (!imageData.startsWith('data:image/png;base64,')) {
            return res.status(400).json({ error: 'Invalid image format' });
        }

        const base64Data = imageData.replace(/^data:image\/png;base64,/, "");
        const tempDir = path.join(__dirname, 'temp');
        const fileName = `print_strip${stripIndex}_${Date.now()}.png`;
        const filePath = path.join(tempDir, fileName);

        // Buat folder temp dengan error handling
        try {
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
        } catch (err) {
            console.error('Error creating temp dir:', err);
            return res.status(500).json({ error: 'Failed to create temp directory' });
        }

        // Simpan gambar dengan error handling
        try {
            fs.writeFileSync(filePath, base64Data, 'base64');
            console.log(`Image saved to: ${filePath}`);
        } catch (err) {
            console.error('Error saving image:', err);
            return res.status(500).json({ error: 'Failed to save image' });
        }

        // Perintah print dengan timeout - menggunakan multiple methods untuk reliability
        const printCommands = [
            // Method 1: Using rundll32 with Windows Photo Viewer
            `rundll32 shimgvw.dll,ImageView_PrintTo "${filePath}" "${actualPrinterName}"`,
            // Method 2: Using mspaint with quotes
            `"C:\\Windows\\System32\\mspaint.exe" /pt "${filePath}" "${actualPrinterName}"`,
            // Method 3: Using start command with mspaint
            `start /min "" "C:\\Windows\\System32\\mspaint.exe" /pt "${filePath}" "${actualPrinterName}"`,
            // Method 4: Using PowerShell
            `powershell -Command "Start-Process -FilePath 'C:\\Windows\\System32\\mspaint.exe' -ArgumentList '/pt', '${filePath}', '${actualPrinterName}' -WindowStyle Hidden"`
        ];

        const timeout = 60000; // 60 detik timeout
        let printSuccess = false;
        let lastError = null;

        // Try each print command until one works
        const tryPrint = (commandIndex) => {
            if (commandIndex >= printCommands.length) {
                // All commands failed
                cleanupFile(filePath);
                return res.status(500).json({ 
                    success: false,
                    error: 'All print methods failed',
                    details: lastError,
                    printerName: actualPrinterName
                });
            }

            const printCommand = printCommands[commandIndex];
            console.log(`Trying print command ${commandIndex + 1}: ${printCommand}`);

            exec(printCommand, { timeout }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Print command ${commandIndex + 1} failed:`, error);
                    lastError = error.message;
                    // Try next command
                    setTimeout(() => tryPrint(commandIndex + 1), 1000);
                } else {
                    console.log(`Print command ${commandIndex + 1} succeeded`);
                    printSuccess = true;
                    cleanupFile(filePath);
                    res.json({ 
                        success: true,
                        message: `Print job sent to ${actualPrinterName} for strip ${stripIndex + 1}`,
                        method: `Command ${commandIndex + 1}`,
                        actualPrinterName: actualPrinterName
                    });
                }
            });
        };

        // Start with first command
        tryPrint(0);

    } catch (err) {
        console.error('Unexpected error:', err);
        cleanupFile(filePath);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error',
            details: err.message
        });
    }
});

// Fungsi helper untuk cleanup file
function cleanupFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.error('Error cleaning up file:', err);
    }
}

app.post("/upload", uploadPhoto.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  res.json({ imageUrl: `/${req.file.filename}` });
});

// Dapatkan daftar printer
app.get('/api/printers', (req, res) => {
    exec('wmic printer get name', (error, stdout, stderr) => {
        if (error) {
            console.error('Error getting printers:', error);
            return res.status(500).json({ error: 'Gagal mendapatkan daftar printer' });
        }
        
        const printers = stdout.split('\n')
            .slice(1) // Hilangkan header
            .map(line => line.trim())
            .filter(name => name.length > 0);

        console.log('Available printers:', printers);
        
        // Check for various HP Deskjet models (case insensitive)
        const hpDeskjetModels = [
            'hp deskjet 2130',
            'hp deskjet 2135', 
            'hp deskjet 2130 series',
            'hp dj 2130',
            'hp dj 2135',
            'hp dj 2130 series',
            'hp deskjet',
            'hp dj'
        ];
        
        // Find HP Deskjet printers
        const hpDeskjetPrinters = printers.filter(printer => 
            hpDeskjetModels.some(model => 
                printer.toLowerCase().includes(model.toLowerCase())
            )
        );
        
        // Check if any HP Deskjet is found
        const hasHPDeskjet = hpDeskjetPrinters.length > 0;
        
        // Find the best match for default printer
        let defaultHPPrinter = null;
        
        // Priority order for default printer
        const priorityModels = [
            'hp deskjet 2135',
            'hp deskjet 2130 series',
            'hp dj 2130 series',
            'hp deskjet 2130',
            'hp dj 2135',
            'hp dj 2130',
            'hp deskjet',
            'hp dj'
        ];
        
        for (const model of priorityModels) {
            const match = printers.find(printer => 
                printer.toLowerCase().includes(model.toLowerCase())
            );
            if (match) {
                defaultHPPrinter = match;
                break;
            }
        }
        
        if (!hasHPDeskjet) {
            console.warn('No HP Deskjet printers found in printer list');
            console.log('Available printers for reference:', printers);
        } else {
            console.log('HP Deskjet printers found:', hpDeskjetPrinters);
            console.log('Default HP printer selected:', defaultHPPrinter);
        }

        res.json({ 
            printers,
            hasHPDeskjet,
            hpDeskjetPrinters,
            defaultHPPrinter: defaultHPPrinter || 'HP Deskjet 2130',
            supportedModels: hpDeskjetModels
        });
    });
});

// Camera connection endpoint
app.post("/api/camera/connect", async (req, res) => {
  try {
    const { type, model, settings } = req.body;

    // For DSLR cameras on Windows, we use digiCamControl
    if (['dslr', 'canon', 'sony'].includes(type)) {
      // Path to digiCamControl CLI - adjust this path according to your installation
      const digiCamPath = 'C:\\Program Files (x86)\\digiCamControl\\CameraControlCmd.exe';
      
      // Check if digiCamControl is installed
      if (!fs.existsSync(digiCamPath)) {
        throw new Error('digiCamControl not found. Please install it first.');
      }

      // Connect to camera using digiCamControl
      exec(`"${digiCamPath}" /list`, (error, stdout, stderr) => {
        if (error) {
          console.error('Error listing cameras:', error);
          return res.status(500).send('Failed to detect cameras');
        }

        // Parse the camera list
        const cameras = stdout.trim().split('\n')
          .filter(line => line.length > 0)
          .map(line => line.trim());

        if (cameras.length === 0) {
          return res.status(404).send('No cameras detected');
        }

        // Configure camera settings if specified
        if (settings && settings.iso !== 'auto') {
          exec(`"${digiCamPath}" /iso ${settings.iso}`);
        }
        if (settings && settings.shutterSpeed !== 'auto') {
          exec(`"${digiCamPath}" /shutter ${settings.shutterSpeed}`);
        }
        if (settings && settings.aperture !== 'auto') {
          exec(`"${digiCamPath}" /aperture ${settings.aperture}`);
        }
        if (settings && settings.whiteBalance !== 'auto') {
          exec(`"${digiCamPath}" /wb ${settings.whiteBalance}`);
        }

        // Start live view if available
        exec(`"${digiCamPath}" /capture`);

        // Return success with camera info
        res.json({
          success: true,
          message: 'Camera connected successfully',
          cameras: cameras
        });
      });
    } else {
      res.status(400).send('Unsupported camera type');
    }
  } catch (error) {
    console.error('Error connecting to camera:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to connect to camera'
    });
  }
});

// Add new endpoint for capturing photos with DSLR
app.post("/api/camera/capture", async (req, res) => {
  try {
    const { type } = req.body;
    
    if (['dslr', 'canon', 'sony'].includes(type)) {
      const digiCamPath = 'C:\\Program Files (x86)\\digiCamControl\\CameraControlCmd.exe';
      const outputPath = path.join(__dirname, 'uploads', `dslr-${Date.now()}.jpg`);

      // Capture photo using digiCamControl
      exec(`"${digiCamPath}" /capture /filename "${outputPath}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('Error capturing photo:', error);
          return res.status(500).send('Failed to capture photo');
        }

        // Return the path to the captured photo
        res.json({
          success: true,
          imagePath: `/uploads/${path.basename(outputPath)}`
        });
      });
    } else {
      res.status(400).send('Unsupported camera type');
    }
  } catch (error) {
    console.error('Error capturing photo:', error);
    res.status(500).send('Failed to capture photo');
  }
});

// Settings endpoints
app.get("/api/settings", (req, res) => {
  res.json(photoboothSettings);
});

app.post("/api/settings", (req, res) => {
  try {
    const newSettings = req.body;
    
    // Validate settings
    if (!newSettings || typeof newSettings !== 'object') {
      return res.status(400).send('Invalid settings format');
    }

    // Update settings
    photoboothSettings = {
      ...photoboothSettings,
      ...newSettings
    };

    // Broadcast settings update to all connected clients
    io.emit('settings-updated', photoboothSettings);

    res.json({ success: true, settings: photoboothSettings });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).send('Failed to save settings');
  }
});

// Patterns storage
let patterns = [];
let nextPatternId = 1;

// Patterns endpoints
app.get("/api/patterns", (req, res) => {
  console.log('GET /api/patterns - Current patterns:', patterns);
  res.json(patterns);
});

app.post("/api/patterns", uploadPattern.single('patternImage'), (req, res) => {
  console.log('POST /api/patterns - Received request');
  console.log('File:', req.file);
  console.log('Body:', req.body);

  if (!req.file || !req.body.name) {
    console.log('Missing file or name');
    return res.status(400).json({ error: 'Missing file or name' });
  }

  const pattern = {
    id: nextPatternId++,
    name: req.body.name,
    url: `/uploads/${req.file.filename}`  // Ubah URL pattern
  };

  patterns.push(pattern);
  console.log('Added new pattern:', pattern);
  res.json(pattern);
});

app.delete("/api/patterns/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const pattern = patterns.find(p => p.id === id);

    if (pattern) {
        // Delete file if it exists
        const filename = pattern.url.split('/').pop();
        const filepath = path.join(__dirname, "uploads", filename);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }

        // Remove from patterns array
        patterns = patterns.filter(p => p.id !== id);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Pattern not found" });
    }
});

// Test print endpoint untuk debugging
app.post('/api/print/test', async (req, res) => {
    const { printerName = 'HP Deskjet 2130' } = req.body;
    
    try {
        // Validasi printer
        const { isValid, printers } = await validatePrinter(printerName);
        if (!isValid) {
            return res.status(400).json({ 
                error: `Printer "${printerName}" not found`,
                availablePrinters: printers
            });
        }

        // Buat test image sederhana
        const testImagePath = path.join(__dirname, 'temp', `test_print_${Date.now()}.png`);
        const tempDir = path.join(__dirname, 'temp');
        
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Buat test image dengan canvas (simple white image with text)
        const { createCanvas } = require('canvas');
        const canvas = createCanvas(400, 300);
        const ctx = canvas.getContext('2d');
        
        // Fill white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 400, 300);
        
        // Add test text
        ctx.fillStyle = 'black';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Test Print', 200, 150);
        ctx.font = '16px Arial';
        ctx.fillText(`Printer: ${printerName}`, 200, 180);
        ctx.fillText(`Time: ${new Date().toLocaleString()}`, 200, 200);

        // Save test image
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(testImagePath, buffer);

        // Try to print test image
        const printCommand = `rundll32 shimgvw.dll,ImageView_PrintTo "${testImagePath}" "${printerName}"`;
        
        exec(printCommand, { timeout: 30000 }, (error, stdout, stderr) => {
            cleanupFile(testImagePath);
            
            if (error) {
                console.error('Test print failed:', error);
                res.status(500).json({ 
                    success: false,
                    error: 'Test print failed',
                    details: error.message
                });
            } else {
                console.log('Test print succeeded');
                res.json({ 
                    success: true,
                    message: `Test print sent to ${printerName}`,
                    printerName: printerName
                });
            }
        });

    } catch (err) {
        console.error('Test print error:', err);
        res.status(500).json({ 
            success: false,
            error: 'Test print error',
            details: err.message
        });
    }
});

// Server setup
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Endpoint print: http://localhost:${PORT}/api/print`);
});

// Socket.io setup
const io = require('socket.io')(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('New client connected');
  socket.emit('settings-update', photoboothSettings);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});