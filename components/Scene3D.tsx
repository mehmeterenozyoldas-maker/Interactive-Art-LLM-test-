import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
// @ts-ignore
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
// @ts-ignore
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
// @ts-ignore
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
// @ts-ignore
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { BiomeConfig, FaceState, WeatherData } from '../types';

// --- ADVANCED MOTION GRAPHICS SHADERS ---

const vertexShader = `
  precision highp float;

  attribute vec3 instancePos;
  attribute float aScale;
  attribute float aPhase;
  attribute float aSpeed;

  uniform float uTime;
  uniform float uWind;
  uniform float uEntropy; 
  uniform vec3 uHeadPos; 
  uniform float uJaw; 

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vDist;
  varying float vNoise;
  varying float vElevation;
  varying float vSpeed;

  // --- Simplex Noise 3D ---
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) { 
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 = v - i + dot(i, C.xxx) ;
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i); 
      vec4 p = permute( permute( permute( 
                  i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
  }

  // --- Curl Noise Helper ---
  vec3 snoiseVec3( vec3 x ){
    float s  = snoise(vec3( x ));
    float s1 = snoise(vec3( x.y - 19.1 , x.z + 33.4 , x.x + 47.2 ));
    float s2 = snoise(vec3( x.z + 74.2 , x.x - 124.5 , x.y + 99.4 ));
    return vec3( s , s1 , s2 );
  }

  // Curl Noise: Calculates the curl of a vector potential (the noise)
  // This produces a divergence-free flow field (fluid-like motion)
  vec3 curlNoise( vec3 p ){
    const float e = 0.1;
    vec3 dx = vec3( e   , 0.0 , 0.0 );
    vec3 dy = vec3( 0.0 , e   , 0.0 );
    vec3 dz = vec3( 0.0 , 0.0 , e   );

    vec3 p_x0 = snoiseVec3( p - dx );
    vec3 p_x1 = snoiseVec3( p + dx );
    vec3 p_y0 = snoiseVec3( p - dy );
    vec3 p_y1 = snoiseVec3( p + dy );
    vec3 p_z0 = snoiseVec3( p - dz );
    vec3 p_z1 = snoiseVec3( p + dz );

    float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
    float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
    float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;

    const float divisor = 1.0 / ( 2.0 * e );
    return normalize( vec3( x , y , z ) * divisor );
  }

  mat4 rotationMatrix(vec3 axis, float angle) {
      axis = normalize(axis);
      float s = sin(angle); float c = cos(angle); float oc = 1.0 - c;
      return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                  oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                  oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                  0.0,                                0.0,                                0.0,                                1.0);
  }

  void main() {
      vec3 pos = instancePos;
      
      // 1. Kinetic Scroll Logic
      float globalSpeed = 1.0 + (uWind * 0.1) + (uEntropy * 0.5);
      float zProgress = mod(pos.z + uTime * globalSpeed * aSpeed, 140.0) - 70.0;
      pos.z = zProgress;

      // 2. Curl Noise Flow Field
      // Create swirling vortices that evolve over time
      float noiseFreq = 0.03;
      float noiseTime = uTime * 0.1;
      vec3 flow = curlNoise(vec3(pos.x * noiseFreq, pos.z * noiseFreq, noiseTime));
      
      // Apply flow displacement
      float flowStrength = 8.0 + uWind * 0.5;
      pos += flow * flowStrength;

      // Add turbulence based on speed and wind
      float turb = snoise(vec3(pos.x * 0.1, pos.z * 0.1, uTime * 0.8));
      pos.y += turb * (2.0 + uEntropy * 3.0);

      // 3. Neural Interaction (Attractor/Repulsor)
      vec3 attractor = vec3(uHeadPos.x * 80.0, uHeadPos.y * 50.0, 0.0);
      float dist = distance(pos, attractor);
      float influenceRadius = 45.0 + (uJaw * 60.0);
      float influence = smoothstep(influenceRadius, 0.0, dist);
      
      // Instead of simple repel, we add a "Levitation Field"
      vec3 repelDir = normalize(pos - attractor);
      pos += repelDir * influence * 15.0;
      pos.y += influence * 12.0; // Lift up particles near face

      // 4. Orientation & Banking
      vec3 localPos = position;
      
      // Calculate Banking: Roll into the turn based on flow X
      float bankAngle = -flow.x * 0.8; 
      // Yaw: Align with flow
      float yawAngle = flow.x * 1.5;

      mat4 rotYaw = rotationMatrix(vec3(0.0, 1.0, 0.0), yawAngle);
      mat4 rotBank = rotationMatrix(vec3(0.0, 0.0, 1.0), bankAngle);
      
      // Scale Dynamics
      float s = aScale * (0.5 + uEntropy * 0.4 + influence * 0.3);
      localPos *= s;
      
      // Elongation (Velocity Stretch)
      localPos.z *= 4.0 + aSpeed * 3.0; // Long streaks
      localPos.x *= 0.12; 
      localPos.y *= 0.12;

      // Apply Rotations
      localPos = (rotYaw * rotBank * vec4(localPos, 1.0)).xyz;

      vec4 mvPosition = modelViewMatrix * vec4(pos + localPos, 1.0);
      
      vViewPosition = -mvPosition.xyz;
      // Transform normals for lighting
      vNormal = normalMatrix * mat3(rotYaw) * mat3(rotBank) * normal; 
      vDist = influence;
      vNoise = turb;
      vElevation = pos.y;
      vSpeed = aSpeed;

      gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragShader = `
  precision highp float;

  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uEntropy;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vDist;
  varying float vNoise;
  varying float vElevation;
  varying float vSpeed;

  void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      // Cinematic Top-down Light
      vec3 lightDir = normalize(vec3(0.2, 1.0, 0.3)); 

      // --- Anisotropic Specular (Strand/Ribbon Lighting) ---
      // This gives the "brushed metal" or "silk" look
      vec3 tangent = cross(normal, vec3(0.0, 0.0, 1.0));
      if (length(tangent) < 0.01) tangent = cross(normal, vec3(0.0, 1.0, 0.0));
      tangent = normalize(tangent);
      
      float dotTH = dot(tangent, normalize(lightDir + viewDir));
      float sinTH = sqrt(1.0 - dotTH * dotTH);
      float dirAtten = smoothstep(-1.0, 0.0, dotTH);
      float anisotropy = pow(sinTH, 60.0) * dirAtten;

      // --- Base Color Mixing ---
      // Mix based on elevation (depth) and noise
      float t = smoothstep(-15.0, 15.0, vElevation + vNoise * 5.0);
      vec3 color = mix(uColorA, uColorB, t);
      
      // Inject highlight color based on speed variation
      color = mix(color, uColorC, vSpeed * 0.4 * vNoise);

      // --- Iridescence (Thin Film Interference) ---
      // Adds a pearlescent shift at grazing angles
      float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
      vec3 iridescence = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + fresnel * 6.0 + vNoise);

      // --- Composition ---
      vec3 finalColor = vec3(0.0);
      
      // Ambient Occlusion-ish feel (darker deep down)
      finalColor += color * 0.2; 
      
      // Diffuse
      float diff = max(dot(normal, lightDir), 0.0);
      finalColor += color * diff * 0.4;
      
      // Add Highlights
      finalColor += uColorC * anisotropy * (0.8 + uEntropy * 2.0); // Bright Specular
      finalColor += iridescence * fresnel * 0.3; // Subtle Rainbow Rim
      
      // Interaction Glow (Face Presence)
      finalColor += uColorC * vDist * 1.5;

      // Cinematic Fog (Distance Fade to Black)
      float dist = length(vViewPosition);
      float fog = smoothstep(40.0, 120.0, dist);
      finalColor = mix(finalColor, vec3(0.0), fog);

      gl_FragColor = vec4(finalColor, 1.0);
  }
