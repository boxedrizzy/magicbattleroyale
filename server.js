const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const Player = require('./models/Player');
const Scroll = require('./models/Scroll');

// Import database storage
let storage = null;
console.log('PostgreSQL database storage available but using existing memory-based system for compatibility');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// MongoDB connection (optional for persistence)
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('Connected to MongoDB'))
        .catch(err => console.error('MongoDB connection error:', err));
} else {
    console.log('Running in memory mode - no persistent storage');
}

// Serve static files
app.use(express.static('public'));

// Game state
const gameState = {
    players: new Map(),
    scrolls: new Map(),
    spells: new Map(),
    animals: new Map(),
    statuesKilled: 0, // Add this line
    currentBiome: 'forest',
    biomeChangeTime: Date.now() + 900000, // 15 minutes from now
    statueSpawnPoints: [
        { x: 600, y: 600 },
        { x: 700, y: 700 },
        { x: 800, y: 800 },
        { x: 900, y: 900 },
        { x: 1000, y: 1000 }
    ],
    scrollSpawnPoints: [
        { x: 1000, y: 1000, type: 'fire', spawnTime: 30000 },
        { x: 3000, y: 1600, type: 'ice', spawnTime: 45000 },
        { x: 2000, y: 2400, type: 'lightning', spawnTime: 60000 },
        { x: 4000, y: 600, type: 'earth', spawnTime: 40000 },
        { x: 600, y: 3000, type: 'wind', spawnTime: 35000 },
        { x: 3600, y: 3600, type: 'shadow', spawnTime: 80000 },
        { x: 1600, y: 400, type: 'light', spawnTime: 90000 }
    ]
};

// Biome definitions
const biomes = {
    forest: {
        name: 'Forest',
        color: '#2d5016',
        animals: ['deer', 'rabbit', 'wolf', 'bear'],
        description: 'Dense woodland with magical creatures'
    },
    desert: {
        name: 'Desert',
        color: '#c19a6b',
        animals: ['snake', 'scorpion', 'lizard', 'phoenix'],
        description: 'Scorching sands with fire-resistant beasts'
    },
    tundra: {
        name: 'Tundra',
        color: '#a7c7e7',
        animals: ['penguin', 'seal', 'polar_bear', 'ice_wolf'],
        description: 'Frozen wasteland with ice creatures'
    },
    swamp: {
        name: 'Swamp',
        color: '#4a5d23',
        animals: ['frog', 'alligator', 'snake', 'will_o_wisp'],
        description: 'Murky wetlands with mysterious beings'
    },
    volcanic: {
        name: 'Volcanic',
        color: '#8b0000',
        animals: ['salamander', 'fire_elemental', 'lava_slug', 'phoenix'],
        description: 'Molten landscape with fire elementals'
    }
};

// Animal types removed

// Magic types and rarities with upgrade tiers
const magicTypes = {
    fire: { 
        color: '#FF4444', 
        rarity: 'common', 
        damage: 20, 
        playerDamage: 15,
        upgrades: {
            1: { name: 'Fireball', damage: 15, description: 'Basic fireball' },
            2: { name: 'Flame Burst', damage: 25, description: 'Explosive fireball' },
            3: { name: 'Inferno Blast', damage: 35, description: 'Massive fire explosion' }
        }
    },
    ice: { 
        color: '#4444FF', 
        rarity: 'common', 
        damage: 18, 
        playerDamage: 12,
        upgrades: {
            1: { name: 'Water Bullet', damage: 12, description: 'Fast water projectile' },
            2: { name: 'Ice Shard', damage: 20, description: 'Sharp ice projectile' },
            3: { name: 'Frost Storm', damage: 30, description: 'Multiple ice shards' }
        }
    },
    lightning: { 
        color: '#FFFF44', 
        rarity: 'uncommon', 
        damage: 30, 
        playerDamage: 25,
        upgrades: {
            1: { name: 'Lightning Bolt', damage: 25, description: 'Instant lightning strike' },
            2: { name: 'Chain Lightning', damage: 35, description: 'Lightning that chains' },
            3: { name: 'Thunder Storm', damage: 45, description: 'Area lightning' }
        }
    },
    earth: { 
        color: '#44AA44', 
        rarity: 'uncommon', 
        damage: 25, 
        playerDamage: 20,
        upgrades: {
            1: { name: 'Earth Wall', damage: 20, description: 'Damaging wall barrier' },
            2: { name: 'Stone Spikes', damage: 30, description: 'Sharp stone projectiles' },
            3: { name: 'Earthquake', damage: 40, description: 'Ground shaking attack' }
        }
    },
    wind: { 
        color: '#44FFFF', 
        rarity: 'rare', 
        damage: 35, 
        playerDamage: 30,
        upgrades: {
            1: { name: 'Wind Blast', damage: 30, description: 'Powerful wind attack' },
            2: { name: 'Tornado', damage: 40, description: 'Spinning wind vortex' },
            3: { name: 'Hurricane', damage: 50, description: 'Massive wind storm' }
        }
    },
    shadow: { 
        color: '#AA44AA', 
        rarity: 'epic', 
        damage: 45, 
        playerDamage: 40,
        upgrades: {
            1: { name: 'Dark Hole', damage: 40, description: 'Pulls enemies and damages' },
            2: { name: 'Shadow Void', damage: 50, description: 'Larger dark hole' },
            3: { name: 'Black Hole', damage: 60, description: 'Massive gravitational pull' }
        }
    },
    light: { 
        color: '#FFFFFF', 
        rarity: 'legendary', 
        damage: 55, 
        playerDamage: 50,
        upgrades: {
            1: { name: 'Light Beam', damage: 50, description: 'Piercing light ray' },
            2: { name: 'Holy Nova', damage: 60, description: 'Radial light explosion' },
            3: { name: 'Divine Wrath', damage: 70, description: 'Ultimate light attack' }
        }
    },
    void: { 
        color: '#8800FF', 
        rarity: 'mythic', 
        damage: 70, 
        playerDamage: 65,
        upgrades: {
            1: { name: 'Void Blast', damage: 65, description: 'Pure void energy' },
            2: { name: 'Reality Tear', damage: 75, description: 'Tears through reality' },
            3: { name: 'Dimension Collapse', damage: 85, description: 'Collapses dimensional space' }
        }
    },
    soul: {
        color: '#C0C0C0',
        rarity: 'rare',
        damage: 40,
        playerDamage: 35,
        upgrades: {
            1: { name: 'Soul Drain', damage: 35, description: 'Drains life from target' },
            2: { name: 'Soul Burst', damage: 45, description: 'Explodes with soul energy' },
            3: { name: 'Soul Storm', damage: 55, description: 'Unleashes a storm of souls' }
        }
    }
};

// Helper functions for enhanced spell visual effects
function getSpellSpeed(spellType) {
    const speeds = {
        fire: 8,
        ice: 6,
        lightning: 15,
        earth: 4,
        wind: 12,
        shadow: 10,
        light: 20,
        void: 14,
        soul: 7
    };
    return speeds[spellType] || 8;
}

function getSpellTrail(spellType) {
    const trails = {
        fire: { enabled: true, color: 0xFF4444, length: 20, fade: 0.95 },
        ice: { enabled: true, color: 0x4444FF, length: 15, fade: 0.92 },
        lightning: { enabled: true, color: 0xFFFF44, length: 30, fade: 0.85 },
        earth: { enabled: false },
        wind: { enabled: true, color: 0x44FFFF, length: 25, fade: 0.90 },
        shadow: { enabled: true, color: 0xAA44AA, length: 35, fade: 0.88 },
        light: { enabled: true, color: 0xFFFFFF, length: 40, fade: 0.82 },
        void: { enabled: true, color: 0x8800FF, length: 45, fade: 0.80 },
        soul: { enabled: true, color: 0xC0C0C0, length: 18, fade: 0.93 }
    };
    return trails[spellType] || { enabled: false };
}

