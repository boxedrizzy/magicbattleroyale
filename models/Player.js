const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    socketId: { type: String, required: true },
    name: { type: String, required: true },
    x: { type: Number, default: 400 },
    y: { type: Number, default: 300 },
    rotation: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
    health: { type: Number, default: 100 },
    maxHealth: { type: Number, default: 100 },
    magicLevels: {
        fire: { type: Number, default: 1 },
        ice: { type: Number, default: 1 },
        lightning: { type: Number, default: 0 },
        earth: { type: Number, default: 0 },
        wind: { type: Number, default: 0 },
        shadow: { type: Number, default: 0 },
        light: { type: Number, default: 0 }
    },
    lastSeen: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Player', playerSchema);
