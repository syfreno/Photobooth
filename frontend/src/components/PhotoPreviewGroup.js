import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const frames = {
  none: {
    draw: (ctx, x, y, width, height) => {}, 
  },
  pastel: {
    draw: (ctx, x, y, width, height) => {
      const drawSticker = (x, y, type) => {
        switch(type) {
          case 'star':
            ctx.fillStyle = "#FFD700";
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'heart':
            ctx.fillStyle = "#cc8084";
            ctx.beginPath();
            const heartSize = 22;
            ctx.moveTo(x, y + heartSize / 4);
            ctx.bezierCurveTo(x, y, x - heartSize / 2, y, x - heartSize / 2, y + heartSize / 4);
            ctx.bezierCurveTo(x - heartSize / 2, y + heartSize / 2, x, y + heartSize * 0.75, x, y + heartSize);
            ctx.bezierCurveTo(x, y + heartSize * 0.75, x + heartSize / 2, y + heartSize / 2, x + heartSize / 2, y + heartSize / 4);
            ctx.bezierCurveTo(x + heartSize / 2, y, x, y, x, y + heartSize / 4);
            ctx.fill();
            break;
          case 'flower':
            ctx.fillStyle = "#FF9BE4";
            for(let i = 0; i < 5; i++) {
              ctx.beginPath();
              const angle = (i * 2 * Math.PI) / 5;
              ctx.ellipse(
                x + Math.cos(angle) * 10,
                y + Math.sin(angle) * 10,
                8, 8, 0, 0, 2 * Math.PI
              );
              ctx.fill();
            }
            // Center of flower
            ctx.fillStyle = "#FFE4E1";
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fill();
            break;
          case 'bow':
            ctx.fillStyle = "#f9cee7";
            // Left loop
            ctx.beginPath();
            ctx.ellipse(x - 10, y, 10, 6, Math.PI / 4, 0, 2 * Math.PI);
            ctx.fill();
            // Right loop
            ctx.beginPath();
            ctx.ellipse(x + 10, y, 10, 6, -Math.PI / 4, 0, 2 * Math.PI);
            ctx.fill();
            // Center knot
            ctx.fillStyle = "#e68bbe";
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
            break;
        }
      };

         // Top left corner
         drawSticker(x + 11, y + 5, 'bow');
         drawSticker(x - 18, y + 95, 'heart');
         
         // Top right corner
         drawSticker(x + width - 160, y + 10, 'star');
         drawSticker(x + width - 1, y + 50, 'heart');
         
         // Bottom left corner
         drawSticker(x + 120, y + height - 20, 'heart');
         drawSticker(x + 20, y + height - 20, 'star');
         
         // Bottom right corner
         drawSticker(x + width - 125, y + height - 5, 'bow');
         drawSticker(x + width - 10, y + height - 45, 'heart');
       }
     },

  
  cute: {
    draw: (ctx, x, y, width, height) => {
      const drawStar = (centerX, centerY, size, color = "#FFD700") => {
        ctx.fillStyle = color;
        ctx.beginPath();
        for(let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const point = i === 0 ? 'moveTo' : 'lineTo';
          ctx[point](
            centerX + size * Math.cos(angle),
            centerY + size * Math.sin(angle)
          );
        }
        ctx.closePath();
        ctx.fill();
      };

      const drawCloud = (centerX, centerY) => {
        ctx.fillStyle = "#87CEEB";
        const cloudParts = [
          { x: 0, y: 0, r: 14 },
          { x: -6, y: 2, r: 10 },
          { x: 6, y: 2, r: 10 },
        ];
        cloudParts.forEach(part => {
          ctx.beginPath();
          ctx.arc(centerX + part.x, centerY + part.y, part.r, 0, Math.PI * 2);
          ctx.fill();
        });
      };

      // Draw decorations around the frame
        // Top corners
        drawStar(x + 150, y + 18, 15, "#FFD700");
        drawCloud(x + 20, y + 5);
        drawStar(x + width - 1, y + 45, 12, "#FF69B4");
        drawCloud(x + width - 80, y + 5);

        // Bottom corners
        drawCloud(x + 150, y + height - 5);
        drawStar(x + 0, y + height - 65, 15, "#9370DB");
        drawCloud(x + width - 5, y + height - 85);
        drawStar(x + width - 120, y + height - 5, 12, "#40E0D0");
   }
  }
};