function getSpellParticles(spellType, level) {
    const baseParticles = {
        fire: { count: 10, size: 3, color: 0xFF4444, spread: 0.3 },
        ice: { count: 8, size: 2, color: 0x4444FF, spread: 0.2 },
        lightning: { count: 15, size: 1, color: 0xFFFF44, spread: 0.5 },
        earth: { count: 6, size: 4, color: 0x44AA44, spread: 0.1 },
        wind: { count: 12, size: 2, color: 0x44FFFF, spread: 0.4 },
        shadow: { count: 20, size: 3, color: 0xAA44AA, spread: 0.6 },
        light: { count: 25, size: 2, color: 0xFFFFFF, spread: 0.7 },
        void: { count: 30, size: 4, color: 0x8800FF, spread: 0.8 },
        soul: { count: 14, size: 3, color: 0xC0C0C0, spread: 0.35 }
    };
    
    const particles = baseParticles[spellType] || baseParticles.fire;
    return {
        ...particles,
        count: particles.count + (level * 5),
        size: particles.size + (level * 0.5)
    };
}

function getTransformationParticles(transformationType) {
    const particles = {
        'phoenix_emperor': { count: 50, color: 0xFF4444, size: 4, pattern: 'rising_flames' },
        'void_leviathan_king': { count: 80, color: 0x8800FF, size: 5, pattern: 'void_swirl' },
        'celestial_tiger_god': { count: 60, color: 0xFFDD00, size: 3, pattern: 'lightning_burst' },
        'ancient_dragon_lord': { count: 70, color: 0x00FF00, size: 6, pattern: 'dragon_spiral' },
        'shadow_demon_king': { count: 90, color: 0x440044, size: 4, pattern: 'shadow_tendrils' },
        'light_archon': { count: 100, color: 0xFFFFFF, size: 3, pattern: 'light_explosion' },
        'ice_empress': { count: 45, color: 0x4444FF, size: 3, pattern: 'ice_crystals' },
        'storm_lord': { count: 65, color: 0x44FFFF, size: 2, pattern: 'wind_tornado' }
    };
    return particles[transformationType] || { count: 30, color: 0xFFFFFF, size: 3, pattern: 'default' };
}

function getTransformationAura(transformationType) {
    const auras = {
        'phoenix_emperor': { color: 0xFF4444, radius: 150, pulse: true, intensity: 0.8 },
        'void_leviathan_king': { color: 0x8800FF, radius: 200, pulse: false, intensity: 1.0 },
        'celestial_tiger_god': { color: 0xFFDD00, radius: 120, pulse: true, intensity: 0.9 },
        'ancient_dragon_lord': { color: 0x00FF00, radius: 180, pulse: false, intensity: 0.85 },
        'shadow_demon_king': { color: 0x440044, radius: 160, pulse: true, intensity: 0.95 },
        'light_archon': { color: 0xFFFFFF, radius: 220, pulse: true, intensity: 1.0 },
        'ice_empress': { color: 0x4444FF, radius: 140, pulse: false, intensity: 0.75 },
        'storm_lord': { color: 0x44FFFF, radius: 170, pulse: true, intensity: 0.85 }
    };
    return auras[transformationType] || { color: 0xFFFFFF, radius: 100, pulse: false, intensity: 0.5 };
}

function getAttackEffects(attackType) {
    const effects = {
        'divine_presence': { 
            particles: { count: 100, color: 0xFFFFFF, size: 5, pattern: 'divine_burst' },
            light: { intensity: 2.0, color: 0xFFFFFF, radius: 300 },
            distortion: { enabled: true, strength: 0.8 }
        },
        'rainbow_divine_blast': {
            particles: { count: 150, colors: [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF], size: 6, pattern: 'rainbow_explosion' },
            light: { intensity: 3.0, rainbow: true, radius: 400 },
            distortion: { enabled: true, strength: 1.2 }
        },
        'mega_fireball': {
            particles: { count: 80, color: 0xFF4444, size: 8, pattern: 'fire_explosion' },
            light: { intensity: 1.5, color: 0xFF4444, radius: 250 },
            heat: { enabled: true, distortion: 0.6 }
        },
        'tsunami': {
            particles: { count: 120, color: 0x4444FF, size: 4, pattern: 'water_wave' },
            light: { intensity: 1.0, color: 0x4444FF, radius: 200 },
            wave: { enabled: true, height: 50, speed: 15 }
        },
        'apocalypse_fire': {
            particles: { count: 200, color: 0xFF0000, size: 10, pattern: 'apocalypse_flames' },
            light: { intensity: 2.5, color: 0xFF0000, radius: 500 },
            burning: { enabled: true, duration: 10000 }
        }
    };
    return effects[attackType] || { particles: { count: 20, color: 0xFFFFFF, size: 3 } };
}

function getAttackShockwave(attackType) {
    const shockwaves = {
        'divine_presence': { radius: 300, speed: 20, color: 0xFFFFFF, strength: 1.0 },
        'rainbow_divine_blast': { radius: 400, speed: 25, rainbow: true, strength: 1.5 },
        'mega_fireball': { radius: 250, speed: 15, color: 0xFF4444, strength: 0.8 },
        'tsunami': { radius: 200, speed: 12, color: 0x4444FF, strength: 0.6 },
        'apocalypse_fire': { radius: 500, speed: 30, color: 0xFF0000, strength: 2.0 }
    };
    return shockwaves[attackType] || null;
}

function getAttackScreenShake(attackType) {
    const shakes = {
        'divine_presence': { intensity: 15, duration: 1000, falloff: 0.95 },
        'rainbow_divine_blast': { intensity: 25, duration: 1500, falloff: 0.9 },
        'mega_fireball': { intensity: 10, duration: 800, falloff: 0.92 },
        'tsunami': { intensity: 8, duration: 1200, falloff: 0.88 },
        'apocalypse_fire': { intensity: 30, duration: 2000, falloff: 0.85 }
    };
    return shakes[attackType] || null;
}

function getSkillEffects(skillType) {
    const effects = {
        'phoenixDive': {
            particles: { count: 60, color: 0xFF4444, size: 4, pattern: 'phoenix_dive' },
            trail: { enabled: true, color: 0xFF4444, length: 80, fade: 0.9 },
            explosion: { radius: 150, color: 0xFF4444, intensity: 1.2 },
            screenShake: { intensity: 12, duration: 800 }
        },
        'rebirthFlames': {
            particles: { count: 100, color: 0xFF6600, size: 5, pattern: 'rebirth_flames' },
            aura: { radius: 200, color: 0xFF4444, pulse: true, intensity: 1.5 },
            healing: { enabled: true, amount: 50, range: 300 }
        },
        'voidTsunami': {
            particles: { count: 150, color: 0x8800FF, size: 6, pattern: 'void_wave' },
            wave: { height: 60, speed: 20, color: 0x8800FF, distortion: 1.2 },
            screenShake: { intensity: 18, duration: 1200 }
        },
        'dimensionalCoil': {
            particles: { count: 80, color: 0x8800FF, size: 4, pattern: 'dimensional_coil' },
            distortion: { enabled: true, strength: 1.5, radius: 250 },
            vortex: { enabled: true, suction: 0.8, damage: 45 }
        },
        'cosmicDevastation': {
            particles: { count: 200, color: 0x4400FF, size: 8, pattern: 'cosmic_explosion' },
            explosion: { radius: 400, color: 0x8800FF, intensity: 2.0 },
            screenShake: { intensity: 25, duration: 1500 },
            aoe: { radius: 350, damage: 75 }
        },
        'divineLightningPounce': {
            particles: { count: 70, color: 0xFFDD00, size: 3, pattern: 'lightning_pounce' },
            lightning: { enabled: true, bolts: 5, damage: 40 },
            dash: { speed: 25, trail: true, damage: 35 },
            screenShake: { intensity: 10, duration: 600 }
        },
        'celestialRoar': {
            particles: { count: 120, color: 0xFFDD00, size: 4, pattern: 'celestial_roar' },
            soundWave: { radius: 300, knockback: 15, stun: 2000 },
            aura: { radius: 250, color: 0xFFDD00, intensity: 1.8 },
            screenShake: { intensity: 15, duration: 1000 }
        },
        'bloodTsunami': {
            particles: { count: 90, color: 0xAA0000, size: 5, pattern: 'blood_wave' },
            wave: { height: 45, speed: 18, color: 0xAA0000, lifesteal: true },
            bloodEffect: { paralysis: 3000, damage: 30 }
        },
        'crimsonBlitz': {
            particles: { count: 50, color: 0xFF0000, size: 3, pattern: 'crimson_dash' },
            dash: { speed: 30, strikes: 6, damage: 25 },
            trail: { enabled: true, color: 0xFF0000, length: 60 }
        },
        'sixTailBarrage': {
            particles: { count: 180, color: 0xAA0000, size: 4, pattern: 'six_tail_barrage' },
            projectiles: { count: 6, speed: 15, damage: 20, homing: true },
            aura: { radius: 180, color: 0xAA0000, intensity: 1.3 }
        }
    };
    return effects[skillType] || { particles: { count: 30, color: 0xFFFFFF, size: 3 } };
}

