import React, { useRef, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import io from "socket.io-client";
import './PhotoBoothGroup.css';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const socket = io(API_URL);

const PhotoBoothGroup = ({ setCapturedImagesGroup: setFinalImages, initialSettings }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [localCapturedImages, setLocalCapturedImages] = useState([]);
  const [filter, setFilter] = useState("none");
  const [countdown, setCountdown] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [settings, setSettings] = useState(initialSettings || { 
    framesPerStrip: 4, 
    numberOfStrips: 1, 
    printCount: 2 
  });
  const [currentStrip, setCurrentStrip] = useState(0);
  const [allStrips, setAllStrips] = useState([]);
  const timerRef = useRef(null);

  // State untuk retake
  const [retakeMode, setRetakeMode] = useState(false);
  const [retakeIndices, setRetakeIndices] = useState([]);
  const [originalStrips, setOriginalStrips] = useState([]);
  const [currentRetakeIndex, setCurrentRetakeIndex] = useState(0);
  const [retakeComplete, setRetakeComplete] = useState(false);

  const [dslrDevice, setDslrDevice] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [selectedCamera, setSelectedCamera] = useState(null);

  const resetAllStates = () => {
    setRetakeMode(false);
    setRetakeIndices([]);
    setOriginalStrips([]);
    setCurrentRetakeIndex(0);
    setRetakeComplete(false);
    setLocalCapturedImages([]);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  // Reset when component mounts
  useEffect(() => {
    resetAllStates();
    // Initialize allStrips with empty arrays based on numberOfStrips
    setAllStrips(Array(settings.numberOfStrips).fill().map(() => []));
  }, [settings.numberOfStrips]);

  // Reset when component unmounts
  useEffect(() => {
    return () => {
      resetAllStates();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const initializeApp = async () => {
      try {
        // Add Font Awesome CDN
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
        document.head.appendChild(link);

        // Fetch settings
        const response = await fetch(`${API_URL}/api/settings`);
        const data = await response.json();
        
        if (!isMounted) return;
        
        console.log("Fetched settings:", data);
        setSettings(data);
        setAllStrips(Array(data.numberOfStrips).fill().map(() => []));

        // Initialize camera
        const initCamera = async () => {
          try {
            await startCamera(data.camera);
          } catch (error) {
            if (retryCount < maxRetries && isMounted) {
              retryCount++;
              console.log(`Retrying camera initialization (${retryCount}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              return initCamera();
            }
            throw error;
          }
        };

        await initCamera();
      } catch (err) {
        console.error("Error initializing:", err);
        if (isMounted) {
          setMessage({ 
            text: 'Error initializing camera. Please refresh the page or check permissions.', 
            type: 'error' 
          });
        }
      }
    };

    initializeApp();

    // Listen for settings updates
    socket.on('settings-updated', async (newSettings) => {
      if (isMounted) {
        console.log("Settings updated:", newSettings);
        setSettings(newSettings);
        setAllStrips(Array(newSettings.numberOfStrips).fill().map(() => []));
        
        // Reinitialize camera with new settings
        try {
          await startCamera(newSettings.camera);
        } catch (error) {
          console.error("Error updating camera with new settings:", error);
        }
      }
    });

    return () => {
      isMounted = false;
      socket.off('settings-updated');
      // Stop camera stream
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  // Effect untuk handle retake mode
  useEffect(() => {
    if (location.state?.isRetake) {
      const { retakeIndices, originalImages, selectedStrips } = location.state;
      
      if (Array.isArray(retakeIndices) && retakeIndices.length > 0) {
        console.log('Entering retake mode for indices:', retakeIndices);
        setRetakeMode(true);
        setRetakeIndices(retakeIndices);
        setOriginalStrips(originalImages);
        setCurrentRetakeIndex(0);
        setRetakeComplete(false);
      }
    }
  }, [location.state]);

  // Function to connect to DSLR camera via WebUSB
  const connectDSLR = async () => {
    try {
      if (!navigator.usb) {
        throw new Error('WebUSB not supported in this browser');
      }

      // Request DSLR camera
      const device = await navigator.usb.requestDevice({
        filters: [
          // Canon filters
          { vendorId: 0x04a9 }, // Canon vendor ID
          // Nikon filters
          { vendorId: 0x04b0 }, // Nikon vendor ID
          // Sony filters
          { vendorId: 0x054c }  // Sony vendor ID
        ]
      });

      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);

      setDslrDevice(device);
      setMessage({ text: 'DSLR camera connected successfully!', type: 'success' });
      
      return device;
    } catch (error) {
      console.error('Error connecting to DSLR:', error);
      setMessage({ 
        text: 'Failed to connect DSLR camera. Falling back to webcam.', 
        type: 'warning' 
      });
      return null;
    }
  };

  const startCamera = async (cameraSettings) => {
    try {
      // Stop any existing stream
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get available devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // Find selected camera or use first available
      let selectedDevice = videoDevices.find(device => device.deviceId === cameraSettings?.deviceId) 
                          || videoDevices[0];

      if (!selectedDevice) {
        throw new Error('No camera devices found');
      }

      console.log('Using camera device:', selectedDevice.label);

      // Try different constraints in order of preference
      const constraints = [
        {
          video: {
            deviceId: { exact: selectedDevice.deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        {
          video: {
            deviceId: { exact: selectedDevice.deviceId },
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 }
          }
        },
        {
          video: {
            deviceId: { exact: selectedDevice.deviceId }
          }
        },
        {
          video: true
        }
      ];

      let stream = null;
      let error = null;

      for (const constraint of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraint);
          if (stream) break;
        } catch (err) {
          error = err;
          console.warn('Failed to get stream with constraint:', constraint, err);
          continue;
        }
      }

      if (!stream) {
        throw error || new Error('Failed to initialize camera');
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve, reject) => {
          videoRef.current.onloadedmetadata = resolve;
          videoRef.current.onerror = reject;
        });
        
        videoRef.current.style.transform = 'scaleX(-1)'; // Mirror effect
        await videoRef.current.play();
        
        console.log('Camera initialized successfully');
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      throw error;
    }
  };

  const startCountdown = () => {
    if (capturing || retakeComplete) return;
    setCapturing(true);
  
    let photosTaken = 0;
    const newCapturedImages = [...localCapturedImages];
  
    let retakeIdx = currentRetakeIndex;
  
    const captureSequence = async () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (retakeMode && retakeIdx >= retakeIndices.length) {
        setCountdown(null);
        setCapturing(false);
        setRetakeComplete(true);
        
        const updatedStrips = originalStrips.map(strip => [...strip]);
        retakeIndices.forEach((photoIndex, i) => {
          if (newCapturedImages[i]) {
            const stripIndex = location.state.selectedStrips[i];
            updatedStrips[stripIndex][photoIndex] = newCapturedImages[i];
          }
        });
        
        navigate("/preview-group", { 
          state: { 
            strips: updatedStrips,
            isRetake: false
          },
          replace: true
        });
        setTimeout(() => {
          setRetakeMode(false);
          setRetakeIndices([]);
          setOriginalStrips([]);
          setCurrentRetakeIndex(0);
          setRetakeComplete(false);
          setLocalCapturedImages([]);
        }, 500);
        return;
      }

      if (!retakeMode && newCapturedImages.length >= settings.framesPerStrip) {
        console.log('Strip completed, saving photos:', newCapturedImages);
        
        const updatedStrips = [...allStrips];
        updatedStrips[currentStrip] = [...newCapturedImages];
        setAllStrips(updatedStrips);
        
        if (currentStrip + 1 >= settings.numberOfStrips) {
          console.log('All strips completed, navigating to /preview-group', updatedStrips);
          setCapturing(false);
          setCountdown(null);
          
          navigate("/preview-group", {
            state: { 
              strips: updatedStrips,
              isRetake: false
            },
            replace: true
          });
          return;
        } else {
          setCurrentStrip(prev => prev + 1);
          setLocalCapturedImages([]);
          setCapturing(false);
          return;
        }
      }

      let timeLeft = 5;
      setCountdown(timeLeft);

      timerRef.current = setInterval(() => {
        timeLeft -= 1;
        setCountdown(timeLeft);

        if (timeLeft === 0) {
          clearInterval(timerRef.current);
          
          const imageUrl = capturePhoto();
          if (typeof imageUrl === 'string') {
            console.log('Photo captured:', photosTaken + 1);
            newCapturedImages.push(imageUrl);
            setLocalCapturedImages(prev => [...prev, imageUrl]);
            photosTaken += 1;
            
            if (retakeMode) {
              retakeIdx++;
              setCurrentRetakeIndex(retakeIdx);
            }

            if (retakeMode && retakeIdx >= retakeIndices.length) {
              setCountdown(null);
              setCapturing(false);
              setRetakeComplete(true);
              const updatedStrips = originalStrips.map(strip => [...strip]);
              retakeIndices.forEach((photoIndex, i) => {
                if (newCapturedImages[i]) {
                  const stripIndex = location.state.selectedStrips[i];
                  updatedStrips[stripIndex][photoIndex] = newCapturedImages[i];
                }
              });
              navigate("/preview-group", {
                state: {
                  strips: updatedStrips,
                  isRetake: false
                },
                replace: true
              });
              setTimeout(() => {
                setRetakeMode(false);
                setRetakeIndices([]);
                setOriginalStrips([]);
                setCurrentRetakeIndex(0);
                setRetakeComplete(false);
                setLocalCapturedImages([]);
              }, 500);
              return;
            }

            if ((retakeMode && retakeIdx < retakeIndices.length) || 
                (!retakeMode && photosTaken < settings.framesPerStrip)) {
              setTimeout(() => captureSequence(), 1500);
            } else {
              setCapturing(false);
            }

            // Tambahan: langsung navigate jika jumlah foto sudah cukup
            if (!retakeMode && newCapturedImages.length >= settings.framesPerStrip) {
              const updatedStrips = [...allStrips];
              updatedStrips[currentStrip] = [...newCapturedImages];
              setAllStrips(updatedStrips);
              setCapturing(false);
              setCountdown(null);
              console.log('Auto navigating to /preview-group', updatedStrips);
              navigate("/preview-group", {
                state: { 
                  strips: updatedStrips,
                  isRetake: false
                },
                replace: true
              });
              return;
            }
          } else {
            console.error('Failed to capture photo');
            setMessage({ 
              text: 'Failed to capture photo. Please try again.', 
              type: 'error' 
            });
            setCapturing(false);
          }
        }
      }, 1000);
    };

    captureSequence();
  };

  const capturePhoto = () => {
    try {
      // Get references to video and canvas elements
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Validate required elements
      if (!video || !canvas) {
        console.error('Missing video or canvas element');
        throw new Error('Missing required elements for photo capture');
      }

      // Ensure video is playing and has valid dimensions
      if (!video.videoWidth || !video.videoHeight) {
        console.error('Video element is not ready');
        throw new Error('Video stream is not ready');
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Get canvas context
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas context');
      }

      // Clear previous content
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Save context state
      context.save();

      // Mirror effect
      context.scale(-1, 1);
      context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      context.restore();

      // Apply any filters or effects if selected
      if (filter !== "none") {
        applyFilter(context, filter);
      }

      // Convert to base64
      try {
        const imageData = canvas.toDataURL("image/jpeg", 0.8);
        console.log('Photo captured successfully');
        return imageData;
      } catch (error) {
        console.error('Error converting canvas to image:', error);
        throw new Error('Failed to convert photo');
      }

    } catch (error) {
      console.error('Error in capturePhoto:', error);
      setMessage({ 
        text: `Failed to capture photo: ${error.message}`, 
        type: 'error' 
      });
      return null;
    }
  };

  // Add helper function for filters
  const applyFilter = (context, filterName) => {
    try {
      const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
      const data = imageData.data;

      switch (filterName) {
        case 'grayscale':
          for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            data[i] = avg;     // red
            data[i + 1] = avg; // green
            data[i + 2] = avg; // blue
          }
          break;
        case 'sepia':
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
            data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
            data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
          }
          break;
        // Add more filters as needed
      }

      context.putImageData(imageData, 0, 0);
    } catch (error) {
      console.error('Error applying filter:', error);
    }
  };

  // Function to apply camera settings effects
  const applyCameraSettings = (context, settings) => {
    const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    const data = imageData.data;

    // Apply ISO (brightness adjustment)
    if (settings.iso !== 'auto') {
      const isoValue = parseInt(settings.iso);
      const brightness = (isoValue / 400) * 0.5; // Normalize ISO value
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * (1 + brightness));     // Red
        data[i + 1] = Math.min(255, data[i + 1] * (1 + brightness)); // Green
        data[i + 2] = Math.min(255, data[i + 2] * (1 + brightness)); // Blue
      }
    }

    // Apply White Balance
    if (settings.whiteBalance !== 'auto') {
      const wbAdjustments = {
        daylight: { r: 1, g: 1, b: 1 },
        cloudy: { r: 1.1, g: 1, b: 0.9 },
        tungsten: { r: 0.8, g: 1, b: 1.2 },
        fluorescent: { r: 0.9, g: 1.1, b: 1 }
      };

      const wb = wbAdjustments[settings.whiteBalance];
      if (wb) {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] * wb.r);     // Red
          data[i + 1] = Math.min(255, data[i + 1] * wb.g); // Green
          data[i + 2] = Math.min(255, data[i + 2] * wb.b); // Blue
        }
      }
    }

    context.putImageData(imageData, 0, 0);
  };

  return (
    <div className="photo-booth-group">
      {retakeMode && (
        <div className="retake-notice">
          <h3>Retake Mode</h3>
          {!retakeComplete ? (
            <>
              <p>Retaking photo {currentRetakeIndex + 1} of {retakeIndices.length}</p>
              {currentRetakeIndex < retakeIndices.length && (
                <p>Frame {retakeIndices[currentRetakeIndex] + 1}</p>
              )}
            </>
          ) : (
            <p>Retake complete! Processing...</p>
          )}
        </div>
      )}
      
      <div className="camera-container-group">
        <div className="strip-info">
          <h3>Strip {currentStrip + 1} of {settings.numberOfStrips}</h3>
          <p>{settings.framesPerStrip - localCapturedImages.length} frames remaining</p>
        </div>

        <div className="camera-frame">
          <video ref={videoRef} autoPlay className="video-feed-group" style={{ filter }} />
          <canvas ref={canvasRef} className="hidden" />
          
          {countdown !== null && (
            <div className="countdown-container">
              <div className="countdown-group">
                <div className="countdown-number">{countdown}</div>
                <div className="countdown-text">Get Ready!</div>
              </div>
            </div>
          )}

          <div className="camera-overlay">
            <div className="frame-corner top-left"></div>
            <div className="frame-corner top-right"></div>
            <div className="frame-corner bottom-left"></div>
            <div className="frame-corner bottom-right"></div>
          </div>

          <div className="camera-controls">
            <button 
              onClick={() => navigate("/")}
              className="back-button"
            >
              <i className="fas fa-arrow-left"></i>
            </button>
            
            <button 
              onClick={startCountdown}
              disabled={capturing}
              className="capture-button"
            >
              <i className="fas fa-camera"></i>
            </button>
          </div>
        </div>

        <div className="preview-container">
          <div className="preview-strip">
            {localCapturedImages.map((image, index) => (
              <div key={index} className="preview-thumbnail">
                <img src={image} alt={`Captured ${index + 1}`} />
                <div className="thumbnail-number">{index + 1}</div>
              </div>
            ))}
          </div>
        </div>

        {currentStrip > 0 && (
          <div className="previous-strips">
            {allStrips.slice(0, currentStrip).map((strip, stripIndex) => (
              <div key={stripIndex} className="strip-preview">
                <h4>Strip {stripIndex + 1}</h4>
                <div className="strip-thumbnails">
                  {strip.map((image, imageIndex) => (
                    <div key={imageIndex} className="mini-thumbnail">
                      <img src={image} alt={`Strip ${stripIndex + 1}, Frame ${imageIndex + 1}`} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoBoothGroup;