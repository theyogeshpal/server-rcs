const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const campaignManager = require('./campaignManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Setup File Uploading
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});
const upload = multer({ storage: storage });

// Store connected sockets
const connectedDevices = new Map();

io.on('connection', (socket) => {
  console.log(`Device connected: ${socket.id}`);
  connectedDevices.set(socket.id, socket);

  // Broadcast updated count
  io.emit('device_count_update', connectedDevices.size);

  socket.on('disconnect', () => {
    console.log(`Device disconnected: ${socket.id}`);
    connectedDevices.delete(socket.id);
    io.emit('device_count_update', connectedDevices.size);
  });
});

// Create uploads folder if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('./uploads')){
    fs.mkdirSync('./uploads');
}

// API to handle campaign creation
app.post('/api/campaign', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'excel', maxCount: 1 }]), (req, res) => {
  const textMessage = req.body.textMessage;
  const files = req.files;

  if (!files.excel || !files.excel[0]) {
    return res.status(400).json({ error: 'Excel sheet is required' });
  }

  const excelFile = files.excel[0];
  const imageFile = files.image ? files.image[0] : null;
  const imageUrl = imageFile ? `/uploads/${imageFile.filename}` : null;

  try {
    // Pass everything to Campaign Manager
    const result = campaignManager.startCampaign(
      excelFile.path, 
      textMessage, 
      imageUrl, 
      Array.from(connectedDevices.values())
    );

    res.json({ success: true, message: 'Campaign started', data: result });
  } catch (error) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ error: 'Failed to process campaign' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