function getDamageEffects(spellType, damage) {
    const baseEffects = {
        fire: { 
            particles: { count: Math.min(damage * 2, 50), color: 0xFF4444, pattern: 'fire_impact' },
            screenShake: { intensity: Math.min(damage * 0.3, 8), duration: 300 },
            burnEffect: { enabled: true, duration: 2000 }
        },
        ice: { 
            particles: { count: Math.min(damage * 1.5, 40), color: 0x4444FF, pattern: 'ice_impact' },
            freezeEffect: { enabled: true, duration: 1500 },
            crystals: { enabled: true, count: 5 }
        },
        lightning: { 
            particles: { count: Math.min(damage * 2.5, 60), color: 0xFFFF44, pattern: 'lightning_impact' },
            electricEffect: { enabled: true, duration: 1000 },
            screenShake: { intensity: Math.min(damage * 0.4, 10), duration: 200 }
        },
        earth: { 
            particles: { count: Math.min(damage * 1.8, 45), color: 0x44AA44, pattern: 'earth_impact' },
            rubble: { enabled: true, count: 8 },
            dustCloud: { enabled: true, radius: 80 }
        },
        wind: { 
            particles: { count: Math.min(damage * 2.2, 55), color: 0x44FFFF, pattern: 'wind_impact' },
            windEffect: { enabled: true, knockback: 10 },
            airDistortion: { enabled: true, strength: 0.5 }
        },
        shadow: { 
            particles: { count: Math.min(damage * 2.8, 70), color: 0xAA44AA, pattern: 'shadow_impact' },
            darkEffect: { enabled: true, duration: 2500 },
            voidRift: { enabled: true, size: 30 }
        },
        light: { 
            particles: { count: Math.min(damage * 3, 75), color: 0xFFFFFF, pattern: 'light_impact' },
            blindEffect: { enabled: true, duration: 1500 },
            lightBurst: { enabled: true, radius: 100 }
        },
        void: { 
            particles: { count: Math.min(damage * 3.5, 90), color: 0x8800FF, pattern: 'void_impact' },
            voidEffect: { enabled: true, duration: 3000 },
            realityTear: { enabled: true, size: 40 }
        },
        soul: { 
            particles: { count: Math.min(damage * 2.5, 65), color: 0xC0C0C0, pattern: 'soul_impact' },
            soulDrain: { enabled: true, amount: damage * 0.5 },
            spiritEffect: { enabled: true, duration: 2000 }
        }
    };
    return baseEffects[spellType] || baseEffects.fire;
}

function getDeathEffects(spellType) {
    const deathEffects = {
        fire: { 
            particles: { count: 100, color: 0xFF0000, pattern: 'fire_death' },
            explosion: { radius: 120, color: 0xFF4444 },
            ashes: { enabled: true, count: 20 }
        },
        ice: { 
            particles: { count: 80, color: 0x4444FF, pattern: 'ice_death' },
            shatter: { enabled: true, pieces: 15 },
            freeze: { enabled: true, duration: 1000 }
        },
        lightning: { 
            particles: { count: 120, color: 0xFFFF44, pattern: 'lightning_death' },
            electricExplosion: { radius: 100, bolts: 8 },
            charred: { enabled: true }
        },
        void: { 
            particles: { count: 150, color: 0x8800FF, pattern: 'void_death' },
            voidRift: { radius: 150, duration: 3000 },
            dimensionalTear: { enabled: true }
        },
        soul: { 
            particles: { count: 90, color: 0xC0C0C0, pattern: 'soul_death' },
            soulRelease: { enabled: true, spirits: 5 },
            ethereal: { enabled: true, duration: 2000 }
        }
    };
    return deathEffects[spellType] || deathEffects.fire;
}

function getLevelUpEffects() {
    return {
        particles: { count: 80, colors: [0xFFD700, 0xFFFF00, 0xFFA500], size: 4, pattern: 'level_up' },
        aura: { radius: 150, color: 0xFFD700, pulse: true, intensity: 1.5 },
        light: { enabled: true, color: 0xFFFFFF, intensity: 2.0, duration: 2000 },
        sound: { enabled: true, type: 'level_up_chime' },
        text: { enabled: true, message: 'LEVEL UP!', color: 0xFFD700, size: 24 }
    };
}

function getSkillEffects(skillType) {
    const effects = {
        'divine_presence': {
            particles: { count: 150, color: 0xFFFFFF, size: 6, pattern: 'divine_burst' },
            light: { intensity: 3.0, color: 0xFFFFFF, radius: 400 },
            aura: { enabled: true, color: 0xFFFFFF, radius: 300, pulse: true }
        },
        'rainbow_divine_blast': {
            particles: { count: 200, colors: [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF], size: 8, pattern: 'rainbow_explosion' },
            light: { intensity: 4.0, rainbow: true, radius: 500 },
            distortion: { enabled: true, strength: 1.5 }
        },
        'heavenly_healing_wave': {
            particles: { count: 100, color: 0x00FF88, size: 5, pattern: 'healing_wave' },
            light: { intensity: 2.0, color: 0x00FF88, radius: 300 },
            wave: { enabled: true, color: 0x00FF88, radius: 250, speed: 20 }
        },
        'mega_fireball': {
            particles: { count: 120, color: 0xFF4444, size: 10, pattern: 'mega_fire' },
            explosion: { radius: 200, color: 0xFF0000, intensity: 2.0 }
        },
        'tsunami': {
            particles: { count: 180, color: 0x4444FF, size: 6, pattern: 'water_tsunami' },
            wave: { enabled: true, height: 80, speed: 25, color: 0x4488FF }
        },
        'sixTailBarrage': {
            particles: { count: 90, color: 0xFF0000, size: 4, pattern: 'blood_barrage' },
            trails: { enabled: true, count: 6, color: 0xFF0000, length: 40 }
        },
        'voidStep': {
            particles: { count: 80, color: 0x8800FF, size: 5, pattern: 'void_teleport' },
            distortion: { enabled: true, strength: 1.2, radius: 150 }
        },
        'primalRoar': {
            particles: { count: 70, color: 0xFFAA00, size: 7, pattern: 'roar_shockwave' },
            shockwave: { radius: 300, color: 0xFFAA00, intensity: 1.5 }
        }
    };
    return effects[skillType] || { particles: { count: 30, color: 0xFFFFFF, size: 3 } };
}

function getHealingWaveEffects(healAmount) {
    return {
        particles: { count: Math.min(healAmount * 2, 100), color: 0x00FF88, pattern: 'healing_sparkles' },
        wave: { radius: 200, color: 0x88FFAA, speed: 15, intensity: 0.8 },
        light: { color: 0x00FF88, intensity: 1.5, duration: 1500 },
        aura: { color: 0x88FFAA, radius: 150, pulse: true, duration: 2000 }
    };
}

function getStatusEffects(statusType, duration) {
    const effects = {
        'burn': {
            particles: { count: 15, color: 0xFF4444, pattern: 'burning', continuous: true },
            overlay: { color: 0xFF4444, alpha: 0.3, pulse: true }
        },
        'freeze': {
            particles: { count: 20, color: 0x4444FF, pattern: 'ice_crystals', continuous: true },
            overlay: { color: 0x4444FF, alpha: 0.4, pattern: 'frozen' }
        },
        'poison': {
            particles: { count: 12, color: 0x44AA44, pattern: 'poison_bubbles', continuous: true },
            overlay: { color: 0x44AA44, alpha: 0.25, pulse: true }
        },
        'blind': {
            overlay: { color: 0x000000, alpha: 0.8, fade: true },
            distortion: { enabled: true, strength: 0.5 }
        },
        'regeneration': {
            particles: { count: 25, color: 0x00FF88, pattern: 'regen_sparkles', continuous: true },
            aura: { color: 0x88FFAA, radius: 100, pulse: true }
        }
    };
    
    const effect = effects[statusType] || { particles: { count: 10, color: 0xFFFFFF } };
    effect.duration = duration;
    return effect;
}

