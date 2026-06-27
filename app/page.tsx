'use client';

import { useState, useEffect, useRef } from 'react';
import Preloader from './componet/Preloader'; // ඔයාගේ ෆෝල්ඩර් නම එලෙසම තබා ඇත

export default function MotorControl() {
  const [targetAngle, setTargetAngle] = useState(0);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [inputAngle, setInputAngle] = useState('');
  const [isLoading, setIsLoading] = useState(false); // බ්ලූටූත් නිසා මුලින්ම ලෝඩින් අවශ්‍ය නොවේ
  const [isConnected, setIsConnected] = useState(false); 
  
  // 🛠️ BLE සම්බන්ධතාවය තබා ගැනීමට useRef පාවිච්චි කරයි
  const bleCharacteristicRef = useRef(null);
  const bleDeviceRef = useRef(null);
  const gaugeRef = useRef(null);
  const isDragging = useRef(false);

  // ESP32 කෝඩ් එකේ දුන්න UUID ම අගයන් මෙතනටත් දී ඇත
  const SERVICE_UUID = "4fa2c730-1341-11ec-82a8-0242ac130003";
  const CHARACTERISTIC_UUID = "4fa2ca28-1341-11ec-82a8-0242ac130003";

  // 🔵 1. ESP32 බ්ලූටූත් එකට සම්බන්ධ වන ක්‍රියාවලිය
  const connectBluetooth = async () => {
    try {
      if (!navigator.bluetooth) {
        alert("ඔයාගේ බ්‍රවුසර් එක Web Bluetooth සපයන්නේ නැත! Chrome හෝ Edge පාවිච්චි කරන්න.");
        return;
      }

      console.log("Requesting Bluetooth Device...");
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'ESP32_Motor_BLE' }],
        optionalServices: [SERVICE_UUID]
      });

      bleDeviceRef.current = device;
      
      // විසන්ධි වුණොත් හඳුනා ගැනීමට ඉවෙන්ට් එකක් ලිවීම
      device.addEventListener('gattserverdisconnected', onDisconnected);

      console.log("Connecting to GATT Server...");
      const server = await device.gatt.connect();

      console.log("Getting Service...");
      const service = await server.getPrimaryService(SERVICE_UUID);

      console.log("Getting Characteristic...");
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      
      bleCharacteristicRef.current = characteristic;
      setIsConnected(true);
      console.log("Connected Successfully!");

      // 🔄 ESP32 එකෙන් එවන සජීවී කෝණය (Current Angle) කියවීම ආරම්භ කිරීම
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleNotifications);

    } catch (error) {
      console.error("Bluetooth Connection Error:", error);
    }
  };

  // 🔴 2. බ්ලූටූත් විසන්ධි කිරීමේ ක්‍රියාවලිය
  const disconnectBluetooth = () => {
    if (bleDeviceRef.current && bleDeviceRef.current.gatt.connected) {
      bleDeviceRef.current.gatt.disconnect();
    }
  };

  const onDisconnected = () => {
    setIsConnected(false);
    bleCharacteristicRef.current = null;
    console.log("Bluetooth Disconnected.");
  };

  // 📥 3. ESP32 වෙතින් දත්ත ලැබෙන විට (Notification Handler)
  const handleNotifications = (event) => {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const angleStr = decoder.decode(value);
    const parsedAngle = parseFloat(angleStr);
    
    if (!isNaN(parsedAngle)) {
      setCurrentAngle(parsedAngle);
    }
  };

  // 📤 4. අලුත් Target Angle එක බ්ලූටූත් හරහා ESP32 එකට යැවීම
  const sendAngleToESP32 = async (angle) => {
    if (!bleCharacteristicRef.current || !isConnected) return;
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(angle.toString());
      await bleCharacteristicRef.current.writeValue(data);
    } catch (error) {
      console.error("Error sending angle via BLE:", error);
    }
  };

  // 📐 Gauge එක මත ක්ලික් කිරීම හෝ Drag කිරීම මඟින් කෝණය සෙවීම
  const handleGaugeMove = (clientX, clientY) => {
    if (!gaugeRef.current) return;

    const rect = gaugeRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;

    let angle = Math.round((Math.atan2(deltaY, deltaX) * 180) / Math.PI);
    
    if (angle < 0) {
      angle += 360;
    }

    setTargetAngle(angle);
    sendAngleToESP32(angle);
  };

  // Mouse Events
  const handleMouseDown = (e) => {
    if (!isConnected) return; // කනෙක්ට් නැත්නම් ඩ්‍රැග් කරන්න දෙන්න එපා
    isDragging.current = true;
    handleGaugeMove(e.clientX, e.clientY);
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    handleGaugeMove(e.clientX, e.clientY);
  };

  // Touch Events
  const handleTouchStart = (e) => {
    if (!isConnected) return;
    isDragging.current = true;
    if (e.touches[0]) handleGaugeMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current) return;
    if (e.touches[0]) handleGaugeMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  useEffect(() => {
    const handleMouseUp = () => { isDragging.current = false; };
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, []);

  // Text Box Input handle කිරීම
  const handleButtonClick = () => {
    const value = parseInt(inputAngle);
    if (value >= 0 && value <= 360) {
      setTargetAngle(value);
      sendAngleToESP32(value);
      setInputAngle('');
    } else {
      alert("Please enter an angle between 0 and 360 degrees!");
    }
  };

  // 🎯 Quick Presets ක්ලික් කිරීම
  const applyPreset = (angle) => {
    setTargetAngle(angle);
    sendAngleToESP32(angle);
  };

  const strokeDasharray = 2 * Math.PI * 80;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4 md:p-8 font-sans text-white select-none">
      
      {isLoading && <Preloader />}

      {/* 📊 Upper Header & Live Connection Status Badge */}
      <div className="w-full max-w-4xl flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-black bg-gradient-to-r from-cyan-400 via-teal-300 to-purple-400 bg-clip-text text-transparent uppercase tracking-wider">
            Interactive PID Dashboard,,,,,
          </h1>
          <p className="text-slate-400 text-xs mt-1">Real-time Closed-Loop BLE Angular Position Control</p>
        </div>
        
        {/* Connection Status Badge */}
        <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 px-4 py-2 rounded-2xl shadow-md">
          <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
          <span className="text-xs font-bold tracking-widest uppercase text-slate-300">
            {isConnected ? 'Bluetooth Online' : 'Bluetooth Offline'}
          </span>
        </div>
      </div>

      {/* 📐 🖥️ Workspace */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        
        {/* LEFT COLUMN: The Interactive Gauge */}
        <div className="bg-slate-900/80 backdrop-blur-md p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl flex flex-col items-center justify-center">
          <div className="text-center text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">
            {isConnected ? 'Touch & Drag the Gauge to Rotate' : 'Connect Bluetooth to Unlock Gauge'}
          </div>

          <div 
            ref={gaugeRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            className={`relative flex justify-center items-center my-4 touch-none ${isConnected ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
          >
            <svg className="w-64 h-64 transform -rotate-90">
              <circle cx="128" cy="128" r="90" className="stroke-slate-800 fill-none" strokeWidth="12" />
              <circle 
                cx="128" cy="128" r="90" 
                className="stroke-purple-500/20 fill-none" 
                strokeWidth="4"
                strokeDasharray={strokeDasharray}
                style={{ strokeDashoffset: strokeDasharray - (targetAngle / 360) * strokeDasharray }}
              />
              <circle 
                cx="128" cy="128" r="90" 
                className="stroke-cyan-500 fill-none transition-all duration-200 ease-out" 
                strokeWidth="12"
                strokeDasharray={strokeDasharray}
                style={{ strokeDashoffset: strokeDasharray - (currentAngle / 360) * strokeDasharray }}
                strokeLinecap="round"
              />
            </svg>
            
            <div className="absolute flex flex-col items-center text-center bg-slate-950/90 w-36 h-36 rounded-full justify-center border border-slate-800 shadow-2xl">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Current</span>
              <span className="text-3xl font-black text-cyan-400 font-mono my-0.5 drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]">
                {currentAngle.toFixed(1)}°
              </span>
              <div className="w-12 h-px bg-slate-800 my-1.5"></div>
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Target</span>
              <span className="text-lg font-bold text-purple-400 font-mono">{targetAngle}°</span>
            </div>

            <div className="absolute w-1.5 h-28 bottom-1/2 left-1/2 origin-bottom transition-transform duration-100" style={{ transform: `translate(-50%, 0) rotate(${targetAngle}deg)` }}>
              <div className="w-full h-1/3 bg-purple-500 rounded-t-full opacity-50"></div>
            </div>

            <div className="absolute w-2 h-28 bottom-1/2 left-1/2 origin-bottom transition-transform duration-200 ease-out" style={{ transform: `translate(-50%, 0) rotate(${currentAngle}deg)` }}>
              <div className="w-full h-1/2 bg-gradient-to-t from-purple-500 to-cyan-400 rounded-t-full shadow-lg shadow-cyan-500/50"></div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Bluetooth Action Button, Manual Input & Quick Presets */}
        <div className="flex flex-col gap-6 justify-between">
          
          {/* Bluetooth Connection & Manual Controller Box */}
          <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-xl flex-1 flex flex-col justify-center">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-4">Hardware Connection & Control</h3>
            
            <div className="space-y-5">
              {/* Bluetooth Connect Button */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Wireless Bluetooth Link</label>
                {!isConnected ? (
                  <button 
                    onClick={connectBluetooth}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all active:scale-[0.99] uppercase text-xs tracking-wider flex items-center justify-center gap-2"
                  >
                    🔵 Connect ESP32 Motor
                  </button>
                ) : (
                  <button 
                    onClick={disconnectBluetooth}
                    className="w-full bg-slate-800 hover:bg-rose-900/40 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-rose-400 font-bold py-3 px-4 rounded-xl transition-all uppercase text-xs tracking-wider"
                  >
                    🔴 Disconnect Device
                  </button>
                )}
              </div>

              {/* Manual Angle Input */}
              <div className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="Type Angle (0 - 360)" 
                  value={inputAngle}
                  disabled={!isConnected}
                  onChange={(e) => setInputAngle(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl focus:outline-none focus:border-purple-500 text-sm text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <button 
                  onClick={handleButtonClick}
                  disabled={!isConnected}
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-all duration-200 text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Set
                </button>
              </div>
            </div>
          </div>

          {/* ⚡ Quick Presets Box */}
          <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-xl">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">Quick Angle Presets</h3>
            <div className="grid grid-cols-5 gap-2">
              {[0, 90, 180, 270, 360].map((angle) => (
                <button 
                  key={angle} 
                  onClick={() => applyPreset(angle)}
                  disabled={!isConnected}
                  className="bg-slate-950 border border-slate-800 hover:border-cyan-500 hover:text-cyan-400 text-xs font-bold font-mono py-3 rounded-xl transition-all duration-200 shadow-inner active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-slate-800 disabled:hover:text-white"
                >
                  {angle}°
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}