/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Zap, 
  RotateCcw, 
  Play, 
  Pause,
  Crosshair,
  RefreshCw,
  AlertTriangle,
  Fingerprint,
  Ghost,
  MoveHorizontal,
  ArrowUp,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Sound Manager ---
class SoundManager {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playJump() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playCollision() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playShift() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [440, 660, 880].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      gain.gain.setValueAtTime(0.05, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.04);
    });
  }

  playLevelUp() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.1, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.2);
    });
  }

  playShoot(type: WeaponType) {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type === 'BEAM' ? 'sine' : 'square';
    const freq = type === 'SPREAD' ? 150 : (type === 'BEAM' ? 800 : 400);
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq / 2, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playExplosion() {
    this.init();
    if (!this.ctx) return;
    const noise = this.ctx.createBufferSource();
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
    noise.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  playStart() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 8; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800 + i * 200, now + i * 0.03);
      gain.gain.setValueAtTime(0.05, now + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.03 + 0.02);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.03);
      osc.stop(now + i * 0.03 + 0.02);
    }
  }
}

const sounds = new SoundManager();

// --- Types ---
type ParadoxRule = 'NORMAL' | 'INVERTED_GRAVITY' | 'REVERSED_CONTROLS' | 'GHOST_WALLS' | 'NEGATIVE_SPEED';

interface RuleInfo {
  id: ParadoxRule;
  label: string;
  description: string;
  color: string;
  icon: React.ReactNode;
}

const RULES: Record<ParadoxRule, RuleInfo> = {
  NORMAL: {
    id: 'NORMAL',
    label: 'Reality: Stable',
    description: 'Everything is as it should be. For now.',
    color: '#00FF00',
    icon: <Fingerprint className="w-6 h-6" />
  },
  INVERTED_GRAVITY: {
    id: 'INVERTED_GRAVITY',
    label: 'Gravity: Inverted',
    description: 'Up is down. Down is up. Don\'t look down.',
    color: '#FF00FF',
    icon: <ArrowUp className="w-6 h-6 rotate-180" />
  },
  REVERSED_CONTROLS: {
    id: 'REVERSED_CONTROLS',
    label: 'Logic: Reversed',
    description: 'Left is Right. Right is Left. Your brain is lying.',
    color: '#00FFFF',
    icon: <MoveHorizontal className="w-6 h-6" />
  },
  GHOST_WALLS: {
    id: 'GHOST_WALLS',
    label: 'Matter: Phase',
    description: 'Walls are air. Air is solid. Walk through the void.',
    color: '#FFFF00',
    icon: <Ghost className="w-6 h-6" />
  },
  NEGATIVE_SPEED: {
    id: 'NEGATIVE_SPEED',
    label: 'Speed: Negative',
    description: 'Face backward to move forward. Logic is dead.',
    color: '#FF4400',
    icon: <Zap className="w-6 h-6" />
  }
};

type WeaponType = 'BLASTER' | 'SPREAD' | 'BEAM';

interface WeaponInfo {
  id: WeaponType;
  label: string;
  description: string;
  color: string;
  cooldown: number; // frames
  maxAmmo: number;
}

const WEAPONS: Record<WeaponType, WeaponInfo> = {
  BLASTER: {
    id: 'BLASTER',
    label: 'Pulse Blaster',
    description: 'Standard rapid-fire energy bolts.',
    color: '#00FF00',
    cooldown: 10,
    maxAmmo: 30
  },
  SPREAD: {
    id: 'SPREAD',
    label: 'Void Spread',
    description: 'Fires three bolts in a wide arc.',
    color: '#FF00FF',
    cooldown: 25,
    maxAmmo: 15
  },
  BEAM: {
    id: 'BEAM',
    label: 'Logic Beam',
    description: 'A powerful, long-range concentrated beam.',
    color: '#00FFFF',
    cooldown: 40,
    maxAmmo: 10
  }
};

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  id: string;
  type: WeaponType;
}

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'WALL' | 'VOID';
  id: string;
  health: number;
}

