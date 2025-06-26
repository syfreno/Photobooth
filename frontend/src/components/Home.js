import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaInstagram, FaCamera, FaHeart } from "react-icons/fa";
import "../App.css";

const Home = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/photobooth-group');
  };

  const handleInstagramClick = () => {
    window.open('https://www.instagram.com/nusanarrative.id?igsh=MXBsY3hsOHlncWJnMQ==', '_blank');
  };

  // Generate stars
  const renderStars = () => {
    return [...Array(150)].map((_, index) => {
      const size = Math.random() * 3;
      return (
        <div
          key={index}
          className="star"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            '--twinkle-duration': `${Math.random() * 4 + 2}s`
          }}
        />
      );
    });
  };

  // Generate shooting stars
  const renderShootingStars = () => {
    return [...Array(5)].map((_, index) => (
      <div
        key={index}
        className="shooting-star"
        style={{
          top: `${Math.random() * 100}%`,
          left: `${Math.random() * 100}%`,
          '--shooting-duration': `${Math.random() * 2 + 1}s`,
          animationDelay: `${Math.random() * 5}s`
        }}
      />
    ));
  };

  return (
    <>
      <div className="space-bg">
        <div className="stars">
          {renderStars()}
        </div>
        {renderShootingStars()}
        <div className="nebula" />
        <div className="aurora" />
      </div>

      <div className="home-container">
        <div className="content-wrapper">
          <div className="logo-section">
            <div className="creative-logo">
              <div className="camera-icon">
                <FaCamera />
              </div>
              <div className="heart-icon">
                <FaHeart />
              </div>
            </div>
            
            <h1 className="welcome-text">Welcome to</h1>
            <h2 className="brand-name">Nusanarrative</h2>
            <p className="tagline">Capture Your Precious Moments</p>
          </div>

          <div className="strip-container">
            <img 
              src="/photobooth-strip.png" 
              alt="Photo Strip" 
              className="photo-strip"
            />
          </div>

          <div className="action-section">
            <button 
              className="start-button"
              onClick={handleStart}
            >
              START
            </button>

            <div className="social-media">
              <button 
                className="instagram-button"
                onClick={handleInstagramClick}
              >
                <FaInstagram className="instagram-icon" />
                <span>Follow Us on Instagram</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