function getSpellImpactEffects(spellType, level) {
    const baseEffects = {
        fire: {
            explosion: { radius: 50 + (level * 10), color: 0xFF4444, intensity: 1.0 + (level * 0.2) },
            sparks: { count: 20 + (level * 5), color: 0xFF6600, spread: 0.5 },
            burn: { duration: 2000 + (level * 500), intensity: 0.8 }
        },
        ice: {
            shatter: { pieces: 10 + (level * 3), color: 0x4444FF, spread: 0.6 },
            freeze: { radius: 40 + (level * 8), duration: 1500 + (level * 300) },
            crystals: { count: 8 + (level * 2), size: 3 + (level * 0.5) }
        },
        lightning: {
            bolt: { branches: 3 + level, color: 0xFFFF44, intensity: 1.5 + (level * 0.3) },
            electric: { sparks: 15 + (level * 4), color: 0xFFFFAA, duration: 1000 },
            chain: { enabled: level >= 3, targets: Math.floor(level / 3), range: 100 }
        },
        earth: {
            rubble: { count: 12 + (level * 3), size: 2 + (level * 0.3), color: 0x44AA44 },
            quake: { radius: 60 + (level * 12), intensity: 0.6 + (level * 0.1), duration: 800 },
            spikes: { count: 6 + level, height: 20 + (level * 5) }
        },
        wind: {
            vortex: { radius: 45 + (level * 9), speed: 10 + (level * 2), color: 0x44FFFF },
            knockback: { force: 15 + (level * 3), radius: 50 + (level * 10) },
            debris: { count: 18 + (level * 4), speed: 8 + (level * 1.5) }
        },
        shadow: {
            darkness: { radius: 55 + (level * 11), alpha: 0.7 + (level * 0.05), color: 0x440044 },
            tendrils: { count: 8 + (level * 2), length: 30 + (level * 6) },
            void: { enabled: level >= 5, radius: 25 + (level * 5) }
        },
        light: {
            burst: { radius: 70 + (level * 14), intensity: 2.0 + (level * 0.4), color: 0xFFFFFF },
            rays: { count: 12 + (level * 3), length: 40 + (level * 8) },
            blind: { radius: 60 + (level * 12), duration: 1200 + (level * 200) }
        },
        void: {
            rift: { radius: 35 + (level * 7), depth: 1.5 + (level * 0.3), color: 0x8800FF },
            pull: { force: 20 + (level * 4), radius: 80 + (level * 16) },
            distortion: { intensity: 1.0 + (level * 0.2), radius: 100 + (level * 20) }
        },
        soul: {
            drain: { amount: 10 + (level * 5), radius: 30 + (level * 6), color: 0xC0C0C0 },
            spirits: { count: 5 + level, speed: 6 + (level * 1.2) },
            ethereal: { alpha: 0.6 + (level * 0.05), duration: 1800 + (level * 300) }
        }
    };
    return baseEffects[spellType] || baseEffects.fire;
}

function getSpellEnvironmentEffects(spellType) {
    const envEffects = {
        fire: { burnTrees: true, meltIce: true, igniteGas: true, scorchGround: true },
        ice: { freezeWater: true, slowMovement: true, createIce: true, extinguishFire: true },
        lightning: { electrifyWater: true, charTrees: true, createEMP: true, chainConduction: true },
        earth: { moveRocks: true, createCraters: true, shakeGround: true, crumbleWalls: true },
        wind: { blowObjects: true, disperseSmoke: true, createTornado: true, knockdownTrees: true },
        shadow: { dimLight: true, hideObjects: true, createDarkness: true, absorbLight: true },
        light: { illuminateArea: true, revealHidden: true, purifyDarkness: true, createRainbows: true },
        void: { tearReality: true, absorbMatter: true, distortSpace: true, nullifyMagic: true },
        soul: { drainLife: true, summonSpirits: true, bindSouls: true, etherealPlane: true }
    };
    return envEffects[spellType] || {};
}

function getSpellSpecialEffects(spellName, level) {
    const specialEffects = {
        'Apocalypse Fire': {
            meteorShower: { enabled: true, count: 5 + level, radius: 200 + (level * 40) },
            hellfire: { enabled: true, color: 0xFF0000, intensity: 3.0 },
            doomsday: { enabled: level >= 8, devastation: 'massive' }
        },
        'Absolute Zero': {
            globalFreeze: { enabled: true, radius: 300 + (level * 60), temperature: -273 },
            iceAge: { enabled: level >= 7, duration: 10000 },
            crystalFormation: { enabled: true, count: 15 + (level * 3) }
        },
        "God's Wrath": {
            divineStrike: { enabled: true, power: 'infinite', color: 0xFFFFFF },
            holyFire: { enabled: true, purification: true, radius: 400 + (level * 80) },
            judgment: { enabled: level >= 9, severity: 'absolute' }
        },
        'Continental Drift': {
            tectonic: { enabled: true, magnitude: 8.0 + level, radius: 1000 },
            landslide: { enabled: true, scale: 'massive' },
            cataclysm: { enabled: level >= 6, reshapeMap: true }
        },
        'Atmospheric Collapse': {
            hurricane: { enabled: true, category: 5 + level, radius: 500 + (level * 100) },
            tornado: { enabled: true, f5Scale: true, multiple: level >= 5 },
            weatherControl: { enabled: true, scope: 'regional' }
        },
        'Reality Erasure': {
            dimensionalRift: { enabled: true, size: 'massive', stability: 'unstable' },
            existentialVoid: { enabled: level >= 8, erasure: 'complete' },
            cosmicDistortion: { enabled: true, spacetime: 'warped' }
        },
        'Genesis Burst': {
            creation: { enabled: true, scope: 'universal', energy: 'infinite' },
            bigBang: { enabled: level >= 10, newUniverse: true },
            primordialForce: { enabled: true, power: 'absolute' }
        },
        'Death Incarnate': {
            reaper: { enabled: true, souls: 'harvest', range: 'unlimited' },
            necromancy: { enabled: true, undead: 'infinite', control: 'absolute' },
            entropy: { enabled: level >= 7, decay: 'universal' }
        }
    };
    return specialEffects[spellName] || { basic: { enabled: true, power: level } };
}

// Initialize scroll spawns
function initializeScrollSpawns() {
    gameState.scrollSpawnPoints.forEach((point, index) => {
        setTimeout(() => {
            spawnScrollAtPoint(point, index);
            setInterval(() => spawnScrollAtPoint(point, index), point.spawnTime);
        }, Math.random() * 10000);
    });

    // Random scroll spawns
    setInterval(() => {
        spawnRandomScroll();
    }, 20000);
}

// Biome management functions
function changeBiome() {
    const biomeNames = Object.keys(biomes);
    let newBiome;
    do {
        newBiome = biomeNames[Math.floor(Math.random() * biomeNames.length)];
    } while (newBiome === gameState.currentBiome);

    gameState.currentBiome = newBiome;
    gameState.biomeChangeTime = Date.now() + 900000; // Next change in 15 minutes

    // Clear existing animals
    gameState.animals.clear();

    // Spawn new biome-specific animals


    // Notify all players
    io.emit('biomeChanged', {
        biome: newBiome,
        biomeData: biomes[newBiome],
        nextChangeTime: gameState.biomeChangeTime
    });

    console.log(`Biome changed to: ${biomes[newBiome].name}`);
}

function spawnBiomeAnimals() {
    // Animal spawning removed
}

function spawnAnimal(type) {

}

function isPositionOccupied(x, y, minDistance = 50) {
    // Check scrolls
    const scrollOccupied = Array.from(gameState.scrolls.values()).some(scroll => {
        const dx = scroll.x - x;
        const dy = scroll.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < minDistance;
    });

    // Check animals
    const animalOccupied = Array.from(gameState.animals.values()).some(animal => {
        const dx = animal.x - x;
        const dy = animal.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < minDistance;
    });

    return scrollOccupied;
}

