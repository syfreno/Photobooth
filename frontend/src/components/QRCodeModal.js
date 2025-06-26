import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './QRCodeModal.css';

const QRCodeModal = ({ url, onClose }) => {
  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <div className="modal-content">
          <button className="close-button" onClick={onClose}>×</button>
          <h2>Scan QR Code</h2>
          <div className="qr-code-container">
            <QRCodeSVG 
              value={url}
              size={256}
              level="H"
              includeMargin={true}
            />
          </div>
          <p className="instructions">
            Scan QR code ini untuk melihat semua foto dan GIF Anda di Google Drive
          </p>
          {/* <div className="link-container">
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="view-link"
            >
              Buka di Browser
            </a>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal; 