const PhotoPreviewGroup = ({ capturedImagesGroup }) => {
  const stripCanvasRef = useRef(null);
  const navigate = useNavigate();
  const [stripColor, setStripColor] = useState("white");
  const [selectedFrame, setSelectedFrame] = useState("none");
  const [email, setEmail] = useState("");  
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");

  const generatePhotoStrip = useCallback(() => {
    const canvas = stripCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

  
    const imgWidth = 650;  
    const imgHeight = 250; 
    const borderSize = 40;  
    const photoSpacing = 20;  
    const textHeight = 50;  
    const totalHeight = (imgHeight * 4) + (photoSpacing * 3) + (borderSize * 2) + textHeight;

    canvas.width = imgWidth + borderSize * 2;
    canvas.height = totalHeight;

    ctx.fillStyle = stripColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let imagesLoaded = 0;
    capturedImagesGroup.forEach((image, index) => {
      const img = new Image();
      img.src = image;
      img.onload = () => {
        const yOffset = borderSize + (imgHeight + photoSpacing) * index;

        const imageRatio = img.width / img.height;
        const targetRatio = imgWidth / imgHeight;

        let sourceWidth = img.width;
        let sourceHeight = img.height;
        let sourceX = 0;
        let sourceY = 0;

        if (imageRatio > targetRatio) {
            sourceWidth = sourceHeight * targetRatio;
            sourceX = (img.width - sourceWidth) / 2;
        } else {
            sourceHeight = sourceWidth / targetRatio;
            sourceY = (img.height - sourceHeight) / 2;
        }

        ctx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight, 
            borderSize, yOffset, imgWidth, imgHeight      
        );

        if (frames[selectedFrame] && typeof frames[selectedFrame].draw === 'function') {
          frames[selectedFrame].draw(
              ctx,
              borderSize,
              yOffset,
              imgWidth,
              imgHeight
          );
      }
        
        imagesLoaded++;

        if (imagesLoaded === capturedImagesGroup.length) {
          const now = new Date();
          const timestamp = now.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
          }) + '  ' + 
          now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
          


          ctx.fillStyle = stripColor === "black" ? "#FFFFFF" : "#000000";
          ctx.font = "20px Arial";
          ctx.textAlign = "center";
          
          ctx.fillText("For Dania to Ehsan " + timestamp, canvas.width / 2, totalHeight - borderSize * 1);


          ctx.fillStyle = stripColor === "black" ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)";
          ctx.font = "12px Arial";  
          ctx.textAlign = "center";

          ctx.fillText(
              "© 2025 AW",
              canvas.width - borderSize,
              totalHeight - borderSize / 2
          );
        }
      };
    });
  }, [capturedImagesGroup, stripColor, selectedFrame]);

  useEffect(() => {
    if (capturedImagesGroup.length === 4) {
      setTimeout(() => {
        generatePhotoStrip();
      }, 100);
    }
  }, [capturedImagesGroup, stripColor, selectedFrame, generatePhotoStrip]);

  const downloadPhotoStrip = () => {
    const fileName = name.trim() ? `${name.trim()}_photostrip.png` : `photostrip.png`;
    const link = document.createElement("a");
    link.download = fileName; // Dynamic filename with user's name
    link.href = stripCanvasRef.current.toDataURL("image/png");
    link.click();
  };

  const sendPhotoStripToEmail = async () => {
    // Clear previous status
    setStatus("");
    
    // Comprehensive email validation
    const validateEmail = (email) => {
      // Basic format check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return false;
      
      // Common typos and issues
      if (email.includes('..') || email.endsWith('.') || email.startsWith('.')) return false;
      if (email.includes('@@') || email.startsWith('@')) return false;
      
      // Length checks
      if (email.length < 5 || email.length > 254) return false;
      
      // Domain part checks
      const [localPart, domain] = email.split('@');
      if (!domain || domain.length < 3) return false;
      if (!domain.includes('.')) return false;
      
      // Local part length check
      if (localPart.length > 64) return false;
      
      // TLD validation (must be at least 2 characters)
      const tld = domain.split('.').pop();
      if (!tld || tld.length < 2) return false;
      
      return true;
    };
  
    // List of commonly mistyped domains and their corrections
    const commonMisspellings = {
      'gmail.co': 'gmail.com',
      'gmail.cm': 'gmail.com',
      'gmai.com': 'gmail.com',
      'gmial.com': 'gmail.com',
      'gamil.com': 'gmail.com',
      'yahoo.co': 'yahoo.com',
      'yahooo.com': 'yahoo.com',
      'hotmail.co': 'hotmail.com',
      'hotmial.com': 'hotmail.com',
      'outloo.com': 'outlook.com',
      'outlok.com': 'outlook.com'
    };
  
    // Check and suggest corrections for common email misspellings
    const checkForTypos = (email) => {
      const [localPart, domain] = email.split('@');
      if (commonMisspellings[domain]) {
        return {
          hasTypo: true,
          suggestion: `${localPart}@${commonMisspellings[domain]}`
        };
      }
      return { hasTypo: false };
    };
  
    if (!email) {
      setStatus("Please enter an email address.");
      return;
    }
  
    // Check for common typos
    const typoCheck = checkForTypos(email);
    if (typoCheck.hasTypo) {
      if (confirm(`Did you mean ${typoCheck.suggestion}?`)) {
        setEmail(typoCheck.suggestion);
        // Continue with the corrected email
      } else {
        // User declined correction, continue with validation
      }
    }
  
    if (!validateEmail(email)) {
      setStatus("Please enter a valid email address. Example: name@example.com");
      return;
    }
  
    // Blocked domains validation
    const blockedDomains = [
      'mymail.lausd.net',
      'lausd.net',
      'domain@undefined',
      'undefined',
      '@undefined'
    ];
  
    const domain = email.split('@')[1];
    if (blockedDomains.includes(domain) || domain.includes('undefined')) {
      setStatus("This email domain is not supported. Please use a different email address.");
      return;
    }
  
    try {
      setStatus("Sending email...");
      
      // Add a delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/send-photo-strip`, {
        recipientEmail: email.trim(), // Trim to remove any accidental spaces
        imageData: stripCanvasRef.current.toDataURL("image/jpeg", 0.7)
      });
  
      if (response.data.success) {
        setStatus("Photo Strip sent successfully! Please check your inbox (and spam folder).");
        setEmail("");
      } else {
        setStatus(`Failed to send: ${response.data.message}`);
      }
    } catch (error) {
      console.error("Network Error Details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // More user-friendly error messages
      if (error.response?.status === 400) {
        setStatus(`Error: ${error.response.data.message || "Invalid email address"}`);
      } else if (error.message.includes("Network Error")) {
        setStatus("Network connection error. Please check your internet connection and try again.");
      } else {
        
        setStatus(`Error: ${error.response?.data?.message || "Failed to send. Please try again later."}`);
      }
    }
  };
  
  return (
    <div className="photo-preview">
      <h2>Photo Strip Preview</h2>
  
      <div className="control-section">
        <h3>Customize your photo strip</h3>
  
        <p className="section-title">Frame Color</p>
        <div className="color-options">
          <button onClick={() => setStripColor("white")}>White</button>
          <button onClick={() => setStripColor("black")}>Black</button>
          <button onClick={() => setStripColor("#f6d5da")}>Pink</button>
          <button onClick={() => setStripColor("#dde6d5")}>Green</button>
          <button onClick={() => setStripColor("#adc3e5")}>Blue</button>
          <button onClick={() => setStripColor("#FFF2CC")}>Yellow</button>
          <button onClick={() => setStripColor("#dbcfff")}>Purple</button>
        </div>
  
        <p className="section-title">Stickers</p>
        <div className="frame-options">
          <button onClick={() => setSelectedFrame("none")}>No Stickers</button>
          <button onClick={() => setSelectedFrame("pastel")}>Girlypop Stickers</button>
          <button onClick={() => setSelectedFrame("cute")}>Cute Stickers</button>
        </div>
      </div>
  
      <canvas ref={stripCanvasRef} className="photo-strip-group" />
  
      <div className="control-section">
        <div className="action-buttons">
          <button onClick={() => navigate("/photobooth-group")}>🔄 Take New Photos</button>
          <button onClick={() => navigate("/")}>Home</button>
        </div>
  
        {/* <div className="email-section">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button onClick={sendPhotoStripToEmail}>Send to Email</button>
          <p className="status-message">{status}</p>
        </div> */}
        <div className="name-section">
        <p>Enter a short name for your photo so it easier to recognise it in the Google Drive</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)} // Update name state on input
          placeholder="Enter your name"
          className="p-2 border rounded-lg"
        />
          <button onClick={downloadPhotoStrip}>📥 Download Photo Strip</button>
          <p>We will sent the link to the Google Drive for you to download your photo strip</p>
        </div>
      </div>
    </div>
  );
};

export default PhotoPreviewGroup;