// Initialize biome system
function initializeBiomeSystem() {
    // Set initial biome
    // Animal spawning removed

    // Send initial biome to players
    io.emit('biomeChanged', {
        biome: gameState.currentBiome,
        biomeData: biomes[gameState.currentBiome],
        nextChangeTime: gameState.biomeChangeTime
    });

    // Check for biome changes every minute
    setInterval(() => {
        if (Date.now() >= gameState.biomeChangeTime) {
            changeBiome();
        }
    }, 60000);
}

function isScrollPositionOccupied(x, y, minDistance = 80) {
    return Array.from(gameState.scrolls.values()).some(scroll => {
        const dx = scroll.x - x;
        const dy = scroll.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < minDistance;
    });
}

function spawnScrollAtPoint(point, pointIndex) {
    // Check if position is already occupied
    if (isScrollPositionOccupied(point.x, point.y)) {
        return; // Don't spawn if position is occupied
    }

    const scrollId = `fixed_${pointIndex}_${Date.now()}`;
    const scroll = {
        id: scrollId,
        x: point.x,
        y: point.y,
        type: point.type,
        rarity: magicTypes[point.type].rarity,
        spawnTime: Date.now()
    };

    gameState.scrolls.set(scrollId, scroll);
    io.emit('scrollSpawned', scroll);
}

function spawnRandomScroll() {
    const types = Object.keys(magicTypes);
    const randomType = types[Math.floor(Math.random() * types.length)];
    const scrollId = `random_${Date.now()}`;

    // Find non-overlapping position
    let x, y, attempts = 0;
    do {
        x = Math.random() * 5600 + 200;
        y = Math.random() * 5600 + 200;
        attempts++;
    } while (isScrollPositionOccupied(x, y) && attempts < 50);

    const scroll = {
        id: scrollId,
        x: x,
        y: y,
        type: randomType,
        rarity: magicTypes[randomType].rarity,
        spawnTime: Date.now()
    };

    gameState.scrolls.set(scrollId, scroll);
    io.emit('scrollSpawned', scroll);
}

