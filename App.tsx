import React, { useState, useEffect } from 'react';
import Scene3D from './components/Scene3D';
import { fetchWeatherData } from './services/api';
import { BiomeConfig, WeatherData, BiomeKey } from './types';

const BIOMES: Record<BiomeKey, BiomeConfig> = {
  'Reykjavik': {
    name: 'Reykjavik',
    lat: 64.14, lon: -21.94,
    // Deep slate, Ice white, Obsidian
    palette: ['#0f172a', '#334155', '#e2e8f0'],
    bgColor: '#020617',
    geometryType: 'box',
    flowSpeed: 0.15,
    bloom: 0.4
  },
  'Stockholm': {
    name: 'Stockholm',
    lat: 59.32, lon: 18.06,
    // Baltic Blue, Granite Grey, Glacial White
    palette: ['#172554', '#64748b', '#dbeafe'],
    bgColor: '#0B1120', // Very dark cool blue
    geometryType: 'box',
    flowSpeed: 0.2,
    bloom: 0.5
  },
  'Tokyo': {
    name: 'Tokyo',
    lat: 35.68, lon: 139.69,
    // Midnight blue, Faint neon purple, Deep black
    palette: ['#0f0518', '#310b4a', '#818cf8'],
    bgColor: '#050505',
    geometryType: 'box',
    flowSpeed: 0.4,
    bloom: 0.6
  },
  'Cairo': {
    name: 'Cairo',
    lat: 30.04, lon: 31.23,
    // Silt Brown, Deep River Teal, Desert Gold
    palette: ['#3f2e18', '#0e7490', '#facc15'],
    bgColor: '#1a120b', // Dark warm brown
    geometryType: 'cone',
    flowSpeed: 0.1,
    bloom: 0.45
  },
  'Amazonas': {
    name: 'Amazonas',
    lat: -3.46, lon: -62.21,
    // Deep jungle green, Mud, Bioluminescent gold (faint)
    palette: ['#022c22', '#3f6212', '#fbbf24'],
    bgColor: '#020402',
    geometryType: 'cone',
    flowSpeed: 0.25,
    bloom: 0.5
  }
};

const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E`;

const App: React.FC = () => {
  const [activeBiome, setActiveBiome] = useState<BiomeKey>('Reykjavik');
  const [weather, setWeather] = useState<WeatherData>({ temp: 10, wind: 10 });
  const [syncLevel, setSyncLevel] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWeather = async () => {
      const b = BIOMES[activeBiome];
      const data = await fetchWeatherData(b.lat, b.lon);
      setWeather(data);
    };
    loadWeather();
  }, [activeBiome]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white select-none font-sans">
      
      {/* Cinematic Vignette */}
      <div className="fixed inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] opacity-80" />
      
      {/* Film Grain Texture */}
      <div 
        className="fixed inset-0 pointer-events-none z-20 opacity-[0.07] mix-blend-overlay" 
        style={{ backgroundImage: `url("${NOISE_SVG}")` }} 
      />

      {/* 3D Scene */}
      <Scene3D 
        biome={BIOMES[activeBiome]} 
        weather={weather} 
        onSyncUpdate={(val) => setSyncLevel(val)}
        onLoaded={() => setLoading(false)}
      />

      {/* Loading Screen */}
      <div 
        className={`absolute inset-0 flex items-center justify-center bg-black transition-opacity duration-1000 z-50 pointer-events-none ${loading ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-[1px] bg-white/30"></div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-white/60 animate-pulse font-light">
            System Initializing
            </div>
            <div className="w-12 h-[1px] bg-white/30"></div>
        </div>
      </div>

      {/* HUD UI */}
      <div className="absolute bottom-12 left-12 z-30 flex flex-col gap-6 md:flex-row md:gap-16 font-light text-white/80">
        
        {/* Location / Biome Selector */}
        <div className="group">
          <span className="block text-[9px] tracking-[0.25em] text-white/40 uppercase mb-2 border-l border-white/20 pl-3">Sector</span>
          <div className="relative pl-3">
            <select 
              value={activeBiome}
              onChange={(e) => setActiveBiome(e.target.value as BiomeKey)}
              className="appearance-none bg-transparent text-sm tracking-[0.15em] uppercase focus:outline-none cursor-pointer hover:text-white transition-colors text-white/70"
            >
              {Object.keys(BIOMES).map((k) => (
                <option key={k} value={k} className="bg-black text-white/70">{k}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 right-[-12px] text-[8px] text-white/30">▼</div>
          </div>
        </div>

        {/* Atmosphere Data */}
        <div>
          <span className="block text-[9px] tracking-[0.25em] text-white/40 uppercase mb-2 border-l border-white/20 pl-3">Data Stream</span>
          <span className="block text-sm tracking-[0.15em] pl-3 tabular-nums text-white/70">
            {weather.temp.toFixed(1)}°C <span className="text-white/20 mx-2">|</span> {weather.wind.toFixed(1)} KPH
          </span>
        </div>

        {/* Neural Sync Data */}
        <div>
          <span className="block text-[9px] tracking-[0.25em] text-white/40 uppercase mb-2 border-l border-white/20 pl-3">Neural Link</span>
          <div className="pl-3 flex items-center gap-3">
            <div className="w-16 h-[2px] bg-white/10 overflow-hidden">
                <div 
                    className="h-full bg-white transition-all duration-300 ease-out" 
                    style={{ width: `${syncLevel * 100}%`, opacity: syncLevel > 0 ? 0.8 : 0 }}
                />
            </div>
            <span className={`block text-sm tracking-[0.15em] tabular-nums transition-colors duration-500 ${syncLevel > 0.5 ? 'text-white' : 'text-white/40'}`}>
              {(syncLevel * 100).toFixed(0)}%
            </span>
          </div>
        </div>

      </div>

      {/* Decoration: Top Right */}
      <div className="absolute top-12 right-12 z-30 text-right opacity-50 mix-blend-difference">
        <div className="text-[9px] tracking-[0.3em] uppercase border-b border-white/20 pb-2 mb-1">Aesthetic Engine</div>
        <div className="text-[8px] tracking-widest text-white/60">RIVERS // V2.1</div>
      </div>

    </div>
  );
};

export default App;