import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Activity, 
  Lightbulb, 
  Wind, 
  AlertTriangle, 
  User, 
  Zap, 
  Clock, 
  MapPin, 
  CheckCircle,
  XCircle,
  HelpCircle,
  Settings
} from 'lucide-react';

export default function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  
  // Dashboard states
  const [devices, setDevices] = useState([]);
  const [totalPower, setTotalPower] = useState(0);
  const [roomBreakdown, setRoomBreakdown] = useState({
    "Drawing Room": 0,
    "Work Room 1": 0,
    "Work Room 2": 0
  });
  const [estimatedKWh, setEstimatedKWh] = useState(4.2);
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState("All");
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  // Settings & Timers states
  const [settings, setSettings] = useState({
    officeStartTime: "09:00",
    officeEndTime: "17:00",
    roomAllOnTimeLimit: "02:00",
    roomTimerEnabled: true,
    discordOnlyDanger: false
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [roomTimers, setRoomTimers] = useState({
    "Drawing Room": 0,
    "Work Room 1": 0,
    "Work Room 2": 0
  });

  const allOnStartTimes = useRef({
    "Drawing Room": null,
    "Work Room 1": null,
    "Work Room 2": null
  });

  // Live clock setup
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Room All-On timer updates
  useEffect(() => {
    const interval = setInterval(() => {
      const roomsList = ["Drawing Room", "Work Room 1", "Work Room 2"];
      const newTimers = { ...roomTimers };
      let updated = false;

      roomsList.forEach(room => {
        const roomDevices = devices.filter(d => d.room === room);
        const allOn = roomDevices.length > 0 && roomDevices.every(d => d.status);

        if (allOn && settings.roomTimerEnabled) {
          if (!allOnStartTimes.current[room]) {
            allOnStartTimes.current[room] = Date.now();
          }
          const elapsedSecs = Math.floor((Date.now() - allOnStartTimes.current[room]) / 1000);
          if (newTimers[room] !== elapsedSecs) {
            newTimers[room] = elapsedSecs;
            updated = true;
          }
        } else {
          if (allOnStartTimes.current[room] !== null || newTimers[room] !== 0) {
            allOnStartTimes.current[room] = null;
            newTimers[room] = 0;
            updated = true;
          }
        }
      });

      if (updated) {
        setRoomTimers(newTimers);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [devices, settings.roomTimerEnabled, roomTimers]);

  // Socket setup
  useEffect(() => {
    // Connect to Backend (port 3001 in development, Render URL in production)
    const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001'
      : 'https://teckathon-backend.onrender.com';

    const socketInstance = io(backendUrl);
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setConnected(true);
      console.log('Connected to backend via Socket.io');
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from backend');
    });

    // Receive initial state snapshot
    socketInstance.on('init_state', (data) => {
      setDevices(data.devices || []);
      setTotalPower(data.totalPower || 0);
      setRoomBreakdown(data.roomBreakdown || {});
      setEstimatedKWh(data.estimatedKWh || 4.2);
      setAlerts(data.alerts || []);
      if (data.settings) {
        setSettings(data.settings);
      }
    });

    socketInstance.on('settings_updated', (updated) => {
      setSettings(updated);
    });

    // Receive incremental update broadcasts
    socketInstance.on('device_update', (data) => {
      setDevices(prevDevices => 
        prevDevices.map(d => d.id === data.device.id ? data.device : d)
      );
      setTotalPower(data.totalPower);
      setRoomBreakdown(data.roomBreakdown);
      setEstimatedKWh(data.estimatedKWh);
    });

    // Receive alert notifications
    socketInstance.on('alert_added', (alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 50));
    });

    // Receive alerts cleared event
    socketInstance.on('alerts_cleared', () => {
      setAlerts([]);
    });

    // Fetch initial dummy users list
    fetch(`${backendUrl}/api/users`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUsers(data.users);
        }
      })
      .catch(err => console.error("Error fetching dummy users:", err));

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Handle manual toggle
  const handleToggle = (deviceId) => {
    if (socket) {
      socket.emit("toggle_device", deviceId);
    }
  };

  // Handle clear alerts
  const handleClearAlerts = () => {
    if (socket) {
      socket.emit("clear_alerts");
    }
  };

  // Handle settings update
  const handleUpdateSettings = (newSettings) => {
    if (socket) {
      socket.emit("update_settings", newSettings);
    }
    setShowSettingsModal(false);
  };

  // Helper to format timers
  const formatTime = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const activeDevices = devices.filter(d => d.status);
  const rooms = ["All", "Drawing Room", "Work Room 1", "Work Room 2"];

  // Filtered devices for rendering lists
  const filteredDevices = selectedRoom === "All" 
    ? devices 
    : devices.filter(d => d.room === selectedRoom);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col font-sans">
      
      {/* HEADER */}
      <header className="border-b border-[#23354E] bg-[#161F30]/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-[#3B82F6] p-2 rounded-xl text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <Zap className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">SmartOffice</h1>
            <p className="text-xs text-gray-400">Power & Device Monitoring Control Room</p>
          </div>
        </div>

        {/* CONNECTION STATUS & TIME */}
        <div className="flex items-center space-x-3 md:space-x-4">
          {/* Settings Button */}
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center space-x-1.5 bg-[#23354E]/40 hover:bg-[#23354E]/80 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg border border-[#23354E]/60 text-xs font-semibold transition-all"
            title="Open Control Settings"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          <a 
            href="https://discord.gg/euFt99ETT" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc] px-3 py-1.5 rounded-lg border border-[#0088cc]/30 text-xs font-semibold transition-all shadow-[0_0_10px_rgba(0,136,204,0.1)] hover:shadow-[0_0_15px_rgba(0,136,204,0.2)]"
          >
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z"/>
            </svg>
            <span className="hidden sm:inline">Telegram Channel</span>
            <span className="sm:hidden">Telegram</span>
          </a>

          <div className="flex items-center space-x-2 bg-[#23354E]/40 px-3 py-1.5 rounded-lg border border-[#23354E]/60 text-xs">
            <Clock className="h-3.5 w-3.5 text-[#3B82F6] animate-pulse" />
            <span className="font-semibold text-white tracking-wider">{time}</span>
          </div>

          <div className="flex items-center space-x-2 bg-[#23354E]/40 px-3 py-1.5 rounded-lg border border-[#23354E]/60 text-xs">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            <span>Office Hours: {settings.officeStartTime} - {settings.officeEndTime}</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse-glow shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`}></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">
              {connected ? 'Live Sync' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT & CENTER COLUMN: OVERVIEW STATS & VISUAL LAYOUT & CONTROL PANEL */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* POWER STATS CAROUSEL/GRID */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Total Wattage */}
            <div className="glass-panel p-4 flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-center text-gray-400 mb-2">
                <span className="text-xs font-medium">Power Demand</span>
                <Zap className="h-4 w-4 text-[#3B82F6]" />
              </div>
              <div>
                <span className="text-2xl font-bold tracking-tight text-white">{totalPower}</span>
                <span className="text-sm font-semibold text-[#3B82F6] ml-1">Watts</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-2">Active now</div>
            </div>

            {/* Estimated Consumption */}
            <div className="glass-panel p-4 flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-center text-gray-400 mb-2">
                <span className="text-xs font-medium">Daily Energy</span>
                <Activity className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <span className="text-2xl font-bold tracking-tight text-white">{estimatedKWh}</span>
                <span className="text-sm font-semibold text-emerald-500 ml-1">kWh</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-2">Estimated consumption</div>
            </div>

            {/* Active Devices */}
            <div className="glass-panel p-4 flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-center text-gray-400 mb-2">
                <span className="text-xs font-medium">Active Devices</span>
                <Lightbulb className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <span className="text-2xl font-bold tracking-tight text-white">{activeDevices.length}</span>
                <span className="text-sm text-gray-400"> / 15</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-2">{15 - activeDevices.length} idle devices</div>
            </div>

            {/* Active Warnings */}
            <div className="glass-panel p-4 flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-center text-gray-400 mb-2">
                <span className="text-xs font-medium">Warnings</span>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <span className="text-2xl font-bold tracking-tight text-white">
                  {alerts.filter(a => a.severity === 'warning' || a.severity === 'danger').length}
                </span>
                <span className="text-sm text-gray-400"> Active</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-2">Requires inspection</div>
            </div>

          </section>

          {/* INTERACTIVE OFFICE FLOOR PLAN (SVG & ANIMATIONS) */}
          <section className="glass-panel p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-400" /> Live Office Floor Plan (Top View)
              </h2>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                Interactive Grid
              </span>
            </div>

            {/* Floor plan layout */}
            <div className="border border-[#23354E] rounded-xl overflow-hidden bg-slate-950 p-4 min-h-[300px] flex flex-col justify-center">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                
                {/* DRAWING ROOM */}
                <div className="border border-[#23354E]/60 bg-[#161F30]/30 rounded-lg p-3 flex flex-col justify-between min-h-[220px]">
                  <div className="border-b border-[#23354E]/40 pb-1.5 mb-2 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      {roomTimers["Drawing Room"] > 0 && settings.roomTimerEnabled && (
                        <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 py-0.5 rounded animate-pulse font-mono font-bold">
                          ⏱️ {formatTime(roomTimers["Drawing Room"])}
                        </span>
                      )}
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">Drawing Room</span>
                    </div>
                    <div className="text-[10px] text-blue-400 font-semibold">{roomBreakdown["Drawing Room"] || 0}W draw</div>
                  </div>
                  
                  {/* Visual assets representing room layout */}
                  <div className="flex-1 flex flex-col justify-center items-center space-y-4">
                    {/* Fans */}
                    <div className="flex justify-center space-x-6">
                      {devices.filter(d => d.room === "Drawing Room" && d.type === "fan").map(d => (
                        <button 
                          key={d.id} 
                          onClick={() => handleToggle(d.id)}
                          className={`p-2.5 rounded-full border transition-all duration-300 flex flex-col items-center ${d.status ? 'bg-blue-500/15 border-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.3)]' : 'bg-slate-900 border-[#23354E] hover:border-blue-500/40'}`}
                          title={`Click to toggle ${d.name}`}
                        >
                          <Wind className={`h-5 w-5 ${d.status ? 'text-blue-400 animate-spin-slow' : 'text-gray-600'}`} />
                          <span className="text-[9px] text-gray-400 mt-1">{d.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Lights */}
                    <div className="flex justify-center space-x-4">
                      {devices.filter(d => d.room === "Drawing Room" && d.type === "light").map(d => (
                        <button 
                          key={d.id} 
                          onClick={() => handleToggle(d.id)}
                          className={`p-2 rounded-full border transition-all duration-300 flex flex-col items-center ${d.status ? 'bg-amber-500/20 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'bg-slate-900 border-[#23354E] hover:border-amber-500/40'}`}
                          title={`Click to toggle ${d.name}`}
                        >
                          <Lightbulb className={`h-4.5 w-4.5 ${d.status ? 'text-amber-400 fill-amber-400/20' : 'text-gray-600'}`} />
                          <span className="text-[9px] text-gray-400 mt-1">{d.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-2 text-[10px] text-gray-500 border-t border-[#23354E]/20 pt-1.5">
                    Waiting Area Sofa Setup
                  </div>
                </div>

                {/* WORK ROOM 1 */}
                <div className="border border-[#23354E]/60 bg-[#161F30]/30 rounded-lg p-3 flex flex-col justify-between min-h-[220px]">
                  <div className="border-b border-[#23354E]/40 pb-1.5 mb-2 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      {roomTimers["Work Room 1"] > 0 && settings.roomTimerEnabled && (
                        <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 py-0.5 rounded animate-pulse font-mono font-bold">
                          ⏱️ {formatTime(roomTimers["Work Room 1"])}
                        </span>
                      )}
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">Work Room 1</span>
                    </div>
                    <div className="text-[10px] text-blue-400 font-semibold">{roomBreakdown["Work Room 1"] || 0}W draw</div>
                  </div>
                  
                  {/* Visual assets representing room layout */}
                  <div className="flex-1 flex flex-col justify-center items-center space-y-4">
                    {/* Fans */}
                    <div className="flex justify-center space-x-6">
                      {devices.filter(d => d.room === "Work Room 1" && d.type === "fan").map(d => (
                        <button 
                          key={d.id} 
                          onClick={() => handleToggle(d.id)}
                          className={`p-2.5 rounded-full border transition-all duration-300 flex flex-col items-center ${d.status ? 'bg-blue-500/15 border-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.3)]' : 'bg-slate-900 border-[#23354E] hover:border-blue-500/40'}`}
                          title={`Click to toggle ${d.name}`}
                        >
                          <Wind className={`h-5 w-5 ${d.status ? 'text-blue-400 animate-spin-slow' : 'text-gray-600'}`} />
                          <span className="text-[9px] text-gray-400 mt-1">{d.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Lights */}
                    <div className="flex justify-center space-x-4">
                      {devices.filter(d => d.room === "Work Room 1" && d.type === "light").map(d => (
                        <button 
                          key={d.id} 
                          onClick={() => handleToggle(d.id)}
                          className={`p-2 rounded-full border transition-all duration-300 flex flex-col items-center ${d.status ? 'bg-amber-500/20 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'bg-slate-900 border-[#23354E] hover:border-amber-500/40'}`}
                          title={`Click to toggle ${d.name}`}
                        >
                          <Lightbulb className={`h-4.5 w-4.5 ${d.status ? 'text-amber-400 fill-amber-400/20' : 'text-gray-600'}`} />
                          <span className="text-[9px] text-gray-400 mt-1">{d.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-2 text-[10px] text-gray-500 border-t border-[#23354E]/20 pt-1.5">
                    4x Workstations & Desks
                  </div>
                </div>

                {/* WORK ROOM 2 */}
                <div className="border border-[#23354E]/60 bg-[#161F30]/30 rounded-lg p-3 flex flex-col justify-between min-h-[220px]">
                  <div className="border-b border-[#23354E]/40 pb-1.5 mb-2 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      {roomTimers["Work Room 2"] > 0 && settings.roomTimerEnabled && (
                        <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 py-0.5 rounded animate-pulse font-mono font-bold">
                          ⏱️ {formatTime(roomTimers["Work Room 2"])}
                        </span>
                      )}
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">Work Room 2</span>
                    </div>
                    <div className="text-[10px] text-blue-400 font-semibold">{roomBreakdown["Work Room 2"] || 0}W draw</div>
                  </div>
                  
                  {/* Visual assets representing room layout */}
                  <div className="flex-1 flex flex-col justify-center items-center space-y-4">
                    {/* Fans */}
                    <div className="flex justify-center space-x-6">
                      {devices.filter(d => d.room === "Work Room 2" && d.type === "fan").map(d => (
                        <button 
                          key={d.id} 
                          onClick={() => handleToggle(d.id)}
                          className={`p-2.5 rounded-full border transition-all duration-300 flex flex-col items-center ${d.status ? 'bg-blue-500/15 border-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.3)]' : 'bg-slate-900 border-[#23354E] hover:border-blue-500/40'}`}
                          title={`Click to toggle ${d.name}`}
                        >
                          <Wind className={`h-5 w-5 ${d.status ? 'text-blue-400 animate-spin-slow' : 'text-gray-600'}`} />
                          <span className="text-[9px] text-gray-400 mt-1">{d.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Lights */}
                    <div className="flex justify-center space-x-4">
                      {devices.filter(d => d.room === "Work Room 2" && d.type === "light").map(d => (
                        <button 
                          key={d.id} 
                          onClick={() => handleToggle(d.id)}
                          className={`p-2 rounded-full border transition-all duration-300 flex flex-col items-center ${d.status ? 'bg-amber-500/20 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'bg-slate-900 border-[#23354E] hover:border-amber-500/40'}`}
                          title={`Click to toggle ${d.name}`}
                        >
                          <Lightbulb className={`h-4.5 w-4.5 ${d.status ? 'text-amber-400 fill-amber-400/20' : 'text-gray-600'}`} />
                          <span className="text-[9px] text-gray-400 mt-1">{d.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-2 text-[10px] text-gray-500 border-t border-[#23354E]/20 pt-1.5">
                    4x Workstations & Water Dispenser
                  </div>
                </div>

              </div>

            </div>
          </section>

          {/* DEVICE CONTROL PANEL LIST */}
          <section className="glass-panel p-6">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h2 className="text-base font-semibold text-white">Device Overrides</h2>
                <p className="text-xs text-gray-400">List of all devices. Click on any item to manually override status</p>
              </div>

              {/* Room select filters */}
              <div className="flex bg-[#0B0F19] rounded-lg p-1 border border-[#23354E]">
                {rooms.map(room => (
                  <button 
                    key={room}
                    onClick={() => setSelectedRoom(room)}
                    className={`px-3 py-1 text-xs rounded-md transition-all font-medium ${selectedRoom === room ? 'bg-[#3B82F6] text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    {room === "All" ? "All Rooms" : room}
                  </button>
                ))}
              </div>
            </div>

            {/* Device Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredDevices.map(device => (
                <div 
                  key={device.id}
                  onClick={() => handleToggle(device.id)}
                  className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between ${device.status ? 'bg-[#161F30] border-[#3B82F6]/60 hover:border-[#3B82F6]' : 'bg-slate-900/60 border-[#23354E] hover:border-slate-700'}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2.5 rounded-lg ${device.status ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-gray-500'}`}>
                      {device.type === 'fan' ? <Wind className="h-5 w-5" /> : <Lightbulb className="h-5 w-5" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{device.name}</h4>
                      <p className="text-[10px] text-gray-400">{device.room}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${device.status ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-gray-500 border border-slate-700'}`}>
                      {device.status ? 'ON' : 'OFF'}
                    </span>
                    <p className="text-[10px] text-gray-500 mt-1 font-semibold">{device.status ? device.powerDraw : 0} Watts</p>
                  </div>
                </div>
              ))}
              
              {filteredDevices.length === 0 && (
                <div className="col-span-full py-8 text-center text-gray-500 text-xs">
                  No devices matching filter found
                </div>
              )}
            </div>

          </section>

        </div>

        {/* RIGHT COLUMN: ALERTS & DATABASE USERS */}
        <div className="lg:col-span-4 space-y-6">

          {/* ACTIVE ALERTS LIST */}
          <section className="glass-panel p-6 flex flex-col max-h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Active System Alerts
              </h2>
              {alerts.length > 0 && (
                <button 
                  onClick={handleClearAlerts}
                  className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-md font-semibold transition-all hover:border-red-500/40"
                >
                  Clear
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {alerts.map(alert => (
                <div 
                  key={alert.id}
                  className={`p-3 rounded-lg border text-xs flex items-start space-x-2.5 ${alert.severity === 'danger' ? 'bg-red-500/10 border-red-500/25 text-red-200' : 'bg-amber-500/10 border-amber-500/25 text-amber-200'}`}
                >
                  <AlertTriangle className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${alert.severity === 'danger' ? 'text-red-400' : 'text-amber-400'}`} />
                  <div>
                    <p className="font-medium leading-relaxed">{alert.message}</p>
                    <span className="text-[10px] text-gray-400 block mt-1">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}

              {alerts.length === 0 && (
                <div className="text-center py-12 text-gray-500 text-xs">
                  <CheckCircle className="h-8 w-8 text-emerald-500/50 mx-auto mb-2" />
                  No anomalies active. All clear!
                </div>
              )}
            </div>
          </section>

          {/* SYSTEM ADMINISTRATORS (STRICT DUMMY DATA SET INTEGRATION) */}
          <section className="glass-panel p-6">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-blue-400" /> Office Administrators
            </h2>

            <div className="space-y-4">
              {users.map((user, idx) => (
                <div key={idx} className="p-3.5 bg-slate-900/50 border border-[#23354E]/60 rounded-xl flex items-center space-x-3">
                  <div className="bg-[#3B82F6]/10 text-[#3B82F6] p-2 rounded-lg">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-semibold text-white">{user.name}</h4>
                    <p className="text-gray-400 mt-0.5">{user.email}</p>
                    <p className="text-blue-400 font-semibold mt-0.5">{user.phone}</p>
                  </div>
                </div>
              ))}

              {users.length === 0 && (
                <div className="text-xs text-gray-500 py-2 italic">
                  Loading administrator information...
                </div>
              )}
            </div>
          </section>


        </div>

      </main>
      
      {/* FOOTER */}
      <footer className="border-t border-[#23354E] bg-slate-950 py-4 text-center text-xs text-gray-500">
        <p>&copy; {new Date().getFullYear()} SmartOffice Monitor. Built for Techathon.</p>
      </footer>

      {/* SETTINGS MODAL */}
      {showSettingsModal && (() => {
        const [durationHours, durationMinutes] = (settings.roomAllOnTimeLimit || "02:00").split(":").map(Number);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-[#161F30] border border-[#23354E] rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#23354E]/60 flex justify-between items-center bg-slate-900/50">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings className="h-4.5 w-4.5 text-[#3B82F6]" /> Control Settings
                </h3>
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="text-gray-400 hover:text-white transition-colors text-lg"
                >
                  &times;
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5 text-sm text-gray-300">
                {/* Rule 1: Office Hours */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Office Hours Schedule</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Start Time</label>
                      <input 
                        type="time" 
                        defaultValue={settings.officeStartTime}
                        id="input_officeStartTime"
                        className="w-full bg-slate-900 border border-[#23354E] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">End Time</label>
                      <input 
                        type="time" 
                        defaultValue={settings.officeEndTime}
                        id="input_officeEndTime"
                        className="w-full bg-slate-900 border border-[#23354E] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                  </div>
                </div>

                {/* Rule 2: Room Fully On Settings */}
                <div className="space-y-3 pt-2 border-t border-[#23354E]/20">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Room Vacancy Check (All ON)</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        defaultChecked={settings.roomTimerEnabled}
                        id="input_roomTimerEnabled"
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3B82F6] peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                  
                  {/* Hours/Mins Dropdown Pickers */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 block">Alert Threshold (Duration)</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] text-gray-600 block mb-0.5">Hours</label>
                        <select 
                          id="input_durationHours"
                          defaultValue={durationHours}
                          className="w-full bg-slate-900 border border-[#23354E] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#3B82F6] text-xs"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>{i} hr{i !== 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-600 block mb-0.5">Minutes</label>
                        <select 
                          id="input_durationMinutes"
                          defaultValue={durationMinutes}
                          className="w-full bg-slate-900 border border-[#23354E] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#3B82F6] text-xs"
                        >
                          {Array.from({ length: 60 }, (_, i) => (
                            <option key={i} value={i}>{i} min{i !== 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rule 3: Discord Alert Filters */}
                <div className="space-y-3 pt-2 border-t border-[#23354E]/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Discord Critical Filter</label>
                      <p className="text-[10px] text-gray-500 mt-0.5">Send only 'Danger' alerts to Discord, suppressing 'Warnings'.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        defaultChecked={settings.discordOnlyDanger}
                        id="input_discordOnlyDanger"
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3B82F6] peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="px-6 py-4 border-t border-[#23354E]/60 bg-slate-900/30 flex justify-end space-x-3">
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 rounded-lg bg-transparent border border-[#23354E] hover:bg-[#23354E]/50 text-gray-300 transition-colors text-xs font-semibold"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const officeStartTime = document.getElementById("input_officeStartTime").value || "09:00";
                    const officeEndTime = document.getElementById("input_officeEndTime").value || "17:00";
                    const hrs = document.getElementById("input_durationHours").value.padStart(2, '0');
                    const mins = document.getElementById("input_durationMinutes").value.padStart(2, '0');
                    const roomAllOnTimeLimit = `${hrs}:${mins}`;
                    const roomTimerEnabled = document.getElementById("input_roomTimerEnabled").checked;
                    const discordOnlyDanger = document.getElementById("input_discordOnlyDanger").checked;
                    handleUpdateSettings({
                      officeStartTime,
                      officeEndTime,
                      roomAllOnTimeLimit,
                      roomTimerEnabled,
                      discordOnlyDanger
                    });
                  }}
                  className="px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white transition-colors text-xs font-bold shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
