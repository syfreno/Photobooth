import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";
import QRCodeModal from './QRCodeModal';
import './PhotoPreviewGroup.css';
import gifshot from 'gifshot';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const socket = io(API_URL);

// Tambahkan definisi photoEffects langsung di sini
const photoEffects = {
  none: { name: 'Normal', filter: 'none' },
  blackAndWhite: { name: 'B&W', filter: 'grayscale(1)' },
  sepia: { name: 'Sepia', filter: 'sepia(1)' },
  vintage: { name: 'Vintage', filter: 'contrast(0.8) brightness(1.1) sepia(0.4)' },
  warm: { name: 'Warm', filter: 'brightness(1.1) sepia(0.2) saturate(1.2)' },
  cool: { name: 'Cool', filter: 'brightness(0.95) contrast(1.1) saturate(1.2) hue-rotate(180deg)' },
};

const PhotoPreviewGroup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stripCanvasRefs, setStripCanvasRefs] = useState([]);
  const [layout, setLayout] = useState("vertical");
  const [stripColor, setStripColor] = useState("white");
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [patternImage, setPatternImage] = useState(null);
  const [patterns, setPatterns] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [selectedEffect, setSelectedEffect] = useState('none');
  const [spacing, setSpacing] = useState(20);
  const [name, setName] = useState("");
  const [settings, setSettings] = useState({ framesPerStrip: 4, numberOfStrips: 1, printCount: 2 });
  const [imagesToRetake, setImagesToRetake] = useState([]);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [driveLink, setDriveLink] = useState('');
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [patternsCache, setPatternsCache] = useState(new Map());
  const [loadedPatternImages, setLoadedPatternImages] = useState(new Map());
  const [strips, setStrips] = useState([]);
  const [selectedStrip, setSelectedStrip] = useState(0);
  const [gifBlob, setGifBlob] = useState(null);
  const [isCreatingGif, setIsCreatingGif] = useState(false);

  // New state for robust printing
  const [printQueue, setPrintQueue] = useState({
    imageData: null,
    totalCopies: 0,
    copiesLeft: 0,
    currentCopy: 1,
    isPrinting: false,
    isFailed: false,
  });

  const capturedImages = location.state?.capturedImages || [];

  const effectSliderRef = useRef(null);
  const patternSliderRef = useRef(null);

  useEffect(() => {
    const initializeCanvasRefs = (numberOfStrips) => {
      console.log('Initializing canvas refs for', numberOfStrips, 'strips');
      const newRefs = Array(numberOfStrips).fill(null).map(() => React.createRef());
      setStripCanvasRefs(newRefs);
    };

    // Fetch settings
    fetch(`${API_URL}/api/settings`)
      .then(res => res.json())
      .then(data => {
        console.log("Fetched settings:", data);
        setSettings(data);
        initializeCanvasRefs(data.numberOfStrips);
        
        // Listen for settings updates
        socket.on('settings-updated', (newSettings) => {
          setSettings(newSettings);
          initializeCanvasRefs(newSettings.numberOfStrips);
        });
      })
      .catch(err => console.error("Error fetching settings:", err));

    return () => {
      socket.off('settings-updated');
    };
  }, []);

  useEffect(() => {
    if (location.state?.strips) {
      console.log("Received strips data:", location.state.strips);
      console.log("Number of strips:", location.state.strips.length);
      console.log("First strip photos:", location.state.strips[0]);
      
      const newRefs = Array(location.state.strips.length).fill(null).map(() => React.createRef());
      setStripCanvasRefs(newRefs);
      setStrips(location.state.strips);
    }
  }, [location.state]);

  useEffect(() => {
    if (strips.length > 0 && stripCanvasRefs.length > 0) {
      const timer = setTimeout(() => {
        strips.forEach((strip, index) => {
          if (strip.length > 0 && stripCanvasRefs[index]?.current) {
            console.log(`Processing strip ${index}:`, strip);
            generatePhotoStrip(index);
          }
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [strips, stripCanvasRefs, layout, selectedEffect, selectedPattern]);

  // Add new function to pre-load pattern images
  const preloadPatternImage = useCallback(async (pattern) => {
    if (loadedPatternImages.has(pattern.url)) {
      return loadedPatternImages.get(pattern.url);
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setLoadedPatternImages(prev => new Map(prev).set(pattern.url, img));
        resolve(img);
      };
      img.onerror = reject;
      img.src = pattern.url;
    });
  }, [loadedPatternImages]);

  // Add new function to create and cache pattern
  const createAndCachePattern = useCallback((ctx, patternImage) => {
    if (!patternImage) return null;
    
    const pattern = ctx.createPattern(patternImage, 'repeat');
    if (pattern) {
      const matrix = new DOMMatrix();
      matrix.scaleSelf(0.5, 0.5);
      pattern.setTransform(matrix);
    }
    return pattern;
  }, []);

  // Modify useEffect to preload all patterns when component mounts
  useEffect(() => {
    const loadPatterns = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/patterns`);
        const data = await response.json();
        console.log("Loaded patterns:", data);
        
        const patternsWithFullUrls = data.map(pattern => ({
          ...pattern,
          url: `${API_URL}${pattern.url}`
        }));
        setPatterns(patternsWithFullUrls);

        // Preload all pattern images
        await Promise.all(patternsWithFullUrls.map(pattern => preloadPatternImage(pattern)));
      } catch (err) {
        console.error("Error loading patterns:", err);
        setMessage({ text: 'Failed to load patterns. Please try again.', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    };

    loadPatterns();
  }, [preloadPatternImage]);

  // Modify handlePatternSelect to use cached images
  const handlePatternSelect = (pattern) => {
    setSelectedPattern(pattern);
    
    if (!pattern) {
      setPatternImage(null);
      return;
    }

    const cachedImage = loadedPatternImages.get(pattern.url);
    if (cachedImage) {
      setPatternImage(cachedImage);
      generatePhotoStrip();
    } else {
      preloadPatternImage(pattern).then(img => {
        setPatternImage(img);
        generatePhotoStrip();
      });
    }
  };

  const applyPhotoEffect = (ctx, x, y, width, height) => {
    if (selectedEffect === 'none') return;
    
    const effect = photoEffects[selectedEffect];
    if (!effect) return;

    ctx.filter = effect.filter;
  };

  const loadImage = (src) => {
    console.log('Loading image from source:', src);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        console.log('Image loaded successfully:', src);
        resolve(img);
      };
      
      img.onerror = (error) => {
        console.error('Error loading image:', error);
        reject(new Error(`Failed to load image: ${src}`));
      };
      
      img.src = src;
    });
  };

  const createSeamlessPattern = (ctx, patternImage) => {
    // Create an offscreen canvas for pattern preparation
    const patternCanvas = document.createElement('canvas');
    const patternCtx = patternCanvas.getContext('2d');

    // Set pattern canvas size to match the original image size
    patternCanvas.width = patternImage.width;
    patternCanvas.height = patternImage.height;

    // Draw the original pattern
    patternCtx.drawImage(patternImage, 0, 0);

    // Create the seamless pattern
    const pattern = ctx.createPattern(patternCanvas, 'repeat');
    return pattern;
  };

  const applyPatternToStrip = (ctx, patternImage, width, height) => {
    if (!patternImage) return;
    
    ctx.save();
    
    try {
      // Create seamless pattern
      const pattern = createSeamlessPattern(ctx, patternImage);
      if (!pattern) return;

      // Calculate pattern size for proper scaling
      const patternWidth = patternImage.width;
      const patternHeight = patternImage.height;
      
      // Calculate scale to make pattern size appropriate for the strip
      const scaleX = width / (patternWidth * 4); // Adjust the divisor to change pattern density
      const scaleY = scaleX; // Keep aspect ratio
      
      // Apply transformation
      const matrix = new DOMMatrix();
      matrix.scaleSelf(scaleX, scaleY);
      pattern.setTransform(matrix);
      
      // Fill background
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    } catch (error) {
      console.error('Error applying pattern:', error);
    }
    
    ctx.restore();
  };

  const generatePhotoStrip = async (stripIndex) => {
    if (!stripCanvasRefs[stripIndex]?.current) {
      setTimeout(() => generatePhotoStrip(stripIndex), 100);
      return;
    }
    const scale = 4;
    // Ukuran pattern (background template) - canvas benar-benar fit pattern
    const patternWidth = 120 * scale;
    const patternHeight = 300 * scale;
    // Tidak ada margin sama sekali
    const stripWidth = patternWidth;
    const stripHeight = patternHeight;
    const canvas = stripCanvasRefs[stripIndex].current;
    const strip = strips[stripIndex];
    if (!strip?.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = stripWidth;
    canvas.height = stripHeight;

    // Pattern mulai dari 0,0
    const patternX = 0;
    const patternY = 0;

    // Draw background strip (benar-benar fit pattern)
    ctx.save();
    ctx.clearRect(0, 0, stripWidth, stripHeight);
    ctx.fillStyle = '#F5F5F7';
    ctx.fillRect(0, 0, stripWidth, stripHeight);
    ctx.restore();

    // Draw pattern di seluruh canvas
    if (patternImage && selectedPattern) {
      const imgW = patternImage.width;
      const imgH = patternImage.height;
      const patternAR = patternWidth / patternHeight;
      const imgAR = imgW / imgH;
      let drawW, drawH, dx, dy;
      if (imgAR > patternAR) {
        drawH = patternHeight;
        drawW = imgW * (patternHeight / imgH);
        dx = (patternWidth - drawW) / 2;
        dy = 0;
      } else {
        drawW = patternWidth;
        drawH = imgH * (patternWidth / imgW);
        dx = 0;
        dy = (patternHeight - drawH) / 2;
      }
      ctx.drawImage(patternImage, dx, dy, drawW, drawH);
    }

    // Ukuran frame foto: 90x68 px (tetap proporsional)
    const frameWidth = 90 * scale;
    const frameHeight = 68 * scale;
    const frameSpacing = 7 * scale;
    const frameMarginTop = 12 * scale; // dari atas pattern
    // Frame X (center di pattern)
    const frameX = (patternWidth - frameWidth) / 2;
    // Frame Y pertama
    let frameY = frameMarginTop;

    const photosToDraw = strip.slice(0, 3);
    for (let i = 0; i < photosToDraw.length; i++) {
      const photo = photosToDraw[i];
      try {
        const img = await loadImage(photo);
        ctx.save();
        if (selectedEffect !== 'none') {
          const effect = photoEffects[selectedEffect];
          if (effect?.filter) ctx.filter = effect.filter;
        }
        ctx.beginPath();
        ctx.rect(frameX, frameY, frameWidth, frameHeight);
        ctx.clip();
        // Draw photo with aspect ratio cover (center crop, not stretch)
        const imgAspect = img.width / img.height;
        const frameAspect = frameWidth / frameHeight;
        let sx, sy, sWidth, sHeight;
        if (imgAspect > frameAspect) {
          sHeight = img.height;
          sWidth = sHeight * frameAspect;
          sx = (img.width - sWidth) / 2;
          sy = 0;
        } else {
          sWidth = img.width;
          sHeight = sWidth / frameAspect;
          sx = 0;
          sy = (img.height - sHeight) / 2;
        }
        ctx.drawImage(img, sx, sy, sWidth, sHeight, frameX, frameY, frameWidth, frameHeight);
        ctx.restore();
        frameY += frameHeight + frameSpacing;
      } catch (error) {
        console.error(`Error processing photo ${i + 1}:`, error);
      }
    }
  };

  const handleCanvasClick = (event) => {
    if (!stripCanvasRefs[selectedStrip]?.current) return;

    const canvas = stripCanvasRefs[selectedStrip]?.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get click position relative to canvas
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Get the scale of the displayed canvas vs its actual size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Convert click coordinates to canvas space
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;

    // Calculate base dimensions and spacing
    const basePhotoWidth = 1600;
    const basePhotoHeight = 900;
    const photoMargin = 60;

    // Calculate layout based on settings
    let cols, rows;
    if (layout === "vertical") {
      cols = 1;
      rows = photos.length;
    } else {
      cols = photos.length <= 4 ? 2 : 3;
      rows = Math.ceil(photos.length / cols);
    }

    // Calculate photo dimensions
    const photoWidth = layout === "vertical" ? 
      basePhotoWidth : 
      (canvas.width - (spacing * (cols - 1))) / cols;
    
    const photoHeight = layout === "vertical" ? 
      (canvas.height - (spacing * (rows - 1))) / rows : 
      (basePhotoHeight * photoWidth) / basePhotoWidth;

    // Find which photo was clicked
    let clickedIndex = -1;
    
    for (let i = 0; i < photos.length; i++) {
      const col = layout === "vertical" ? 0 : (i % cols);
      const row = layout === "vertical" ? i : Math.floor(i / cols);
      
      const photoX = col * (photoWidth + spacing);
      const photoY = row * (photoHeight + spacing);
      
      // Calculate actual photo area (with margin)
      const actualX = photoX + photoMargin;
      const actualY = photoY + photoMargin;
      const actualWidth = photoWidth - (photoMargin * 2);
      const actualHeight = photoHeight - (photoMargin * 2);

      // Check if click is within this photo's bounds
      if (canvasX >= actualX && canvasX <= actualX + actualWidth &&
          canvasY >= actualY && canvasY <= actualY + actualHeight) {
        clickedIndex = i;
        break;
      }
    }

    // Update selection if a photo was clicked
    if (clickedIndex !== -1) {
      setSelectedPhotos(prev => {
        if (prev.includes(clickedIndex)) {
          return prev.filter(i => i !== clickedIndex);
        } else {
          return [...prev, clickedIndex];
        }
      });
    }
  };

  const handlePhotoClick = (stripIndex, photoIndex) => {
    setSelectedPhotos(prev => {
      // Cari apakah foto ini sudah diselect
      const existingIndex = prev.findIndex(
        p => p.stripIndex === stripIndex && p.photoIndex === photoIndex
      );
      
      if (existingIndex >= 0) {
        // Jika sudah diselect, hapus dari array (unselect)
        return prev.filter((_, index) => index !== existingIndex);
      } else {
        // Jika belum diselect, tambahkan ke array
        return [...prev, { stripIndex, photoIndex }];
      } 
    });
  };

  const handleRetakePhotos = () => {
    if (selectedPhotos.length === 0) {
      setMessage({ text: 'Please select photos to retake', type: 'error' });
      return;
    }

    // Urutkan foto yang akan diretake berdasarkan index
    const sortedRetakes = [...selectedPhotos].sort((a, b) => 
      a.stripIndex === b.stripIndex ? 
        a.photoIndex - b.photoIndex : 
        a.stripIndex - b.stripIndex
    );

    // Siapkan data untuk retake
    const retakeData = {
      retakeIndices: sortedRetakes.map(p => p.photoIndex),
      originalImages: strips.map(strip => strip.slice()), // Deep copy semua strips
      selectedStrips: sortedRetakes.map(p => p.stripIndex),
      retakeCount: selectedPhotos.length
    };

    // Navigate ke photobooth dengan data retake
    navigate("/photobooth-group", { 
      state: { 
        ...retakeData,
        isRetake: true
      } 
    });
  };

  useEffect(() => {
    // This effect drives the print queue
    if (!printQueue.isPrinting || printQueue.copiesLeft <= 0 || printQueue.isFailed) {
      if (printQueue.copiesLeft === 0 && printQueue.isPrinting && !printQueue.isFailed) {
        // All jobs finished successfully
        setStatus(`Printing complete. ${printQueue.totalCopies} page(s) sent to printer.`);
        setMessage({ text: 'All print jobs finished successfully!', type: 'success' });
        setIsLoading(false);
        setPrintQueue(prev => ({ ...prev, isPrinting: false }));
      }
      return;
    }

    const printCopy = async () => {
      setStatus(`Printing page copy ${printQueue.currentCopy} of ${printQueue.totalCopies}...`);
      setIsLoading(true);

      try {
        // Add a delay to help the printer spooler
        await new Promise(resolve => setTimeout(resolve, 2500));

      const response = await fetch(`${API_URL}/api/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            imageData: printQueue.imageData,
            printerName: settings.selectedPrinter || 'HP Deskjet',
            stripIndex: -1, // Indicates a composite print
        }),
      });

      const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Unknown printing error');
        }

        console.log(`Successfully sent print job for copy ${printQueue.currentCopy}`);
        setPrintQueue(prev => ({
          ...prev,
          copiesLeft: prev.copiesLeft - 1,
          currentCopy: prev.currentCopy + 1,
        }));
      } catch (error) {
        console.error(`Error printing page copy ${printQueue.currentCopy}:`, error);
        setStatus(`Print failed on copy ${printQueue.currentCopy}. Please check the printer.`);
        setMessage({ text: `Print Error: ${error.message}. Fix the printer and click 'Retry'.`, type: 'error' });
        setPrintQueue(prev => ({ ...prev, isFailed: true, isPrinting: false }));
        setIsLoading(false);
      }
    };

    printCopy();
  }, [printQueue, settings.selectedPrinter]);

  const handlePrint = async () => {
    if (!name) {
      setMessage({ text: 'Please enter a group name.', type: 'error' });
      return;
    }
    if (strips.length < 1 || !stripCanvasRefs[0]?.current) {
      setMessage({ text: 'At least one photo strip must be ready.', type: 'error' });
      return;
    }
    
    // Create the composite image for printing
    const scale = 4;
    const printCanvas = document.createElement('canvas');
    const printCtx = printCanvas.getContext('2d');
    
    const canvasWidth = 595 * scale;
    const canvasHeight = 421 * scale;
    printCanvas.width = canvasWidth;
    printCanvas.height = canvasHeight;

    printCtx.fillStyle = '#ffffff';
    printCtx.fillRect(0, 0, canvasWidth, canvasHeight);

    const stripToPrintCanvas = stripCanvasRefs[0].current;
    
    const stripWidth = 180 * scale; // Updated to match new strip width
    const spacing = 105 * scale; // Adjusted spacing to fit larger strips
    const strip1X = 65 * scale; // Adjusted position
    const stripY = 30 * scale; // Adjusted position
    const strip2X = strip1X + stripWidth + spacing;
    
    printCtx.drawImage(stripToPrintCanvas, strip1X, stripY);
    printCtx.drawImage(stripToPrintCanvas, strip2X, stripY);

    const imageData = printCanvas.toDataURL('image/png');

    // Save image data to local storage for reprinting from settings
    try {
      localStorage.setItem('lastPrintJob', imageData);
      console.log('Saved last print job to localStorage.');
    } catch (e) {
      console.error('Error saving print job to localStorage:', e);
    }
    
    // Set up and start the print queue
    setPrintQueue({
      imageData: imageData,
      totalCopies: settings.printCount,
      copiesLeft: settings.printCount,
      currentCopy: 1,
      isPrinting: true,
      isFailed: false,
    });
  };

  const handleRetryPrint = () => {
    if (printQueue.isFailed) {
      setPrintQueue(prev => ({
        ...prev,
        isPrinting: true,
        isFailed: false,
      }));
    }
  };

  // Add function to create GIF from frames
  const createGifFromFrames = async (stripIndex) => {
    setIsCreatingGif(true);
    const strip = strips[stripIndex];
    
    try {
      // Convert base64 images to Image objects
      const imageObjects = await Promise.all(
        strip.map(base64Str => {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = base64Str;
          });
        })
      );

      // Create GIF using gifshot
      return new Promise((resolve, reject) => {
        gifshot.createGIF({
          images: imageObjects,
          gifWidth: 800,
          gifHeight: 600,
          numFrames: strip.length,
          frameDuration: 5, // seconds per frame
          sampleInterval: 10,
          progressCallback: (progress) => {
            console.log('Creating GIF: ', Math.round(progress * 100) + '%');
          }
        }, (result) => {
          if (!result.error) {
            // Convert base64 to blob
            const base64Data = result.image.split(',')[1];
            const blob = base64ToBlob(base64Data, 'image/gif');
            resolve(blob);
          } else {
            reject(new Error(result.errorMsg));
          }
        });
      });
    } catch (error) {
      console.error('Error creating GIF:', error);
      throw error;
    } finally {
      setIsCreatingGif(false);
    }
  };

  // Helper function to convert base64 to blob
  const base64ToBlob = (base64, type) => {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type });
  };

  // Modify handleSaveToGDrive to include GIF
  const handleSaveToGDrive = async () => {
    if (!name) {
      setMessage({ text: 'Please enter a group name before saving', type: 'error' });
      return;
    }

    try {
      setStatus("Creating GIF and uploading to Google Drive...");
      
      // Track uploaded files to prevent duplicates
      const uploadedFiles = new Set();
      let folderUrl = null;

      // Only create GIFs for the number of strips in settings
      const gifBlobs = await Promise.all(
        Array(settings.numberOfStrips).fill().map((_, index) => createGifFromFrames(index))
      );

      // Upload strips based on numberOfStrips setting
      for (let index = 0; index < settings.numberOfStrips; index++) {
        console.log(`Processing strip ${index + 1} of ${settings.numberOfStrips}`);
      
        const canvas = stripCanvasRefs[index]?.current;
        if (canvas) {
          const fileName = `${name.trim()}_strip${index + 1}`;

          // Check if PNG version already uploaded
          if (!uploadedFiles.has(`${fileName}.png`)) {
            // Upload PNG (photo strip)
            const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const stripFormData = new FormData();
            stripFormData.append('photo', pngBlob, `${fileName}.png`);
            
            console.log(`Uploading strip ${index + 1} PNG`);
            const stripResponse = await axios.post(`${API_URL}/api/drive/upload`, stripFormData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (stripResponse.data.success) {
              uploadedFiles.add(`${fileName}.png`);
              // Save the folder URL from the first successful upload
              if (!folderUrl) {
                folderUrl = stripResponse.data.folderUrl;
              }
            }
          }

          // Check if GIF version already uploaded
          if (!uploadedFiles.has(`${fileName}.gif`) && gifBlobs[index]) {
            const gifFormData = new FormData();
            gifFormData.append('photo', gifBlobs[index], `${fileName}.gif`);

            console.log(`Uploading strip ${index + 1} GIF`);
            const gifResponse = await axios.post(`${API_URL}/api/drive/upload`, gifFormData, {
              headers: { 'Content-Type': 'multipart/form-data' }
      });

            if (gifResponse.data.success) {
              uploadedFiles.add(`${fileName}.gif`);
              // Update folder URL if not set yet
              if (!folderUrl) {
                folderUrl = gifResponse.data.folderUrl;
              }
            }
          }
        }
      }

      if (folderUrl) {
        setDriveLink(folderUrl);
        setIsQRModalOpen(true);
        const filesCount = uploadedFiles.size;
        setStatus(`Successfully uploaded ${filesCount} file(s)! Scan QR code to access them.`);
        } else {
        throw new Error("Failed to get folder URL");
      }
    } catch (error) {
      console.error("Upload error:", error);
      
      // Enhanced error logging
      if (error.response) {
        // Server responded with error status
        console.error('Server error response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
        setStatus(`Server Error: ${error.response.status} - ${error.response.data?.message || error.response.data?.error || 'Unknown server error'}`);
      } else if (error.request) {
        // Request was made but no response received
        console.error('No response received:', error.request);
        setStatus(`Network Error: No response from server. Please check your connection.`);
      } else {
        // Something else happened
        console.error('Request setup error:', error.message);
      setStatus(`Error: ${error.message}`);
      }
      
      setMessage({ 
        text: `Upload failed: ${error.response?.data?.message || error.response?.data?.error || error.message}`, 
        type: 'error' 
      });
    }
  };

  const drawBackgroundPattern = (ctx, canvasWidth, canvasHeight) => {
    if (!patternImage) return;

    try {
      ctx.save();
      
      // Create pattern with proper scaling
      const pattern = ctx.createPattern(patternImage, 'repeat');
      if (pattern) {
        // Scale pattern to appropriate size
        const scale = 0.5; // Adjust this value to change pattern size
        const matrix = new DOMMatrix();
        matrix.scaleSelf(scale, scale);
        pattern.setTransform(matrix);
        
        // Fill canvas with pattern
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }
      
      ctx.restore();
    } catch (error) {
      console.error('Error applying pattern:', error);
      setMessage({ text: 'Error applying pattern', type: 'error' });
    }
  };

  const drawPhotosOnCanvas = useCallback(() => {
    if (!stripCanvasRefs[selectedStrip]?.current || selectedPhotos.length === 0) return;

    const canvas = stripCanvasRefs[selectedStrip]?.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size
    const canvasWidth = 400;
    const canvasHeight = layout === 'vertical' ? canvasWidth * 1.5 : canvasWidth * 0.75;
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw background pattern first if available
    if (patternImage) {
      drawBackgroundPattern(ctx, canvasWidth, canvasHeight);
    } else {
      // Fill with white if no pattern
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // Ukuran foto yang lebih kecil
    const photoWidth = layout === 'vertical' ? canvasWidth * 0.25 : canvasWidth * 0.18;
    const photoHeight = layout === 'vertical' ? canvasHeight * 0.08 : canvasHeight * 0.25;

    selectedPhotos.forEach((photoIndex, index) => {
      const img = new Image();
      img.src = photos[photoIndex];

      const x = layout === 'vertical' ? 
        (canvasWidth - photoWidth) / 2 : 
        (index === 0 ? canvasWidth * 0.2 : canvasWidth * 0.6);
      
      const y = layout === 'vertical' ? 
        (index === 0 ? canvasHeight * 0.2 : canvasHeight * 0.65) : 
        (canvasHeight - photoHeight) / 2;

    ctx.save();
    ctx.beginPath();
        ctx.rect(x, y, photoWidth, photoHeight);
        ctx.clip();
        ctx.drawImage(img, x, y, photoWidth, photoHeight);

        if (selectedEffect !== 'none') {
          const imageData = ctx.getImageData(x, y, photoWidth, photoHeight);
          applyPhotoEffect(imageData, selectedEffect);
          ctx.putImageData(imageData, x, y);
        }
    ctx.restore();
    });
  }, [selectedPhotos, photos, layout, patternImage, selectedEffect]);

  // Tambahkan fungsi swipe gesture untuk slider
  function useSliderSwipe(ref) {
    useEffect(() => {
      const slider = ref.current;
      if (!slider) return;
      let isDown = false;
      let startX, scrollLeft;
      let isTouch = false;

      const onPointerDown = (e) => {
        isDown = true;
        isTouch = e.type === 'touchstart';
        startX = isTouch ? e.touches[0].pageX : e.pageX;
        scrollLeft = slider.scrollLeft;
        slider.classList.add('dragging');
      };
      const onPointerMove = (e) => {
        if (!isDown) return;
        const x = isTouch ? e.touches[0].pageX : e.pageX;
        const walk = (x - startX) * 1.2;
        slider.scrollLeft = scrollLeft - walk;
      };
      const onPointerUp = () => {
        isDown = false;
        slider.classList.remove('dragging');
      };
      slider.addEventListener('mousedown', onPointerDown);
      slider.addEventListener('mousemove', onPointerMove);
      slider.addEventListener('mouseleave', onPointerUp);
      slider.addEventListener('mouseup', onPointerUp);
      slider.addEventListener('touchstart', onPointerDown, { passive: false });
      slider.addEventListener('touchmove', onPointerMove, { passive: false });
      slider.addEventListener('touchend', onPointerUp);
      return () => {
        slider.removeEventListener('mousedown', onPointerDown);
        slider.removeEventListener('mousemove', onPointerMove);
        slider.removeEventListener('mouseleave', onPointerUp);
        slider.removeEventListener('mouseup', onPointerUp);
        slider.removeEventListener('touchstart', onPointerDown);
        slider.removeEventListener('touchmove', onPointerMove);
        slider.removeEventListener('touchend', onPointerUp);
      };
    }, [ref]);
  }

  // Panggil useSliderSwipe untuk kedua slider
  useSliderSwipe(effectSliderRef);
  useSliderSwipe(patternSliderRef);

  // Pastikan Font Awesome selalu di-load
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  // Jika user tekan tombol back (browser), langsung ke halaman utama
  useEffect(() => {
    const handlePopState = (event) => {
      navigate('/', { replace: true });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  return (
      <div className="photo-preview-container">
        <div className="main-content">
          {/* KIRI: Pattern Sidebar */}
          <div className="pattern-sidebar">
            {patterns.length > 0 && (
                    <div className="pattern-controls">
                      <h4>Background Pattern</h4>
                <div className="pattern-list-vertical">
                  {patterns.map((pattern, index) => (
                    <div
                      key={index}
                      className={`pattern-item ${selectedPattern === pattern ? 'selected' : ''}`}
                            onClick={() => {
                              handlePatternSelect(pattern);
                        generatePhotoStrip(selectedStrip);
                            }}
                    >
                      <img
                        src={pattern.url}
                        alt={pattern.name}
                        crossOrigin="anonymous"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* TENGAH: Preview Strip */}
          <div className="strips-preview">
            {strips.map((strip, stripIndex) => (
              <div key={stripIndex} className="strip-container">
                <h3>Strip {stripIndex + 1}</h3>
                <div className="strip-preview-area">
                  <canvas 
                    ref={stripCanvasRefs[stripIndex]}
                    className={`strip-canvas ${selectedStrip === stripIndex ? 'selected' : ''}`}
                    onClick={() => setSelectedStrip(stripIndex)}
                  />
          </div>
              <div className="strip-thumbnails">
                {strip.map((photo, photoIndex) => (
            <div
                    key={photoIndex}
                      className={`photo-thumbnail ${selectedPhotos.some(
                        p => p.stripIndex === stripIndex && p.photoIndex === photoIndex
                      ) ? 'selected' : ''}`}
                    onClick={() => handlePhotoClick(stripIndex, photoIndex)}
            >
                    <img src={photo} alt={`Frame ${photoIndex + 1}`} />
                    <div className="photo-number">{photoIndex + 1}</div>
                    {selectedPhotos.some(
                      p => p.stripIndex === stripIndex && p.photoIndex === photoIndex
                    ) && (
                      <div className="selection-overlay">
                    <i className="fas fa-check"></i>
                  </div>
                )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          </div>

          {/* KANAN: Right Sidebar */}
          <div className="right-sidebar">
            <div className="effect-controls">
              <h4>Photo Effect</h4>
              <div className="effect-list-vertical">
                {Object.entries(photoEffects).map(([key, effect]) => (
            <button 
                    key={key}
                    className={`effect-item ${selectedEffect === key ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedEffect(key);
                      generatePhotoStrip(selectedStrip);
                    }}
            >
                    <i className={`fas fa-${
                      key === 'none' ? 'image' :
                      key === 'blackAndWhite' ? 'adjust' :
                      key === 'sepia' ? 'sun' :
                      key === 'vintage' ? 'clock' :
                      key === 'warm' ? 'temperature-high' :
                      'snowflake'}`}></i>
                    <span className="effect-item-label">{effect.name}</span>
            </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="groupName">Enter Your Google Drive Name Folder:</label>
              <input
                type="text"
                id="groupName"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter group name"
              />
            </div>
            <img src="/logo-nusanarrative.png" alt="Nusanarrative Logo" className="nusa-logo" />

            <div className="action-buttons" style={{ justifyContent: 'center' }}>
          {selectedPhotos.length === 0 && (
            <>
          <button
            className="action-button primary"
            onClick={handlePrint}
                disabled={isLoading || !name || printQueue.isPrinting}
          >
            <i className="fas fa-print"></i>
          </button>
              {printQueue.isFailed && (
                <button 
                  className="action-button retry"
                  onClick={handleRetryPrint}
                  disabled={isLoading}
                >
                  <i className="fas fa-sync-alt"></i>
                </button>
              )}
          <button 
            className="action-button secondary"
            onClick={handleSaveToGDrive}
            disabled={isLoading || !name || isCreatingGif}
          >
            <i className="fas fa-qrcode"></i>
          </button>
            </>
              )}
            </div>

            {/* Retake Area */}
            {selectedPhotos.length > 0 && (
              <div className="retake-area">
                <button 
                  className="action-button danger"
                  onClick={handleRetakePhotos}
                >
                  <i className="fas fa-camera"></i>
                </button>
              </div>
          )}
          </div>
      </div>

        {isQRModalOpen && (
      <QRCodeModal 
            url={driveLink} 
        onClose={() => setIsQRModalOpen(false)}
      />
      )}
    </div>
  );
};

export default PhotoPreviewGroup;