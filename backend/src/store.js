// Single Source of Truth - In-Memory Store
// Managing 15 devices total (2 fans, 3 lights per room across 3 rooms)

// STRICT PROBLEM STATEMENT REQUIREMENT: Only this dummy dataset must be used for any user-related values
const dummyUsers = [
  { name: "Nafisa Rahman", email: "nafisa.rahman@yahoo.com", phone: "+8801812345678" },
  { name: "Tanvir Hossain", email: "tanvir.hossain@yahoo.com", phone: "+8801912345678" }
];

// Initialize devices state
const devices = [
  // Drawing Room
  { id: "drawing_fan_1", name: "Fan 1", type: "fan", room: "Drawing Room", status: false, powerDraw: 60, lastChanged: new Date().toISOString() },
  { id: "drawing_fan_2", name: "Fan 2", type: "fan", room: "Drawing Room", status: false, powerDraw: 60, lastChanged: new Date().toISOString() },
  { id: "drawing_light_1", name: "Light 1", type: "light", room: "Drawing Room", status: false, powerDraw: 15, lastChanged: new Date().toISOString() },
  { id: "drawing_light_2", name: "Light 2", type: "light", room: "Drawing Room", status: false, powerDraw: 15, lastChanged: new Date().toISOString() },
  { id: "drawing_light_3", name: "Light 3", type: "light", room: "Drawing Room", status: false, powerDraw: 15, lastChanged: new Date().toISOString() },

  // Work Room 1
  { id: "work1_fan_1", name: "Fan 1", type: "fan", room: "Work Room 1", status: false, powerDraw: 60, lastChanged: new Date().toISOString() },
  { id: "work1_fan_2", name: "Fan 2", type: "fan", room: "Work Room 1", status: false, powerDraw: 60, lastChanged: new Date().toISOString() },
  { id: "work1_light_1", name: "Light 1", type: "light", room: "Work Room 1", status: false, powerDraw: 15, lastChanged: new Date().toISOString() },
  { id: "work1_light_2", name: "Light 2", type: "light", room: "Work Room 1", status: false, powerDraw: 15, lastChanged: new Date().toISOString() },
  { id: "work1_light_3", name: "Light 3", type: "light", room: "Work Room 1", status: false, powerDraw: 15, lastChanged: new Date().toISOString() },

  // Work Room 2
  { id: "work2_fan_1", name: "Fan 1", type: "fan", room: "Work Room 2", status: false, powerDraw: 60, lastChanged: new Date().toISOString() },
  { id: "work2_fan_2", name: "Fan 2", type: "fan", room: "Work Room 2", status: false, powerDraw: 60, lastChanged: new Date().toISOString() },
  { id: "work2_light_1", name: "Light 1", type: "light", room: "Work Room 2", status: false, powerDraw: 15, lastChanged: new Date().toISOString() },
  { id: "work2_light_2", name: "Light 2", type: "light", room: "Work Room 2", status: false, powerDraw: 15, lastChanged: new Date().toISOString() },
  { id: "work2_light_3", name: "Light 3", type: "light", room: "Work Room 2", status: false, powerDraw: 15, lastChanged: new Date().toISOString() }
];

// In-Memory alerts list
const alerts = [];

// Estimated daily power usage in kWh (calculated by accumulative logic, initialized to a base estimate)
let estimatedKWh = 4.2; 
let lastKWhUpdate = Date.now();

// Helper functions
const getDevices = () => devices;

const getDeviceById = (id) => devices.find(d => d.id === id);

const updateDeviceStatus = (id, status) => {
  const device = getDeviceById(id);
  if (device) {
    if (device.status !== status) {
      device.status = status;
      device.lastChanged = new Date().toISOString();
      return true; // status changed
    }
  }
  return false;
};

// Calculate total power usage right now
const getTotalPowerNow = () => {
  return devices.reduce((sum, d) => sum + (d.status ? d.powerDraw : 0), 0);
};

// Calculate power usage breakdown by room
const getRoomPowerBreakdown = () => {
  const rooms = ["Drawing Room", "Work Room 1", "Work Room 2"];
  const breakdown = {};
  rooms.forEach(room => {
    breakdown[room] = devices
      .filter(d => d.room === room)
      .reduce((sum, d) => sum + (d.status ? d.powerDraw : 0), 0);
  });
  return breakdown;
};

// Update and retrieve the accumulated estimated kWh
const getEstimatedKWh = () => {
  const now = Date.now();
  const hoursPassed = (now - lastKWhUpdate) / (1000 * 60 * 60);
  
  // Calculate power consumption during the interval: TotalPowerNow (in Watts) * hours / 1000
  const currentDrawW = getTotalPowerNow();
  const addedKWh = (currentDrawW * hoursPassed) / 1000;
  
  estimatedKWh += addedKWh;
  lastKWhUpdate = now;
  return parseFloat(estimatedKWh.toFixed(3));
};

const getAlerts = () => alerts;

const clearAlerts = () => {
  alerts.length = 0;
};

const addAlert = (message, severity = "warning") => {
  const alert = {
    id: `alert_${Date.now()}`,
    timestamp: new Date().toISOString(),
    message,
    severity
  };
  alerts.unshift(alert);
  if (alerts.length > 50) {
    alerts.pop(); // Keep list size under control
  }
  return alert;
};

// Settings configuration
const settings = {
  officeStartHour: 9,
  officeEndHour: 17,
  roomAllOnHourLimit: 2,
  roomTimerEnabled: true,
  discordOnlyDanger: false
};

const getSettings = () => settings;

const updateSettings = (newSettings) => {
  Object.assign(settings, newSettings);
  return settings;
};

module.exports = {
  dummyUsers,
  getDevices,
  getDeviceById,
  updateDeviceStatus,
  getTotalPowerNow,
  getRoomPowerBreakdown,
  getEstimatedKWh,
  getAlerts,
  clearAlerts,
  addAlert,
  getSettings,
  updateSettings
};