// Socket.io connection handling
// Add server-side error handling
process.on('unhandledRejection', (reason, promise) => {
    // Suppress console warnings for common socket/connection issues
    if (reason && typeof reason === 'object' && 
        (reason.message?.includes('socket') || 
         reason.message?.includes('WebSocket') || 
         reason.message?.includes('disconnect'))) {
        return;
    }
    console.warn('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
    // Suppress console warnings for common socket/connection issues
    if (error && error.message && 
        (error.message.includes('socket') || 
         error.message.includes('WebSocket') || 
         error.message.includes('disconnect'))) {
        return;
    }
    console.warn('Uncaught exception:', error);
});

io.on('connection', async (socket) => {
    console.log('Player connected:', socket.id);

    // Create or load player
    let player;
    if (MONGODB_URI) {
        try {
            player = await Player.findOne({ socketId: socket.id });
            if (!player) {
                player = new Player({
                    socketId: socket.id,
                    name: `Player${Math.floor(Math.random() * 1000)}`,
                    x: Math.random() * 800 + 100,
                    y: Math.random() * 500 + 100,
                    level: 1,
                    experience: 0,
                    health: 100,
                    maxHealth: 100,
                    magicLevels: {
                        fire: 0,
                        ice: 0,
                        lightning: 0,
                        earth: 0,
                        wind: 0,
                        shadow: 0,
                        light: 0,
                        void: 0,
                        soul: 0
                    }
                });
                await player.save();
            } else {
                player.socketId = socket.id;
                await player.save();
            }
        } catch (error) {
            console.error('Error loading player:', error);
            player = createNewPlayer(socket.id);
        }
    } else {
        player = createNewPlayer(socket.id);
    }

    function createNewPlayer(socketId) {
        return {
            socketId: socketId,
            name: `Player${Math.floor(Math.random() * 1000)}`,
            x: Math.random() * 5000 + 500,
            y: Math.random() * 5000 + 500,
            level: 1,
            experience: 0,
            health: 100,
            maxHealth: 100,
            magicLevels: {
                fire: 0,
                ice: 0,
                lightning: 0,
                earth: 0,
                wind: 0,
                shadow: 0,
                light: 0,
                void: 0,
                soul: 0
            },
            selectedSpells: {
                fire: 'Fireball',
                ice: 'Water Bullet',
                lightning: 'Lightning Bolt',
                earth: 'Earth Wall',
                wind: 'Wind Blast',
                shadow: 'Dark Hole',
                light: 'Light Beam',
                void: 'Void Blast',
                soul: 'Soul Drain'
            }
        };
    }



    gameState.players.set(socket.id, player);

    // Send initial game state
    socket.emit('gameState', {
        player: player,
        players: Array.from(gameState.players.values()),
        scrolls: Array.from(gameState.scrolls.values()),
        animals: Array.from(gameState.animals.values()),
        biome: gameState.currentBiome,
        biomeData: biomes[gameState.currentBiome],
        nextBiomeChange: gameState.biomeChangeTime
    });

    // Broadcast new player to others
    socket.broadcast.emit('playerJoined', player);

    // Handle player movement
    socket.on('playerMove', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            player.x = data.x;
            player.y = data.y;
            player.rotation = data.rotation;
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: data.x,
                y: data.y,
                rotation: data.rotation
            });
        }
    });

    // Handle spell casting
    socket.on('castSpell', (data) => {
        const player = gameState.players.get(socket.id);
        if (player && player.magicLevels[data.type] > 0) {
            const spellId = `spell_${Date.now()}_${socket.id}`;
            const selectedSpell = player.selectedSpells[data.type];
            const spellLevel = player.magicLevels[data.type];

            // Calculate damage based on spell level and selected spell
            let baseDamage = magicTypes[data.type].playerDamage;
            let spellMultiplier = 1;

            if (spellLevel === 2) spellMultiplier = 1.5;
            else if (spellLevel === 3) spellMultiplier = 2;

            const spell = {
                id: spellId,
                playerId: socket.id,
                type: data.type,
                spellName: selectedSpell,
                level: spellLevel,
                x: data.x,
                y: data.y,
                targetX: data.targetX,
                targetY: data.targetY,
                damage: Math.floor(baseDamage * spellMultiplier),
                createdAt: Date.now()
            };

            gameState.spells.set(spellId, spell);
            io.emit('spellCast', spell);

            // Enhanced spell animation broadcasting - ensure all visual effects are sent
            console.log(`Broadcasting ${data.type} spell: ${selectedSpell} (Level ${spellLevel})`);
            
            io.emit('spellAnimation', {
                playerId: socket.id,
                spellId: spellId,
                type: data.type,
                spellName: selectedSpell,
                level: spellLevel,
                x: data.x,
                y: data.y,
                targetX: data.targetX,
                targetY: data.targetY,
                playerName: player.name,
                color: magicTypes[data.type].color,
                damage: Math.floor(baseDamage * spellMultiplier),
                timestamp: Date.now()
            });

            // Broadcast spell projectile data for enhanced visual effects
            io.emit('spellProjectile', {
                spellId: spellId,
                playerId: socket.id,
                type: data.type,
                spellName: selectedSpell,
                level: spellLevel,
                startX: data.x,
                startY: data.y,
                endX: data.targetX,
                endY: data.targetY,
                color: magicTypes[data.type].color,
                speed: getSpellSpeed(data.type),
                trail: getSpellTrail(data.type),
                particles: getSpellParticles(data.type, spellLevel)
            });

            // Broadcast enhanced spell effects for all magic types
            io.emit('enhancedSpellEffects', {
                spellId: spellId,
                playerId: socket.id,
                type: data.type,
                spellName: selectedSpell,
                level: spellLevel,
                x: data.x,
                y: data.y,
                targetX: data.targetX,
                targetY: data.targetY,
                impactEffects: getSpellImpactEffects(data.type, spellLevel),
                environmentEffects: getSpellEnvironmentEffects(data.type),
                specialEffects: getSpellSpecialEffects(selectedSpell, spellLevel),
                timestamp: Date.now()
            });

            // Remove spell after duration
            setTimeout(() => {
                gameState.spells.delete(spellId);
                io.emit('spellExpired', spellId);
            }, 3000);
        }
    });

    // Handle transformation animations
    socket.on('transformationAnimation', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            // Enhanced transformation animation broadcasting with visual effects
            io.emit('transformationAnimation', {
                playerId: socket.id,
                transformationType: data.transformationType,
                animationType: data.animationType,
                x: data.x || player.x,
                y: data.y || player.y,
                targetX: data.targetX,
                targetY: data.targetY,
                playerName: player.name,
                timestamp: Date.now()
            });

            // Broadcast transformation visual effects
            io.emit('transformationEffects', {
                playerId: socket.id,
                transformationType: data.transformationType,
                phase: data.phase || 'start',
                x: data.x || player.x,
                y: data.y || player.y,
                intensity: data.intensity || 1.0,
                duration: data.duration || 2000,
                particles: getTransformationParticles(data.transformationType),
                aura: getTransformationAura(data.transformationType)
            });
        }
    });

    // Handle special attack animations
    socket.on('attackAnimation', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            // Enhanced special attack animation broadcasting
            io.emit('attackAnimation', {
                playerId: socket.id,
                attackType: data.attackType,
                x: data.x,
                y: data.y,
                targetX: data.targetX,
                targetY: data.targetY,
                damage: data.damage,
                playerName: player.name,
                timestamp: Date.now()
            });

            // Broadcast enhanced attack visual effects
            io.emit('attackEffects', {
                playerId: socket.id,
                attackType: data.attackType,
                startX: data.x,
                startY: data.y,
                endX: data.targetX,
                endY: data.targetY,
                damage: data.damage,
                effects: getAttackEffects(data.attackType),
                shockwave: getAttackShockwave(data.attackType),
                screenShake: getAttackScreenShake(data.attackType)
            });
        }
    });

    // Handle statue interactions
    socket.on('statueAnimation', (data) => {
        // Broadcast statue animations to all players
        io.emit('statueAnimation', {
            statueId: data.statueId,
            animationType: data.animationType,
            x: data.x,
            y: data.y,
            playerId: socket.id
        });
    });

    // Handle transformation activation
    socket.on('transformationActivated', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            player.activeTransformation = data.transformationType;
            
            // Broadcast transformation activation to all players
            io.emit('playerTransformed', {
                playerId: socket.id,
                transformationType: data.transformationType,
                x: player.x,
                y: player.y,
                playerName: player.name
            });
        }
    });

    // Handle transformation deactivation
    socket.on('transformationDeactivated', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            player.activeTransformation = null;
            
            // Broadcast transformation deactivation to all players
            io.emit('playerTransformationEnded', {
                playerId: socket.id,
                transformationType: data.transformationType,
                x: data.x,
                y: data.y,
                playerName: player.name
            });
        }
    });

    // Handle transformation skill usage
    socket.on('transformationSkillUsed', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            // Broadcast skill usage to all players
            io.emit('transformationSkillUsed', {
                playerId: socket.id,
                transformationType: data.transformationType,
                skillKey: data.skillKey,
                skillName: data.skillName,
                x: data.x,
                y: data.y,
                playerName: player.name
            });
        }
    });

    // Handle scroll collection
    socket.on('collectScroll', async (scrollId) => {
        const scroll = gameState.scrolls.get(scrollId);
        const player = gameState.players.get(socket.id);

        if (scroll && player) {
            console.log(`Player ${socket.id} collecting ${scroll.type} scroll`);

            // Void magic cannot be collected from scrolls - only unlocked through dungeon
            if (scroll.type === 'void') {
                console.log(`Void scroll cannot be collected - dungeon only`);
                return;
            }

            // Check if player already has this magic type
            if (player.magicLevels[scroll.type] > 0) {
                console.log(`Player already has ${scroll.type} magic`);
                return;
            }

            // Learning new magic type - set the CORRECT type to level 1
            player.magicLevels[scroll.type] = 1;
            console.log(`Player learned ${scroll.type} magic:`, player.magicLevels);

            // Remove scroll from game state
            gameState.scrolls.delete(scrollId);

            // Save to database if MongoDB is available
            if (MONGODB_URI) {
                try {
                    await Player.findOneAndUpdate(
                        { socketId: socket.id },
                        {
                            magicLevels: player.magicLevels,
                            experience: player.experience,
                            level: player.level,
                            maxHealth: player.maxHealth,
                            health: player.health
                        }
                    );
                } catch (error) {
                    console.error('Error saving player progress:', error);
                }
            }

            // Notify all players
            io.emit('scrollCollected', { scrollId, playerId: socket.id });
            socket.emit('playerUpdated', player);
        }
    });

    // Handle experience gain
    socket.on('gainExperience', async (expAmount) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            player.experience += expAmount;

            // Level up check
            const requiredExp = player.level * 100;
            if (player.experience >= requiredExp) {
                player.level++;
                player.experience = 0; // Reset experience to 0
                player.maxHealth += 20;
                player.health = player.maxHealth;
            }

            // Save to database if MongoDB is available
            if (MONGODB_URI) {
                try {
                    await Player.findOneAndUpdate(
                        { socketId: socket.id },
                        {
                            experience: player.experience,
                            level: player.level,
                            maxHealth: player.maxHealth,
                            health: player.health
                        }
                    );
                } catch (error) {
                    console.error('Error saving player progress:', error);
                }
            }

            socket.emit('playerUpdated', player);
        }
    });

    socket.on('unlockSoulMagic', () => {
        console.log(`Player ${socket.id} unlocking soul magic`);

        if (gameState.players.has(socket.id)) {
            const player = gameState.players.get(socket.id);
            player.magicLevels.soul = 1;

            // Broadcast updated player to all clients
            io.emit('playerUpdated', player);
            console.log(`Player ${socket.id} unlocked soul magic:`, player.magicLevels);
        }
    });

    socket.on('levelUpSoulMagic', (newLevel) => {
        console.log(`Player ${socket.id} leveling up soul magic to ${newLevel}`);

        if (gameState.players.has(socket.id)) {
            const player = gameState.players.get(socket.id);
            player.magicLevels.soul = Math.min(10, newLevel);

            // Broadcast updated player to all clients
            io.emit('playerUpdated', player);
            console.log(`Player ${socket.id} soul magic level:`, player.magicLevels.soul);
        }
    });

    socket.on('healthRegen', (data) => {
        if (gameState.players.has(socket.id)) {
            const player = gameState.players.get(socket.id);
            player.health = Math.min(data.health, player.maxHealth);

            // Broadcast updated health to all clients
            io.emit('playerUpdated', player);
        }
    });

    // Handle player heal
    socket.on('healPlayer', (healAmount) => {
        const players = gameState.players;
        const player = players.get(socket.id);
        if (player) {
            player.health = Math.min(player.maxHealth, player.health + healAmount);
            
            // Broadcast healing wave effect
            io.emit('healingWaveEffect', {
                playerId: socket.id,
                healAmount: healAmount,
                x: player.x,
                y: player.y,
                playerName: player.name,
                effects: getHealingWaveEffects(healAmount),
                timestamp: Date.now()
            });
            
            io.emit('playerUpdated', player);
        }
    });

    // Handle healing wave spell
    socket.on('castHealingWave', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            // Broadcast healing wave effect to all players
            io.emit('healingWaveEffect', {
                playerId: socket.id,
                spellType: 'healing_wave',
                x: data.x || player.x,
                y: data.y || player.y,
                targetX: data.targetX,
                targetY: data.targetY,
                radius: data.radius || 200,
                healAmount: data.healAmount || 50,
                playerName: player.name,
                effects: getHealingWaveEffects(data.healAmount || 50),
                timestamp: Date.now()
            });
        }
    });

    // Handle status effect application
    socket.on('applyStatusEffect', (data) => {
        const targetPlayer = gameState.players.get(data.targetId);
        if (targetPlayer) {
            // Broadcast status effect to all players
            io.emit('statusEffectApplied', {
                targetId: data.targetId,
                casterId: socket.id,
                statusType: data.statusType,
                duration: data.duration,
                x: targetPlayer.x,
                y: targetPlayer.y,
                effects: getStatusEffects(data.statusType, data.duration),
                timestamp: Date.now()
            });
        }
    });

    // Handle player damage
    socket.on('playerHit', async (data) => {
        const targetPlayer = gameState.players.get(data.targetId);
        if (targetPlayer) {
            targetPlayer.health -= data.damage;

            // Enhanced damage effect broadcasting
            io.emit('damageEffect', {
                targetId: data.targetId,
                attackerId: socket.id,
                damage: data.damage,
                spellType: data.spellType,
                x: targetPlayer.x,
                y: targetPlayer.y,
                effects: getDamageEffects(data.spellType, data.damage),
                timestamp: Date.now()
            });

            if (targetPlayer.health <= 0) {
                // Broadcast death effect
                io.emit('playerDeathEffect', {
                    playerId: data.targetId,
                    killerId: socket.id,
                    x: targetPlayer.x,
                    y: targetPlayer.y,
                    spellType: data.spellType,
                    effects: getDeathEffects(data.spellType)
                });

                targetPlayer.health = targetPlayer.maxHealth;
                targetPlayer.x = Math.random() * 800 + 100;
                targetPlayer.y = Math.random() * 500 + 100;

                // Give experience and magic upgrade to attacker
                const attacker = gameState.players.get(socket.id);
                if (attacker) {
                    attacker.experience += 25;

                    // Upgrade magic level for the spell used (up to level 10 for SSS spells)
                    // EXCEPT for soul magic - soul magic can only be leveled by killing statues
                    if (data.spellType && data.spellType !== 'soul' && attacker.magicLevels[data.spellType] > 0) {
                        attacker.magicLevels[data.spellType] = Math.min(10, attacker.magicLevels[data.spellType] + 1);
                    }

                    // Level up check
                    const requiredExp = attacker.level * 100;
                    if (attacker.experience >= requiredExp) {
                        attacker.level++;
                        attacker.experience = 0; // Reset experience to 0
                        attacker.maxHealth += 20;
                        attacker.health = attacker.maxHealth;

                        // Broadcast level up effect
                        io.emit('levelUpEffect', {
                            playerId: socket.id,
                            newLevel: attacker.level,
                            x: attacker.x,
                            y: attacker.y,
                            effects: getLevelUpEffects()
                        });
                    }

                    socket.emit('playerUpdated', attacker);
                }

                io.emit('playerRespawned', targetPlayer);
            } else {
                io.emit('playerDamaged', { 
                    playerId: data.targetId, 
                    health: targetPlayer.health,
                    maxHealth: targetPlayer.maxHealth,
                    damage: data.damage,
                    spellType: data.spellType
                });
            }

            // Save player state if MongoDB is available
            if (MONGODB_URI) {
                try {
                    await Player.findOneAndUpdate(
                        { socketId: data.targetId },
                        {
                            health: targetPlayer.health,
                            x: targetPlayer.x,
                            y: targetPlayer.y
                        }
                    );
                } catch (error) {
                    console.error('Error saving player state:', error);
                }
            }
        }
    });

    // Handle spell selection
    socket.on('selectSpell', async (data) => {
        const player = gameState.players.get(socket.id);
        if (player && player.selectedSpells) {
            player.selectedSpells[data.magicType] = data.spellName;

            // Save to database if MongoDB is available
            if (MONGODB_URI) {
                try {
                    await Player.findOneAndUpdate(
                        { socketId: socket.id },
                        { selectedSpells: player.selectedSpells }
                    );
                } catch (error) {
                    console.error('Error saving spell selection:', error);
                }
            }

            socket.emit('playerUpdated', player);
        }
    });

    // Handle void magic unlock
    socket.on('unlockVoidMagic', async () => {
        const player = gameState.players.get(socket.id);
        if (player) {
            player.magicLevels.void = 1;

            // Save to database if MongoDB is available
            if (MONGODB_URI) {
                try {
                    await Player.findOneAndUpdate(
                        { socketId: socket.id },
                        { magicLevels: player.magicLevels }
                    );
                } catch (error) {
                    console.error('Error saving void magic unlock:', error);
                }
            }

            socket.emit('playerUpdated', player);
        }
    });

    // Handle animal damage
    socket.on('animalHit', async (data) => {

    });

    // Handle animal attacking player
    socket.on('animalAttackPlayer', (data) => {

    });

    // Handle player name update
    socket.on('updatePlayerName', async (newName) => {
        const player = gameState.players.get(socket.id);
        if (player && newName && newName.length <= 20) {
            player.name = newName;

            // Save to database if MongoDB is available
            if (MONGODB_URI) {
                try {
                    await Player.findOneAndUpdate(
                        { socketId: socket.id },
                        { name: newName }
                    );
                } catch (error) {
                    console.error('Error saving player name:', error);
                }
            }

            socket.emit('playerUpdated', player);
            socket.broadcast.emit('playerNameUpdated', { playerId: socket.id, name: newName });
        }
    });

    // Handle blood effect from Blood Lust transformation
    socket.on('bloodEffect', (data) => {
        const targetPlayer = gameState.players.get(data.targetId);
        if (targetPlayer) {
            // Apply 5-second paralysis effect (server-side tracking)
            targetPlayer.paralyzed = true;
            targetPlayer.paralysisEnd = Date.now() + 5000; // 5 seconds

            // Notify target player about blood effect
            io.to(data.targetId).emit('bloodEffectReceived', {
                duration: 5000,
                attackerId: socket.id
            });

            // Auto-remove paralysis after 5 seconds
            setTimeout(() => {
                if (targetPlayer.paralysisEnd && Date.now() >= targetPlayer.paralysisEnd) {
                    targetPlayer.paralyzed = false;
                    targetPlayer.paralysisEnd = 0;
                    io.to(data.targetId).emit('bloodEffectEnded');
                }
            }, 5000);
        }
    });

    // Admin functionality
    socket.on('requestPlayerList', () => {
        const playerList = [];
        gameState.players.forEach((player, id) => {
            // Get the socket for this player ID
            const playerSocket = io.sockets.sockets.get(id);
            let ipAddress = 'Unknown';

            if (playerSocket) {
                // Try different ways to get IP address
                ipAddress = playerSocket.handshake.headers['x-forwarded-for'] || 
                           playerSocket.handshake.headers['x-real-ip'] || 
                           playerSocket.handshake.address || 
                           playerSocket.conn.remoteAddress || 
                           'Hidden';

                // If x-forwarded-for contains multiple IPs, take the first one
                if (ipAddress.includes(',')) {
                    ipAddress = ipAddress.split(',')[0].trim();
                }
            }

            playerList.push({
                id: id,
                name: player.name,
                level: player.level,
                ipAddress: ipAddress
            });
        });
        socket.emit('playerListUpdate', playerList);
    });

    socket.on('adminSetMaxLevel', () => {
        const player = gameState.players.get(socket.id);
        if (player) {
            player.level = 100;
            player.experience = 0;
            player.maxHealth = 2000;
            player.health = 2000;

            // Unlock all magic types
            Object.keys(player.magicLevels).forEach(type => {
                player.magicLevels[type] = 10;
            });

            socket.emit('playerUpdated', player);
        }
    });

    socket.on('adminToggleGodMode', () => {
        const player = gameState.players.get(socket.id);
        if (player) {
            if (!player.godMode) {
                player.godMode = true;
                player.originalMaxHealth = player.maxHealth;
                player.maxHealth = 999999;
                player.health = 999999;
            } else {
                player.godMode = false;
                player.maxHealth = player.originalMaxHealth || 100;
                player.health = player.maxHealth;
            }

            socket.emit('playerUpdated', player);
        }
    });

    // Handle divine summon skill (Z skill for admin transformation)
    socket.on('divineSummon', (data) => {
        // Get nearby players
        const casterPlayer = gameState.players.get(socket.id);
        if (!casterPlayer) return;

        gameState.players.forEach((player, playerId) => {
            if (playerId !== socket.id) {
                const dx = player.x - casterPlayer.x;
                const dy = player.y - casterPlayer.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 300) { // Within range
                    io.to(playerId).emit('showWishPrompt', {
                        adminId: socket.id,
                        adminName: casterPlayer.name
                    });
                }
            }
        });
    });

    // Handle wish submission
    socket.on('submitWish', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            // Send wish to admin
            io.to(data.adminId).emit('playerWish', {
                playerId: socket.id,
                playerName: player.name,
                wish: data.wish
            });
        }
    });

    // Handle rainbow divine blast (X skill for admin transformation)
    socket.on('rainbowBlast', (data) => {
        const spellId = `rainbow_blast_${Date.now()}_${socket.id}`;
        const spell = {
            id: spellId,
            playerId: socket.id,
            type: 'rainbow',
            spellName: 'Rainbow Divine Blast',
            level: 10,
            x: data.x,
            y: data.y,
            targetX: data.targetX,
            targetY: data.targetY,
            damage: 999,
            createdAt: Date.now(),
            isAdmin: true
        };

        gameState.spells.set(spellId, spell);
        io.emit('spellCast', spell);

        // Remove spell after duration
        setTimeout(() => {
            gameState.spells.delete(spellId);
            io.emit('spellExpired', spellId);
        }, 5000);
    });

    // Handle heavenly healing (Q skill for admin transformation)
    socket.on('heavenlyHealing', () => {
        const casterPlayer = gameState.players.get(socket.id);
        if (!casterPlayer) return;

        // Heal all players
        gameState.players.forEach((player, playerId) => {
            player.health = player.maxHealth;
            io.emit('playerUpdated', player);

            // Show healing effect
            io.to(playerId).emit('healingEffect', {
                adminId: socket.id,
                adminName: casterPlayer.name
            });
        });

        // Broadcast healing wave visual effect
        io.emit('healingWaveEffect', {
            casterId: socket.id,
            casterName: casterPlayer.name,
            x: casterPlayer.x,
            y: casterPlayer.y,
            radius: 1000,
            intensity: 2.0
        });
    });

    // Handle all transformation skill broadcasting
    socket.on('phoenixDive', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            io.emit('transformationSkillUsed', {
                playerId: socket.id,
                skillType: 'phoenixDive',
                transformationType: 'phoenix_emperor',
                x: player.x,
                y: player.y,
                targetX: data.targetX,
                targetY: data.targetY,
                playerName: player.name,
                effects: getSkillEffects('phoenixDive')
            });
        }
    });

    socket.on('rebirthFlames', () => {
        const player = gameState.players.get(socket.id);
        if (player) {
            io.emit('transformationSkillUsed', {
                playerId: socket.id,
                skillType: 'rebirthFlames',
                transformationType: 'phoenix_emperor',
                x: player.x,
                y: player.y,
                playerName: player.name,
                effects: getSkillEffects('rebirthFlames')
            });
        }
    });

    socket.on('voidTsunami', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            io.emit('transformationSkillUsed', {
                playerId: socket.id,
                skillType: 'voidTsunami',
                transformationType: 'void_leviathan_king',
                x: player.x,
                y: player.y,
                targetX: data.targetX,
                targetY: data.targetY,
                playerName: player.name,
                effects: getSkillEffects('voidTsunami')
            });
        }
    });

    socket.on('dimensionalCoil', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            io.emit('transformationSkillUsed', {
                playerId: socket.id,
                skillType: 'dimensionalCoil',
                transformationType: 'void_leviathan_king',
                x: player.x,
                y: player.y,
                targetX: data.targetX,
                targetY: data.targetY,
                playerName: player.name,
                effects: getSkillEffects('dimensionalCoil')
            });
        }
    });

    socket.on('cosmicDevastation', () => {
        const player = gameState.players.get(socket.id);
        if (player) {
            io.emit('transformationSkillUsed', {
                playerId: socket.id,
                skillType: 'cosmicDevastation',
                transformationType: 'void_leviathan_king',
                x: player.x,
                y: player.y,
                playerName: player.name,
                effects: getSkillEffects('cosmicDevastation')
            });
        }
    });

    socket.on('divineLightningPounce', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            io.emit('transformationSkillUsed', {
                playerId: socket.id,
                skillType: 'divineLightningPounce',
                transformationType: 'celestial_tiger_god',
                x: player.x,
                y: player.y,
                targetX: data.targetX,
                targetY: data.targetY,
                playerName: player.name,
                effects: getSkillEffects('divineLightningPounce')
            });
        }
    });

    socket.on('celestialRoar', () => {
        const player = gameState.players.get(socket.id);
        if (player) {
            io.emit('transformationSkillUsed', {
                playerId: socket.id,
                skillType: 'celestialRoar',
                transformationType: 'celestial_tiger_god',
                x: player.x,
                y: player.y,
                playerName: player.name,
                effects: getSkillEffects('celestialRoar')
            });
        }
    });

    socket.on('bloodTsunami', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            io.emit('transformationSkillUsed', {
                playerId: socket.id,
                skillType: 'bloodTsunami',
                transformationType: 'bloodLust',
                x: player.x,
                y: player.y,
                targetX: data.targetX,
                targetY: data.targetY,
                playerName: player.name,
                effects: getSkillEffects('bloodTsunami')
            });
        }
    });

    socket.on('crimsonBlitz', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            io.emit('transformationSkillUsed', {
                playerId: socket.id,
                skillType: 'crimsonBlitz',
                transformationType: 'bloodLust',
                x: player.x,
                y: player.y,
                targetX: data.targetX,
                targetY: data.targetY,
                playerName: player.name,
                effects: getSkillEffects('crimsonBlitz')
            });
        }
    });

    socket.on('sixTailBarrage', () => {
        const player = gameState.players.get(socket.id);
        if (player) {
            io.emit('transformationSkillUsed', {
                playerId: socket.id,
                skillType: 'sixTailBarrage',
                transformationType: 'bloodLust',
                x: player.x,
                y: player.y,
                playerName: player.name,
                effects: getSkillEffects('sixTailBarrage')
            });
        }
    });

    // Handle universal transformation skill broadcasting
    socket.on('transformationSkillUsed', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            io.emit('transformationSkillUsed', {
                playerId: socket.id,
                skillType: data.skillType,
                transformationType: data.transformationType,
                skillKey: data.skillKey,
                skillName: data.skillName,
                x: data.x || player.x,
                y: data.y || player.y,
                targetX: data.targetX,
                targetY: data.targetY,
                playerName: player.name,
                timestamp: Date.now(),
                effects: getSkillEffects(data.skillType)
            });
        }
    });

    // Handle wish granting
    socket.on('grantWish', (data) => {
        const targetPlayer = gameState.players.get(data.playerId);
        if (targetPlayer) {
            // Grant some benefits based on the wish
            targetPlayer.experience += 500;
            targetPlayer.health = targetPlayer.maxHealth;

            // Check for level up
            const requiredExp = targetPlayer.level * 100;
            if (targetPlayer.experience >= requiredExp) {
                targetPlayer.level++;
                targetPlayer.experience = 0;
                targetPlayer.maxHealth += 20;
                targetPlayer.health = targetPlayer.maxHealth;
            }

            io.emit('playerUpdated', targetPlayer);
            io.to(data.playerId).emit('wishGranted', {
                message: `Your wish has been granted by the admin! "${data.wish}"`
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
        console.log('Player disconnected:', socket.id);
        gameState.players.delete(socket.id);
        socket.broadcast.emit('playerLeft', socket.id);

        // Save final player state if MongoDB is available
        if (MONGODB_URI) {
            try {
                const player = gameState.players.get(socket.id);
                if (player) {
                    await Player.findOneAndUpdate(
                        { socketId: socket.id },
                        { lastSeen: new Date() }
                    );
                }
            } catch (error) {
                console.error('Error saving player on disconnect:', error);
            }
        }
    });

     // Helper function for handling player death
     function handlePlayerDeath(playerId, killerId) {
        const player = gameState.players.get(playerId);
        const killer = gameState.players.get(killerId);

        if (player) {
            player.health = player.maxHealth;
            player.x = Math.random() * 800 + 100;
            player.y = Math.random() * 500 + 100;

            if (killer) {
                killer.experience += 25;

                if (killer.magicLevels[data.spellType] > 0) {
                    killer.magicLevels[data.spellType] = Math.min(10, killer.magicLevels[data.spellType] + 1);
                }

                const requiredExp = killer.level * 100;
                if (killer.experience >= requiredExp) {
                    killer.level++;
                    killer.experience = 0;
                    killer.maxHealth += 20;
                    killer.health = killer.maxHealth;
                }

                socket.emit('playerUpdated', killer);
            }

            io.emit('playerRespawned', player);
        }
    }
});

// Start scroll spawning and biome system
initializeScrollSpawns();
initializeBiomeSystem();

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});