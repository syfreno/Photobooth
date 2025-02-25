import "./App.css";
import React, { useState } from "react";
import { Routes, Route, Link } from "react-router-dom";  
import Home from "./components/Home";
import Welcome from "./components/Welcome";
import PhotoBooth from "./components/PhotoBooth";
import PhotoPreview from "./components/PhotoPreview";
import PrivacyPolicy from './components/PrivacyPolicy';
import Contact from "./components/Contact";


function App() {
  const [capturedImages, setCapturedImages] = useState([]);
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
        <Link to="/" className="logo">picapica</Link>

        {/* Navigation Links */}
        <div className={`nav-links ${isMobileNavOpen ? "open" : ""}`}>
          <Link to="/" onClick={closeMobileNav}>Home</Link>
          <Link to="/privacy-policy" onClick={closeMobileNav}>Privacy Policy</Link>
          <Link to="/contact" onClick={closeMobileNav}>Contact</Link>
        </div>

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
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/photobooth" element={<PhotoBooth setCapturedImages={setCapturedImages} />} />
          <Route path="/preview" element={<PhotoPreview capturedImages={capturedImages} />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
