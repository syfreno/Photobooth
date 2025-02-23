const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;


const emailsDir = path.join(__dirname, "saved_emails");
if (!fs.existsSync(emailsDir)) {
  fs.mkdirSync(emailsDir);
  console.log("Saved emails directory created");
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(cors({
  origin: ["http://localhost:3000", "https://picapicaa.netlify.app"], 
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));



app.use(express.static("uploads"));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log("Uploads directory created");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); 
  },
  filename: (req, file, cb) => {
    cb(null, `photo-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  console.log("File uploaded:", req.file.filename);
  res.json({ imageUrl: `/${req.file.filename}` });
});

app.get("/images", (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error("Error reading uploads directory:", err);
      return res.status(500).json({ message: "Error reading uploads" });
    }
    res.json(files.map(file => ({ url: `/${file}` })));
  });
});

app.post("/send-message", async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ message: "All fields are required" });
  }

  console.log("Incoming message:", { name, email, message });

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });;

    transporter.verify(function(error, success) {
      if (error) {
        console.error("Email verification failed:", error);
      } else {
        console.log("Email server is ready");
      }
    });

    const mailOptions = {
      from: email,
      to: process.env.EMAIL,
      subject: `New Message from ${name}`,
      text: `Email: ${email}\n\nMessage:\n${message}`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);

    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ message: "Failed to send email", error: error.message });
  }
});

app.post("/send-photo-strip", async (req, res) => {
  const { recipientEmail, imageData } = req.body;

  if (!recipientEmail || !imageData) {
    return res.status(400).json({ message: "Missing recipientEmail or imageData" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    transporter.verify(function(error, success) {
      if (error) {
        console.error("Email verification failed:", error);
      } else {
        console.log("Email server is ready");
      }
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: recipientEmail,
      subject: "Your Photo Strip 🎉",
      text: "Thanks for using Picapica!",
      attachments: [
        {
          filename: "photo-strip.png",
          content: imageData.split("base64,")[1], 
          encoding: "base64"
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully to:", recipientEmail);

    res.status(200).json({ 
      success: true,
      message: "Photo strip sent successfully!"
    });
  } catch (error) {
    console.error("Error sending photo strip:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to send photo strip", 
      error: error.message 
    });
  }
});

app.get("/saved-emails", (req, res) => {
  fs.readdir(emailsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ message: "Error reading saved emails" });
    }
    const emails = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const data = JSON.parse(fs.readFileSync(path.join(emailsDir, file)));
        return {
          filename: file,
          to: data.to,
          date: data.date
        };
      });
    res.json(emails);
  });
});

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});