`;

interface Scene3DProps {
  biome: BiomeConfig;
  weather: WeatherData;
  onSyncUpdate: (val: number) => void;
  onLoaded: () => void;
}

interface AudioEngine {
  ctx: AudioContext;
  gain: GainNode;
  filter: BiquadFilterNode;
}

const Scene3D: React.FC<Scene3DProps> = ({ biome, weather, onSyncUpdate, onLoaded }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const engineRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer;
    mesh: THREE.InstancedMesh | null;
    material: THREE.ShaderMaterial | null;
    bloomPass: UnrealBloomPass;
    afterimagePass: AfterimagePass;
    landmarker: FaceLandmarker | null;
    faceState: FaceState;
    lastVideoTime: number;
    requestID: number;
    audio: AudioEngine | null;
  } | null>(null);

  // Initialize Engine
  useEffect(() => {
    if (!containerRef.current || engineRef.current) return;

    // 1. Setup THREE
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.012);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(0, 25, 60); // Slightly higher angle for better view of flow
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ 
        antialias: false, 
        powerPreference: "high-performance",
        stencil: false,
        depth: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    containerRef.current.appendChild(renderer.domElement);

    // 2. Post Processing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    // Cinematic Bloom
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.strength = 0.6; 
    bloomPass.radius = 0.5;
    bloomPass.threshold = 0.15;
    composer.addPass(bloomPass);

    const afterimagePass = new AfterimagePass();
    afterimagePass.uniforms.damp.value = 0.7; 
    composer.addPass(afterimagePass);

    // 3. Audio Engine
    const setupAudio = () => {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return null;
        
        const ctx = new AudioContext();
        
        const bufferSize = ctx.sampleRate * 2; 
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        const gain = ctx.createGain();
        gain.gain.value = 0; 

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start();

        return { ctx, gain, filter };
      } catch (e) {
        console.error("Audio init failed", e);
        return null;
      }
    };

    engineRef.current = {
      scene,
      camera,
      renderer,
      composer,
      mesh: null,
      material: null,
      bloomPass,
      afterimagePass,
      landmarker: null,
      faceState: { detected: false, jaw: 0, headX: 0, headY: 0, presence: 0 },
      lastVideoTime: -1,
      requestID: 0,
      audio: setupAudio()
    };

    const resumeAudio = () => {
      const audio = engineRef.current?.audio;
      if (audio && audio.ctx.state === 'suspended') {
        audio.ctx.resume();
      }
    };
    document.addEventListener('click', resumeAudio);
    document.addEventListener('mousemove', resumeAudio);
    document.addEventListener('keydown', resumeAudio);

    // 4. Initialize Vision
    const initVision = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, delegate: "GPU" },
          outputFaceBlendshapes: true, runningMode: "VIDEO", numFaces: 1
        });
        
        if (engineRef.current) {
          engineRef.current.landmarker = landmarker;
          startCamera();
        }
      } catch (e) {
        console.error("Failed to load vision:", e);
      }
    };

    const startCamera = async () => {
      try {
        if (!videoRef.current) return;
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        videoRef.current.addEventListener("loadeddata", () => {
            onLoaded();
        });
      } catch (e) {
        console.error("Camera access denied or missing", e);
        onLoaded();
      }
    };

    initVision();

    const handleResize = () => {
      if (!engineRef.current) return;
      const { camera, renderer, composer } = engineRef.current;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('click', resumeAudio);
      document.removeEventListener('mousemove', resumeAudio);
      document.removeEventListener('keydown', resumeAudio);
      
      if (engineRef.current) {
        cancelAnimationFrame(engineRef.current.requestID);
        engineRef.current.renderer.dispose();
        engineRef.current.composer.dispose();
        engineRef.current.audio?.ctx.close();
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Update Biome & Weather
  useEffect(() => {
    if (!engineRef.current) return;
    const { scene, bloomPass } = engineRef.current;
    
    if (engineRef.current.mesh) {
      scene.remove(engineRef.current.mesh);
      engineRef.current.mesh.geometry.dispose();
      if (Array.isArray(engineRef.current.mesh.material)) {
        engineRef.current.mesh.material.forEach(m => m.dispose());
      } else {
        engineRef.current.mesh.material.dispose();
      }
      engineRef.current.mesh = null;
    }

    scene.background = new THREE.Color(biome.bgColor);
    scene.fog = new THREE.FogExp2(biome.bgColor, 0.015);
    bloomPass.strength = biome.bloom;

    let baseGeo: THREE.BufferGeometry;
    if (biome.geometryType === 'cone') {
        baseGeo = new THREE.ConeGeometry(0.08, 1.2, 4); 
    } else {
        baseGeo = new THREE.BoxGeometry(0.1, 0.1, 1.0); 
    }

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWind: { value: weather.wind },
        uEntropy: { value: 0 },
        uHeadPos: { value: new THREE.Vector3() },
        uJaw: { value: 0 },
        uColorA: { value: new THREE.Color(biome.palette[0]) },
        uColorB: { value: new THREE.Color(biome.palette[1]) },
        uColorC: { value: new THREE.Color(biome.palette[2]) }
      },
      vertexShader: vertexShader,
      fragmentShader: fragShader,
      side: THREE.DoubleSide,
      transparent: false, 
    });
    engineRef.current.material = material;

    // Increased count for denser, richer visuals
    const count = 12000;
    const mesh = new THREE.InstancedMesh(baseGeo, material, count);
    
    const dummy = new THREE.Object3D();
    const positions = [];
    const scales = [];
    const phases = [];
    const speeds = [];

    for (let i = 0; i < count; i++) {
        // Distribute on a plane (X, Z)
        const x = (Math.random() - 0.5) * 120;
        const z = (Math.random() - 0.5) * 120;
        const y = 0; 

        dummy.position.set(x, y, z);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        positions.push(x, y, z);
        scales.push(0.5 + Math.random() * 1.5);
        phases.push(Math.random() * Math.PI * 2);
        speeds.push(0.8 + Math.random() * 0.4); // Random speed multiplier
    }

    mesh.geometry.setAttribute('instancePos', new THREE.InstancedBufferAttribute(new Float32Array(positions), 3));
    mesh.geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(new Float32Array(scales), 1));
    mesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(phases), 1));
    mesh.geometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(new Float32Array(speeds), 1));

    engineRef.current.mesh = mesh;
    scene.add(mesh);

  }, [biome, weather]);

  // Animation Loop
  useEffect(() => {
    if (!engineRef.current) return;

    const loop = () => {
      const engine = engineRef.current;
      if (!engine) return;

      const { camera, composer, landmarker, faceState, mesh, material, audio } = engine;
      
      // Vision Logic
      if (landmarker && videoRef.current) {
         const video = videoRef.current;
         if (video.videoWidth > 0 && video.videoHeight > 0 && video.currentTime !== engine.lastVideoTime) {
           engine.lastVideoTime = video.currentTime;
           try {
              const res = landmarker.detectForVideo(video, performance.now());
              if (res.faceBlendshapes.length > 0 && res.faceLandmarks.length > 0) {
                faceState.detected = true;
                const jawCat = res.faceBlendshapes[0].categories.find(c => c.categoryName === 'jawOpen');
                faceState.jaw = jawCat ? jawCat.score : 0;
                const nose = res.faceLandmarks[0][1]; 
                faceState.headX = (nose.x - 0.5) * -2;
                faceState.headY = (nose.y - 0.5) * -2;
              } else {
                faceState.detected = false;
              }
           } catch(e) { /* ignore */ }
         }
      }

      // Physics/Logic
      const t = performance.now() * 0.001;
      const targetPresence = faceState.detected ? 1.0 : 0.0;
      faceState.presence += (targetPresence - faceState.presence) * 0.05; 
      
      onSyncUpdate(faceState.presence);

      if (mesh && material) {
         material.uniforms.uTime.value = t;
         material.uniforms.uEntropy.value = faceState.presence;
         material.uniforms.uHeadPos.value.lerp(new THREE.Vector3(faceState.headX, faceState.headY, 0), 0.05);
         material.uniforms.uJaw.value += (faceState.jaw - material.uniforms.uJaw.value) * 0.1;
      }

      // Audio Updates
      if (audio) {
          const targetGain = 0.05 + (faceState.presence * 0.4); 
          audio.gain.gain.setTargetAtTime(targetGain, audio.ctx.currentTime, 0.1);
          
          const targetFreq = 200 + (weather.wind * 30) + (faceState.presence * 400); 
          audio.filter.frequency.setTargetAtTime(targetFreq, audio.ctx.currentTime, 0.1);
      }

      // Cinematic Slow Camera Pan (Floating feel)
      camera.position.x = Math.sin(t * 0.04) * 12;
      camera.position.z = Math.cos(t * 0.04) * 12 + 40; 
      camera.position.y = 20 + Math.sin(t * 0.08) * 3;
      camera.lookAt(0, 0, 0);

      composer.render();
      engine.requestID = requestAnimationFrame(loop);
    };

    engineRef.current.requestID = requestAnimationFrame(loop);

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      cancelAnimationFrame(engineRef.current?.requestID || 0);
    };
  }, [onSyncUpdate]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 z-0" />
      <video ref={videoRef} className="absolute top-0 left-0 opacity-0 pointer-events-none" playsInline muted autoPlay />
    </>
  );
};

export default Scene3D;