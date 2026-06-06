const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const campaignManager = require('./campaignManager');

// Store campaigns in memory
const campaigns = {};

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

  socket.on('MESSAGE_STATUS', (data) => {
    // data: { campaignId, phone, status: 'sent' | 'failed' }
    if (data && data.campaignId && campaigns[data.campaignId]) {
      if (data.status === 'sent') {
        campaigns[data.campaignId].sent += 1;
      } else if (data.status === 'failed') {
        campaigns[data.campaignId].failed += 1;
      }
      
      // Check if campaign is completed
      const c = campaigns[data.campaignId];
      if (c.sent + c.failed >= c.total) {
        c.status = 'completed';
      }
    }
  });
});

// Create uploads folder if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('./uploads')){
    fs.mkdirSync('./uploads');
}

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
    const campaignId = crypto.randomUUID();

    // Pass everything to Campaign Manager
    const result = campaignManager.startCampaign(
      campaignId,
      excelFile.path, 
      textMessage, 
      imageUrl, 
      Array.from(connectedDevices.values())
    );

    // Initialize campaign tracking
    campaigns[campaignId] = {
      id: campaignId,
      message: textMessage,
      total: result.totalContacts,
      sent: 0,
      failed: 0,
      status: 'running',
      createdAt: new Date().toISOString()
    };

    res.json({ success: true, message: 'Campaign started', data: { ...result, campaignId } });
  } catch (error) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ error: 'Failed to process campaign' });
  }
});

// API to get all campaigns
app.get('/api/campaigns', (req, res) => {
  // Return list of campaigns sorted by newest first
  const list = Object.values(campaigns).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, data: list });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