export default function App() {
  // --- State ---
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER' | 'LEVEL_UP'>('START');
  const [isPaused, setIsPaused] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [currentRule, setCurrentRule] = useState<ParadoxRule>('NORMAL');
  const [ruleTimer, setRuleTimer] = useState(10);
  const [level, setLevel] = useState(1);
  const [levelTimer, setLevelTimer] = useState(120); // Increased to 120 seconds
  const [glitchIntensity, setGlitchIntensity] = useState(0);
  const [dimensions, setDimensions] = useState({ 
    width: typeof window !== 'undefined' ? window.innerWidth : 800, 
    height: typeof window !== 'undefined' ? window.innerHeight - 80 : 600 
  });

  // --- Weapon State ---
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>('BLASTER');
  const [weaponCooldown, setWeaponCooldown] = useState(0);
  const [weaponAmmo, setWeaponAmmo] = useState<Record<WeaponType, number>>({
    BLASTER: WEAPONS.BLASTER.maxAmmo,
    SPREAD: WEAPONS.SPREAD.maxAmmo,
    BEAM: WEAPONS.BEAM.maxAmmo
  });
  const weaponAmmoRef = useRef<Record<WeaponType, number>>({
    BLASTER: WEAPONS.BLASTER.maxAmmo,
    SPREAD: WEAPONS.SPREAD.maxAmmo,
    BEAM: WEAPONS.BEAM.maxAmmo
  });

  // --- Power-up State ---
  const [isPhasing, setIsPhasing] = useState(false);
  const [phaseTimeLeft, setPhaseTimeLeft] = useState(0);
  const [phaseCooldown, setPhaseCooldown] = useState(0);
  const [totalSessionTime, setTotalSessionTime] = useState(0);

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef({ x: 100, y: 300, vy: 0, w: 40, h: 40, color: '#00FF00', jumps: 0 });
  const obstaclesRef = useRef<Obstacle[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const requestRef = useRef<number>(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const touchJumpRef = useRef(false);
  const touchShootRef = useRef(false);
  const touchSwitchRef = useRef(false);
  const phaseTriggerRef = useRef(false);
  const lastJumpKeyRef = useRef(false);
  const lastShootKeyRef = useRef(false);
  const lastSwitchKeyRef = useRef(false);
  const frameCount = useRef(0);
  const timeElapsed = useRef(0);

  // --- Initialization ---
  useEffect(() => {
    const stored = localStorage.getItem('paradox_highscore');
    if (stored) setHighScore(parseInt(stored));

    const handleKeyDown = (e: KeyboardEvent) => keysRef.current[e.code] = true;
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current[e.code] = false;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
      // Initial call to set correct dimensions
      handleResize();
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  const spawnObstacle = useCallback((width: number, height: number) => {
    const pattern = Math.random();
    const rule = currentRule;
    
    // Helper to add obstacle
    const add = (x: number, y: number, w: number, h: number, type: 'WALL' | 'VOID' = 'WALL') => {
      obstaclesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        x: width + x,
        y,
        w: w * 0.7,
        h: h * 0.7,
        type,
        health: type === 'WALL' ? 3 : 1
      });
    };

    // Paradox-Aware Generation
    if (rule === 'GHOST_WALLS') {
      // In Ghost Walls, we need platforms to stay alive
      const platformW = 120 + Math.random() * 150;
      const platformY = 150 + Math.random() * (height - 300);
      add(0, platformY, platformW, 25);
      // Occasionally add a "trap" platform
      if (Math.random() > 0.8) {
        add(platformW + 120, platformY - 80, 40, 150);
      }
      return;
    }

    if (rule === 'INVERTED_GRAVITY') {
      // Focus on ceiling obstacles
      if (pattern < 0.5) {
        const h = 100 + Math.random() * 150;
        add(0, 0, 40, h); // Ceiling pillar
      } else {
        const y = height / 2 + (Math.random() - 0.5) * 80;
        add(0, y, 80, 30); // Mid-air platform
      }
      return;
    }

    // Default Patterns
    if (pattern < 0.25) {
      // Pattern: Pillars (Top or Bottom)
      const h = 60 + Math.random() * 120;
      const isTop = Math.random() > 0.5;
      add(0, isTop ? 0 : height - h, 35, h);
    } else if (pattern < 0.5) {
      // Pattern: Narrow Corridor
      const gap = 200 + Math.random() * 50; // Increased gap for cleaner path
      const topH = 50 + Math.random() * (height - gap - 100);
      add(0, 0, 35, topH);
      add(0, topH + gap, 35, height - (topH + gap));
    } else if (pattern < 0.75) {
      // Pattern: Zig-Zag / Stairs
      const steps = 2; // Reduced steps for cleaner path
      const stepW = 50;
      const stepH = 35;
      const startY = 150 + Math.random() * (height - 300);
      const direction = Math.random() > 0.5 ? 1 : -1;
      for (let i = 0; i < steps; i++) {
        add(i * (stepW + 80), startY + i * stepH * direction, stepW, 20);
      }
    } else {
      // Pattern: Floating Cluster
      const count = 1; // Reduced count for cleaner path
      const baseX = 0;
      const baseY = 100 + Math.random() * (height - 200);
      for (let i = 0; i < count; i++) {
        add(baseX + i * 120, baseY + (Math.random() - 0.5) * 80, 40, 40);
      }
    }
  }, [currentRule]);

  // --- Game Loop ---
  const update = useCallback((ctx: CanvasRenderingContext2D) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    if (isPaused) {
      requestRef.current = requestAnimationFrame(() => update(ctx));
      return;
    }
    frameCount.current++;
    timeElapsed.current += 1/60;

    // Clear with Glitch Effect
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    if (glitchIntensity > 0) {
      ctx.fillStyle = `rgba(0, 255, 0, ${glitchIntensity * 0.1})`;
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(Math.random() * width, Math.random() * height, Math.random() * 100, 2);
      }
    }

    // Draw Grid
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    const player = playerRef.current;
    const rule = currentRule;

    // Movement Logic
    let moveX = 0;
    const speed = 5;
    
    if (rule === 'REVERSED_CONTROLS') {
      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) moveX += speed;
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) moveX -= speed;
    } else if (rule === 'NEGATIVE_SPEED') {
      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) moveX -= speed * 1.5;
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) moveX += speed * 0.5;
    } else {
      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) moveX -= speed;
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) moveX += speed;
    }

    player.x += moveX;
    player.x = Math.max(0, Math.min(width - player.w, player.x));

    // Gravity Logic
    const gravity = 0.8;
    const jumpForce = -15;
    const jumpKeyPressed = keysRef.current['Space'] || keysRef.current['ArrowUp'] || keysRef.current['KeyW'] || touchJumpRef.current;

    if (rule === 'INVERTED_GRAVITY') {
      player.vy -= gravity;
      if (jumpKeyPressed && !lastJumpKeyRef.current) {
        if (player.y >= height - player.h - 5 || player.jumps < 2) {
          player.vy = -jumpForce;
          player.jumps++;
          sounds.playJump();
        }
      }
    } else {
      player.vy += gravity;
      if (jumpKeyPressed && !lastJumpKeyRef.current) {
        if (player.y >= height - player.h - 5 || player.jumps < 2) {
          player.vy = jumpForce;
          player.jumps++;
          sounds.playJump();
        }
      }
    }
    lastJumpKeyRef.current = jumpKeyPressed;
    touchJumpRef.current = false; // Reset touch jump after processing frame

    player.y += player.vy;
    
    // Shooting Logic
    const shootKeyPressed = keysRef.current['KeyF'] || keysRef.current['Enter'] || touchShootRef.current;
    if (shootKeyPressed && weaponCooldown <= 0 && weaponAmmoRef.current[currentWeapon] > 0) {
      const wInfo = WEAPONS[currentWeapon];
      const pId = () => Math.random().toString(36).substr(2, 9);
      
      weaponAmmoRef.current[currentWeapon]--;
      setWeaponAmmo({ ...weaponAmmoRef.current });

      if (currentWeapon === 'BLASTER') {
        projectilesRef.current.push({
          x: player.x + player.w,
          y: player.y + player.h / 2 - 4,
          vx: 12,
          vy: 0,
          w: 15,
          h: 8,
          color: wInfo.color,
          id: pId(),
          type: 'BLASTER'
        });
      } else if (currentWeapon === 'SPREAD') {
        [-0.2, 0, 0.2].forEach(angle => {
          projectilesRef.current.push({
            x: player.x + player.w,
            y: player.y + player.h / 2 - 4,
            vx: 10 * Math.cos(angle),
            vy: 10 * Math.sin(angle),
            w: 10,
            h: 10,
            color: wInfo.color,
            id: pId(),
            type: 'SPREAD'
          });
        });
      } else if (currentWeapon === 'BEAM') {
        projectilesRef.current.push({
          x: player.x + player.w,
          y: player.y + player.h / 2 - 2,
          vx: 20,
          vy: 0,
          w: 40,
          h: 4,
          color: wInfo.color,
          id: pId(),
          type: 'BEAM'
        });
      }
      
      setWeaponCooldown(wInfo.cooldown);
      sounds.playShoot(currentWeapon);
    }
    touchShootRef.current = false;

    // Weapon Switching
    const switchKeyPressed = keysRef.current['KeyQ'] || keysRef.current['Tab'] || touchSwitchRef.current;
    if (switchKeyPressed && !lastSwitchKeyRef.current) {
      const wTypes: WeaponType[] = ['BLASTER', 'SPREAD', 'BEAM'];
      const nextIdx = (wTypes.indexOf(currentWeapon) + 1) % wTypes.length;
      setCurrentWeapon(wTypes[nextIdx]);
      sounds.playShift();
    }
    lastSwitchKeyRef.current = switchKeyPressed;
    touchSwitchRef.current = false;

    setWeaponCooldown(c => Math.max(0, c - 1));

    // Ammo Regeneration (Slow)
    if (frameCount.current % 120 === 0) {
      let changed = false;
      (Object.keys(WEAPONS) as WeaponType[]).forEach(w => {
        if (weaponAmmoRef.current[w] < WEAPONS[w].maxAmmo) {
          weaponAmmoRef.current[w]++;
          changed = true;
        }
      });
      if (changed) setWeaponAmmo({ ...weaponAmmoRef.current });
    }

    // Floor/Ceiling Collisions
    if (player.y > height - player.h - 4) {
      player.y = height - player.h - 4;
      player.vy = 0;
      player.jumps = 0;
    }
    if (player.y < 4) {
      player.y = 4;
      player.vy = 0;
      player.jumps = 0;
    }

    // Update Obstacles
    const timeSpeedBonus = timeElapsed.current / 15; // Faster speed ramp for 120s level
    const spawnRate = Math.max(25, 90 - (level * 6) - (timeElapsed.current / 10));
    if (frameCount.current % Math.floor(spawnRate) === 0) spawnObstacle(width, height);

    const obstacleSpeed = 5 + (level * 1.2) + timeSpeedBonus;

    // Update Projectiles
    projectilesRef.current = projectilesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;

      ctx.fillStyle = p.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.shadowBlur = 0;

      return p.x < width + 100 && p.x > -100 && p.y < height + 100 && p.y > -100;
    });

    obstaclesRef.current = obstaclesRef.current.filter(obs => {
      obs.x -= obstacleSpeed;

      // Projectile Collision
      projectilesRef.current = projectilesRef.current.filter(p => {
        const hit = (
          p.x < obs.x + obs.w &&
          p.x + p.w > obs.x &&
          p.y < obs.y + obs.h &&
          p.y + p.h > obs.y
        );
        if (hit) {
          obs.health -= (p.type === 'BEAM' ? 2 : 1);
          // Visual feedback for hit
          ctx.fillStyle = '#fff';
          ctx.fillRect(obs.x - 2, obs.y - 2, obs.w + 4, obs.h + 4);
          return false; // Remove projectile
        }
        return true;
      });

      if (obs.health <= 0) {
        sounds.playExplosion();
        setScore(s => s + 50);
        return false; // Remove obstacle
      }

      // Draw Obstacle
      const obsColor = isPhasing ? '#ffffff44' : RULES[rule].color;
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = obsColor;
      ctx.strokeStyle = obsColor;
      ctx.lineWidth = 2;
      
      // Draw main body
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      
      // Draw a "hatch" pattern inside the obstacle for more brutalist feel
      if (obs.type === 'WALL') {
        ctx.fillStyle = `${obsColor}11`;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(obs.x, obs.y);
        ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
        ctx.moveTo(obs.x + obs.w, obs.y);
        ctx.lineTo(obs.x, obs.y + obs.h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      
      if (obs.type === 'VOID') {
        ctx.fillStyle = isPhasing ? '#ffffff11' : `${RULES[rule].color}22`;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      }
      
      // Health indicator (if damaged)
      if (obs.health < 3 && obs.type === 'WALL') {
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(obs.x, obs.y - 8, (obs.health / 3) * obs.w, 3);
      }
      
      ctx.restore();
      ctx.shadowBlur = 0;

      // Collision
      const isColliding = (
        player.x < obs.x + obs.w &&
        player.x + player.w > obs.x &&
        player.y < obs.y + obs.h &&
        player.y + player.h > obs.y
      );

      if (isColliding && !isPhasing) {
        if (rule === 'GHOST_WALLS') {
          // In Ghost mode, walls are safe, but the floor is lava (handled elsewhere)
          ctx.fillStyle = '#fff';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        } else {
          setGameState('GAMEOVER');
          sounds.playCollision();
        }
      }

      return obs.x > -100;
    });

    // Special Rule: Ghost Walls makes floor deadly
    if (rule === 'GHOST_WALLS' && player.y >= height - player.h - 2 && !isPhasing) {
      setGameState('GAMEOVER');
      sounds.playCollision();
    }

    // Draw Player
    const playerColor = isPhasing ? '#fff' : RULES[rule].color;
    ctx.save();
    ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
    
    // Rotation based on velocity
    const rotation = Math.max(-0.4, Math.min(0.4, player.vy * 0.05));
    ctx.rotate(rotation);
    
    ctx.fillStyle = playerColor;
    ctx.shadowBlur = isPhasing ? 30 : 20;
    ctx.shadowColor = playerColor;
    
    // Draw a "Ship" shape (Triangle/Polygon)
    ctx.beginPath();
    ctx.moveTo(player.w / 2, 0); // Nose
    ctx.lineTo(-player.w / 2, -player.h / 2); // Top back
    ctx.lineTo(-player.w / 4, 0); // Inner back
    ctx.lineTo(-player.w / 2, player.h / 2); // Bottom back
    ctx.closePath();
    ctx.fill();
    
    // Add a "Core" glow
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(-player.w / 8, 0, player.w / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    
    ctx.restore();
    ctx.shadowBlur = 0;

    // Phasing Effect
    if (isPhasing) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(player.x - 5, player.y - 5, player.w + 10, player.h + 10);
    }

    // Floor & Ceiling Indicators (The "Bars")
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(0, 0, width, 4); // Ceiling bar
    ctx.fillRect(0, height - 4, width, 4); // Floor bar
    
    ctx.strokeStyle = RULES[rule].color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(width, 4);
    ctx.moveTo(0, height - 4);
    ctx.lineTo(width, height - 4);
    ctx.stroke();

    // Obstacle Warning
    obstaclesRef.current.forEach(obs => {
      if (obs.x > width && obs.x < width + 400) {
        ctx.fillStyle = `${RULES[rule].color}33`;
        ctx.fillRect(width - 10, obs.y, 4, obs.h);
      }
    });

    // Glitch Player
    if (Math.random() > 0.95) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(player.x + (Math.random() - 0.5) * 20, player.y, player.w, 2);
    }

    setScore(s => s + 1);
    requestRef.current = requestAnimationFrame(() => update(ctx));
  }, [currentRule, glitchIntensity, spawnObstacle, isPhasing, level, isPaused, currentWeapon]);

  useEffect(() => {
    if (gameState === 'PLAYING' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        playerRef.current = { 
          x: 100, 
          y: canvas.height / 2, 
          vy: 0, 
          w: 40, 
          h: 40, 
          color: '#00FF00', 
          jumps: 0 
        };
        obstaclesRef.current = [];
        frameCount.current = 0;
        requestRef.current = requestAnimationFrame(() => update(ctx));
      }
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, update]);

  // --- Paradox Rule & Level Cycler ---
  useEffect(() => {
    if (gameState !== 'PLAYING' || isPaused) return;

    const interval = setInterval(() => {
      // Rule Timer
      setRuleTimer(t => {
        if (t <= 1) {
          const ruleKeys = Object.keys(RULES) as ParadoxRule[];
          const nextRule = ruleKeys[Math.floor(Math.random() * ruleKeys.length)];
          setCurrentRule(nextRule);
          setGlitchIntensity(1);
          sounds.playShift();
          setTimeout(() => setGlitchIntensity(0), 500);
          return 10;
        }
        return t - 1;
      });

    // Level Timer
    setLevelTimer(t => {
      if (t <= 1) {
        setGameState('LEVEL_UP');
        sounds.playLevelUp();
        // Clear phasing state on level up to prevent wasting it
        setIsPhasing(false);
        setPhaseTimeLeft(0);
        return 120; // Reset to 120
      }
      return t - 1;
    });

      // Session & Power-up Logic
      setTotalSessionTime(prev => prev + 1);
      
      setPhaseTimeLeft(prev => {
        if (prev <= 1 && isPhasing) {
          setIsPhasing(false);
          return 0;
        }
        return Math.max(0, prev - 1);
      });

      setPhaseCooldown(prev => Math.max(0, prev - 1));

    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, isPhasing, isPaused]);

  // Handle Phase Activation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' || e.code === 'ShiftLeft') {
        activatePhase();
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (gameState === 'PLAYING') setIsPaused(p => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalSessionTime, phaseCooldown, isPhasing, gameState]);

  const activatePhase = () => {
    if (totalSessionTime >= 60 && phaseCooldown === 0 && !isPhasing && gameState === 'PLAYING' && !isPaused) {
      setIsPhasing(true);
      setPhaseTimeLeft(10);
      setPhaseCooldown(60);
      sounds.playShift(); // Use shift sound for activation
    }
  };

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('paradox_highscore', score.toString());
    }
  }, [score, highScore]);

  // --- Actions ---
  const handleStart = () => {
    setScore(0);
    setLevel(1);
    setLevelTimer(120);
    setTotalSessionTime(0);
    setPhaseCooldown(0);
    setPhaseTimeLeft(0);
    setIsPhasing(false);
    setIsPaused(false);
    setCurrentRule('NORMAL');
    setRuleTimer(10);
    const initialAmmo = {
      BLASTER: WEAPONS.BLASTER.maxAmmo,
      SPREAD: WEAPONS.SPREAD.maxAmmo,
      BEAM: WEAPONS.BEAM.maxAmmo
    };
    weaponAmmoRef.current = { ...initialAmmo };
    setWeaponAmmo(initialAmmo);
    setGameState('PLAYING');
    projectilesRef.current = [];
    timeElapsed.current = 0;
    sounds.playStart();
  };

  const handleNextLevel = () => {
    setLevel(prev => prev + 1);
    setLevelTimer(120);
    setGameState('PLAYING');
    sounds.playStart();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Don't jump if clicking UI buttons
    if ((e.target as HTMLElement).closest('button')) return;
    
    if (gameState === 'START' || gameState === 'GAMEOVER') {
      handleStart();
      return;
    }

    if (gameState === 'LEVEL_UP') {
      handleNextLevel();
      return;
    }

    if (isPaused) return;
    
    // Check for phase activation (double tap or specific area?)
    // For now, let's add a dedicated button in the UI for mobile
    touchJumpRef.current = true;
  };

  // --- Render ---
  return (
    <div className="flex flex-col h-[100dvh] w-full bg-black overflow-hidden font-mono text-[#00FF00] select-none touch-none">
      {/* Top Stats Bar - Separated from the game screen */}
      {gameState === 'PLAYING' && (
        <div className="h-16 sm:h-20 bg-black border-b-2 border-white/20 px-2 sm:px-4 flex justify-between items-center z-50 pointer-events-auto">
          <div className="flex items-center gap-2 sm:gap-6">
            <div className="flex flex-col">
              <span className="text-[8px] sm:text-[10px] opacity-50 uppercase tracking-widest font-bold">Score</span>
              <span className="text-lg sm:text-2xl font-black text-[#00FF00] leading-none">{score.toLocaleString()}</span>
            </div>
            <div className="h-8 sm:h-10 w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[8px] sm:text-[10px] opacity-50 uppercase tracking-widest font-bold">Lvl {level}</span>
              <span className="text-xs sm:text-sm font-bold leading-none">{levelTimer}s</span>
            </div>
            <button 
              onClick={() => setIsPaused(p => !p)}
              className="ml-1 sm:ml-2 p-1.5 sm:p-2 border border-white/40 hover:bg-white hover:text-black transition-colors"
            >
              {isPaused ? <Play className="w-3 h-3 sm:w-4 h-4" /> : <Pause className="w-3 h-3 sm:w-4 h-4" />}
            </button>
          </div>

          {/* Middle Section: Weapon & Power-up - Hidden on very small screens or made compact */}
          <div className="hidden md:flex items-center gap-4">
            {/* Weapon UI */}
            <div className="border border-white/20 bg-black/40 p-1.5 text-right min-w-[100px] lg:min-w-[120px]">
              <div className="flex items-center justify-end gap-2 mb-0.5">
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black uppercase tracking-tighter" style={{ color: WEAPONS[currentWeapon].color }}>
                    {WEAPONS[currentWeapon].label}
                  </span>
                  <span className="text-[7px] opacity-70">AMMO: {weaponAmmo[currentWeapon]}</span>
                </div>
                <Crosshair className="w-3 h-3" style={{ color: WEAPONS[currentWeapon].color }} />
              </div>
              <div className="h-0.5 bg-white/10 w-full overflow-hidden">
                <motion.div 
                  key={currentWeapon + weaponCooldown}
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: WEAPONS[currentWeapon].cooldown / 60, ease: "linear" }}
                  className="h-full"
                  style={{ backgroundColor: WEAPONS[currentWeapon].color }}
                />
              </div>
            </div>

            {/* Power-up UI */}
            <div className={cn(
              "border border-white/20 p-1.5 bg-black/40 cursor-pointer transition-all min-w-[100px] lg:min-w-[120px]",
              (totalSessionTime < 60 || phaseCooldown > 0) ? "opacity-40" : "border-white animate-pulse"
            )} onClick={activatePhase}>
              <div className="flex items-center justify-end gap-2">
                <span className="text-[9px] font-bold uppercase">Phase</span>
                <Zap className={cn("w-2.5 h-2.5", isPhasing && "animate-spin")} />
              </div>
              {totalSessionTime < 60 ? (
                <div className="text-[7px] text-right">{60 - totalSessionTime}s</div>
              ) : isPhasing ? (
                <div className="text-[7px] text-right">ACT: {phaseTimeLeft}s</div>
              ) : (
                <div className="text-[7px] text-right">{phaseCooldown > 0 ? `CD: ${phaseCooldown}s` : 'READY'}</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[8px] sm:text-[10px] opacity-50 uppercase tracking-widest font-bold hidden sm:block">Paradox</span>
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="text-[10px] sm:text-xs font-black uppercase" style={{ color: RULES[currentRule].color }}>{RULES[currentRule].label}</span>
                <div className="scale-75 sm:scale-90" style={{ color: RULES[currentRule].color }}>{RULES[currentRule].icon}</div>
              </div>
            </div>
            <div className="w-16 sm:w-32 h-1 sm:h-1.5 bg-white/10 overflow-hidden relative border border-white/5">
              <motion.div 
                key={currentRule + ruleTimer}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 1, ease: "linear" }}
                className="h-full"
                style={{ backgroundColor: RULES[currentRule].color }}
              />
            </div>
          </div>
        </div>
      )}

      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className="flex-1 relative w-full bg-black overflow-hidden"
      >
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block"
      />

      {/* Border Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none border-[12px] z-[70] transition-colors duration-500"
        style={{ borderColor: gameState === 'PLAYING' ? RULES[currentRule].color : '#00FF00' }}
      />

      {/* UI Overlay */}
      <AnimatePresence>
        {gameState === 'START' && (
          <motion.div
            key="start-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50 p-4 sm:p-12"
          >
            <div className="border-4 border-[#00FF00] p-4 sm:p-8 max-w-2xl w-full bg-black">
              <motion.div 
                animate={{ x: [0, -2, 2, 0] }}
                transition={{ repeat: Infinity, duration: 0.1 }}
                className="flex items-center gap-4 mb-4"
              >
                <AlertTriangle className="w-12 h-12" />
                <h1 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase leading-none">
                  Paradox<br/>Runner
                </h1>
              </motion.div>
              
              <p className="text-sm mb-8 leading-relaxed border-l-4 border-[#00FF00] pl-4 py-2">
                CRITICAL ERROR: Reality engine failing. Logic is no longer a constant. 
                Survive the shifting paradoxes. Trust nothing.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="border-2 border-[#00FF00] p-4">
                  <span className="text-[10px] block mb-2">SYSTEM STATUS</span>
                  <span className="text-xs font-bold uppercase animate-pulse">UNSTABLE</span>
                </div>
                <div className="border-2 border-[#00FF00] p-4">
                  <span className="text-[10px] block mb-2">BEST RECORD</span>
                  <span className="text-xl font-bold">{highScore.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="flex flex-col gap-4">
                <button
                  onClick={handleStart}
                  className="w-full py-6 bg-[#00FF00] text-black font-black uppercase text-2xl tracking-widest hover:bg-white transition-colors flex flex-col items-center justify-center gap-1"
                >
                  <div className="flex items-center gap-4">
                    <Play className="w-8 h-8 fill-current" /> Initialize
                  </div>
                  <span className="text-[10px] opacity-50 font-bold">OR TAP ANYWHERE TO START</span>
                </button>
                
                <button
                  onClick={() => setShowHowToPlay(true)}
                  className="w-full py-4 border-2 border-[#00FF00] text-[#00FF00] font-bold uppercase text-sm tracking-widest hover:bg-[#00FF00]/10 transition-colors flex items-center justify-center gap-2"
                >
                  <Info className="w-5 h-5" /> How to Play
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {showHowToPlay && (
          <motion.div
            key="how-to-play"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black z-[80] p-4 sm:p-12"
          >
            <div className="border-4 border-[#00FF00] p-4 sm:p-8 max-w-2xl w-full bg-black">
              <h2 className="text-2xl sm:text-4xl font-black uppercase mb-4 sm:mb-6 flex items-center gap-3">
                <Info className="w-6 h-6 sm:w-8 h-8" /> System Manual
              </h2>
              
              <div className="space-y-6 mb-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                <section>
                  <h3 className="text-lg font-bold uppercase mb-2 text-white">Objective</h3>
                  <p className="text-sm opacity-80">Survive as long as possible. The reality engine is failing, causing the rules of physics to shift every 10 seconds.</p>
                </section>

                <section>
                  <h3 className="text-lg font-bold uppercase mb-2 text-white">Controls</h3>
                  <ul className="text-sm space-y-1 opacity-80">
                    <li>• <span className="text-[#00FF00]">WASD / Arrows</span>: Move & Jump</li>
                    <li>• <span className="text-[#00FF00]">Space / Tap Screen</span>: Jump (Double Jump Enabled)</li>
                    <li>• <span className="text-[#00FF00]">F / Enter</span>: Shoot</li>
                    <li>• <span className="text-[#00FF00]">Q / Tab</span>: Switch Weapon</li>
                    <li>• <span className="text-[#00FF00]">E / Shift</span>: Phase Shift (Unlocks at 1m)</li>
                    <li>• <span className="text-[#00FF00]">P / Esc</span>: Pause Game</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-lg font-bold uppercase mb-2 text-white">Weapons</h3>
                  <div className="grid gap-4">
                    {Object.values(WEAPONS).map(weapon => (
                      <div key={weapon.id} className="flex gap-4 p-3 border border-white/10 bg-white/5">
                        <div style={{ color: weapon.color }}><Crosshair className="w-6 h-6" /></div>
                        <div>
                          <h4 className="font-bold text-xs uppercase" style={{ color: weapon.color }}>{weapon.label}</h4>
                          <p className="text-[10px] opacity-60">{weapon.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-bold uppercase mb-2 text-white">The Paradoxes</h3>
                  <div className="grid gap-4">
                    {Object.values(RULES).map(rule => (
                      <div key={rule.id} className="flex gap-4 p-3 border border-white/10 bg-white/5">
                        <div style={{ color: rule.color }}>{rule.icon}</div>
                        <div>
                          <h4 className="font-bold text-xs uppercase" style={{ color: rule.color }}>{rule.label}</h4>
                          <p className="text-[10px] opacity-60">{rule.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <button
                onClick={() => setShowHowToPlay(false)}
                className="w-full py-4 bg-[#00FF00] text-black font-black uppercase tracking-widest hover:bg-white transition-colors"
              >
                Close Manual
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'PLAYING' && (
          <div key="playing-screen" className="absolute inset-0 pointer-events-none p-4 sm:p-8">
            {/* Pause Overlay */}
            {isPaused && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] pointer-events-auto">
                <div className="border-4 border-white p-8 bg-black text-center">
                  <h2 className="text-4xl font-black uppercase mb-4 tracking-tighter">System Paused</h2>
                  <button 
                    onClick={() => setIsPaused(false)}
                    className="px-8 py-3 bg-white text-black font-bold uppercase hover:bg-[#00FF00] transition-colors"
                  >
                    Resume Session
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Controls & Stats */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <div className="text-[8px] font-bold opacity-50 uppercase tracking-widest bg-black/40 p-1">Session_Time: {totalSessionTime}s</div>
                  <div className="flex gap-1">
                    {Object.keys(RULES).map((r) => (
                      <div 
                        key={r}
                        className={cn(
                          "w-1.5 h-1.5 border",
                          currentRule === r ? "bg-white border-white scale-110" : "border-white/20"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 pointer-events-auto">
                {/* Weapon UI and Power-up UI moved to top HUD */}
              </div>
            </div>

            {/* Mobile Controls (L-buttons) */}
            <div className="absolute bottom-32 left-4 right-4 flex justify-between items-center sm:hidden pointer-events-auto">
              <div className="flex gap-2">
                <button 
                  onPointerDown={(e) => { e.stopPropagation(); touchSwitchRef.current = true; }}
                  className="w-14 h-14 border-2 border-white bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-full active:scale-90 transition-transform"
                >
                  <RefreshCw className="w-6 h-6" />
                </button>
              </div>
              <div className="flex gap-2">
                <button 
                  onPointerDown={(e) => { e.stopPropagation(); touchShootRef.current = true; }}
                  className="w-16 h-16 border-4 border-[#00FF00] bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-full active:scale-90 transition-transform"
                >
                  <Crosshair className="w-8 h-8" />
                </button>
              </div>
            </div>
          </div>
        )}

        {gameState === 'LEVEL_UP' && (
          <motion.div
            key="level-up-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50 p-4 sm:p-12"
          >
            <div className="border-8 border-[#00FF00] p-6 sm:p-12 max-w-2xl w-full bg-black text-[#00FF00]">
              <h2 className="text-4xl sm:text-8xl font-black uppercase italic mb-4 leading-none text-white">Level<br/>Cleared</h2>
              <p className="text-sm mb-8 font-bold border-l-4 border-[#00FF00] pl-4">
                REALITY_STABILIZED: You have survived the current paradox cluster. Level {level} complete.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-12">
                <div className="border-2 border-[#00FF00] p-4">
                  <span className="text-[10px] block mb-1">SCORE_ACHIEVED</span>
                  <span className="text-2xl font-bold">{score.toLocaleString()}</span>
                </div>
                <div className="border-2 border-[#00FF00] p-4">
                  <span className="text-[10px] block mb-1">NEXT_DIFFICULTY</span>
                  <span className="text-2xl font-bold">{(6 + (level + 1) * 2).toFixed(1)}x</span>
                </div>
              </div>
              
              <div className="flex flex-col gap-4">
                <button
                  onClick={handleNextLevel}
                  className="w-full py-6 bg-[#00FF00] text-black font-black uppercase text-2xl tracking-widest hover:bg-white transition-colors flex flex-col items-center justify-center gap-1"
                >
                  <div className="flex items-center gap-4">
                    <Play className="w-8 h-8 fill-current" /> Next Level
                  </div>
                  <span className="text-[10px] opacity-50 font-bold">PREPARE FOR INCREASED ENTROPY</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div
            key="game-over-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50 p-4 sm:p-12"
          >
            <div className="border-8 border-red-600 p-6 sm:p-12 max-w-2xl w-full bg-black text-red-600">
              <h2 className="text-4xl sm:text-8xl font-black uppercase italic mb-4 leading-none">Fatal<br/>Error</h2>
              <p className="text-sm mb-12 font-bold border-l-4 border-red-600 pl-4">
                PARADOX_COLLAPSE: The logic loop has terminated. Your existence has been archived.
              </p>
              
              <div className="grid grid-cols-2 gap-4 sm:gap-8 mb-12">
                <div>
                  <span className="text-[10px] block mb-2">ARCHIVED_SCORE</span>
                  <span className="text-3xl sm:text-5xl font-bold">{score.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] block mb-2">PEAK_REALITY</span>
                  <span className="text-3xl sm:text-5xl font-bold">{highScore.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={handleStart}
                  className="w-full py-6 bg-red-600 text-black font-black uppercase text-2xl tracking-widest hover:bg-white transition-colors flex flex-col items-center justify-center gap-1"
                >
                  <div className="flex items-center gap-4">
                    <RotateCcw className="w-8 h-8" /> Reboot System
                  </div>
                  <span className="text-[10px] opacity-50 font-bold">OR TAP ANYWHERE TO REBOOT</span>
                </button>

                <button
                  onClick={() => setShowHowToPlay(true)}
                  className="w-full py-4 border-2 border-red-600 text-red-600 font-bold uppercase text-sm tracking-widest hover:bg-red-600/10 transition-colors flex items-center justify-center gap-2"
                >
                  <Info className="w-5 h-5" /> How to Play
                </button>
                
                <button
                  onClick={() => setGameState('START')}
                  className="w-full py-2 text-red-600/40 font-bold uppercase tracking-widest text-[10px] hover:text-red-600 transition-colors"
                >
                  Terminate Session
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glitch Overlay */}
      {glitchIntensity > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-white/10 pointer-events-none z-[100] mix-blend-overlay"
        />
      )}
      </div>
    </div>
  );
}
