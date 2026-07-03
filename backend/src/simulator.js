// Simulated Device Layer
// Toggles random device states to create a live dashboard experience

const store = require("./store");

function startSimulator(io) {
  console.log("Device simulator started...");

  // Runs every 7 seconds to toggle random device states
  const simulatorInterval = setInterval(() => {
    const devices = store.getDevices();
    
    // Pick a random device
    const randomIndex = Math.floor(Math.random() * devices.length);
    const targetDevice = devices[randomIndex];
    
    // Toggle state
    const newStatus = !targetDevice.status;
    const didChange = store.updateDeviceStatus(targetDevice.id, newStatus);
    
    if (didChange) {
      console.log(`[Simulator] Toggled ${targetDevice.room} - ${targetDevice.name} to ${newStatus ? 'ON' : 'OFF'}`);
      
      // Emit the update to all connected dashboard clients
      io.emit("device_update", {
        device: targetDevice,
        totalPower: store.getTotalPowerNow(),
        roomBreakdown: store.getRoomPowerBreakdown(),
        estimatedKWh: store.getEstimatedKWh()
      });
      
      // Run checks for anomalous conditions
      checkAlerts(io, targetDevice);
    }
  }, 7000);

  return simulatorInterval;
}

// Check for alerts based on problem statement rules
function checkAlerts(io, updatedDevice) {
  const settings = store.getSettings();
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTimeVal = currentHour * 60 + currentMin;

  const [startH, startM] = (settings.officeStartTime || "09:00").split(":").map(Number);
  const startTimeVal = startH * 60 + startM;

  const [endH, endM] = (settings.officeEndTime || "17:00").split(":").map(Number);
  const endTimeVal = endH * 60 + endM;
  
  // Alert Rule 1: Devices left on after office hours (Office hours from settings)
  const isAfterHours = currentTimeVal < startTimeVal || currentTimeVal >= endTimeVal;
  if (isAfterHours && updatedDevice.status === true) {
    const admin = store.dummyUsers[0]; // Nafisa Rahman
    const msg = `[After Hours Alert] ${updatedDevice.room} - ${updatedDevice.name} was turned ON at ${now.toLocaleTimeString()}. Dispatching alert to Admin ${admin.name} (${admin.phone}).`;
    
    const alert = store.addAlert(msg, "warning");
    io.emit("alert_added", alert);
  }

  // Alert Rule 2: A room where all devices are on
  // Let's check each room to see if all 5 devices in it are currently ON
  const rooms = ["Drawing Room", "Work Room 1", "Work Room 2"];
  const devices = store.getDevices();

  rooms.forEach(room => {
    const roomDevices = devices.filter(d => d.room === room);
    const allOn = roomDevices.every(d => d.status === true);
    
    if (allOn) {
      // Check if we already have an active alert for this room recently to avoid spamming
      const existingAlerts = store.getAlerts();
      const hasRecentRoomAlert = existingAlerts.some(
        a => a.message.includes(`all devices in ${room}`) && 
        (Date.now() - new Date(a.timestamp).getTime() < 30000) // 30 second threshold
      );

      if (!hasRecentRoomAlert) {
        const admin = store.dummyUsers[1]; // Tanvir Hossain
        const msg = `[Efficiency Alert] All devices in ${room} are currently running ON simultaneously. Notifying Admin ${admin.name} (${admin.phone}) to check for vacancy. Limit set to ${settings.roomAllOnTimeLimit} (hh:mm).`;
        const alert = store.addAlert(msg, "danger");
        io.emit("alert_added", alert);
      }
    }
  });
}

module.exports = {
  startSimulator
};
