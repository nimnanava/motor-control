'use client';

export default function Preloader() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center font-sans">
      <div className="relative w-24 h-24">
        {/* Animated Rings */}
        <div className="absolute inset-0 border-4 border-t-cyan-500 border-r-transparent border-b-cyan-500 border-l-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-2 border-4 border-t-transparent border-r-purple-500 border-b-transparent border-l-purple-500 rounded-full animate-spin [animation-direction:reverse]"></div>
      </div>
      <h2 className="text-cyan-400 font-bold text-lg mt-6 tracking-widest animate-pulse">
        CONNECTING TO ESP32
      </h2>
      <p className="text-slate-400 text-sm mt-2">Initializing PID system...</p>
    </div>
  );
}