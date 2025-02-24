import "./App.css";
import React, { use, useState } from "react";
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

  return (
    <div className="App">
      <nav className="navbar">
        <Link to="/">Home</Link>
        <Link to="/privacy-policy">Privacy Policy</Link>
        <Link to="/contact">Contact</Link>
        <Link to="/" className="logo">Picapica</Link>

        <div className={`hamburger ${isMobileNavOpen ? "open" : ""}`} onClick={toggleMobileNav}>
           <div className= "bar"></div>
           <div className= "bar"></div>
           <div className= "bar"></div>
        </div>
        
        <div className={`nav-links ${isMobileNavOpen ? "open" : ""}`}>
          <Link to="/" onClick={toggleMobileNav}>Home</Link>
          <Link to="/privacy-policy" onClick={toggleMobileNav}>Privacy Policy</Link>
          <Link to="/contact" onClick={toggleMobileNav}>Contact</Link>

          {/* PayPal Button */}
          <form action="https://www.paypal.com/donate" method="post" target="_blank" className="paypal-form">
            <a href="https://www.paypal.com/donate?hosted_button_id=VMLZHE6KGTZGQ"
              target="_blank"
              rel="noopener noreferrer"
              title="Support me with a donation!">
              <img
                src="https://pics.paypal.com/00/s/YWRhODcwY2EtZWVhZC00OGY3LThhYTMtMzI1OWViYzIwYjUy/file.PNG"
                alt="Donate with PayPal button"
                className="paypal-button"
              />
            </a>
          </form>
        </div>


        <form action="https://www.paypal.com/donate" method="post" target="_blank" className="paypal-form">
         <a href="https://www.paypal.com/donate?hosted_button_id=VMLZHE6KGTZGQ" 
          target="_blank" 
          rel="noopener noreferrer" 
          title="Support me with a donation!">

        <img 
              src="https://pics.paypal.com/00/s/YWRhODcwY2EtZWVhZC00OGY3LThhYTMtMzI1OWViYzIwYjUy/file.PNG" 
              border="0" 
              name="submit" 
              alt="Donate with PayPal button"
              className="paypal-button"
            />
          </a> 
        </form>
      </nav>
  
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/photobooth" element={<PhotoBooth setCapturedImages={setCapturedImages} />} />
        <Route path="/preview" element={<PhotoPreview capturedImages={capturedImages} />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </div>
  );
}

export default App;
