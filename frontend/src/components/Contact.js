import React, { useState } from 'react';
import axios from 'axios';
import '../App.css';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus('Sending message...');
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
      console.log("Sending to backend URL:", BACKEND_URL);
      
      if (!formData.name || !formData.email || !formData.message) {
        setStatus('Please fill in all fields');
        setIsSubmitting(false);
        return;
      }
      
      const res = await axios.post(`${BACKEND_URL}/send-message`, formData, {
        headers: {
          'Content-Type': 'application/json'
        },
        withCredentials: false
      });
      
      if (res.status === 200) {
        setStatus('Thank you for reaching out! Your message has been sent.');
        setFormData({ name: '', email: '', message: '' });
      } else {
        setStatus('Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error("Error details:", err);
      
      if (err.message === 'Network Error') {
        setStatus('Cannot connect to the server. Please check if the backend is running or try again later.');
      } else if (err.response) {
        setStatus(`Error: ${err.response.data.message || 'Server error, please try again'}`);
      } else {
        setStatus(`Failed to send message: ${err.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="contact-container">
        <div className="contact-form">
        <h2>Contact Us</h2>
        <form onSubmit={handleSubmit}>
            <input
            type="text"
            name="name"
            placeholder="Your Name"
            value={formData.name}
            onChange={handleChange}
            required
            />
            <input
            type="email"
            name="email"
            placeholder="Your Email"
            value={formData.email}
            onChange={handleChange}
            required
            />
            <textarea
            name="message"
            placeholder="Your Message"
            value={formData.message}
            onChange={handleChange}
            required
            ></textarea>
            <button type="submit">Send Message</button>
        </form>
        {status && <p className="status-message">{status}</p>}
          <div style={{ marginTop: '20px', fontSize: '0.9rem', textAlign: 'center' }}>
            <p>If you're having trouble with the contact form, you can also reach me directly at:</p>
            <p style={{ fontWeight: 'bold', marginTop: '5px' }}>agnes@picapicabooth.com</p>
          </div>
      </div>
    </div>
    
  );
};

export default Contact;
