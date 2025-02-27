import React from "react";
import { useNavigate } from "react-router-dom";

const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div className="welcome-container">
      <h1>Welcome!</h1>
      <p>
        You have <strong>3 seconds</strong> for each shot – no retakes! <br />
        This photobooth captures <strong>4 pictures</strong> in a row, so strike your best pose and have fun!
      </p>
      <p>
        After the session, <span style={{ color: "pink" }}></span> download your digital copy and share the fun!
      </p>
      <button onClick={() => navigate("/photobooth")}>COUPLES</button>
      <button onClick={() => navigate("/photobooth-group")}>GROUPS</button>
    </div>
  );
};

export default Welcome;
