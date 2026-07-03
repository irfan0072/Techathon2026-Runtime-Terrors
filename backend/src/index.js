const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const store = require("./store");
const { startSimulator } = require("./simulator");

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Express REST API Routes

// Get all devices and their statuses
app.get("/api/devices", (req, res) => {
  res.json({
    success: true,
    devices: store.getDevices()
  });
});

// Manual override: Toggle device status via REST API
app.post("/api/devices/:id/toggle", (req, res) => {
  const { id } = req.params;
  const device = store.getDeviceById(id);

  if (!device) {
    return res.status(404).json({ success: false, message: "Device not found" });
  }

  const newStatus = !device.status;
  const didChange = store.updateDeviceStatus(id, newStatus);

  if (didChange) {
    // Notify all socket clients about manual toggle
    io.emit("device_update", {
      device: device,
      totalPower: store.getTotalPowerNow(),
      roomBreakdown: store.getRoomPowerBreakdown(),
      estimatedKWh: store.getEstimatedKWh()
    });

    return res.json({
      success: true,
      message: `Manually toggled ${device.room} - ${device.name} to ${newStatus ? 'ON' : 'OFF'}`,
      device
    });
  }

  res.json({ success: true, message: "No change in state", device });
});

// Get power consumption metrics
app.get("/api/usage", (req, res) => {
  res.json({
    success: true,
    metrics: {
      totalPowerNow: store.getTotalPowerNow(),
      roomBreakdown: store.getRoomPowerBreakdown(),
      estimatedKWh: store.getEstimatedKWh()
    }
  });
});

// Get active alerts log
app.get("/api/alerts", (req, res) => {
  res.json({
    success: true,
    alerts: store.getAlerts()
  });
});

// Get dummy users dataset (strictly Nafisa Rahman and Tanvir Hossain)
app.get("/api/users", (req, res) => {
  res.json({
    success: true,
    users: store.dummyUsers
  });
});

// Clear all alerts
app.post("/api/alerts/clear", (req, res) => {
  store.clearAlerts();
  io.emit("alerts_cleared");
  res.json({ success: true, message: "Alerts cleared successfully" });
});


// Initialize HTTP Server and Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for dev simplicity in hackathon
    methods: ["GET", "POST"]
  }
});

// Socket.io Connection handler
io.on("connection", (socket) => {
  console.log(`[Socket] Dashboard client connected: ${socket.id}`);
  
  // Send initial data snapshot to the newly connected client
  socket.emit("init_state", {
    devices: store.getDevices(),
    totalPower: store.getTotalPowerNow(),
    roomBreakdown: store.getRoomPowerBreakdown(),
    estimatedKWh: store.getEstimatedKWh(),
    alerts: store.getAlerts()
  });

  // Handle manual toggle requests from the frontend client via WebSockets
  socket.on("toggle_device", (deviceId) => {
    const device = store.getDeviceById(deviceId);
    if (device) {
      const newStatus = !device.status;
      const didChange = store.updateDeviceStatus(deviceId, newStatus);
      if (didChange) {
        console.log(`[Socket] Client ${socket.id} toggled ${device.room} - ${device.name} to ${newStatus ? 'ON' : 'OFF'}`);
        // Broadcast the update to all clients
        io.emit("device_update", {
          device: device,
          totalPower: store.getTotalPowerNow(),
          roomBreakdown: store.getRoomPowerBreakdown(),
          estimatedKWh: store.getEstimatedKWh()
        });
      }
    }
  });

  // Handle request to clear all alerts
  socket.on("clear_alerts", () => {
    store.clearAlerts();
    io.emit("alerts_cleared");
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Start simulated device layer
startSimulator(io);

// Start server
server.listen(port, () => {
  console.log(`[Server] Smart Office Backend running at http://localhost:${port}`);
});
