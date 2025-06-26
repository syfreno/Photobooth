import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import './Settings.css';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const socket = io(API_URL);

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'info' });
  const [connectedCameras, setConnectedCameras] = useState([]);
  const [printersList, setPrintersList] = useState([]);
  const [settings, setSettings] = useState({
    framesPerStrip: 4,
    numberOfStrips: 2,
    printCount: 2,
    selectedPrinter: 'HP Deskjet',
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
  });
  const [patterns, setPatterns] = useState([]);
  const [newPattern, setNewPattern] = useState({
    name: '',
    file: null,
    files: null,
    previewUrl: ''
  });

  // Fetch initial data
  useEffect(() => {
    // Fetch current settings
    fetch(`${API_URL}/api/settings`)
      .then(res => res.json())
      .then(data => {
        console.log("Fetched settings:", data);
        setSettings(prev => ({
          ...prev,
          ...data,
          camera: {
            ...prev.camera,
            ...data.camera
          }
        }));
      })
      .catch(err => {
        console.error("Error fetching settings:", err);
        setMessage({ text: 'Error loading settings', type: 'error' });
      });

    // Fetch patterns
    fetchPatterns();
    
    // Detect cameras
    detectConnectedCameras();
    
    // Fetch printers
    fetchPrinters();
    
    // Setup device change listener
    navigator.mediaDevices.addEventListener('devicechange', detectConnectedCameras);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', detectConnectedCameras);
    };
  }, []);

  // Fetch available printers
  const fetchPrinters = async () => {
    try {
      const response = await fetch(`${API_URL}/api/printers`);
      const data = await response.json();
      if (data.printers && data.printers.length > 0) {
        setPrintersList(data.printers);
        
        // Check if HP Deskjet is available
        if (data.hasHPDeskjet && data.defaultHPPrinter) {
          console.log('HP Deskjet is available:', data.defaultHPPrinter);
          console.log('All HP Deskjet printers found:', data.hpDeskjetPrinters);
          
          // Set the default HP printer if no printer is selected
          if (!settings.selectedPrinter) {
            setSettings(prev => ({
              ...prev,
              selectedPrinter: data.defaultHPPrinter
            }));
          }
        } else {
          console.warn('No HP Deskjet found, using first available printer');
          // Set first printer as default if no HP Deskjet is available
          if (!settings.selectedPrinter && data.printers.length > 0) {
            setSettings(prev => ({
              ...prev,
              selectedPrinter: data.printers[0]
            }));
          }
        }
        
        // Show message about printer availability
        if (data.hasHPDeskjet) {
          const hpPrinterList = data.hpDeskjetPrinters.join(', ');
          setMessage({ 
            text: `HP Deskjet detected: ${hpPrinterList}. Default: ${data.defaultHPPrinter}`, 
            type: 'success' 
          });
        } else {
          setMessage({ 
            text: `No HP Deskjet found. Available printers: ${data.printers.join(', ')}`, 
            type: 'info' 
          });
        }
      } else {
        setMessage({ 
          text: 'No printers found. Please check your printer connections.', 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('Error fetching printers:', error);
      setMessage({ 
        text: 'Error loading printers. Please check your printer connections.', 
        type: 'error' 
      });
    }
  };

  // Camera detection functions
  const detectConnectedCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      const cameraList = videoDevices.map(device => {
        let label = device.label || `Camera ${device.deviceId.slice(0, 5)}`;
        const isCanonM50 = /canon.*m50/i.test(label);
        const isCanonEOS = /canon|eos/i.test(label);
        return {
          id: device.deviceId,
          label: label + (isCanonM50 ? ' (Canon M50 Detected)' : isCanonEOS ? ' (Canon EOS Detected)' : ''),
          type: isCanonM50 ? 'canon-m50' : isCanonEOS ? 'canon-eos' : 'webcam'
        };
      });

      setConnectedCameras(cameraList);
    } catch (error) {
      console.error('Error detecting cameras:', error);
      setMessage({ text: 'Error detecting cameras', type: 'error' });
    }
  };

  // Settings change handlers
  const handleCameraChange = (deviceId) => {
    const selectedCamera = connectedCameras.find(cam => cam.id === deviceId);
    if (selectedCamera) {
      setSettings(prev => ({
        ...prev,
        camera: {
          ...prev.camera,
          type: selectedCamera.type,
          deviceId: selectedCamera.id,
          model: selectedCamera.label
        }
      }));
    }
  };

  const handleSettingsChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('camera.settings.')) {
      const settingName = name.split('.')[2];
      setSettings(prev => ({
        ...prev,
        camera: {
          ...prev.camera,
          settings: {
            ...prev.camera.settings,
            [settingName]: value
          }
        }
      }));
    } else if (name.startsWith('camera.')) {
      const cameraField = name.split('.')[1];
      setSettings(prev => ({
        ...prev,
        camera: {
          ...prev.camera,
          [cameraField]: value
        }
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        [name]: parseInt(value) || value
      }));
    }
  };

  // Pattern management functions
  const fetchPatterns = async () => {
    try {
      const response = await fetch(`${API_URL}/api/patterns`);
      const data = await response.json();
      setPatterns(data.map(pattern => ({
        ...pattern,
        url: `${API_URL}${pattern.url}`
      })));
    } catch (error) {
      console.error('Error fetching patterns:', error);
      setMessage({ text: 'Error loading patterns', type: 'error' });
    }
  };

  const handlePatternFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Validate each file
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ text: 'Each file size should be less than 5MB', type: 'error' });
        return;
      }
      if (!file.type.startsWith('image/')) {
        setMessage({ text: 'Please upload only image files', type: 'error' });
        return;
      }
    }

    // Set first file as preview
    const firstFile = files[0];
    setNewPattern(prev => ({
      ...prev,
      file: firstFile,
      files: files,
      previewUrl: URL.createObjectURL(firstFile)
    }));
  };

  const handlePatternNameChange = (e) => {
    setNewPattern(prev => ({
      ...prev,
      name: e.target.value
    }));
  };

  const handlePatternUpload = async (e) => {
    e.preventDefault();
    if (!newPattern.files || !newPattern.name) {
      setMessage({ text: 'Please provide both name and image files', type: 'error' });
      return;
    }

    setLoading(true);
    let uploadedCount = 0;
    const totalFiles = newPattern.files.length;

    try {
      for (let i = 0; i < newPattern.files.length; i++) {
        const file = newPattern.files[i];
        const formData = new FormData();
        
        // Add number suffix for multiple files
        const fileName = totalFiles > 1 ? 
          `${newPattern.name}_${i + 1}` : 
          newPattern.name;
        
        formData.append('name', fileName);
        formData.append('patternImage', file);

        const response = await fetch(`${API_URL}/api/patterns`, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          uploadedCount++;
        }
      }

      await fetchPatterns();
      setNewPattern({ name: '', file: null, files: null, previewUrl: '' });
      setMessage({ 
        text: `Successfully uploaded ${uploadedCount} pattern${uploadedCount !== 1 ? 's' : ''}!`, 
        type: 'success' 
      });
    } catch (error) {
      console.error('Error uploading patterns:', error);
      setMessage({ 
        text: 'Error uploading patterns. Please try again.', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePattern = async (patternId) => {
    if (!window.confirm('Are you sure you want to delete this pattern?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/patterns/${patternId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchPatterns();
        setMessage({ text: 'Pattern deleted successfully!', type: 'success' });
      } else {
        throw new Error('Failed to delete pattern');
      }
    } catch (error) {
      console.error('Error deleting pattern:', error);
      setMessage({ text: 'Error deleting pattern. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Save all settings
  const handleSave = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      // Emit settings update through socket
      socket.emit('settings-update', settings);
      
      setMessage({ text: 'Settings saved successfully!', type: 'success' });
      
      // Navigate back after short delay
      setTimeout(() => {
        navigate('/settings');
      }, 1500);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ text: 'Error saving settings', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Listen for settings updates from other clients
  useEffect(() => {
    socket.on('settings-updated', (newSettings) => {
      console.log('Received settings update:', newSettings);
      setSettings(prev => ({
        ...prev,
        ...newSettings
      }));
    });

    return () => {
      socket.off('settings-updated');
    };
  }, []);

  // Show detailed printer information
  const showPrinterInfo = () => {
    if (printersList.length === 0) {
      setMessage({ text: 'No printers detected. Please refresh printer list.', type: 'info' });
      return;
    }

    const hpPrinters = printersList.filter(printer => 
      printer.toLowerCase().includes('hp') && 
      (printer.toLowerCase().includes('deskjet') || printer.toLowerCase().includes('dj'))
    );

    if (hpPrinters.length > 0) {
      const info = `HP Printers Found: ${hpPrinters.join(', ')}`;
      setMessage({ text: info, type: 'success' });
    } else {
      const info = `Available Printers: ${printersList.join(', ')}`;
      setMessage({ text: info, type: 'info' });
    }
  };

  // Test print function
  const testPrint = async () => {
    if (!settings.selectedPrinter) {
      setMessage({ text: 'Please select a printer first', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/print/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          printerName: settings.selectedPrinter
        }),
      });

      const result = await response.json();
      if (result.success) {
        setMessage({ 
          text: `Test print sent to ${settings.selectedPrinter}`, 
          type: 'success' 
        });
      } else {
        setMessage({ 
          text: `Test print failed: ${result.error}`, 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('Test print error:', error);
      setMessage({ 
        text: 'Test print failed. Please check printer connection.', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReprintLastJob = async () => {
    setLoading(true);
    setMessage({ text: 'Attempting to reprint last job...', type: 'info' });

    try {
      const lastPrintJobData = localStorage.getItem('lastPrintJob');
      if (!lastPrintJobData) {
        throw new Error('No previous print job found in this session.');
      }

      if (!settings.selectedPrinter) {
        throw new Error('Please select a printer first.');
      }

      const response = await fetch(`${API_URL}/api/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: lastPrintJobData,
          printerName: settings.selectedPrinter,
          stripIndex: -1, // Indicates a composite print
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Unknown error during reprint.');
      }

      setMessage({ text: `Reprint job successfully sent to ${settings.selectedPrinter}!`, type: 'success' });

    } catch (error) {
      console.error('Reprint error:', error);
      setMessage({ text: `Reprint Failed: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-container">
      <h1>Photo Booth Settings</h1>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
          <button 
            className="close-message" 
            onClick={() => setMessage({ text: '', type: 'info' })}
          >
            ×
          </button>
        </div>
      )}

      <div className="settings-grid">
        <div className="settings-section">
          <h2>General Settings</h2>
          <div className="form-group">
            <label>Frames per Strip:</label>
            <input
              type="number"
              name="framesPerStrip"
              value={settings.framesPerStrip}
              onChange={handleSettingsChange}
              min="1"
              max="6"
            />
            <small className="help-text">Number of photos/frames in each strip (1-6)</small>
          </div>

          <div className="form-group">
            <label>Prints per Page:</label>
            <input
              type="number"
              name="printCount"
              value={settings.printCount}
              onChange={handleSettingsChange}
              min="1"
              max="5"
            />
            <small className="help-text">Number of page copies to print (each page contains 2 strips)</small>
          </div>

          <div className="form-group">
            <label>Default Printer:</label>
            <div className="printer-select-wrapper">
              <select
                name="selectedPrinter"
                value={settings.selectedPrinter}
                onChange={handleSettingsChange}
                className="printer-select"
              >
                {printersList.length > 0 ? (
                  printersList.map((printer, index) => (
                    <option key={index} value={printer}>{printer}</option>
                  ))
                ) : (
                  <option value="">No printers found</option>
                )}
              </select>
              <button 
                type="button" 
                onClick={fetchPrinters}
                className="refresh-printers-btn"
                title="Refresh printer list"
              >
                <i className="fas fa-sync-alt"></i>
              </button>
              <button 
                type="button" 
                onClick={testPrint}
                className="test-print-btn"
                title="Test print"
                disabled={loading || !settings.selectedPrinter}
              >
                <i className="fas fa-print"></i>
              </button>
              <button
                type="button"
                onClick={handleReprintLastJob}
                className="reprint-btn"
                title="Reprint last job"
                disabled={loading}
              >
                <i className="fas fa-history"></i>
              </button>
              <button 
                type="button" 
                onClick={showPrinterInfo}
                className="info-printers-btn"
                title="Show printer info"
              >
                <i className="fas fa-info-circle"></i>
              </button>
            </div>
            <small className="help-text">Select the default printer for photo strips</small>
            <small className="help-text supported-printers">
              <strong>Supported HP Models:</strong> HP Deskjet 2130, 2135, 2130 Series, HP DJ 2130, HP DJ 2135, and other HP Deskjet variants
            </small>
          </div>
        </div>

        <div className="settings-section">
          <h2>Camera Settings</h2>
          <div className="form-group">
            <label>Select Camera:</label>
            <select 
              value={settings.camera.deviceId}
              onChange={(e) => handleCameraChange(e.target.value)}
              className="camera-select"
            >
              {connectedCameras.map(camera => (
                <option key={camera.id} value={camera.id}>
                  {camera.label} ({camera.type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {settings.camera.type !== 'webcam' && (
            <>
              <div className="form-group">
                <label>ISO:</label>
                <select
                  name="camera.settings.iso"
                  value={settings.camera.settings.iso}
                  onChange={handleSettingsChange}
                >
                  <option value="auto">Auto</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="400">400</option>
                  <option value="800">800</option>
                  <option value="1600">1600</option>
                </select>
              </div>

              <div className="form-group">
                <label>Shutter Speed:</label>
                <select
                  name="camera.settings.shutterSpeed"
                  value={settings.camera.settings.shutterSpeed}
                  onChange={handleSettingsChange}
                >
                  <option value="auto">Auto</option>
                  <option value="1/1000">1/1000</option>
                  <option value="1/500">1/500</option>
                  <option value="1/250">1/250</option>
                  <option value="1/125">1/125</option>
                  <option value="1/60">1/60</option>
                </select>
              </div>

              <div className="form-group">
                <label>Aperture:</label>
                <select
                  name="camera.settings.aperture"
                  value={settings.camera.settings.aperture}
                  onChange={handleSettingsChange}
                >
                  <option value="auto">Auto</option>
                  <option value="f/1.8">f/1.8</option>
                  <option value="f/2.8">f/2.8</option>
                  <option value="f/4">f/4</option>
                  <option value="f/5.6">f/5.6</option>
                  <option value="f/8">f/8</option>
                </select>
              </div>

              <div className="form-group">
                <label>White Balance:</label>
                <select
                  name="camera.settings.whiteBalance"
                  value={settings.camera.settings.whiteBalance}
                  onChange={handleSettingsChange}
                >
                  <option value="auto">Auto</option>
                  <option value="daylight">Daylight</option>
                  <option value="cloudy">Cloudy</option>
                  <option value="tungsten">Tungsten</option>
                  <option value="fluorescent">Fluorescent</option>
                </select>
              </div>
            </>
          )}
        </div>

        <div className="settings-section">
          <h2>Background Patterns</h2>
          <div className="patterns-grid">
            {patterns.map(pattern => (
              <div key={pattern.id} className="pattern-item">
                <div className="pattern-preview">
                  <img 
                    src={pattern.url} 
                    alt={pattern.name}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+';
                    }}
                  />
                  <div className="pattern-actions">
                    <button 
                      onClick={() => handleDeletePattern(pattern.id)}
                      className="delete-button"
                      title="Delete pattern"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
                <div className="pattern-info">
                  <span>{pattern.name}</span>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handlePatternUpload} className="upload-form">
            <h3>Add New Pattern</h3>
            <div className="form-group">
              <label>Pattern Name:</label>
              <input
                type="text"
                value={newPattern.name}
                onChange={handlePatternNameChange}
                placeholder="e.g., Leopard Print"
                disabled={loading}
                className="pattern-input"
              />
            </div>
            <div className="form-group">
              <label>Pattern Image:</label>
              <div className="file-input-wrapper">
                <input
                  type="file"
                  onChange={handlePatternFileChange}
                  accept="image/*"
                  disabled={loading}
                  className="pattern-file-input"
                  multiple
                  id="pattern-file-input"
                />
                <button 
                  type="button" 
                  className="file-select-button"
                  onClick={() => document.getElementById('pattern-file-input').click()}
                >
                  Choose File
                </button>
                <span className="file-name">
                  {newPattern.file ? newPattern.file.name : 'No file chosen'}
                </span>
              </div>
              {newPattern.previewUrl && (
                <div className="pattern-preview upload-preview">
                  <img src={newPattern.previewUrl} alt="Preview" />
                </div>
              )}
            </div>
            <button 
              type="submit" 
              className="upload-button"
              disabled={loading || !newPattern.file || !newPattern.name}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Uploading...
                </>
              ) : (
                <>
                  <i className="fas fa-upload"></i> Upload Pattern
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <div className="button-group">
        <button 
          onClick={() => navigate('/')}
          className="cancel-button"
        >
          Cancel
        </button>
        <button 
          onClick={handleSave}
          className="save-button"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
};

export default Settings; 