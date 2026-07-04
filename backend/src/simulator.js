// Simulated Device Layer
// Toggles random device states to create a live dashboard experience

const store = require("./store");

function startSimulator(io) {
  console.log("Device simulator started...");

  // Runs every 7 seconds to toggle random device states
  const simulatorInterval = setInterval(() => {
    const settings = store.getSettings();
    if (!settings.autoSimulatorEnabled) {
      return; // Skip automatic simulation, manual control only
    }

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

  // Run vacancy check interval every 5 seconds (Real-time vacancy alerts)
  setInterval(() => {
    const settings = store.getSettings();
    if (!settings.roomTimerEnabled) return;

    const startTimes = store.getRoomAllOnStartTimes();
    const now = Date.now();

    const [limitH, limitM] = (settings.roomAllOnTimeLimit || "02:00").split(":").map(Number);
    const limitMs = (limitH * 60 + limitM) * 60 * 1000;

    Object.entries(startTimes).forEach(([room, startTime]) => {
      if (startTime) {
        const elapsedMs = now - startTime;
        if (elapsedMs >= limitMs) {
          const existingAlerts = store.getAlerts();
          // Avoid spamming this specific warning alert within 30 seconds
          const hasRecentRoomAlert = existingAlerts.some(
            a => a.message.includes(`all devices in ${room} have been running ON simultaneously`) && 
            (now - new Date(a.timestamp).getTime() < 30000)
          );

          if (!hasRecentRoomAlert) {
            const admin = store.dummyUsers[1]; // Tanvir Hossain
            const elapsedMins = Math.floor(elapsedMs / 60000);
            const elapsedSecs = Math.floor((elapsedMs % 60000) / 1000);
            const timeStr = elapsedMins > 0 ? `${elapsedMins}m ${elapsedSecs}s` : `${elapsedSecs}s`;

            const msg = `[Efficiency Alert] All devices in ${room} have been running ON simultaneously for ${timeStr}. Notifying Admin ${admin.name} (${admin.phone}) to check for vacancy. Limit set to ${settings.roomAllOnTimeLimit} (hh:mm).`;
            const alert = store.addAlert(msg, "danger");
            io.emit("alert_added", alert);
          }
        }
      }
    });
  }, 5000);

  return simulatorInterval;
}

// Helper to get Dhaka time components (GMT+6) to match the user's timezone exactly
function getDhakaTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    hour: "numeric",
    minute: "numeric",
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const min = parseInt(parts.find(p => p.type === 'minute').value, 10);
  
  const timeString = now.toLocaleTimeString("en-US", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  return { hour, min, timeString };
}

// Check for alerts based on problem statement rules
function checkAlerts(io, updatedDevice) {
  const settings = store.getSettings();
  const { hour: currentHour, min: currentMin, timeString } = getDhakaTime();
  const currentTimeVal = currentHour * 60 + currentMin;

  const [startH, startM] = (settings.officeStartTime || "09:00").split(":").map(Number);
  const startTimeVal = startH * 60 + startM;

  const [endH, endM] = (settings.officeEndTime || "17:00").split(":").map(Number);
  const endTimeVal = endH * 60 + endM;
  
  // Alert Rule 1: Devices left on after office hours (Office hours from settings)
  const isAfterHours = currentTimeVal < startTimeVal || currentTimeVal >= endTimeVal;
  if (isAfterHours && updatedDevice.status === true) {
    const admin = store.dummyUsers[0]; // Nafisa Rahman
    const msg = `[After Hours Alert] ${updatedDevice.room} - ${updatedDevice.name} was turned ON at ${timeString}. Dispatching alert to Admin ${admin.name} (${admin.phone}).`;
    
    // Check if alert already exists to prevent spam
    const existing = store.getAlerts();
    const hasRecent = existing.some(
      a => a.message.includes(`${updatedDevice.room} - ${updatedDevice.name}`) && 
      (Date.now() - new Date(a.timestamp).getTime() < 30000)
    );

    if (!hasRecent) {
      const alert = store.addAlert(msg, "warning");
      io.emit("alert_added", alert);
    }
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
  startSimulator,
  checkAlerts
};
