import * as THREE from 'three';

export type BiomeKey = 'Reykjavik' | 'Tokyo' | 'Amazonas' | 'Stockholm' | 'Cairo';

export interface BiomeConfig {
  name: BiomeKey;
  lat: number;
  lon: number;
  palette: [string, string, string]; // Hex codes
  bgColor: string; // Hex code
  geometryType: 'cone' | 'box' | 'sphere';
  flowSpeed: number;
  bloom: number;
}

export interface WeatherData {
  temp: number;
  wind: number;
}

export interface FaceState {
  detected: boolean;
  jaw: number;
  headX: number;
  headY: number;
  presence: number;
}