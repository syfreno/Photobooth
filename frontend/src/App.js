import "./App.css";
import React, { useState } from "react";
import { Routes, Route, Link } from "react-router-dom";  
import Home from "./components/Home";
import PhotoBoothGroup from "./components/PhotoBoothGroup";
import PhotoPreviewGroup from "./components/PhotoPreviewGroup";
import Settings from './components/Settings';

function App() {
  const [capturedImagesGroup, setCapturedImagesGroup] = useState([]);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const toggleMobileNav = () => {
    setIsMobileNavOpen(!isMobileNavOpen);
  }

  const closeMobileNav = () => {
    setIsMobileNavOpen(false);
  }

  return (
    <div className="App">
      <nav className="navbar">
        {/* Hamburger Icon (Mobile Only) */}
        <div className={`hamburger ${isMobileNavOpen ? "open" : ""}`} onClick={toggleMobileNav}>
          <div className="bar"></div>
          <div className="bar"></div>
          <div className="bar"></div>
        </div>

        {/* Overlay (closes the menu when clicked outside) */}
        {isMobileNavOpen && <div className="overlay show" onClick={closeMobileNav}></div>}
      </nav>

      <div className="main-content">
        {/* App Routes */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/photobooth-group" element={<PhotoBoothGroup setCapturedImagesGroup={setCapturedImagesGroup} />} />
          <Route path="/preview-group" element={<PhotoPreviewGroup capturedImagesGroup={capturedImagesGroup} />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
