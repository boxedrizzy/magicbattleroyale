const mongoose = require('mongoose');

const scrollSchema = new mongoose.Schema({
    type: { type: String, required: true },
    rarity: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    spawnTime: { type: Date, default: Date.now },
    collected: { type: Boolean, default: false },
    collectedBy: { type: String, default: null }
});

module.exports = mongoose.model('Scroll', scrollSchema);
