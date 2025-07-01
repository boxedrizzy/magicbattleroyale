class Client {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.init();
    }

    init() {
        this.connect();
        this.setupEventListeners();
    }

    connect() {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}`;

        this.socket = io(wsUrl);

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.connected = true;
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.connected = false;
        });

        // Game state events
        this.socket.on('gameState', (data) => {
            console.log('Received game state:', data);

            // Initialize current player
            if (data.player) {
                game.addPlayer(data.player);
                ui.updatePlayerInfo(data.player);
            }

            // Add other players
            data.players.forEach(player => {
                if (player.socketId !== this.socket.id) {
                    game.addPlayer(player);
                }
            });

            // Add scrolls
            data.scrolls.forEach(scroll => {
                game.addScroll(scroll);
            });

            // Add animals
            if (data.animals) {
                data.animals.forEach(animal => {
                    if (game && game.createAnimal) {
                        const animalSprite = game.createAnimal(animal);
                        if (animalSprite) {
                            game.animals.set(animal.id, animalSprite);
                            game.app.stage.addChild(animalSprite);
                        }
                    }
                });
            }
        });

        this.socket.on('playerJoined', (playerData) => {
            console.log('Player joined:', playerData);
            game.addPlayer(playerData);
        });

        this.socket.on('playerLeft', (playerId) => {
            console.log('Player left:', playerId);
            game.removePlayer(playerId);
        });

        this.socket.on('playerMoved', (data) => {
            game.updatePlayer(data.id, data);
        });

        this.socket.on('playerUpdated', (playerData) => {
            console.log('Player updated:', playerData);
            if (playerData.socketId === this.socket.id) {
                // Check for newly learned magic before updating
                let newMagicLearned = null;
                if (game.currentPlayer && game.currentPlayer.playerData) {
                    const oldMagicLevels = game.currentPlayer.playerData.magicLevels;
                    const newMagicLevels = playerData.magicLevels;

                    // Check each magic type for newly learned magic
                    Object.keys(newMagicLevels).forEach(type => {
                        if (oldMagicLevels[type] === 0 && newMagicLevels[type] > 0) {
                            newMagicLearned = type;
                        }
                    });
                }

                // Update current player reference first
                if (game.currentPlayer) {
                    game.currentPlayer.playerData = playerData;
                    // Update name display if it changed
                    if (game.currentPlayer.nameText) {
                        game.currentPlayer.nameText.text = playerData.name;
                    }
                }

                // Then update UI
                ui.updatePlayerInfo(playerData);

                // Show notification for newly learned magic
                if (newMagicLearned) {
                    ui.showMagicCollectionNotification(newMagicLearned);
                }

                // Update spell selection if needed
                if (game.selectedSpell && playerData.magicLevels[game.selectedSpell] === 0) {
                    // Find first available spell
                    const availableSpells = Object.keys(playerData.magicLevels).filter(type => playerData.magicLevels[type] > 0);
                    game.selectedSpell = availableSpells[0] || null;
                    game.updateSpellSelection();
                }
            } else {
                // Update other player names
                const player = game.players.get(playerData.socketId);
                if (player && player.nameText) {
                    player.nameText.text = playerData.name;
                    player.playerData = playerData;
                }
            }
        });

        this.socket.on('playerDamaged', (data) => {
            const player = game.players.get(data.playerId);
            if (player) {
                // Update health bar
                const healthPercent = data.health / player.playerData.maxHealth;
                player.healthBar.clear();
                player.healthBar.beginFill(healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000);
                player.healthBar.drawRect(-20, -35, 40 * healthPercent, 6);
                player.healthBar.endFill();

                player.playerData.health = data.health;
            }
        });

        this.socket.on('playerRespawned', (playerData) => {
            const player = game.players.get(playerData.socketId);
            if (player) {
                // Create death particles at old position
                game.createDeathParticles(player.x, player.y);

                player.x = playerData.x;
                player.y = playerData.y;
                player.playerData = playerData;

                // Reset health bar
                player.healthBar.clear();
                player.healthBar.beginFill(0x00ff00);
                player.healthBar.drawRect(-20, -35, 40, 6);
                player.healthBar.endFill();
            }

            if (playerData.socketId === this.socket.id) {
                ui.updatePlayerInfo(playerData);
            }
        });

        this.socket.on('playerKilled', (data) => {
            if (data.killerId === this.socket.id) {
                ui.addEnemyDefeat();
            }
        });

        this.socket.on('scrollSpawned', (scrollData) => {
            console.log('Scroll spawned:', scrollData);
            game.addScroll(scrollData);
        });

        // Handle scroll collection
        this.socket.on('scrollCollected', (data) => {
            game.scrolls.delete(data.scrollId);
            const scroll = Array.from(game.app.stage.children).find(child => 
                child.scrollData && child.scrollData.id === data.scrollId
            );
            if (scroll) {
                game.app.stage.removeChild(scroll);
            }
        });

        // Handle biome changes
        this.socket.on('biomeChanged', (data) => {
            game.currentBiome = data.biome;
            game.biomeChangeTime = data.nextChangeTime;
            game.updateWorldBackground();

            if (ui) {
                ui.showBiomeChange(data.biomeData);
            }
        });

        // Handle animal spawning
        // Animal event handlers removed

        // Handle animal damage
        this.socket.on('animalDamaged', (data) => {
            try {
                const animal = game.animals.get(data.animalId);
                if (animal && animal.healthBar) {
                    const healthPercent = data.health / animal.animalData.maxHealth;
                    animal.healthBar.clear();
                    animal.healthBar.beginFill(healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000);
                    animal.healthBar.drawRect(-15, -animal.animalData.size - 10, 30 * healthPercent, 4);
                    animal.healthBar.endFill();
                    animal.animalData.health = data.health;
                }
            } catch (error) {
                console.warn('Error updating animal damage:', error);
            }
        });

        // Handle animal defeat
        // Animal event handlers removed

        this.socket.on('spellCast', (spellData) => {
            console.log('Spell cast:', spellData);
            game.addSpell(spellData);
        });

        this.socket.on('spellExpired', (spellId) => {
            game.removeSpell(spellId);
        });

        // Handle synchronized spell animations
        this.socket.on('spellAnimation', (data) => {
            // Play animation for all players including the caster for consistency
            if (game && game.playSpellAnimation) {
                game.playSpellAnimation(data);
            }
        });

        // Handle synchronized transformation animations
        this.socket.on('transformationAnimation', (data) => {
            // Play animation for all players including the caster for consistency
            if (game && game.playTransformationAnimation) {
                game.playTransformationAnimation(data);
            }
        });

        // Handle synchronized attack animations
        this.socket.on('attackAnimation', (data) => {
            // Play animation for all players including the caster for consistency
            if (game && game.playAttackAnimation) {
                game.playAttackAnimation(data);
            }
        });

        // Handle synchronized statue animations
        this.socket.on('statueAnimation', (data) => {
            game.playStatueAnimation(data);
        });

        // Handle transformation skill usage
        this.socket.on('transformationSkillUsed', (data) => {
            if (data.playerId !== this.socket.id && ui) {
                // Show skill effect for other players
                ui.showSkillEffect(data);
            }
        });

        // Handle enhanced spell projectile effects
        this.socket.on('spellProjectile', (data) => {
            if (game && game.createEnhancedSpellProjectile) {
                game.createEnhancedSpellProjectile(data);
            }
        });

        // Handle transformation effects
        this.socket.on('transformationEffects', (data) => {
            if (game && game.createTransformationEffects) {
                game.createTransformationEffects(data);
            }
        });

        // Handle enhanced attack effects
        this.socket.on('attackEffects', (data) => {
            if (game && game.createAttackEffects) {
                game.createAttackEffects(data);
            }
        });

        // Handle damage effects
        this.socket.on('damageEffect', (data) => {
            if (game && game.showDamageEffect) {
                game.showDamageEffect(data);
            }
        });

        // Handle death effects
        this.socket.on('playerDeathEffect', (data) => {
            if (game && game.showDeathEffect) {
                game.showDeathEffect(data);
            }
        });

        // Handle level up effects
        this.socket.on('levelUpEffect', (data) => {
            if (game && game.showLevelUpEffect) {
                game.showLevelUpEffect(data);
            }
        });

        // Handle healing wave effects
        this.socket.on('healingWaveEffect', (data) => {
            if (game && game.showHealingWaveEffect) {
                game.showHealingWaveEffect(data);
            }
        });

        // Handle player transformation events
        this.socket.on('playerTransformed', (data) => {
            if (data.playerId !== this.socket.id) {
                game.updatePlayerTransformation(data.playerId, data.transformationType);
            }
        });

        this.socket.on('playerTransformationEnded', (data) => {
            if (data.playerId !== this.socket.id) {
                game.removePlayerTransformation(data.playerId);
            }
        });

        this.socket.on('playerNameUpdated', (data) => {
            const player = game.players.get(data.playerId);
            if (player && player.nameText) {
                player.nameText.text = data.name;
                player.playerData.name = data.name;
            }
        });

        // Handle blood effect received
        this.socket.on('bloodEffectReceived', (data) => {
            console.log('Blood effect received!');
            
            // Disable movement for 5 seconds (except magic casting)
            game.isParalyzed = true;
            
            // Create blood screen effect
            ui.createBloodScreenEffect();
            
            // Shake screen
            this.shakeScreen(5000); // 5 seconds
            
            setTimeout(() => {
                game.isParalyzed = false;
            }, data.duration);
        });

        this.socket.on('bloodEffectEnded', () => {
            game.isParalyzed = false;
        });

        // Admin panel handlers
        this.socket.on('playerListUpdate', (playerList) => {
            if (ui.adminPanelVisible) {
                ui.updatePlayerList(playerList);
            }
        });

        this.socket.on('showWishPrompt', (data) => {
            ui.showWishPrompt(data);
        });

        this.socket.on('playerWish', (data) => {
            if (ui.isAdmin) {
                ui.addPlayerWish(data);
            }
        });

        this.socket.on('wishGranted', (data) => {
            ui.showNotification(data.message, 'success');
        });

        this.socket.on('healingEffect', (data) => {
            ui.showHealingEffect(data);
        });
    }

    setupEventListeners() {
        // Check for scroll collection periodically
        setInterval(() => {
            if (game && game.currentPlayer) {
                game.checkScrollCollection();
            }
        }, 100);
    }

    shakeScreen(duration) {
        const startTime = Date.now();
        let shakeIntensity = 15;
        
        const shake = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed < duration) {
                const gameContainer = document.getElementById('gameContainer');
                if (gameContainer) {
                    const shakeX = (Math.random() - 0.5) * shakeIntensity;
                    const shakeY = (Math.random() - 0.5) * shakeIntensity;
                    gameContainer.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
                    
                    // Gradually reduce shake intensity
                    shakeIntensity = 15 * (1 - elapsed / duration);
                }
                requestAnimationFrame(shake);
            } else {
                // Reset transform
                const gameContainer = document.getElementById('gameContainer');
                if (gameContainer) {
                    gameContainer.style.transform = '';
                }
            }
        };
        
        shake();
    }
}

// Initialize client after DOM is loaded
let client;

document.addEventListener('DOMContentLoaded', () => {
    // Wait for game to be initialized
    setTimeout(() => {
        client = new Client();
    }, 100);
});