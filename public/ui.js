class UI {
    constructor() {
        this.inventoryInitialized = false;
        this.rarityPopup = document.getElementById('rarityPopup');
        this.gameStartTime = null;
        this.enemiesDefeated = 0;
        this.totalExperience = 0;
        this.setupScreens();
    }

    setupScreens() {
        const playButton = document.getElementById('playButton');
        const respawnButton = document.getElementById('respawnButton');
        const returnToMenuButton = document.getElementById('returnToMenuButton');
        const dungeonButton = document.getElementById('dungeonButton');
        const closeDungeonModal = document.getElementById('closeDungeonModal');
        const enterDungeonButton = document.getElementById('enterDungeonButton');
        const transformationBtn = document.getElementById('transformationBtn');
        const closeTransformationModal = document.getElementById('closeTransformationModal');

        if (playButton) {
            playButton.addEventListener('click', () => this.startGame());
        }

        if (respawnButton) {
            respawnButton.addEventListener('click', () => this.respawnPlayer());
        }

        if (returnToMenuButton) {
            returnToMenuButton.addEventListener('click', () => this.returnToMenu());
        }

        if (dungeonButton) {
            dungeonButton.addEventListener('click', () => this.showDungeonModal());
        }

        if (closeDungeonModal) {
            closeDungeonModal.addEventListener('click', () => this.hideDungeonModal());
        }

        if (enterDungeonButton) {
            enterDungeonButton.addEventListener('click', () => this.enterDungeon());
        }

        if (transformationBtn) {
            transformationBtn.addEventListener('click', () => this.showTransformationModal());
        }

        if (closeTransformationModal) {
            closeTransformationModal.addEventListener('click', () => this.hideTransformationModal());
        }

        // Initialize transformations
        this.initializeTransformations();
    }

    startGame() {
        const nameInput = document.getElementById('playerNameInput');
        const playerName = nameInput.value.trim() || `Player${Math.floor(Math.random() * 1000)}`;

        // Send name to server
        if (client && client.socket) {
            client.socket.emit('updatePlayerName', playerName);
        }

        document.getElementById('playScreen').classList.add('hidden');
        document.getElementById('gameContainer').classList.remove('hidden');
        this.gameStartTime = Date.now();
        this.enemiesDefeated = 0;
        this.totalExperience = 0;
    }

    showDeathScreen(playerData) {
        document.getElementById('gameContainer').classList.add('hidden');
        document.getElementById('deathScreen').classList.remove('hidden');

        // Calculate stats
        const timeAlive = this.gameStartTime ? Math.floor((Date.now() - this.gameStartTime) / 1000) : 0;
        const minutes = Math.floor(timeAlive / 60);
        const seconds = timeAlive % 60;
        const spellsLearned = Object.values(playerData.magicLevels || {}).filter(level => level > 0).length;

        document.getElementById('finalLevel').textContent = playerData.level || 1;
        document.getElementById('spellsLearned').textContent = spellsLearned;
        document.getElementById('enemiesDefeated').textContent = this.enemiesDefeated;
        document.getElementById('timeSurvived').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    respawnPlayer() {
        document.getElementById('deathScreen').classList.add('hidden');
        document.getElementById('gameContainer').classList.remove('hidden');
        this.gameStartTime = Date.now();
        this.enemiesDefeated = 0;

        // Trigger respawn through client
        if (client && client.socket) {
            client.socket.emit('requestRespawn');
        }
    }

    returnToMenu() {
        document.getElementById('deathScreen').classList.add('hidden');
        document.getElementById('playScreen').classList.remove('hidden');
    }

    showDungeonModal() {
        const modal = document.getElementById('dungeonModal');
        const enterButton = document.getElementById('enterDungeonButton');
        const requirements = document.querySelectorAll('.requirement');

        if (game && game.currentPlayer && game.currentPlayer.playerData) {
            const player = game.currentPlayer.playerData;
            let canEnter = true;

            // Check level requirement
            const levelReq = document.querySelector('[data-type="level"]');
            if (player.level >= 5) {
                levelReq.classList.add('met');
            } else {
                levelReq.classList.remove('met');
                canEnter = false;
            }

            // Check magic types requirement
            const magicReq = document.querySelector('[data-type="magic"]');
            const magicTypes = Object.values(player.magicLevels || {}).filter(level => level > 0).length;
            if (magicTypes >= 4) {
                magicReq.classList.add('met');
            } else {
                magicReq.classList.remove('met');
                canEnter = false;
            }

            // Experience requirement removed

            enterButton.disabled = !canEnter;
        }

        modal.classList.remove('hidden');
    }

    hideDungeonModal() {
        document.getElementById('dungeonModal').classList.add('hidden');
    }

    enterDungeon() {
        this.hideDungeonModal();

        if (game && game.currentPlayer) {
            // Start dungeon mode
            this.isDungeonMode = true;
            this.dungeonEnemiesLeft = 8;
            this.dungeonStartTime = Date.now();

            // Hide other players and change environment
            game.players.forEach((player, id) => {
                if (id !== client.socket.id) {
                    player.visible = false;
                }
            });

            // Change world appearance to dungeon
            this.setupDungeonEnvironment();

            // Create dungeon UI
            this.createDungeonUI();

            // Start spawning dungeon enemies
            this.spawnDungeonEnemies();

            this.showNotification('Entered the dungeon! Defeat 8 void creatures to unlock Void Magic!', 'info');
        }
    }

    setupDungeonEnvironment() {
        if (!game || !game.app) return;

        // Store original world appearance
        this.originalBackground = game.app.stage.children[0];
        this.originalEnvironments = [];

        // Hide original world elements
        if (this.originalBackground) {
            this.originalBackground.visible = false;
        }

        // Hide all environmental objects
        game.environments.forEach(env => {
            this.originalEnvironments.push(env);
            env.visible = false;
        });

        // Hide bushes
        if (game.bushes) {
            game.bushes.forEach(bush => {
                this.originalEnvironments.push(bush);
                bush.visible = false;
            });
        }

        // Hide paths and dungeon entrance
        game.app.stage.children.forEach(child => {
            if (child !== this.originalBackground && child.lineStyle) {
                this.originalEnvironments.push(child);
                child.visible = false;
            }
        });

        if (game.dungeonEntrance) {
            game.dungeonEntrance.visible = false;
        }

        // Create grey dungeon floor
        this.dungeonFloor = new PIXI.Graphics();
        this.dungeonFloor.beginFill(0x404040); // Grey floor
        this.dungeonFloor.drawRect(0, 0, game.worldSize.width, game.worldSize.height);
        this.dungeonFloor.endFill();
        game.app.stage.addChildAt(this.dungeonFloor, 0);

        // Add dungeon walls pattern
        this.dungeonWalls = new PIXI.Graphics();
        this.dungeonWalls.lineStyle(2, 0x202020);

        // Create grid pattern for dungeon floor
        for (let x = 0; x < game.worldSize.width; x += 100) {
            this.dungeonWalls.moveTo(x, 0);
            this.dungeonWalls.lineTo(x, game.worldSize.height);
        }
        for (let y = 0; y < game.worldSize.height; y += 100) {
            this.dungeonWalls.moveTo(0, y);
            this.dungeonWalls.lineTo(game.worldSize.width, y);
        }
        game.app.stage.addChild(this.dungeonWalls);

        // Add dark overlay for atmosphere
        this.dungeonOverlay = new PIXI.Graphics();
        this.dungeonOverlay.beginFill(0x000000, 0.3);
        this.dungeonOverlay.drawRect(0, 0, game.worldSize.width, game.worldSize.height);
        this.dungeonOverlay.endFill();
        game.app.stage.addChild(this.dungeonOverlay);
    }

    createDungeonUI() {
        const dungeonUI = document.createElement('div');
        dungeonUI.id = 'dungeonUI';
        dungeonUI.style.position = 'fixed';
        dungeonUI.style.top = '10px';
        dungeonUI.style.right = '10px';
        dungeonUI.style.background = 'rgba(0, 0, 0, 0.8)';
        dungeonUI.style.color = 'white';
        dungeonUI.style.padding = '15px';
        dungeonUI.style.borderRadius = '10px';
        dungeonUI.style.border = '2px solid #8a2be2';
        dungeonUI.style.zIndex = '1001';

        dungeonUI.innerHTML = `
            <h3>🏰 Dungeon Challenge</h3>
            <p class="enemy-counter">Void Creatures: <span id="enemiesLeft">${this.dungeonEnemiesLeft}</span>/8</p>
            <p class="dungeon-info">Defeat all enemies to unlock Void Magic!</p>
        `;

        document.body.appendChild(dungeonUI);
    }

    spawnDungeonEnemies() {
        if (!game || !game.currentPlayer) return;

        game.voidCreatures = game.voidCreatures || new Map();

        // Spawn 8 void creatures around the map
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                const angle = (i / 8) * Math.PI * 2;
                const distance = 200 + Math.random() * 300;
                const creatureX = game.currentPlayer.x + Math.cos(angle) * distance;
                const creatureY = game.currentPlayer.y + Math.sin(angle) * distance;

                this.createVoidCreature(creatureX, creatureY, i);
            }, i * 1000);
        }
    }

    createVoidCreature(x, y, index) {
        if (!game) return;

        const creatureContainer = new PIXI.Container();

        // Void creature body
        const body = new PIXI.Graphics();
        body.beginFill(0x220044);
        body.lineStyle(3, 0x8800ff);
        body.drawCircle(0, 0, 25);
        body.endFill();
        creatureContainer.addChild(body);

        // Void core
        const core = new PIXI.Graphics();
        core.beginFill(0x000000);
        core.drawCircle(0, 0, 12);
        core.endFill();
        creatureContainer.addChild(core);

        // Glowing eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0xff00ff);
        leftEye.drawCircle(-8, -8, 4);
        leftEye.endFill();

        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0xff00ff);
        rightEye.drawCircle(8, -8, 4);
        rightEye.endFill();

        creatureContainer.addChild(leftEye);
        creatureContainer.addChild(rightEye);

        // Tentacles
        for (let i = 0; i < 6; i++) {
            const tentacle = new PIXI.Graphics();
            tentacle.lineStyle(4, 0x6600aa);
            const angle = (i / 6) * Math.PI * 2;
            tentacle.moveTo(0, 0);
            tentacle.lineTo(Math.cos(angle) * 40, Math.sin(angle) * 40);
            creatureContainer.addChild(tentacle);
        }

        creatureContainer.x = x;
        creatureContainer.y = y;
        creatureContainer.health = 60;
        creatureContainer.maxHealth = 60;
        creatureContainer.damage = 35;
        creatureContainer.speed = 40;
        creatureContainer.isDungeonEnemy = true;

        game.app.stage.addChild(creatureContainer);

        const creatureId = `void_${index}_${Date.now()}`;
        game.voidCreatures.set(creatureId, creatureContainer);

        // Floating animation
        const floatAnimation = () => {
            if (creatureContainer.parent) {
                creatureContainer.y += Math.sin(Date.now() * 0.003 + index) * 0.5;
                creatureContainer.rotation += 0.01;
                requestAnimationFrame(floatAnimation);
            }
        };
        floatAnimation();
    }

    updateDungeonProgress() {
        this.dungeonEnemiesLeft--;
        const enemiesLeftElement = document.getElementById('enemiesLeft');
        if (enemiesLeftElement) {
            enemiesLeftElement.textContent = this.dungeonEnemiesLeft;
        }

        if (this.dungeonEnemiesLeft <= 0) {
            this.completeDungeon();
        }
    }

    completeDungeon() {
        // Grant Void Magic through server
        if (client && client.socket) {
            client.socket.emit('unlockVoidMagic');
            client.socket.emit('gainExperience', 200); // Bonus experience
        }

        // Clean up dungeon
        this.exitDungeon();

        this.showNotification('🎉 Dungeon Complete! You unlocked Void Magic!', 'success');
    }

    exitDungeon() {
        this.isDungeonMode = false;

        // Remove dungeon environment
        if (this.dungeonFloor && this.dungeonFloor.parent) {
            game.app.stage.removeChild(this.dungeonFloor);
        }
        if (this.dungeonWalls && this.dungeonWalls.parent) {
            game.app.stage.removeChild(this.dungeonWalls);
        }
        if (this.dungeonOverlay && this.dungeonOverlay.parent) {
            game.app.stage.removeChild(this.dungeonOverlay);
        }

        // Restore original world appearance
        if (this.originalBackground) {
            this.originalBackground.visible = true;
        }

        // Restore all environmental objects
        this.originalEnvironments.forEach(env => {
            env.visible = true;
        });

        if (game.dungeonEntrance) {
            game.dungeonEntrance.visible = true;
        }

        // Show other players again
        if (game) {
            game.players.forEach((player, id) => {
                if (id !== client.socket.id) {
                    player.visible = true;
                }
            });

            // Clean up void creatures
            if (game.voidCreatures) {
                game.voidCreatures.forEach(creature => {
                    if (creature.parent) {
                        game.app.stage.removeChild(creature);
                    }
                });
                game.voidCreatures.clear();
            }
        }

        // Remove dungeon UI
        const dungeonUI = document.getElementById('dungeonUI');
        if (dungeonUI) {
            dungeonUI.remove();
        }
    }

    updatePlayerInfo(playerData) {
        // Update level
        const levelElement = document.getElementById('playerLevel');
        if (levelElement) {
            levelElement.textContent = playerData.level;
        }

        // Update health
        const healthFill = document.getElementById('healthFill');
        const healthText = document.getElementById('healthText');
        if (healthFill && healthText) {
            const healthPercent = (playerData.health / playerData.maxHealth) * 100;
            healthFill.style.width = healthPercent + '%';
            healthText.textContent = `${playerData.health}/${playerData.maxHealth}`;

            // Check for death - ensure death screen shows
            if (playerData.health <= 0 && !document.getElementById('deathScreen').classList.contains('hidden')) {
                setTimeout(() => {
                    this.showDeathScreen(playerData);
                }, 100);
            }
        }

        // Update experience and track total
        const expFill = document.getElementById('expFill');
        const expText = document.getElementById('expText');
        if (expFill && expText) {
            const requiredExp = playerData.level * 100;
            const expPercent = (playerData.experience / requiredExp) * 100;
            expFill.style.width = expPercent + '%';
            expText.textContent = `${playerData.experience}/${requiredExp}`;

            // Track total experience gained
            this.totalExperience += (playerData.experience - (this.lastExperience || 0));
            this.lastExperience = playerData.experience;
        }

        // Update magic inventory
        this.updateMagicInventory(playerData.magicLevels);
    }

    addEnemyDefeat() {
        this.enemiesDefeated++;
    }

    updateMagicInventory(magicLevels) {
        const slotsContainer = document.getElementById('inventorySlots');
        if (!slotsContainer) return;

        // Always rebuild the inventory to ensure proper updates
        slotsContainer.innerHTML = '';

        const magicTypes = ['fire', 'ice', 'lightning', 'earth', 'wind', 'shadow', 'light', 'void', 'soul'];
        const hotkeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

        magicTypes.forEach((type, index) => {
            const slot = document.createElement('div');
            slot.className = 'spell-slot';
            slot.dataset.type = type;

            if (magicLevels[type] > 0) {
                const icon = document.createElement('div');
                icon.className = `spell-icon ${type}-icon`;

                // Try to load icon image, fallback to styled div
                const iconImg = document.createElement('img');
                iconImg.src = `assets/${type}scroll.png`;
                iconImg.style.width = '100%';
                iconImg.style.height = '100%';
                iconImg.style.objectFit = 'cover';
                iconImg.style.borderRadius = '50%';

                iconImg.onerror = () => {
                    // Fallback to colored circle with symbol
                    icon.style.backgroundColor = this.getSpellColor(type);
                    icon.style.border = '2px solid #fff';
                    icon.style.borderRadius = '50%';
                    icon.style.display = 'flex';
                    icon.style.alignItems = 'center';
                    icon.style.justifyContent = 'center';
                    icon.style.fontSize = '16px';
                    icon.style.fontWeight = 'bold';
                    icon.style.color = '#fff';
                    icon.textContent = this.getSpellSymbol(type);
                };

                iconImg.onload = () => {
                    icon.appendChild(iconImg);
                };

                // Trigger load attempt
                icon.appendChild(iconImg);
                slot.appendChild(icon);

                const level = document.createElement('div');
                level.className = 'spell-level'; 
                level.textContent = magicLevels[type];
                slot.appendChild(level);

                // Add cooldown overlay
                const cooldownOverlay = document.createElement('div');
                cooldownOverlay.className = 'cooldown-overlay';
                cooldownOverlay.style.display = 'none';
                slot.appendChild(cooldownOverlay);

                const cooldownText = document.createElement('div');
                cooldownText.className = 'cooldown-text';
                slot.appendChild(cooldownText);
            }

            const hotkey = document.createElement('div');
            hotkey.className = 'spell-hotkey';
            hotkey.textContent = hotkeys[index] || '';
            slot.appendChild(hotkey);

            slot.addEventListener('click', () => {
                if (magicLevels[type] > 0 && game && game.currentPlayer) {
                    if (game.magicCooldowns[type] <= 0) {
                        game.selectedSpell = type;
                        game.updateSpellSelection();
                    }
                }
            });

            slotsContainer.appendChild(slot);
        });

        // Auto-select first available spell if none selected
        if (game && !game.selectedSpell) {
            const firstAvailable = magicTypes.find(type => magicLevels[type] > 0);
            if (firstAvailable) {
                game.selectedSpell = firstAvailable;
                this.updateSpellSelection();
            }
        }
    }

    showMagicCollectionNotification(magicType) {
        const magicNames = {
            fire: 'Fire Magic',
            ice: 'Ice Magic',
            lightning: 'Lightning Magic',
            earth: 'Earth Magic',
            wind: 'Wind Magic',
            shadow: 'Shadow Magic',
            light: 'Light Magic',
            void: 'Void Magic',
            soul: 'Soul Magic'
        };

        const magicIcons = {
            fire: '🔥',
            ice: '❄️',
            lightning: '⚡',
            earth: '🌍',
            wind: '💨',
            shadow: '🌑',
            light: '☀️',
            void: '🌌',
            soul: '👻'
        };

        const magicName = magicNames[magicType] || magicType;
        const magicIcon = magicIcons[magicType] || '✨';

        this.showNotification(`${magicIcon} You learned ${magicName}! Press ${['1','2','3','4','5','6','7','8','9'][['fire','ice','lightning','earth','wind','shadow','light','void','soul'].indexOf(magicType)]} to cast spells!`, 'success');
    }

    showSoulMagicUnlock() {
        this.showNotification('👻 You unlocked Soul Magic by defeating 5 demon statues! The power of the dead is now yours!', 'success');
    }

    showBiomeChange(biomeData) {
        this.showNotification(`Biome Changed: ${biomeData.name}`, biomeData.description, 'biome');
        this.updateBiomeDisplay(biomeData);
    }

    showCurrentBiome(biomeData) {
        this.updateBiomeDisplay(biomeData);
    }

    updateBiomeDisplay(biomeData) {
        let biomeDisplay = document.getElementById('biome-display');
        if (!biomeDisplay) {
            biomeDisplay = document.createElement('div');
            biomeDisplay.id = 'biome-display';
            biomeDisplay.className = 'biome-display';
            document.body.appendChild(biomeDisplay);
        }

        biomeDisplay.innerHTML = `
            <div class="biome-info">
                <h3>Current Biome: ${biomeData.name}</h3>
                <p>${biomeData.description}</p>
                <div class="biome-animals">
                    <strong>Wildlife:</strong> ${biomeData.animals.join(', ')}
                </div>
            </div>
        `;
    }

    updateSpellSelection() {
        document.querySelectorAll('.spell-slot').forEach(slot => {
            slot.classList.remove('selected');
        });

        if (game && game.selectedSpell) {
            const selectedSlot = document.querySelector(`[data-type="${game.selectedSpell}"]`);
            if (selectedSlot) {
                selectedSlot.classList.add('selected');
            }
        }
    }

    showRarityPopup(rarity, x, y) {
        const popup = document.getElementById('rarityPopup');
        const rarityText = popup.querySelector('.rarity-text');

        if (popup && rarityText) {
            rarityText.textContent = rarity;
            rarityText.className = `rarity-text rarity-${rarity}`;

            // Position popup (convert world coordinates to screen coordinates if game exists)
            let screenX = x;
            let screenY = y;

            if (game && game.camera) {
                screenX = x - game.camera.x;
                screenY = y - game.camera.y;
            }

            popup.style.left = screenX + 'px';
            popup.style.top = screenY + 'px';
            popup.classList.remove('hidden');
            popup.classList.add('show');

            setTimeout(() => {
                popup.classList.remove('show');
                popup.classList.add('hidden');
            }, 2000);
        }
    }

    showDamageNumber(damage, x, y, color = '#ff4444') {
        const damageElement = document.createElement('div');
        damageElement.textContent = `-${damage}`;
        damageElement.style.position = 'fixed';
        damageElement.style.left = x + 'px';
        damageElement.style.top = y + 'px';
        damageElement.style.color = color;
        damageElement.style.fontSize = '18px';
        damageElement.style.fontWeight = 'bold';
        damageElement.style.pointerEvents = 'none';
        damageElement.style.zIndex = '1500';
        damageElement.style.textShadow = '0 0 4px rgba(0,0,0,0.8)';
        damageElement.style.transition = 'all 1s ease-out';

        document.body.appendChild(damageElement);

        // Animate
        setTimeout(() => {
            damageElement.style.transform = 'translateY(-50px)';
            damageElement.style.opacity = '0';
        }, 50);

        setTimeout(() => {
            if (damageElement.parentNode) {
                damageElement.parentNode.removeChild(damageElement);
            }
        }, 1100);
    }

    getSpellColor(type) {
        const colors = {
            fire: '#ff4444',
            ice: '#4444ff',
            lightning: '#ffff44',
            earth: '#44aa44',
            wind: '#44ffff',
            shadow: '#aa44aa',
            light: '#ffffff',
            void: '#8800ff',
            soul: '#aa00aa'
        };
        return colors[type] || '#888888';
    }

    getSpellSymbol(type) {
        const symbols = {
            fire: '🔥',
            ice: '❄️',
            lightning: '⚡',
            earth: '🌍',
            wind: '💨',
            shadow: '🌑',
            light: '☀️',
            void: '🌌',
            soul: '👻'
        };
        return symbols[type] || '?';
    }

    initializeTransformations() {
        this.isAdmin = false;
        this.adminPanelVisible = false;
        this.playerWishes = [];

        this.transformations = {
            adminGod: {
                name: 'Divine Admin Avatar',
                levelRequired: 1,
                description: 'Transform into the ultimate divine being with absolute power over reality. This sacred form grants you complete control over the game world and the ability to assist players with divine intervention.',
                duration: 999999999, // Permanent
                cooldown: 0, // No cooldown
                stats: 'Infinite Power, Reality Control, Divine Authority, Heavenly Blessing, Immortal',
                active: false,
                cooldownEnd: 0,
                icon: '👑',
                adminOnly: true,
                skills: {
                    z: { name: 'Summon Divine Presence', description: 'Call upon the gods to grant wishes - shows wish prompt to nearby players', cooldown: 5000 },
                    x: { name: 'Rainbow Divine Blast', description: 'Unleash a spectacular multi-colored blast of pure divine energy', cooldown: 3000 },
                    q: { name: 'Heavenly Healing Wave', description: 'Send out divine healing energy that automatically heals all players', cooldown: 4000 }
                }
            },
            bloodLust: {
                name: 'Blood Lust Cloak',
                levelRequired: 3,
                description: 'Transform into a six-tailed crimson fox demon with blood manipulation powers. Your fox form grants enhanced agility and blood magic abilities that can paralyze and drain enemies.',
                duration: 60000, // 60 seconds (increased)
                cooldown: 45000, // 45 seconds (reduced)
                stats: '+60% Speed, +40% Damage, Blood Regeneration, Six Fox Tails, Blood Aura',
                active: false,
                cooldownEnd: 0,
                icon: '🦊',
                skills: {
                    z: { name: 'Blood Tsunami', description: 'Unleash massive waves of blood that drain enemy health and heal you', cooldown: 8000 },
                    x: { name: 'Crimson Blitz', description: 'Dash through enemies at light speed, leaving blood trails that explode', cooldown: 6000 },
                    q: { name: 'Six-Tail Barrage', description: 'Each tail fires blood projectiles that track enemies and steal life force', cooldown: 10000 }
                }
            },
            shadowNinja: {
                name: 'Shadow Ninja Beast',
                levelRequired: 6,
                description: 'Transform into a legendary shadow wolf ninja with mastery over darkness and stealth. Your wolf form grants supernatural speed and shadow manipulation abilities.',
                duration: 45000, // 45 seconds (increased)
                cooldown: 50000, // 50 seconds (reduced)
                stats: '+80% Speed, Stealth Mode, Shadow Clone Army, Phase Through Walls',
                active: false,
                cooldownEnd: 0,
                icon: '🐺',
                skills: {
                    z: { name: 'Shadow Clone Jutsu', description: 'Create 5 shadow clones that mirror your attacks and confuse enemies', cooldown: 12000 },
                    x: { name: 'Void Step', description: 'Instantly teleport behind nearest enemy dealing massive backstab damage', cooldown: 5000 },
                    q: { name: 'Darkness Domain', description: 'Create a field of pure darkness that blinds enemies and boosts your power', cooldown: 15000 }
                }
            },
            dragonLord: {
                name: 'Ancient Dragon Lord',
                levelRequired: 10,
                description: 'Transform into a majestic ancient dragon with mastery over all elements. Your draconic form grants flight and devastating red beam attacks.',
                duration: 60000, // 60 seconds (increased)
                cooldown: 70000, // 70 seconds (reduced)
                stats: '+120% All Damage, Flight, Elemental Immunity, Dragon Scales Armor',
                active: false,
                cooldownEnd: 0,
                icon: '🐉',
                skills: {
                    z: { name: 'Crimson Laser Beam', description: 'Channel a continuous red laser beam that devastates everything in its path - hold to maintain', cooldown: 0 },
                    x: { name: 'Dragon Wing Storm', description: 'Create massive tornadoes with your wings that lift and slam enemies', cooldown: 10000 },
                    q: { name: 'Ancient Roar', description: 'Roar that stuns all enemies and summons meteor shower from the sky', cooldown: 18000 }
                }
            },
            phoenixEmperor: {
                name: 'Phoenix Emperor',
                levelRequired: 13,
                description: 'Transform into the legendary Phoenix Emperor with immortal flames and rebirth powers. Your phoenix form grants immunity to death and solar fire mastery.',
                duration: 55000, // 55 seconds (increased)
                cooldown: 75000, // 75 seconds (reduced)
                stats: '+100% Fire Damage, Auto-Revive, Solar Flame Aura, Flight',
                active: false,
                cooldownEnd: 0,
                icon: '🔥',
                skills: {
                    z: { name: 'Solar Flare Burst', description: 'Explode in solar flames that heal allies and incinerate enemies', cooldown: 9000 },
                    x: { name: 'Phoenix Dive', description: 'Dive from the sky as a blazing phoenix dealing area damage on impact', cooldown: 7000 },
                    q: { name: 'Rebirth Flames', description: 'If killed, instantly revive with full health in a massive fire explosion', cooldown: 20000 }
                }
            },
            voidLeviathanKing: {
                name: 'Void Leviathan King',
                levelRequired: 16,
                description: 'Transform into the ultimate Void Leviathan, a cosmic sea serpent that commands space and time. Your leviathan form bends reality itself.',
                duration: 75000, // 75 seconds (increased)
                cooldown: 90000, // 90 seconds (reduced)
                stats: '+200% All Damage, Reality Control, Dimensional Swimming, Cosmic Armor',
                active: false,
                cooldownEnd: 0,
                icon: '🐙',
                skills: {
                    z: { name: 'Void Tsunami', description: 'Summon massive waves of void energy that erase everything in their path', cooldown: 12000 },
                    x: { name: 'Dimensional Coil', description: 'Wrap enemies in your coils and drag them through dimensions', cooldown: 8000 },
                    q: { name: 'Cosmic Devastation', description: 'Channel the power of dying stars to create reality-ending explosions', cooldown: 25000 }
                }
            },
            celestialTigerGod: {
                name: 'Celestial Tiger God',                levelRequired: 19,
                description: 'Transform into the divine Celestial Tiger God with heavenly powers and lightning speed. Your tiger form commands divine authority over all elements.',
                duration: 70000, // 70 seconds (increased)
                cooldown: 80000, // 80 seconds (reduced)
                stats: '+150% Speed, +150% Damage, Divine Protection, Celestial Claws',
                active: false,
                cooldownEnd: 0,
                icon: '🐅',
                skills: {
                    z: { name: 'Divine Lightning Pounce', description: 'Leap across the battlefield striking multiple enemies with divine lightning', cooldown: 6000 },
                    x: { name: 'Celestial Roar', description: 'Roar that creates shockwaves and calls down divine judgment from heaven', cooldown: 10000 },
                    q: { name: 'Tiger God Domain', description: 'Transform the battlefield into your divine domain where you are unstoppable', cooldown: 20000 }
                }
            }
        };

        this.activeTransformation = null;
        this.transformationEffects = new Map();
        this.skillCooldowns = new Map();
        this.activeBeams = new Map();
        this.keysPressed = new Set();

        // Setup admin panel
        this.setupAdminPanel();

        // Add global admin unlock function
        window.adminUnlock = () => this.showAdminPasswordPrompt();
    }

    setupAdminPanel() {
        // Create admin panel HTML
        const adminPanel = document.createElement('div');
        adminPanel.id = 'adminPanel';
        adminPanel.className = 'admin-panel hidden';
        adminPanel.innerHTML = `
            <div class="admin-panel-content">
                <div class="admin-header">
                    <h2>🛡️ ADMIN CONTROL PANEL 🛡️</h2>
                    <button class="close-admin-btn" onclick="ui.hideAdminPanel()">×</button>
                </div>
                <div class="admin-section">
                    <h3>Player Management</h3>
                    <div id="playerList" class="player-list"></div>
                </div>
                <div class="admin-section">
                    <h3>Admin Powers</h3>
                    <button class="admin-btn" onclick="ui.setMaxLevel()">🔥 MAX LEVEL</button>
                    <button class="admin-btn" onclick="ui.toggleGodMode()">⚡ GOD MODE</button>
                    <button class="admin-btn" onclick="ui.activateAdminTransformation()">👑 ADMIN FORM</button>
                </div>
                <div class="admin-section">
                    <h3>🙏 Player Wishes</h3>
                    <div id="wishList" class="wish-list"></div>
                </div>
            </div>
        `;
        document.body.appendChild(adminPanel);
    }

    showAdminPasswordPrompt() {
        const password = prompt('Enter admin password:');
        if (password === 'admin123') {
            this.isAdmin = true;
            this.showAdminPanel();
            this.showNotification('🛡️ Admin access granted!', 'success');

            // Request player list from server
            if (client && client.socket) {
                client.socket.emit('requestPlayerList');
            }
        } else {
            this.showNotification('❌ Invalid password!', 'error');
        }
    }

    showAdminPanel() {
        if (!this.isAdmin) return;

        const panel = document.getElementById('adminPanel');
        if (panel) {
            panel.classList.remove('hidden');
            this.adminPanelVisible = true;
            this.updatePlayerList();
        }
    }

    hideAdminPanel() {
        const panel = document.getElementById('adminPanel');
        if (panel) {
            panel.classList.add('hidden');
            this.adminPanelVisible = false;
        }
    }

    updatePlayerList() {
        if (!this.isAdmin) return;

        const playerList = document.getElementById('playerList');
        if (!playerList || !game) return;

        playerList.innerHTML = '';

        game.players.forEach((player, id) => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            playerItem.innerHTML = `
                <div class="player-info">
                    <strong>${player.playerData?.name || 'Unknown'}</strong>
                    <span class="player-id">ID: ${id}</span>
                    <span class="player-ip">IP: ${player.ipAddress || 'Hidden'}</span>
                    <span class="player-level">Level: ${player.playerData?.level || 1}</span>
                </div>
            `;
            playerList.appendChild(playerItem);
        });
    }

    setMaxLevel() {
        if (!this.isAdmin || !client || !client.socket) return;

        client.socket.emit('adminSetMaxLevel');
        this.showNotification('🔥 Max level granted!', 'success');
    }

    toggleGodMode() {
        if (!this.isAdmin || !client || !client.socket) return;

        client.socket.emit('adminToggleGodMode');
        this.showNotification('⚡ God mode toggled!', 'success');
    }

    activateAdminTransformation() {
        if (!this.isAdmin) return;

        this.activateTransformation('adminGod');
    }

    addPlayerWish(wishData) {
        this.playerWishes.push(wishData);
        this.updateWishList();
    }

    updateWishList() {
        const wishList = document.getElementById('wishList');
        if (!wishList) return;

        wishList.innerHTML = '';

        this.playerWishes.forEach((wish, index) => {
            const wishItem = document.createElement('div');
            wishItem.className = 'wish-item';
            wishItem.innerHTML = `
                <div class="wish-content">
                    <strong>Player: ${wish.playerName}</strong>
                    <span class="wish-id">ID: ${wish.playerId}</span>
                    <div class="wish-text">${wish.wish}</div>
                    <button class="grant-wish-btn" onclick="ui.grantWish(${index})">Grant Wish</button>
                </div>
            `;
            wishList.appendChild(wishItem);
        });
    }

    grantWish(index) {
        if (!this.isAdmin || !client || !client.socket) return;

        const wish = this.playerWishes[index];
        if (wish) {
            client.socket.emit('grantWish', { playerId: wish.playerId, wish: wish.wish });
            this.playerWishes.splice(index, 1);
            this.updateWishList();
            this.showNotification(`✨ Granted wish for ${wish.playerName}!`, 'success');
        }
    }

    showTransformationModal() {
        const modal = document.getElementById('transformationModal');
        this.updateTransformationList();        modal.classList.remove('hidden');
    }

    hideTransformationModal() {
        document.getElementById('transformationModal').classList.add('hidden');
    }

    updateTransformationList() {
        const container = document.getElementById('transformationList');
        if (!container) return;

        container.innerHTML = '';

        const playerLevel = game?.currentPlayer?.playerData?.level || 1;

        Object.keys(this.transformations).forEach(key => {
            const transformation = this.transformations[key];

            // Hide admin transformation if not admin
            if (transformation.adminOnly && !this.isAdmin) {
                return;
            }

            const item = document.createElement('div');
            item.className = 'transformation-item';

            const isAvailable = this.isAdmin || playerLevel >= transformation.levelRequired;
            const isOnCooldown = Date.now() < transformation.cooldownEnd;
            const isActive = transformation.active;

            if (isActive) {
                item.classList.add('active');
            } else if (isAvailable && !isOnCooldown) {
                item.classList.add('available');
            } else if (isOnCooldown) {
                item.classList.add('cooldown');
            } else {
                item.classList.add('locked');
            }

            let buttonText = 'Transform';
            let buttonDisabled = false;

            if (!isAvailable) {
                buttonText = `Requires Level ${transformation.levelRequired}`;
                buttonDisabled = true;
            } else if (isActive) {
                buttonText = 'Active';
                buttonDisabled = true;
            } else if (isOnCooldown) {
                const cooldownLeft = Math.ceil((transformation.cooldownEnd - Date.now()) / 1000);
                buttonText = `Cooldown: ${cooldownLeft}s`;
                buttonDisabled = true;
            } else if (this.activeTransformation) {
                buttonText = 'Another transformation active';
                buttonDisabled = true;
            }

            let skillsHTML = '';
            if (transformation.skills) {
                skillsHTML = `<div class="transformation-skills">
                    <strong>Skills:</strong><br>`;
                for (const skillKey in transformation.skills) {
                    const skill = transformation.skills[skillKey];
                    skillsHTML += `<span class="skill-name">${skillKey.toUpperCase()}: ${skill.name}</span> - ${skill.description} (Cooldown: ${skill.cooldown / 1000}s)<br>`;
                }
                skillsHTML += `</div>`;
            }

            item.innerHTML = `
                <div class="transformation-card">
                    <div class="transformation-icon-large">${transformation.icon}</div>
                    <div class="transformation-content">
                        <div class="transformation-header">
                            <span class="transformation-name">${transformation.name}</span>
                            <span class="transformation-level-req">Level ${transformation.levelRequired}</span>
                        </div>
                        <div class="transformation-description">${transformation.description}</div>
                        <div class="transformation-stats">${transformation.stats}</div>
                        <div class="transformation-duration">Duration: ${transformation.duration / 1000}s | Cooldown: ${transformation.cooldown / 1000}s</div>
                        ${skillsHTML}
                        ${isActive ? `<div class="transformation-timer">Active for ${Math.ceil((transformation.activeUntil - Date.now()) / 1000)} seconds</div>` : ''}
                    </div>
                </div>
                <button class="transformation-button ${isActive ? 'active' : ''}" ${buttonDisabled ? 'disabled' : ''} onclick="ui.activateTransformation('${key}')">
                    ${buttonText}
                </button>
            `;

            container.appendChild(item);
        });
    }

    activateTransformation(transformationKey) {
        const transformation = this.transformations[transformationKey];
        if (!transformation || transformation.active || this.activeTransformation) return;

        const playerLevel = game?.currentPlayer?.playerData?.level || 1;
        if (playerLevel < transformation.levelRequired) return;

        if (Date.now() < transformation.cooldownEnd) return;

        // Activate transformation
        transformation.active = true;
        transformation.activeUntil = Date.now() + transformation.duration;
        this.activeTransformation = transformationKey;

        // Apply transformation effects
        this.applyTransformationEffects(transformationKey);

        // Notify server and other players
        if (client && client.socket) {
            client.socket.emit('transformationActivated', {
                transformationType: transformationKey
            });
        }

        // Set cooldown after duration
        setTimeout(() => {
            this.deactivateTransformation(transformationKey);
        }, transformation.duration);

        this.updateTransformationList();
        this.hideTransformationModal();

        this.showNotification(`🔮 ${transformation.name} activated!`, 'success');
    }

    deactivateTransformation(transformationKey) {
        const transformation = this.transformations[transformationKey];
        if (!transformation) return;

        // Notify server and other players about deactivation
        if (client && client.socket) {
            client.socket.emit('transformationDeactivated', {
                transformationType: transformationKey
            });
        }

        transformation.active = false;
        transformation.cooldownEnd = Date.now() + transformation.cooldown;
        this.activeTransformation = null;

        // Remove transformation effects
        this.removeTransformationEffects(transformationKey);

        this.showNotification(`${transformation.icon} ${transformation.name} ended`, 'info');
    }

    applyTransformationEffects(transformationKey) {
        if (!game || !game.currentPlayer) return;

        const player = game.currentPlayer;
        const transformation = this.transformations[transformationKey];

        switch (transformationKey) {
            case 'adminGod':
                this.applyAdminGodEffects(player);
                break;
            case 'bloodLust':
                this.applyBloodLustEffects(player);
                break;
            case 'shadowNinja':
                this.applyShadowNinjaEffects(player);
                break;
            case 'dragonLord':
                this.applyDragonLordEffects(player);
                break;
            case 'phoenixEmperor':
                this.applyPhoenixEmperorEffects(player);
                break;
            case 'voidLeviathanKing':
                this.applyVoidLeviathanKingEffects(player);
                break;
            case 'celestialTigerGod':
                this.applyCelestialTigerGodEffects(player);
                break;
        }
    }

    removeTransformationEffects(transformationKey) {
        if (!game || !game.currentPlayer) return;

        const player = game.currentPlayer;

        switch (transformationKey) {
            case 'adminGod':
                this.removeAdminGodEffects(player);
                break;
            case 'bloodLust':
                this.removeBloodLustEffects(player);
                break;
            case 'shadowNinja':
                this.removeShadowNinjaEffects(player);
                break;
            case 'dragonLord':
                this.removeDragonLordEffects(player);
                break;
            case 'phoenixEmperor':
                this.removePhoenixEmperorEffects(player);
                 break;
            case 'voidLeviathanKing':
                this.removeVoidLeviathanKingEffects(player);
                break;
            case 'celestialTigerGod':
                this.removeCelestialTigerGodEffects(player);
                break;
        }
    }

    applyBloodLustEffects(player) {
        // Transform player into 9-tailed fox-like creature
        const body = player.children.find(child => child.beginFill);
        if (body) {
            body.clear();
            // Larger fox-like body
            body.beginFill(0x8B0000); // Dark red
            body.lineStyle(3, 0xFF0000); // Bright red outline
            body.drawEllipse(0, 0, 30, 35); // Larger, more fox-like shape
            body.endFill();
        }

        // Add 9 tails
        this.createNineTails(player);

        // Add fox ears
        this.createFoxEars(player);

        // Store original stats
        if (!this.transformationEffects.has('bloodLust')) {
            this.transformationEffects.set('bloodLust', {
                originalSpeed: game.moveSpeed || 200,
                originalHealth: player.playerData.health
            });
        }

        // Apply stat boosts
        game.moveSpeed = (game.moveSpeed || 200) * 1.6; // 60% speed boost
        player.playerData.health = Math.min(player.playerData.maxHealth + 20, player.playerData.health + 20);

        // Create blood aura effect with wider radius
        this.createBloodAura(player);

        // Start blood aura damage check
        this.bloodAuraInterval = setInterval(() => {
            this.checkBloodAuraEffects(player);
        }, 500);
    }

    removeBloodLustEffects(player) {
        // Restore player appearance
        const body = player.children.find(child => child.beginFill);
        if (body) {
            body.clear();
            body.beginFill(0xF4C2A1); // Original skin color
            body.lineStyle(2, 0xD2B48C);
            body.drawCircle(0, 0, 20); // Original size
            body.endFill();
        }

        // Remove nine tails
        if (this.nineTails) {
            this.nineTails.forEach(tail => {
                if (tail.parent) {
                    tail.parent.removeChild(tail);
                }
            });
            this.nineTails = null;
        }

        // Remove fox ears
        if (this.foxEars) {
            this.foxEars.forEach(ear => {
                if (ear.parent) {
                    ear.parent.removeChild(ear);
                }
            });
            this.foxEars = null;
        }

        // Restore original speed
        const effects = this.transformationEffects.get('bloodLust');
        if (effects) {
            game.moveSpeed = effects.originalSpeed;
            this.transformationEffects.delete('bloodLust');
        }

        // Remove blood aura
        if (this.bloodAura && this.bloodAura.parent) {
            this.bloodAura.parent.removeChild(this.bloodAura);
            this.bloodAura = null;
        }

        // Clear interval
        if (this.bloodAuraInterval) {
            clearInterval(this.bloodAuraInterval);
            this.bloodAuraInterval = null;
        }
    }

    createNineTails(player) {
        this.nineTails = [];

        for (let i = 0; i < 6; i++) {
            const tail = new PIXI.Graphics();
            tail.lineStyle(6, 0x8B0000);
            tail.beginFill(0x8B0000, 0.8); // Same color as body

            // Create curved tail shape
            const angle = (i / 6) * Math.PI * 2;
            const baseAngle = angle - Math.PI * 0.3;
            const tipAngle = angle + Math.PI * 0.3;

            // Tail segments
            for (let j = 0; j < 3; j++) {
                const segmentAngle = baseAngle + (tipAngle - baseAngle) * (j / 3);
                const radius = 15 + j * 12;
                const x = Math.cos(segmentAngle) * radius;
                const y = Math.sin(segmentAngle) * radius;

                if (j === 0) {
                    tail.moveTo(0, 0);
                    tail.lineTo(x, y);
                } else {
                    tail.lineTo(x, y);
                }
            }

            tail.endFill();
            tail.tailIndex = i;
            this.nineTails.push(tail);
            player.addChild(tail);
        }

        // Animate tails
        this.animateNineTails();
    }

    createFoxEars(player) {
        this.foxEars = [];

        // Left ear
        const leftEar = new PIXI.Graphics();
        leftEar.lineStyle(2, 0x8B0000);
        leftEar.beginFill(0x8B0000); // Same color as body
        leftEar.drawPolygon([-15, -35, -25, -50, -8, -45]);
        leftEar.endFill();

        // Right ear
        const rightEar = new PIXI.Graphics();
        rightEar.lineStyle(2, 0x8B0000);
        rightEar.beginFill(0x8B0000); // Same color as body
        rightEar.drawPolygon([15, -35, 25, -50, 8, -45]);
        rightEar.endFill();

        this.foxEars.push(leftEar, rightEar);
        player.addChild(leftEar);
        player.addChild(rightEar);
    }

    animateNineTails() {
        const animateTails = () => {
            if (this.nineTails && this.nineTails.length > 0) {
                this.nineTails.forEach((tail, index) => {
                    if (tail.parent) {
                        const time = Date.now() * 0.003;
                        const offset = index * 0.7;
                        tail.rotation = Math.sin(time + offset) * 0.5;
                        tail.y = Math.sin(time * 2 + offset) * 3;
                    }
                });
                requestAnimationFrame(animateTails);
            }
        };
        animateTails();
    }

    createBloodAura(player) {
        if (!game || !game.app) return;

        this.bloodAura = new PIXI.Graphics();
        this.bloodAura.beginFill(0xFF0000, 0.2); // More transparent
        this.bloodAura.drawCircle(0, 0, 120); // Much wider aura radius
        this.bloodAura.endFill();

        // Add inner aura ring
        const innerAura = new PIXI.Graphics();
        innerAura.beginFill(0xFF4444, 0.3);
        innerAura.drawCircle(0, 0, 80);
        innerAura.endFill();
        this.bloodAura.addChild(innerAura);

        // Add blood particles
        for (let i = 0; i < 20; i++) {
            const particle = new PIXI.Graphics();
            particle.beginFill(0xFF0000, 0.7);
            particle.drawCircle(0, 0, 2 + Math.random() * 3);
            particle.endFill();

            const angle = (i / 20) * Math.PI * 2;
            particle.x = Math.cos(angle) * (60 + Math.random() * 40);
            particle.y = Math.sin(angle) * (60 + Math.random() * 40);
            this.bloodAura.addChild(particle);
        }

        // Add pulsing animation
        let pulseDirection = 1;
        let pulseScale = 1;

        const pulseAnimation = () => {
            if (this.bloodAura && this.bloodAura.parent) {
                pulseScale += pulseDirection * 0.03;
                if (pulseScale > 1.4 || pulseScale < 0.9) {
                    pulseDirection *= -1;
                }
                this.bloodAura.scale.set(pulseScale);
                this.bloodAura.x = player.x;
                this.bloodAura.y = player.y;
                this.bloodAura.rotation += 0.02;
                requestAnimationFrame(pulseAnimation);
            }
        };

        game.app.stage.addChild(this.bloodAura);
        pulseAnimation();
    }

    checkBloodAuraEffects(player) {
        if (!game || !this.bloodAura) return;

        const auraRadius = 120; // Wider range to match new aura

        // Check other players in blood aura
        game.players.forEach((otherPlayer, playerId) => {
            if (playerId !== client.socket.id) {
                const dx = otherPlayer.x - player.x;
                const dy = otherPlayer.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < auraRadius) {
                    // Apply blood effect to other player
                    this.applyBloodEffect(playerId, otherPlayer);
                }
            }
        });
    }

    applyBloodEffect(playerId, targetPlayer) {
        // Send blood effect to server (paralysis)
        if (client && client.socket) {
            client.socket.emit('bloodEffect', { targetId: playerId });
        }

        // Create blood screen effect for visual
        this.createBloodScreenEffect();

        // Shake target player
        this.shakePlayer(targetPlayer);
    }

    createBloodScreenEffect() {
        // Create blood dripping effect on screen
        const bloodOverlay = document.createElement('div');
        bloodOverlay.style.position = 'fixed';
        bloodOverlay.style.top = '0';
        bloodOverlay.style.left = '0';
        bloodOverlay.style.width = '100%';
        bloodOverlay.style.height = '100%';
        bloodOverlay.style.background = 'linear-gradient(180deg, transparent 0%, rgba(139, 0, 0, 0.7) 100%)';
        bloodOverlay.style.pointerEvents = 'none';
        bloodOverlay.style.zIndex = '9999';
        bloodOverlay.style.animation = 'bloodDrip 5s ease-out forwards';

        // Add blood drip animation CSS
        if (!document.getElementById('bloodAnimation')) {
            const style = document.createElement('style');
            style.id = 'bloodAnimation';
            style.textContent = `
                @keyframes bloodDrip {
                    0% { opacity: 0; transform: translateY(-100%); }
                    30% { opacity: 0.8; transform: translateY(0); }
                    70% { opacity: 0.8; }
                    100% { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(bloodOverlay);

        setTimeout(() => {
            if (bloodOverlay.parentNode) {
                bloodOverlay.parentNode.removeChild(bloodOverlay);
            }
        }, 5000);
    }

    shakePlayer(player) {
        if (!player) return;

        let shakeIntensity = 10;
        let shakeCount = 0;
        const maxShakes = 100; // 5 seconds at 20fps

        const shakeAnimation = () => {
            if (shakeCount < maxShakes && player.parent) {
                player.x += (Math.random() - 0.5) * shakeIntensity;
                player.y += (Math.random() - 0.5) * shakeIntensity;
                shakeIntensity *= 0.95; // Gradually reduce shake
                shakeCount++;
                setTimeout(shakeAnimation, 50); // 20fps
            }
        };

        shakeAnimation();
    }
    applyShadowNinjaEffects(player) {
        // Make player semi-transparent (stealth)
        player.alpha = 0.6;

        // Change appearance to shadowy
        const body = player.children.find(child => child.beginFill);
        if (body) {
            body.clear();
            body.beginFill(0x222222, 0.8); // Dark shadow
            body.lineStyle(3, 0x8A2BE2); // Purple outline
            body.drawCircle(0, 0, 22); // Slightly larger
            body.endFill();
        }

        // Create shadow clones
        this.createShadowClones(player);

        // Create shadow wisps
        this.createShadowWisps(player);

        // Increase speed dramatically
        if (!this.transformationEffects.has('shadowNinja')) {
            this.transformationEffects.set('shadowNinja', {
                originalSpeed: game.moveSpeed || 200
            });
        }
        game.moveSpeed = (game.moveSpeed || 200) * 1.8; // 80% speed boost
    }

    createShadowClones(player) {
        this.shadowClones = [];

        for (let i = 0; i < 3; i++) {
            const clone = new PIXI.Graphics();
            clone.beginFill(0x444444, 0.5);
            clone.lineStyle(2, 0x8A2BE2, 0.7);
            clone.drawCircle(0, 0, 18);
            clone.endFill();

            const angle = (i / 3) * Math.PI * 2;
            clone.x = player.x + Math.cos(angle) * 40;
            clone.y = player.y + Math.sin(angle) * 40;
            clone.cloneIndex = i;

            this.shadowClones.push(clone);
            game.app.stage.addChild(clone);
        }

        // Animate clones orbiting around player
        this.animateShadowClones(player);
    }

    createShadowWisps(player) {
        this.shadowWisps = [];

        for (let i = 0; i < 8; i++) {
            const wisp = new PIXI.Graphics();
            wisp.beginFill(0x8A2BE2, 0.8);
            wisp.drawCircle(0, 0, 3);
            wisp.endFill();

            wisp.wispIndex = i;
            this.shadowWisps.push(wisp);
            player.addChild(wisp);
        }

        this.animateShadowWisps();
    }

    animateShadowClones(player) {
        const animateClones = () => {
            if (this.shadowClones && this.shadowClones.length > 0) {
                const time = Date.now() * 0.002;
                this.shadowClones.forEach((clone, index) => {
                    if (clone.parent) {
                        const angle = time + (index / 3) * Math.PI * 2;
                        clone.x = player.x + Math.cos(angle) * 50;
                        clone.y = player.y + Math.sin(angle) * 50;
                        clone.alpha = 0.3 + Math.sin(time * 3 + index) * 0.2;
                    }
                });
                requestAnimationFrame(animateClones);
            }
        };
        animateClones();
    }

    animateShadowWisps() {
        const animateWisps = () => {
            if (this.shadowWisps && this.shadowWisps.length > 0) {
                const time = Date.now() * 0.005;
                this.shadowWisps.forEach((wisp, index) => {
                    if (wisp.parent) {
                        const angle = time + (index / 8) * Math.PI * 2;
                        wisp.x = Math.cos(angle) * 30;
                        wisp.y = Math.sin(angle) * 30;
                        wisp.alpha = 0.5 + Math.sin(time * 4 + index) * 0.3;
                    }
                });
                requestAnimationFrame(animateWisps);
            }
        };
        animateWisps();
    }

    removeShadowNinjaEffects(player) {
        // Restore visibility
        player.alpha = 1;

        // Restore appearance
        const body = player.children.find(child => child.beginFill);
        if (body) {
            body.clear();
            body.beginFill(0xF4C2A1);
            body.lineStyle(2, 0xD2B48C);
            body.drawCircle(0, 0, 20);
            body.endFill();
        }

        // Remove shadow clones
        if (this.shadowClones) {
            this.shadowClones.forEach(clone => {
                if (clone.parent) {
                    clone.parent.removeChild(clone);
                }
            });
            this.shadowClones = null;
        }

        // Remove shadow wisps
        if (this.shadowWisps) {
            this.shadowWisps.forEach(wisp => {
                if (wisp.parent) {
                    wisp.parent.removeChild(wisp);
                }
            });
            this.shadowWisps = null;
        }

        // Restore speed
        const effects = this.transformationEffects.get('shadowNinja');
        if (effects) {
            game.moveSpeed = effects.originalSpeed;
            this.transformationEffects.delete('shadowNinja');
        }
    }

    applyDragonLordEffects(player) {
        // Hide original player body completely during transformation
        const body = player.children.find(child => child.beginFill);
        if (body) {
            body.visible = false; // Hide instead of modifying
        }

        // Create main dragon body segment (this will be the visible center)
        this.mainDragonBody = new PIXI.Graphics();
        this.mainDragonBody.beginFill(0xFFD700, 0.9); // Golden body
        this.mainDragonBody.lineStyle(3, 0xFF4500); // Orange-red outline
        this.mainDragonBody.drawEllipse(0, 0, 40, 25); // Main body segment
        this.mainDragonBody.endFill();
        player.addChild(this.mainDragonBody);

        // Create serpentine dragon body segments
        this.createDragonBodySegments(player);

        // Create elaborate dragon head
        this.createChineseDragonHead(player);

        // Store original stats
        if (!this.transformationEffects.has('dragonLord')) {
            this.transformationEffects.set('dragonLord', {
                originalSpeed: game.moveSpeed || 200
            });
        }
        
        // Apply dragon speed boost
        game.moveSpeed = (game.moveSpeed || 200) * 2.2; // 120% speed boost
    }

    removeDragonLordEffects(player) {
        // Restore original player body visibility
        const body = player.children.find(child => child.beginFill);
        if (body) {
            body.visible = true; // Show original body again
        }

        // Remove main dragon body
        if (this.mainDragonBody && this.mainDragonBody.parent) {
            this.mainDragonBody.parent.removeChild(this.mainDragonBody);
            this.mainDragonBody = null;
        }

        // Remove dragon body segments
        if (this.dragonBodySegments) {
            this.dragonBodySegments.forEach(segment => {
                if (segment.parent) {
                    segment.parent.removeChild(segment);
                }
            });
            this.dragonBodySegments = null;
        }

        // Remove Chinese dragon head
        if (this.chineseDragonHead && this.chineseDragonHead.parent) {
            this.chineseDragonHead.parent.removeChild(this.chineseDragonHead);
            this.chineseDragonHead = null;
        }

        // Stop any active beams
        this.stopDragonBeam();

        // Restore speed
        const effects = this.transformationEffects.get('dragonLord');
        if (effects) {
            game.moveSpeed = effects.originalSpeed;
            this.transformationEffects.delete('dragonLord');
        }
    }

    createDragonBodySegments(player) {
        this.dragonBodySegments = [];

        // Create 6 body segments that will trail behind the main body
        for (let i = 0; i < 6; i++) {
            const segment = new PIXI.Graphics();
            
            // Gradient size - smaller towards tail
            const segmentSize = 35 - (i * 4);
            
            // Use same golden color as main dragon body
            segment.beginFill(0xFFD700, 0.8);
            segment.lineStyle(2, 0xFF4500, 0.9); // Orange-red outline like main body
            segment.drawEllipse(0, 0, segmentSize, segmentSize * 0.7);
            segment.endFill();

            // Add energy rings with matching colors
            segment.lineStyle(1, 0xFFD700, 0.6);
            segment.drawCircle(0, 0, segmentSize + 5);
            segment.drawCircle(0, 0, segmentSize + 10);

            // Position segments behind the main body initially
            segment.x = -(i + 1) * 35; // Start behind main body
            segment.y = 0;

            segment.segmentIndex = i;
            this.dragonBodySegments.push(segment);
            player.addChild(segment);
        }

        this.animateDragonBodySegments(player);
    }

    createChineseDragonHead(player) {
        this.chineseDragonHead = new PIXI.Graphics();

        // Main dragon head - elongated and majestic, facing forward
        this.chineseDragonHead.beginFill(0xFFD700, 0.95);
        this.chineseDragonHead.lineStyle(3, 0xFF4500);
        
        // Create elongated dragon head shape pointing forward (positive X direction)
        this.chineseDragonHead.drawEllipse(45, 0, 15, 25); // Main head
        this.chineseDragonHead.drawEllipse(60, 0, 12, 20); // Upper head/forehead
        this.chineseDragonHead.endFill();

        // Dragon snout pointing forward
        this.chineseDragonHead.beginFill(0xFFD700, 0.9);
        this.chineseDragonHead.lineStyle(2, 0xFF4500);
        this.chineseDragonHead.drawEllipse(75, 0, 8, 15);
        this.chineseDragonHead.endFill();

        // Powerful dragon eyes with inner fire, positioned on forward-facing head
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0xFF0000, 0.9);
        leftEye.drawEllipse(48, -10, 4, 6);
        leftEye.endFill();
        // Eye pupils
        leftEye.beginFill(0x000000);
        leftEye.drawEllipse(48, -10, 2, 3);
        leftEye.endFill();
        // Eye glow
        leftEye.beginFill(0xFFFF00, 0.6);
        leftEye.drawCircle(48, -10, 8);
        leftEye.endFill();

        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0xFF0000, 0.9);
        rightEye.drawEllipse(48, 10, 4, 6);
        rightEye.endFill();
        // Eye pupils
        rightEye.beginFill(0x000000);
        rightEye.drawEllipse(48, 10, 2, 3);
        rightEye.endFill();
        // Eye glow
        rightEye.beginFill(0xFFFF00, 0.6);
        rightEye.drawCircle(48, 10, 8);
        rightEye.endFill();

        this.chineseDragonHead.addChild(leftEye);
        this.chineseDragonHead.addChild(rightEye);

        // Dragon antlers (traditional Chinese dragon feature) positioned for forward-facing head
        this.chineseDragonHead.lineStyle(4, 0x8B4513, 0.9);
        
        // Left antler with branches
        this.chineseDragonHead.moveTo(35, -15);
        this.chineseDragonHead.lineTo(25, -25);
        this.chineseDragonHead.moveTo(28, -18);
        this.chineseDragonHead.lineTo(20, -25);
        this.chineseDragonHead.moveTo(28, -18);
        this.chineseDragonHead.lineTo(25, -15);

        // Right antler with branches
        this.chineseDragonHead.moveTo(35, 15);
        this.chineseDragonHead.lineTo(25, 25);
        this.chineseDragonHead.moveTo(28, 18);
        this.chineseDragonHead.lineTo(20, 25);
        this.chineseDragonHead.moveTo(28, 18);
        this.chineseDragonHead.lineTo(25, 15);

        // Dragon nostrils with smoke effect, positioned on forward-facing snout
        this.chineseDragonHead.beginFill(0x333333);
        this.chineseDragonHead.drawEllipse(80, -6, 3, 2);
        this.chineseDragonHead.drawEllipse(80, 6, 3, 2);
        this.chineseDragonHead.endFill();

        player.addChild(this.chineseDragonHead);
        this.animateChineseDragonHead();
    }

    createDragonWhiskersAndAntlers(player) {
        this.dragonWhiskers = [];

        // Create flowing whiskers (traditional Chinese dragon feature)
        for (let i = 0; i < 6; i++) {
            const whisker = new PIXI.Graphics();
            whisker.lineStyle(3, 0xFFD700, 0.8);
            
            const side = i < 3 ? -1 : 1;
            const offset = (i % 3) * 8;
            const length = 40 + offset;
            
            // Create curved whisker
            for (let j = 0; j <= 10; j++) {
                const progress = j / 10;
                const curve = Math.sin(progress * Math.PI) * 8;
                const x = side * (15 + progress * length);
                const y = -35 + offset + curve;
                
                if (j === 0) {
                    whisker.moveTo(side * 15, -35 + offset);
                } else {
                    whisker.lineTo(x, y);
                }
            }
            
            whisker.whiskerIndex = i;
            this.dragonWhiskers.push(whisker);
            player.addChild(whisker);
        }

        this.animateChineseDragonWhiskers();
    }

    createDragonClaws(player) {
        this.dragonClaws = [];

        // Create 4 powerful dragon claws
        for (let i = 0; i < 4; i++) {
            const claw = new PIXI.Graphics();
            const side = i < 2 ? -1 : 1;
            const front = i % 2 === 0 ? 1 : -1;

            // Claw base
            claw.beginFill(0xC0C0C0, 0.9);
            claw.lineStyle(2, 0x000000);
            
            const baseX = side * 25;
            const baseY = front * 20;
            
            // Draw claw shape
            claw.drawPolygon([
                baseX, baseY,
                baseX + side * 8, baseY + front * 3,
                baseX + side * 15, baseY + front * 8,
                baseX + side * 18, baseY + front * 15,
                baseX + side * 12, baseY + front * 18,
                baseX + side * 4, baseY + front * 12,
                baseX, baseY + front * 8
            ]);
            claw.endFill();

            // Add claw talons
            for (let j = 0; j < 3; j++) {
                claw.lineStyle(3, 0x000000, 0.8);
                const talonX = baseX + side * (10 + j * 3);
                const talonY = baseY + front * (12 + j * 2);
                claw.moveTo(talonX, talonY);
                claw.lineTo(talonX + side * 8, talonY + front * 12);
            }

            claw.clawIndex = i;
            this.dragonClaws.push(claw);
            player.addChild(claw);
        }

        this.animateDragonClaws();
    }

    createDragonMane(player) {
        this.dragonMane = [];

        // Create flowing dragon mane
        for (let i = 0; i < 8; i++) {
            const maneStrand = new PIXI.Graphics();
            
            const colors = [0xFF4500, 0xFFD700, 0xFF0000, 0xFF7F00];
            maneStrand.lineStyle(4, colors[i % colors.length], 0.8);
            
            const angle = (i / 8) * Math.PI * 2;
            const baseRadius = 30;
            
            // Create flowing mane strands
            for (let j = 0; j <= 8; j++) {
                const progress = j / 8;
                const radius = baseRadius + progress * 25;
                const wave = Math.sin(progress * Math.PI * 2) * 8;
                const x = Math.cos(angle) * radius + wave;
                const y = Math.sin(angle) * radius + wave - 40; // Position around head
                
                if (j === 0) {
                    maneStrand.moveTo(Math.cos(angle) * baseRadius, Math.sin(angle) * baseRadius - 40);
                } else {
                    maneStrand.lineTo(x, y);
                }
            }
            
            maneStrand.maneIndex = i;
            this.dragonMane.push(maneStrand);
            player.addChild(maneStrand);
        }

        this.animateDragonMane();
    }

    

    // Animation methods for new dragon design
    animateDragonBodySegments(player) {
        const animateSegments = () => {
            if (this.dragonBodySegments && this.dragonBodySegments.length > 0) {
                const time = Date.now() * 0.002;
                
                this.dragonBodySegments.forEach((segment, index) => {
                    if (segment.parent) {
                        // Serpentine wave movement that properly connects to the main body (at 0,0)
                        const waveOffset = Math.sin(time + index * 0.8) * 12;
                        const followDistance = -(index + 1) * 35; // Each segment 35 units behind the previous
                        
                        segment.x = followDistance;
                        segment.y = waveOffset + Math.sin(time * 2 + index * 0.5) * 6;
                        segment.rotation = Math.sin(time + index * 0.3) * 0.2;
                        segment.alpha = 0.8 + Math.sin(time * 3 + index) * 0.2;
                    }
                });
                requestAnimationFrame(animateSegments);
            }
        };
        animateSegments();
    }

    animateChineseDragonHead() {
        const animateHead = () => {
            if (this.chineseDragonHead && this.chineseDragonHead.parent) {
                const time = Date.now() * 0.002;
                this.chineseDragonHead.y = -5 + Math.sin(time) * 3;
                this.chineseDragonHead.rotation = Math.sin(time * 0.7) * 0.15;
                
                // Breathing effect
                this.chineseDragonHead.scale.set(1 + Math.sin(time * 4) * 0.05);
                
                requestAnimationFrame(animateHead);
            }
        };
        animateHead();
    }

    animateChineseDragonWhiskers() {
        const animateWhiskers = () => {
            if (this.dragonWhiskers && this.dragonWhiskers.length > 0) {
                const time = Date.now() * 0.003;
                this.dragonWhiskers.forEach((whisker, index) => {
                    if (whisker.parent) {
                        whisker.rotation = Math.sin(time + index * 0.7) * 0.4;
                        whisker.alpha = 0.7 + Math.sin(time * 2 + index) * 0.3;
                        whisker.y = Math.sin(time * 1.5 + index) * 5;
                    }
                });
                requestAnimationFrame(animateWhiskers);
            }
        };
        animateWhiskers();
    }

    animateDragonClaws() {
        const animateClaws = () => {
            if (this.dragonClaws && this.dragonClaws.length > 0) {
                const time = Date.now() * 0.004;
                this.dragonClaws.forEach((claw, index) => {
                    if (claw.parent) {
                        claw.rotation = Math.sin(time + index * 0.8) * 0.2;
                        claw.scale.set(0.9 + Math.sin(time * 2 + index) * 0.1);
                        claw.alpha = 0.8 + Math.sin(time * 3 + index) * 0.2;
                    }
                });
                requestAnimationFrame(animateClaws);
            }
        };
        animateClaws();
    }

    animateDragonMane() {
        const animateMane = () => {
            if (this.dragonMane && this.dragonMane.length > 0) {
                const time = Date.now() * 0.003;
                this.dragonMane.forEach((strand, index) => {
                    if (strand.parent) {
                        strand.rotation = Math.sin(time + index * 0.5) * 0.3;
                        strand.alpha = 0.6 + Math.sin(time * 2 + index) * 0.4;
                        strand.y = -40 + Math.sin(time * 1.5 + index) * 8;
                    }
                });
                requestAnimationFrame(animateMane);
            }
        };
        animateMane();
    }

    

    createDragonWhiskers(player) {
        this.dragonWhiskers = [];

        for (let i = 0; i < 4; i++) {
            const whisker = new PIXI.Graphics();
            whisker.lineStyle(2, 0xFFD700, 0.8);
            
            const side = i < 2 ? -1 : 1;
            const offset = (i % 2) * 8;
            
            whisker.moveTo(side * 15, -35 + offset);
            whisker.lineTo(side * 35, -30 + offset);
            
            whisker.whiskerIndex = i;
            this.dragonWhiskers.push(whisker);
            player.addChild(whisker);
        }

        this.animateDragonWhiskers();
    }

    createDragonOrbs(player) {
        this.dragonOrbs = [];

        const orbColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF];

        for (let i = 0; i < 5; i++) {
            const orb = new PIXI.Graphics();
            orb.beginFill(orbColors[i], 0.8);
            orb.lineStyle(2, 0xFFFFFF);
            orb.drawCircle(0, 0, 8);
            orb.endFill();

            // Add energy core
            const core = new PIXI.Graphics();
            core.beginFill(0xFFFFFF, 0.9);
            core.drawCircle(0, 0, 4);
            core.endFill();
            orb.addChild(core);

            orb.orbIndex = i;
            this.dragonOrbs.push(orb);
            player.addChild(orb);
        }

        this.animateDragonOrbs();
    }

    createChakraAura(player) {
        if (!game || !game.app) return;

        this.chakraAura = new PIXI.Graphics();

        const drawChakra = () => {
            if (!this.chakraAura || !this.chakraAura.parent) return;

            this.chakraAura.clear();

            // Create chakra rings with different colors
            const chakraColors = [0xFF0000, 0xFF7F00, 0xFFFF00, 0x00FF00, 0x0000FF, 0x4B0082, 0x9400D3];
            
            for (let ring = 0; ring < chakraColors.length; ring++) {
                this.chakraAura.lineStyle(4, chakraColors[ring], 0.7);

                const radius = 50 + ring * 15;
                const pulse = Math.sin(Date.now() * 0.004 + ring) * 8;
                
                // Draw flowing chakra ring
                const points = 24;
                for (let i = 0; i <= points; i++) {
                    const angle = (i / points) * Math.PI * 2;
                    const waveOffset = Math.sin(angle * 3 + Date.now() * 0.006) * 5;
                    const x = Math.cos(angle) * (radius + pulse + waveOffset);
                    const y = Math.sin(angle) * (radius + pulse + waveOffset);

                    if (i === 0) {
                        this.chakraAura.moveTo(x, y);
                    } else {
                        this.chakraAura.lineTo(x, y);
                    }
                }
            }

            // Add chakra particles
            for (let i = 0; i < 15; i++) {
                const angle = (Date.now() * 0.003 + i) % (Math.PI * 2);
                const distance = 60 + Math.sin(Date.now() * 0.004 + i) * 30;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                const color = chakraColors[i % chakraColors.length];

                this.chakraAura.beginFill(color, 0.8);
                this.chakraAura.drawCircle(x, y, 4);
                this.chakraAura.endFill();
            }

            this.chakraAura.x = player.x;
            this.chakraAura.y = player.y;
            this.chakraAura.rotation += 0.02;

            requestAnimationFrame(drawChakra);
        };

        game.app.stage.addChild(this.chakraAura);
        drawChakra();
    }

    animateDragonHead() {
        const animateHead = () => {
            if (this.dragonHead && this.dragonHead.parent) {
                const time = Date.now() * 0.003;
                this.dragonHead.y = Math.sin(time) * 2;
                this.dragonHead.rotation = Math.sin(time * 0.7) * 0.1;
                requestAnimationFrame(animateHead);
            }
        };
        animateHead();
    }

    animateDragonWhiskers() {
        const animateWhiskers = () => {
            if (this.dragonWhiskers && this.dragonWhiskers.length > 0) {
                const time = Date.now() * 0.004;
                this.dragonWhiskers.forEach((whisker, index) => {
                    if (whisker.parent) {
                        whisker.rotation = Math.sin(time + index * 0.5) * 0.3;
                        whisker.alpha = 0.6 + Math.sin(time * 2 + index) * 0.3;
                    }
                });
                requestAnimationFrame(animateWhiskers);
            }
        };
        animateWhiskers();
    }

    animateDragonOrbs() {
        const animateOrbs = () => {
            if (this.dragonOrbs && this.dragonOrbs.length > 0) {
                const time = Date.now() * 0.002;
                this.dragonOrbs.forEach((orb, index) => {
                    if (orb.parent) {
                        const angle = time + (index / 5) * Math.PI * 2;
                        orb.x = Math.cos(angle) * 55;
                        orb.y = Math.sin(angle) * 55;
                        orb.rotation += 0.05;
                        orb.scale.set(0.8 + Math.sin(time * 3 + index) * 0.3);
                    }
                });
                requestAnimationFrame(animateOrbs);
            }
        };
        animateOrbs();
    }
    applyPhoenixEmperorEffects(player) {
        // Phoenix fire appearance
        const body = player.children.find(child => child.beginFill);
        if (body) {
            body.clear();
            body.beginFill(0xFF4500, 0.9); // Orange-red phoenix body
            body.lineStyle(4, 0xFFD700); // Golden outline
            body.drawCircle(0, 0, 28); // Larger size
            body.endFill();
        }

        // Create phoenix crown
        this.createPhoenixCrown(player);

        // Create phoenix wings
        this.createPhoenixWings(player);

        // Create solar aura
        this.createSolarAura(player);

        // Create phoenix feathers
        this.createPhoenixFeathers(player);

        // Store original stats
        if (!this.transformationEffects.has('phoenixEmperor')) {
            this.transformationEffects.set('phoenixEmperor', {
                originalSpeed: game.moveSpeed || 200
            });
        }
        
        // Apply phoenix speed boost
        game.moveSpeed = (game.moveSpeed || 200) * 2; // 100% speed boost
    }

    removePhoenixEmperorEffects(player) {
        // Restore appearance
        const body = player.children.find(child => child.beginFill);
        if (body) {
            body.clear();
            body.beginFill(0xF4C2A1);
            body.lineStyle(2, 0xD2B48C);
            body.drawCircle(0, 0, 20);
            body.endFill();
        }

        // Remove phoenix crown
        if (this.phoenixCrown && this.phoenixCrown.parent) {
            this.phoenixCrown.parent.removeChild(this.phoenixCrown);
            this.phoenixCrown = null;
        }

        // Remove phoenix wings
        if (this.phoenixWings) {
            this.phoenixWings.forEach(wing => {
                if (wing.parent) {
                    wing.parent.removeChild(wing);
                }
            });
            this.phoenixWings = null;
        }

        // Remove phoenix feathers
        if (this.phoenixFeathers) {
            this.phoenixFeathers.forEach(feather => {
                if (feather.parent) {
                    feather.parent.removeChild(feather);
                }
            });
            this.phoenixFeathers = null;
        }

        // Remove solar aura
        if (this.solarAura && this.solarAura.parent) {
            this.solarAura.parent.removeChild(this.solarAura);
            this.solarAura = null;
        }

        // Restore speed
        const effects = this.transformationEffects.get('phoenixEmperor');
        if (effects) {
            game.moveSpeed = effects.originalSpeed;
            this.transformationEffects.delete('phoenixEmperor');
        }
    }

    createPhoenixCrown(player) {
        this.phoenixCrown = new PIXI.Graphics();

        // Create flame crown spikes
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x = Math.cos(angle) * 25;
            const y = Math.sin(angle) * 25 - 35;

            this.phoenixCrown.beginFill(0xFF4500, 0.9);
            this.phoenixCrown.lineStyle(2, 0xFFD700);
            this.phoenixCrown.drawPolygon([
                x, y - 15,
                x - 8, y + 8,
                x + 8, y + 8
            ]);
            this.phoenixCrown.endFill();

            // Add flame tip
            this.phoenixCrown.beginFill(0xFFFF00, 0.8);
            this.phoenixCrown.drawCircle(x, y - 10, 3);
            this.phoenixCrown.endFill();
        }

        player.addChild(this.phoenixCrown);
        this.animatePhoenixCrown();
    }

    createPhoenixWings(player) {
        this.phoenixWings = [];

        for (let side = 0; side < 2; side++) {
            const wing = new PIXI.Graphics();
            const wingSide = side === 0 ? -1 : 1;

            // Create layered phoenix wings
            for (let layer = 0; layer < 3; layer++) {
                const wingSize = 40 + layer * 15;
                const alpha = 0.9 - layer * 0.2;
                const colors = [0xFF4500, 0xFF6347, 0xFFD700];

                wing.beginFill(colors[layer], alpha);
                wing.lineStyle(2, 0xFF0000, alpha);

                // Wing feather shape
                wing.drawPolygon([
                    wingSide * 20, -15,
                    wingSide * wingSize, -25 - layer * 5,
                    wingSide * (wingSize + 10), 0,
                    wingSide * wingSize, 25 + layer * 5,
                    wingSide * 20, 15
                ]);
                wing.endFill();

                // Wing details - feather lines
                for (let detail = 0; detail < 6; detail++) {
                    wing.lineStyle(1, 0xFFD700, 0.7);
                    wing.moveTo(wingSide * 20, -10 + detail * 7);
                    wing.lineTo(wingSide * (35 + layer * 10), -15 + detail * 8);
                }
            }

            wing.wingIndex = side;
            this.phoenixWings.push(wing);
            player.addChild(wing);
        }

        this.animatePhoenixWings();
    }

    createPhoenixFeathers(player) {
        this.phoenixFeathers = [];

        for (let i = 0; i < 12; i++) {
            const feather = new PIXI.Graphics();
            feather.beginFill(0xFF4500, 0.8);
            feather.lineStyle(1, 0xFFD700);
            
            // Small feather shape
            feather.drawPolygon([
                0, -8,
                -3, -2,
                -2, 6,
                0, 8,
                2, 6,
                3, -2
            ]);
            feather.endFill();

            feather.featherIndex = i;
            this.phoenixFeathers.push(feather);
            player.addChild(feather);
        }

        this.animatePhoenixFeathers();
    }

    createSolarAura(player) {
        if (!game || !game.app) return;

        this.solarAura = new PIXI.Graphics();

        const drawSolar = () => {
            if (!this.solarAura || !this.solarAura.parent) return;

            this.solarAura.clear();

            // Create solar rays
            for (let ray = 0; ray < 16; ray++) {
                const angle = (ray / 16) * Math.PI * 2;
                const rayLength = 60 + Math.sin(Date.now() * 0.005 + ray) * 20;
                
                this.solarAura.lineStyle(4, 0xFFD700, 0.8);
                this.solarAura.moveTo(0, 0);
                this.solarAura.lineTo(
                    Math.cos(angle) * rayLength,
                    Math.sin(angle) * rayLength
                );

                // Add flame effect at ray tips
                this.solarAura.beginFill(0xFF4500, 0.6);
                this.solarAura.drawCircle(
                    Math.cos(angle) * rayLength,
                    Math.sin(angle) * rayLength,
                    5
                );
                this.solarAura.endFill();
            }

            // Create pulsing solar rings
            for (let ring = 0; ring < 3; ring++) {
                const radius = 40 + ring * 20;
                const pulse = Math.sin(Date.now() * 0.004 + ring * 2) * 5;
                
                this.solarAura.lineStyle(3, 0xFFFF00, 0.6 - ring * 0.15);
                this.solarAura.drawCircle(0, 0, radius + pulse);
            }

            this.solarAura.x = player.x;
            this.solarAura.y = player.y;
            this.solarAura.rotation += 0.03;

            requestAnimationFrame(drawSolar);
        };

        game.app.stage.addChild(this.solarAura);
        drawSolar();
    }

    animatePhoenixCrown() {
        const animateCrown = () => {
            if (this.phoenixCrown && this.phoenixCrown.parent) {
                const time = Date.now() * 0.005;
                this.phoenixCrown.y = -3 + Math.sin(time) * 2;
                this.phoenixCrown.alpha = 0.8 + Math.sin(time * 2) * 0.2;
                requestAnimationFrame(animateCrown);
            }
        };
        animateCrown();
    }

    animatePhoenixWings() {
        const animateWings = () => {
            if (this.phoenixWings && this.phoenixWings.length > 0) {
                const time = Date.now() * 0.006;
                this.phoenixWings.forEach((wing, index) => {
                    if (wing.parent) {
                        const wingSide = index === 0 ? -1 : 1;
                        wing.rotation = Math.sin(time + index) * 0.4;
                        wing.y = Math.sin(time * 2 + index) * 3;
                        wing.alpha = 0.8 + Math.sin(time * 3 + index) * 0.2;
                    }
                });
                requestAnimationFrame(animateWings);
            }
        };
        animateWings();
    }

    animatePhoenixFeathers() {
        const animateFeathers = () => {
            if (this.phoenixFeathers && this.phoenixFeathers.length > 0) {
                const time = Date.now() * 0.003;
                this.phoenixFeathers.forEach((feather, index) => {
                    if (feather.parent) {
                        const angle = time + (index / 12) * Math.PI * 2;
                        const distance = 45 + Math.sin(time * 2 + index) * 15;
                        feather.x = Math.cos(angle) * distance;
                        feather.y = Math.sin(angle) * distance;
                        feather.rotation = angle + Math.PI / 2;
                        feather.alpha = 0.6 + Math.sin(time * 4 + index) * 0.3;
                    }
                });
                requestAnimationFrame(animateFeathers);
            }
        };
        animateFeathers();
    }

    createRealityTears(player) {
        this.realityTears = [];

        for (let i = 0; i < 5; i++) {
            const tear = new PIXI.Graphics();
            tear.lineStyle(3, 0x8800ff, 0.9);
            tear.beginFill(0x000000, 0.8);

            // Create irregular tear shape
            const tearHeight = 15 + Math.random() * 10;
            tear.drawPolygon([
                0, -tearHeight/2,
                -3, -tearHeight/4,
                -2, tearHeight/4,
                0, tearHeight/2,
                2, tearHeight/4,
                3, -tearHeight/4
            ]);
            tear.endFill();

            tear.tearIndex = i;
            this.realityTears.push(tear);
            player.addChild(tear);
        }

        this.animateRealityTears();
    }

    createVoidCrown(player) {
        this.voidCrown = new PIXI.Graphics();

        // Create void crown with reality distortion
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const x = Math.cos(angle) * 32;
            const y = Math.sin(angle) * 32 - 45;

            this.voidCrown.beginFill(0x8800ff, 0.8);
            this.voidCrown.lineStyle(2, 0x4400aa);
            this.voidCrown.drawPolygon([
                x, y - 18,
                x - 6, y + 6,
                x + 6, y + 6
            ]);
            this.voidCrown.endFill();

            // Add void gems
            this.voidCrown.beginFill(0x000000);
            this.voidCrown.drawCircle(x, y - 10, 4);
            this.voidCrown.endFill();
        }

        player.addChild(this.voidCrown);
        this.animateVoidCrown();
    }

    createVoidFragments(player) {
        this.voidFragments = [];

        for (let i = 0; i < 8; i++) {
            const fragment = new PIXI.Graphics();
            fragment.beginFill(0x4400aa, 0.7);
            fragment.lineStyle(1, 0x8800ff);
            fragment.drawRect(-3, -3, 6, 6);
            fragment.endFill();

            fragment.fragmentIndex = i;
            this.voidFragments.push(fragment);
            player.addChild(fragment);
        }

        this.animateVoidFragments();
    }

    createCelestialCrown(player) {
        this.celestialCrown = new PIXI.Graphics();

        // Create divine tiger crown with lightning
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const x = Math.cos(angle) * 28;
            const y = Math.sin(angle) * 28 - 40;

            this.celestialCrown.beginFill(0xFFD700, 0.9);
            this.celestialCrown.lineStyle(2, 0x00FFFF);
            this.celestialCrown.drawPolygon([
                x, y - 12,
                x - 5, y + 5,
                x + 5, y + 5
            ]);
            this.celestialCrown.endFill();

            // Add lightning bolts
            if (i % 2 === 0) {
                this.celestialCrown.lineStyle(3, 0x00FFFF, 0.8);
                this.celestialCrown.moveTo(x, y - 12);
                this.celestialCrown.lineTo(x + (Math.random() - 0.5) * 10, y - 20);
            }
        }

        player.addChild(this.celestialCrown);
        this.animateCelestialCrown();
    }

    createTigerClaws(player) {
        this.tigerClaws = [];

        for (let i = 0; i < 4; i++) {
            const claw = new PIXI.Graphics();
            const side = i < 2 ? -1 : 1;
            const front = i % 2 === 0 ? 1 : -1;

            claw.lineStyle(4, 0xC0C0C0, 0.9);
            claw.beginFill(0xFFFFFF, 0.7);
            
            // Claw shape
            const baseX = side * 20;
            const baseY = front * 15;
            claw.drawPolygon([
                baseX, baseY,
                baseX + side * 15, baseY + front * 8,
                baseX + side * 12, baseY + front * 15,
                baseX, baseY + front * 12
            ]);
            claw.endFill();

            claw.clawIndex = i;
            this.tigerClaws.push(claw);
            player.addChild(claw);
        }

        this.animateTigerClaws();
    }

    createCelestialOrbs(player) {
        this.celestialOrbs = [];

        const orbColors = [0x00FFFF, 0xFFD700, 0xFF69B4, 0x00FF00, 0xFF4500, 0x9400D3];

        for (let i = 0; i < 6; i++) {
            const orb = new PIXI.Graphics();
            orb.beginFill(orbColors[i], 0.8);
            orb.lineStyle(2, 0xFFFFFF);
            // Create star shape manually
            const starPoints = [];
            for (let p = 0; p < 12; p++) {
                const angle = (p / 12) * Math.PI * 2;
                const radius = (p % 2 === 0) ? 10 : 6;
                starPoints.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
            orb.drawPolygon(starPoints);
            orb.endFill();

            // Add inner glow
            const glow = new PIXI.Graphics();
            glow.beginFill(0xFFFFFF, 0.6);
            glow.drawCircle(0, 0, 4);
            glow.endFill();
            orb.addChild(glow);

            orb.orbIndex = i;
            this.celestialOrbs.push(orb);
            player.addChild(orb);
        }

        this.animateCelestialOrbs();
    }

    createDivineLightningAura(player) {
        if (!game || !game.app) return;

        this.divineLightningAura = new PIXI.Graphics();

        const drawDivineLightning = () => {
            if (!this.divineLightningAura || !this.divineLightningAura.parent) return;

            this.divineLightningAura.clear();

            // Create divine lightning bolts
            for (let bolt = 0; bolt < 20; bolt++) {
                const angle = (bolt / 20) * Math.PI * 2 + Date.now() * 0.001;
                const distance = 50 + Math.random() * 40;

                this.divineLightningAura.lineStyle(3, 0x00FFFF, 0.9);
                this.divineLightningAura.moveTo(0, 0);

                // Jagged lightning effect
                let currentX = 0, currentY = 0;
                const segments = 4;
                for (let j = 1; j <= segments; j++) {
                    const segmentAngle = angle + (Math.random() - 0.5) * 0.8;
                    const segmentDistance = (distance / segments) * j;
                    const targetX = Math.cos(segmentAngle) * segmentDistance;
                    const targetY = Math.sin(segmentAngle) * segmentDistance;
                    this.divineLightningAura.lineTo(targetX, targetY);
                    currentX = targetX;
                    currentY = targetY;
                }

                // Add spark at end
                this.divineLightningAura.beginFill(0xFFFFFF, 0.8);
                this.divineLightningAura.drawCircle(currentX, currentY, 3);
                this.divineLightningAura.endFill();
            }

            // Add divine energy rings
            for (let ring = 0; ring < 4; ring++) {
                const radius = 60 + ring * 20;
                const pulse = Math.sin(Date.now() * 0.006 + ring) * 8;
                
                this.divineLightningAura.lineStyle(4, 0xFFD700, 0.6 - ring * 0.1);
                this.divineLightningAura.drawCircle(0, 0, radius + pulse);
            }

            this.divineLightningAura.x = player.x;
            this.divineLightningAura.y = player.y;

            requestAnimationFrame(drawDivineLightning);
        };

        game.app.stage.addChild(this.divineLightningAura);
        drawDivineLightning();
    }

    animateCelestialCrown() {
        const animateCrown = () => {
            if (this.celestialCrown && this.celestialCrown.parent) {
                const time = Date.now() * 0.004;
                this.celestialCrown.y = -5 + Math.sin(time) * 3;
                this.celestialCrown.rotation = Math.sin(time * 0.8) * 0.2;
                this.celestialCrown.alpha = 0.8 + Math.sin(time * 3) * 0.2;
                requestAnimationFrame(animateCrown);
            }
        };
        animateCrown();
    }

    animateTigerClaws() {
        const animateClaws = () => {
            if (this.tigerClaws && this.tigerClaws.length > 0) {
                const time = Date.now() * 0.005;
                this.tigerClaws.forEach((claw, index) => {
                    if (claw.parent) {
                        claw.rotation = Math.sin(time + index * 0.5) * 0.3;
                        claw.alpha = 0.7 + Math.sin(time * 2 + index) * 0.3;
                        claw.scale.set(0.9 + Math.sin(time * 3 + index) * 0.2);
                    }
                });
                requestAnimationFrame(animateClaws);
            }
        };
        animateClaws();
    }

    animateCelestialOrbs() {
        const animateOrbs = () => {
            if (this.celestialOrbs && this.celestialOrbs.length > 0) {
                const time = Date.now() * 0.003;
                this.celestialOrbs.forEach((orb, index) => {
                    if (orb.parent) {
                        const angle = time + (index / 6) * Math.PI * 2;
                        orb.x = Math.cos(angle) * 50;
                        orb.y = Math.sin(angle) * 50;
                        orb.rotation += 0.08;
                        orb.scale.set(0.8 + Math.sin(time * 4 + index) * 0.3);
                    }
                });
                requestAnimationFrame(animateOrbs);
            }
        };
        animateOrbs();
    }

    animateVoidCrown() {
        const animateCrown = () => {
            if (this.voidCrown && this.voidCrown.parent) {
                const time = Date.now() * 0.003;
                this.voidCrown.y = -5 + Math.sin(time) * 3;
                this.voidCrown.rotation = Math.sin(time * 0.7) * 0.2;
                requestAnimationFrame(animateCrown);
            }
        };
        animateCrown();
    }

    animateRealityTears() {
        const animateTears = () => {
            if (this.realityTears && this.realityTears.length > 0) {
                const time = Date.now() * 0.004;
                this.realityTears.forEach((tear, index) => {
                    if (tear.parent) {
                        const angle = time + (index / 5) * Math.PI * 2;
                        tear.x = Math.cos(angle) * 50;
                        tear.y = Math.sin(angle) * 50;
                        tear.rotation = angle;
                        tear.alpha = 0.4 + Math.sin(time * 2 + index) * 0.3;
                    }
                });
                requestAnimationFrame(animateTears);
            }
        };
        animateTears();
    }

    animateVoidFragments() {
        const animateFragments = () => {
            if (this.voidFragments && this.voidFragments.length > 0) {
                const time = Date.now() * 0.002;
                this.voidFragments.forEach((fragment, index) => {
                    if (fragment.parent) {
                        const angle = time * 1.5 + (index / 8) * Math.PI * 2;
                        fragment.x = Math.cos(angle) * 35;
                        fragment.y = Math.sin(angle) * 35;
                        fragment.rotation += 0.1;
                        fragment.scale.set(0.8 + Math.sin(time * 3 + index) * 0.3);
                    }
                });
                requestAnimationFrame(animateFragments);
            }
        };
        animateFragments();
    }

    createVoidAura(player) {
        if (!game || !game.app) return;

        this.voidAura = new PIXI.Graphics();

        // Create void distortion effect
        const drawVoid = () => {
            if (!this.voidAura || !this.voidAura.parent) return;

            this.voidAura.clear();

            // Draw void rings with distortion
            for (let ring = 0; ring < 4; ring++) {
                this.voidAura.lineStyle(4, 0x8800ff, 0.7 - ring * 0.15);

                // Create distorted ring
                const radius = 50 + ring * 25;
                const points = 20;
                for (let i = 0; i <= points; i++) {
                    const angle = (i / points) * Math.PI * 2;
                    const distortion = Math.sin(Date.now() * 0.003 + angle * 3 + ring) * 8;
                    const x = Math.cos(angle) * (radius + distortion);
                    const y = Math.sin(angle) * (radius + distortion);

                    if (i === 0) {
                        this.voidAura.moveTo(x, y);
                    } else {
                        this.voidAura.lineTo(x, y);
                    }
                }
            }

            this.voidAura.x = player.x;
            this.voidAura.y = player.y;
            this.voidAura.rotation += 0.03;

            requestAnimationFrame(drawVoid);
        };

        game.app.stage.addChild(this.voidAura);
        drawVoid();
    }

    applyVoidLeviathanKingEffects(player) {
        // Cosmic void appearance
        const body = player.children.find(child => child.beginFill);
        if (body) {
            body.clear();
            body.beginFill(0x1a0033, 0.8); // Dark purple void
            body.lineStyle(4, 0x8800ff); // Bright purple outline
            body.drawCircle(0, 0, 28); // Larger size
            body.endFill();
        }

        // Create void crown
        this.createVoidCrown(player);

        // Create reality tears
        this.createRealityTears(player);

        // Create void distortion effect
        this.createVoidAura(player);

        // Create floating void fragments
        this.createVoidFragments(player);
    }

    removeVoidLeviathanKingEffects(player) {
        // Restore appearance
        const body = player.children.find(child => child.beginFill);
        if (body) {
            body.clear();
            body.beginFill(0xF4C2A1);
            body.lineStyle(2, 0xD2B48C);
            body.drawCircle(0, 0, 20);
            body.endFill();
        }

        // Remove void crown
        if (this.voidCrown && this.voidCrown.parent) {
            this.voidCrown.parent.removeChild(this.voidCrown);
            this.voidCrown = null;
        }

        // Remove reality tears
        if (this.realityTears) {
            this.realityTears.forEach(tear => {
                if (tear.parent) {
                    tear.parent.removeChild(tear);
                }
            });
            this.realityTears = null;
        }

        // Remove void fragments
        if (this.voidFragments) {
            this.voidFragments.forEach(fragment => {
                if (fragment.parent) {
                    fragment.parent.removeChild(fragment);
                }
            });
            this.voidFragments = null;
        }

        // Remove void aura
        if (this.voidAura && this.voidAura.parent) {
            this.voidAura.parent.removeChild(this.voidAura);
            this.voidAura = null;
        }
    }

    applyCelestialTigerGodEffects(player) {
        // Celestial tiger appearance
        const body = player.children.find(child => child.beginFill);
        if (body) {
            body.clear();
            body.beginFill(0xFFD700, 0.9); // Golden tiger body
            body.lineStyle(4, 0xFF4500); // Orange outline with black stripes
            body.drawEllipse(0, 0, 30, 25); // Tiger-like elongated body
            body.endFill();

            // Add tiger stripes
            body.lineStyle(3, 0x000000, 0.8);
            for (let i = 0; i < 6; i++) {
                const stripeY = -15 + (i * 6);
                body.moveTo(-25, stripeY);
                body.lineTo(25, stripeY);
            }
        }

        // Create celestial crown
        this.createCelestialCrown(player);

        // Create tiger claws
        this.createTigerClaws(player);

        // Create divine lightning aura
        this.createDivineLightningAura(player);

        // Create celestial orbs
        this.createCelestialOrbs(player);

        // Store original stats
        if (!this.transformationEffects.has('celestialTigerGod')) {
            this.transformationEffects.set('celestialTigerGod', {
                originalSpeed: game.moveSpeed || 200
            });
        }
        
        // Apply tiger speed boost
        game.moveSpeed = (game.moveSpeed || 200) * 2.5; // 150% speed boost
    }

    removeCelestialTigerGodEffects(player) {
        // Restore appearance
        const body = player.children.find(child => child.beginFill);
        if (body) {
            body.clear();
            body.beginFill(0xF4C2A1);
            body.lineStyle(2, 0xD2B48C);
            body.drawCircle(0, 0, 20);
            body.endFill();
        }

        // Remove celestial crown
        if (this.celestialCrown && this.celestialCrown.parent) {
            this.celestialCrown.parent.removeChild(this.celestialCrown);
            this.celestialCrown = null;
        }

        // Remove tiger claws
        if (this.tigerClaws) {
            this.tigerClaws.forEach(claw => {
                if (claw.parent) {
                    claw.parent.removeChild(claw);
                }
            });
            this.tigerClaws = null;
        }

        // Remove celestial orbs
        if (this.celestialOrbs) {
            this.celestialOrbs.forEach(orb => {
                if (orb.parent) {
                    orb.parent.removeChild(orb);
                }
            });
            this.celestialOrbs = null;
        }

        // Remove divine lightning aura
        if (this.divineLightningAura && this.divineLightningAura.parent) {
            this.divineLightningAura.parent.removeChild(this.divineLightningAura);
            this.divineLightningAura = null;
        }

        // Restore speed
        const effects = this.transformationEffects.get('celestialTigerGod');
        if (effects) {
            game.moveSpeed = effects.originalSpeed;
            this.transformationEffects.delete('celestialTigerGod');
        }
    }

    applyAdminGodEffects(player) {
        // Divine appearance with white/gold theme
        const body = player.children.find(child => child.beginFill);
        if (body) {
            body.clear();
            body.beginFill(0xFFFFFF, 0.9); // Pure white
            body.lineStyle(4, 0xFFD700); // Gold outline
            body.drawCircle(0, 0, 35); // Much larger
            body.endFill();
        }

        // Create divine crown
        this.createDivineCrown(player);

        // Create heavenly wings
        this.createHeavenlyWings(player);

        // Create divine aura
        this.createDivineAura(player);

        // Create floating holy symbols
        this.createHolySymbols(player);

        // Create rainbow cloak
        this.createRainbowCloak(player);

        // Store original stats
        if (!this.transformationEffects.has('adminGod')) {
            this.transformationEffects.set('adminGod', {
                originalSpeed: game.moveSpeed || 200,
                originalHealth: player.playerData.health
            });
        }

        // Apply infinite stats
        game.moveSpeed = (game.moveSpeed || 200) * 3; // 200% speed boost
        player.playerData.health = player.playerData.maxHealth;
    }

    createDivineCrown(player) {
        this.divineCrown = new PIXI.Graphics();

        // Create elaborate crown with multiple layers
        for (let layer = 0; layer < 3; layer++) {
            const radius = 30 + layer * 8;
            const spikes = 8 + layer * 2;

            for (let i = 0; i < spikes; i++) {
                const angle = (i / spikes) * Math.PI * 2;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius - 45;

                this.divineCrown.beginFill(0xFFD700, 0.9 - layer * 0.2);
                this.divineCrown.lineStyle(2, 0xFFFFFF);
                this.divineCrown.drawPolygon([
                    x, y - 15,
                    x - 5, y + 5,
                    x + 5, y + 5
                ]);
                this.divineCrown.endFill();

                // Add gems
                this.divineCrown.beginFill(0xFF1493);
                this.divineCrown.drawCircle(x, y - 8, 3);
                this.divineCrown.endFill();
            }
        }

        player.addChild(this.divineCrown);
        this.animateDivineCrown();
    }

    createHeavenlyWings(player) {
        this.heavenlyWings = [];

        for (let side = 0; side < 2; side++) {
            const wing = new PIXI.Graphics();
            const wingSide = side === 0 ? -1 : 1;

            // Create multiple wing layers
            for (let layer = 0; layer < 4; layer++) {
                const wingSize = 40 + layer * 15;
                const alpha = 0.8 - layer * 0.15;

                wing.beginFill(0xFFFFFF, alpha);
                wing.lineStyle(2, 0xFFD700, alpha);

                // Wing shape
                wing.drawPolygon([
                    wingSide * 15, -10,
                    wingSide * wingSize, -30 - layer * 5,
                    wingSide * wingSize, 20 + layer * 5,
                    wingSide * 15, 10
                ]);
                wing.endFill();

                // Wing details
                for (let detail = 0; detail < 5; detail++) {
                    wing.lineStyle(1, 0xFFD700, 0.6);
                    wing.moveTo(wingSide * 15, -5 + detail * 5);
                    wing.lineTo(wingSide * (30 + layer * 10), -20 + detail * 8);
                }
            }

            wing.wingIndex = side;
            this.heavenlyWings.push(wing);
            player.addChild(wing);
        }

        this.animateHeavenlyWings();
    }

    createDivineAura(player) {
        if (!game || !game.app) return;

        this.divineAura = new PIXI.Graphics();

        const drawDivineAura = () => {
            if (!this.divineAura || !this.divineAura.parent) return;

            this.divineAura.clear();

            // Create multiple divine rings
            for (let ring = 0; ring < 6; ring++) {
                const radius = 60 + ring * 20;
                const color = [0xFFFFFF, 0xFFD700, 0xFF69B4, 0x00FFFF, 0xFF1493, 0x9400D3][ring];

                this.divineAura.lineStyle(6, color, 0.8 - ring * 0.1);

                // Create pulsing ring
                const points = 30;
                for (let i = 0; i <= points; i++) {
                    const angle = (i / points) * Math.PI * 2;
                    const pulse = Math.sin(Date.now() * 0.005 + ring + angle * 2) * 10;
                    const x = Math.cos(angle) * (radius + pulse);
                    const y = Math.sin(angle) * (radius + pulse);

                    if (i === 0) {
                        this.divineAura.moveTo(x, y);
                    } else {
                        this.divineAura.lineTo(x, y);
                    }
                }
            }

            // Add divine particles
            for (let i = 0; i < 30; i++) {
                const angle = (Date.now() * 0.002 + i) % (Math.PI * 2);
                const distance = 80 + Math.sin(Date.now() * 0.003 + i) * 40;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;

                this.divineAura.beginFill(0xFFFFFF, 0.9);
                // Create star shape manually
                const starPoints = [];
                for (let p = 0; p < 10; p++) {
                    const angle = (p / 10) * Math.PI * 2;
                    const radius = (p % 2 === 0) ? 8 : 4;
                    starPoints.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
                }
                this.divineAura.drawPolygon(starPoints);
                this.divineAura.endFill();
            }

            this.divineAura.x = player.x;
            this.divineAura.y = player.y;
            this.divineAura.rotation += 0.02;

            requestAnimationFrame(drawDivineAura);
        };

        game.app.stage.addChild(this.divineAura);
        drawDivineAura();
    }

    createHolySymbols(player) {
        this.holySymbols = [];

        const symbols = ['✚', '✧', '❋', '✦', '✿', '☆'];

        for (let i = 0; i < 6; i++) {
            const symbol = new PIXI.Text(symbols[i], {
                fontSize: 20,
                fill: 0xFFD700,
                stroke: 0xFFFFFF,
                strokeThickness: 2
            });

            symbol.anchor.set(0.5);
            symbol.symbolIndex = i;
            this.holySymbols.push(symbol);
            player.addChild(symbol);
        }

        this.animateHolySymbols();
    }

    createRainbowCloak(player) {
        this.rainbowCloak = new PIXI.Graphics();

        const drawCloak = () => {
            if (!this.rainbowCloak || !this.rainbowCloak.parent) return;

            this.rainbowCloak.clear();

            // Create flowing rainbow cloak
            const colors = [0xFF0000, 0xFF7F00, 0xFFFF00, 0x00FF00, 0x0000FF, 0x4B0082, 0x9400D3];

            for (let layer = 0; layer < colors.length; layer++) {
                const alpha = 0.6 - layer * 0.05;
                this.rainbowCloak.beginFill(colors[layer], alpha);

                // Cloak shape with flowing effect
                const cloakPoints = [];
                const cloakRadius = 50 + layer * 3;
                const segments = 20;

                for (let i = 0; i <= segments; i++) {
                    const angle = Math.PI + (i / segments) * Math.PI;
                    const flow = Math.sin(Date.now() * 0.004 + i * 0.5 + layer) * 8;
                    const x = Math.cos(angle) * (cloakRadius + flow);
                    const y = Math.sin(angle) * (cloakRadius + flow) + 10;
                    cloakPoints.push(x, y);
                }

                // Close the cloak shape
                cloakPoints.push(cloakPoints[0], cloakPoints[1]);
                this.rainbowCloak.drawPolygon(cloakPoints);
                this.rainbowCloak.endFill();
            }

            requestAnimationFrame(drawCloak);
        };

        player.addChild(this.rainbowCloak);
        drawCloak();
    }

    animateDivineCrown() {
        const animateCrown = () => {
            if (this.divineCrown && this.divineCrown.parent) {
                const time = Date.now() * 0.003;
                this.divineCrown.y = -5 + Math.sin(time) * 3;
                this.divineCrown.rotation = Math.sin(time * 0.5) * 0.1;
                this.divineCrown.alpha = 0.8 + Math.sin(time * 2) * 0.2;
                requestAnimationFrame(animateCrown);
            }
        };
        animateCrown();
    }

    animateHeavenlyWings() {
        const animateWings = () => {
            if (this.heavenlyWings && this.heavenlyWings.length > 0) {
                const time = Date.now() * 0.004;
                this.heavenlyWings.forEach((wing, index) => {
                    if (wing.parent) {
                        const wingSide = index === 0 ? -1 : 1;
                        wing.rotation = Math.sin(time + index) * 0.3;
                        wing.y = Math.sin(time * 2 + index) * 2;
                        wing.alpha = 0.7 + Math.sin(time * 3 + index) * 0.3;
                    }
                });
                requestAnimationFrame(animateWings);
            }
        };
        animateWings();
    }

    animateHolySymbols() {
        const animateSymbols = () => {
            if (this.holySymbols && this.holySymbols.length > 0) {
                const time = Date.now() * 0.003;
                this.holySymbols.forEach((symbol, index) => {
                    if (symbol.parent) {
                        const angle = time + (index / 6) * Math.PI * 2;
                        symbol.x = Math.cos(angle) * 50;
                        symbol.y = Math.sin(angle) * 50;
                        symbol.rotation += 0.1;
                        symbol.alpha = 0.6 + Math.sin(time * 2 + index) * 0.4;
                    }
                });
                requestAnimationFrame(animateSymbols);
            }
        };
        animateSymbols();
    }

    removeAdminGodEffects(player) {
        // Note: Admin transformation is permanent, but this is here for completeness

        // Restore appearance
        const body = player.children.find(child => child.beginFill);
        if (body) {
            body.clear();
            body.beginFill(0xF4C2A1);
            body.lineStyle(2, 0xD2B48C);
            body.drawCircle(0, 0, 20);
            body.endFill();
        }

        // Remove divine crown
        if (this.divineCrown && this.divineCrown.parent) {
            this.divineCrown.parent.removeChild(this.divineCrown);
            this.divineCrown = null;
        }

        // Remove heavenly wings
        if (this.heavenlyWings) {
            this.heavenlyWings.forEach(wing => {
                if (wing.parent) {
                    wing.parent.removeChild(wing);
                }
            });
            this.heavenlyWings = null;
        }

        // Remove holy symbols
        if (this.holySymbols) {
            this.holySymbols.forEach(symbol => {
                if (symbol.parent) {
                    symbol.parent.removeChild(symbol);
                }
            });
            this.holySymbols = null;
        }

        // Remove rainbow cloak
        if (this.rainbowCloak && this.rainbowCloak.parent) {
            this.rainbowCloak.parent.removeChild(this.rainbowCloak);
            this.rainbowCloak = null;
        }

        // Remove divine aura
        if (this.divineAura && this.divineAura.parent) {
            this.divineAura.parent.removeChild(this.divineAura);
            this.divineAura = null;
        }

        // Restore speed
        const effects = this.transformationEffects.get('adminGod');
        if (effects) {
            game.moveSpeed = effects.originalSpeed;
            this.transformationEffects.delete('adminGod');
        }
    }

    showWishPrompt(data) {
        const prompt = document.createElement('div');
        prompt.className = 'wish-prompt';
        prompt.innerHTML = `
            <h3>✨ Divine Presence Summoned ✨</h3>
            <p style="color: #ffd700; text-align: center; margin-bottom: 15px;">
                Admin ${data.adminName} has summoned divine presence!<br>
                Make a wish and it may be granted!
            </p>
            <textarea id="wishText" placeholder="Enter your wish here..." maxlength="200"></textarea>
            <div class="wish-buttons">
                <button class="wish-submit" onclick="ui.submitWish('${data.adminId}')">Submit Wish</button>
                <button class="wish-cancel" onclick="ui.closeWishPrompt()">Cancel</button>
            </div>
        `;
        document.body.appendChild(prompt);
    }

    submitWish(adminId) {
        const wishText = document.getElementById('wishText');
        if (wishText && wishText.value.trim()) {
            if (client && client.socket) {
                client.socket.emit('submitWish', {
                    adminId: adminId,
                    wish: wishText.value.trim()
                });
            }
            this.closeWishPrompt();
            this.showNotification('🙏 Your wish has been sent to the admin!', 'success');
        }
    }

    closeWishPrompt() {
        const prompt = document.querySelector('.wish-prompt');
        if (prompt) {
            prompt.remove();
        }
    }

    startDragonBeam(targetX, targetY) {
        if (this.activeTransformation !== 'dragonLord' || !game || !game.currentPlayer) return;

        const beamId = 'dragonBeam';
        if (this.activeBeams.has(beamId)) return; // Already active

        // Send animation event to other players
        if (client && client.socket) {
            client.socket.emit('transformationAnimation', {
                transformationType: 'dragonLord',
                animationType: 'beam',
                x: game.currentPlayer.x,
                y: game.currentPlayer.y,
                targetX: targetX,
                targetY: targetY
            });
        }

        this.keysPressed.add('z');
        
        const beam = new PIXI.Graphics();
        beam.alpha = 0.9;
        
        const player = game.currentPlayer;
        const updateBeam = () => {
            if (!this.keysPressed.has('z') || this.activeTransformation !== 'dragonLord') {
                this.stopDragonBeam();
                return;
            }

            beam.clear();
            
            // Get current mouse position for targeting
            const mouseX = game.mousePosition.x + game.camera.x;
            const mouseY = game.mousePosition.y + game.camera.y;
            
            // Calculate dragon mouth position - the dragon head is at position relative to player
            // The dragon head is positioned forward, and the mouth is at the tip
            const mouthX = player.x + 75; // Dragon mouth position (tip of snout)
            const mouthY = player.y - 5; // Slightly above center where the head is
            
            const dx = mouseX - mouthX;
            const dy = mouseY - mouthY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                // Main red beam coming from dragon mouth
                beam.lineStyle(20, 0xFF0000, 0.9);
                beam.moveTo(mouthX, mouthY);
                beam.lineTo(mouseX, mouseY);
                
                // Inner bright core
                beam.lineStyle(12, 0xFF6666, 0.8);
                beam.moveTo(mouthX, mouthY);
                beam.lineTo(mouseX, mouseY);
                
                // Innermost white-hot core
                beam.lineStyle(6, 0xFFFFFF, 0.7);
                beam.moveTo(mouthX, mouthY);
                beam.lineTo(mouseX, mouseY);
                
                // Check for damage along beam path
                this.checkBeamDamage(mouthX, mouthY, mouseX, mouseY);
            }
            
            requestAnimationFrame(updateBeam);
        };
        
        game.app.stage.addChild(beam);
        this.activeBeams.set(beamId, beam);
        updateBeam();
    }

    stopDragonBeam() {
        const beamId = 'dragonBeam';
        const beam = this.activeBeams.get(beamId);
        
        if (beam && beam.parent) {
            game.app.stage.removeChild(beam);
        }
        
        this.activeBeams.delete(beamId);
        this.keysPressed.delete('z');
    }

    checkBeamDamage(startX, startY, endX, endY) {
        if (!game || !client || !client.socket) return;
        
        // Send beam damage to server periodically
        const now = Date.now();
        if (!this.lastBeamDamage || now - this.lastBeamDamage > 100) { // 10 times per second
            client.socket.emit('beamDamage', {
                startX: startX,
                startY: startY,
                endX: endX,
                endY: endY,
                damage: 8 // Continuous damage
            });
            this.lastBeamDamage = now;
        }
    }

    showHealingEffect(data) {
        // Create healing screen effect
        const healingOverlay = document.createElement('div');
        healingOverlay.style.position = 'fixed';
        healingOverlay.style.top = '0';
        healingOverlay.style.left = '0';
        healingOverlay.style.width = '100%';
        healingOverlay.style.height = '100%';
        healingOverlay.style.background = 'radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%)';
        healingOverlay.style.pointerEvents = 'none';
        healingOverlay.style.zIndex = '9999';
        healingOverlay.style.animation = 'healingPulse 3s ease-out forwards';

        // Add healing pulse animation CSS
        if (!document.getElementById('healingAnimation')) {
            const style = document.createElement('style');
            style.id = 'healingAnimation';
            style.textContent = `
                @keyframes healingPulse {
                    0% { opacity: 0; transform: scale(0.5); }
                    50% { opacity: 0.8; transform: scale(1.2); }
                    100% { opacity: 0; transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(healingOverlay);

        // Add floating healing text
        const healingText = document.createElement('div');
        healingText.textContent = `✨ Healed by Admin ${data.adminName} ✨`;
        healingText.style.position = 'fixed';
        healingText.style.top = '50%';
        healingText.style.left = '50%';
        healingText.style.transform = 'translate(-50%, -50%)';
        healingText.style.color = '#ffd700';
        healingText.style.fontSize = '24px';
        healingText.style.fontWeight = 'bold';
        healingText.style.textShadow = '0 0 10px rgba(255, 215, 0, 0.8)';
        healingText.style.pointerEvents = 'none';
        healingText.style.zIndex = '10000';
        healingText.style.animation = 'healingText 3s ease-out forwards';

        // Add healing text animation CSS
        if (!document.getElementById('healingTextAnimation')) {
            const style = document.createElement('style');
            style.id = 'healingTextAnimation';
            style.textContent = `
                @keyframes healingText {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
                    30% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
                    70% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -60%) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(healingText);

        setTimeout(() => {
            if (healingOverlay.parentNode) {
                healingOverlay.parentNode.removeChild(healingOverlay);
            }
            if (healingText.parentNode) {
                healingText.parentNode.removeChild(healingText);
            }
        }, 3000);

        this.showNotification(`💖 You have been healed by Admin ${data.adminName}!`, 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.color = 'white';
        notification.style.fontSize = '14px';
        notification.style.zIndex = '2000';
        notification.style.transition = 'all 0.3s ease';

        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#27ae60';
                break;
            case 'error':
                notification.style.backgroundColor = '#e74c3c';
                break;
            case 'warning':
                notification.style.backgroundColor = '#f39c12';
                break;
            default:
                notification.style.backgroundColor = '#3498db';
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            notification.style.opacity = '0';
        }, 3000);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3300);
    }

    useTransformationSkill(skillKey) {
        if (!this.activeTransformation || !game || !game.currentPlayer || !client || !client.socket) return;
    
        const transformation = this.transformations[this.activeTransformation];
        if (!transformation || !transformation.skills || !transformation.skills[skillKey]) return;
    
        const skill = transformation.skills[skillKey];
        
        // Check cooldown
        const now = Date.now();
        const lastUsed = this.skillCooldowns.get(`${this.activeTransformation}_${skillKey}`) || 0;
        if (now - lastUsed < skill.cooldown) {
            const remaining = Math.ceil((skill.cooldown - (now - lastUsed)) / 1000);
            this.showNotification(`⏰ ${skill.name} on cooldown: ${remaining}s`, 'warning');
            return;
        }

        // Set cooldown
        this.skillCooldowns.set(`${this.activeTransformation}_${skillKey}`, now);
        
        // Get target position (where player is aiming)
        const targetX = game.mousePosition.x + game.camera.x;
        const targetY = game.mousePosition.y + game.camera.y;
    
        // Execute skill-specific effects
        switch (this.activeTransformation) {
            case 'adminGod':
                if (skillKey === 'z') {
                    this.executeAdminGodSkillZ();
                }
                if (skillKey === 'x') {
                    this.executeAdminGodSkillX(targetX, targetY);
                }
                if (skillKey === 'q') {
                    this.executeAdminGodSkillQ();
                }
                break;
            case 'bloodLust':
                if (skillKey === 'z') {
                    this.executeBloodLustSkillZ(targetX, targetY);
                }
                if (skillKey === 'x') {
                    this.executeBloodLustSkillX(targetX, targetY);
                }
                if (skillKey === 'q') {
                    this.executeBloodLustSkillQ();
                }
                break;
            case 'shadowNinja':
                if (skillKey === 'z') {
                    this.executeShadowNinjaSkillZ();
                }
                if (skillKey === 'x') {
                    this.executeShadowNinjaSkillX(targetX, targetY);
                }
                if (skillKey === 'q') {
                    this.executeShadowNinjaSkillQ();
                }
                break;
            case 'dragonLord':
                if (skillKey === 'z') {
                    this.startDragonBeam(targetX, targetY);
                }
                if (skillKey === 'x') {
                    this.executeDragonLordSkillX(targetX, targetY);
                }
                if (skillKey === 'q') {
                    this.executeDragonLordSkillQ();
                }
                break;
            case 'phoenixEmperor':
                if (skillKey === 'z') {
                    this.executePhoenixEmperorSkillZ();
                }
                if (skillKey === 'x') {
                    this.executePhoenixEmperorSkillX(targetX, targetY);
                }
                if (skillKey === 'q') {
                    this.executePhoenixEmperorSkillQ();
                }
                break;
            case 'voidLeviathanKing':
                if (skillKey === 'z') {
                    this.executeVoidLeviathanKingSkillZ(targetX, targetY);
                }
                if (skillKey === 'x') {
                    this.executeVoidLeviathanKingSkillX(targetX, targetY);
                }
                if (skillKey === 'q') {
                    this.executeVoidLeviathanKingSkillQ();
                }
                break;
            case 'celestialTigerGod':
                if (skillKey === 'z') {
                    this.executeCelestialTigerGodSkillZ(targetX, targetY);
                }
                if (skillKey === 'x') {
                    this.executeCelestialTigerGodSkillX();
                }
                if (skillKey === 'q') {
                    this.executeCelestialTigerGodSkillQ();
                }
                break;
        }
    
        this.showNotification(`✨ ${skill.name}!`, 'success');
    }

    // Admin God Skills
    executeAdminGodSkillZ() {
        if (client && client.socket) {
            const targetX = game.mousePosition.x + game.camera.x;
            const targetY = game.mousePosition.y + game.camera.y;
            
            client.socket.emit('summonDivinePresence');
            client.socket.emit('transformationAnimation', {
                transformationType: 'adminGod',
                animationType: 'skill',
                x: game.currentPlayer.x,
                y: game.currentPlayer.y,
                targetX: targetX,
                targetY: targetY
            });
        }
        this.createDivinePresenceEffect();
    }

    executeAdminGodSkillX(targetX, targetY) {
        this.createRainbowDivineBlast(targetX, targetY);
        if (client && client.socket) {
            client.socket.emit('transformationAnimation', {
                transformationType: 'adminGod',
                animationType: 'skill',
                x: game.currentPlayer.x,
                y: game.currentPlayer.y,
                targetX: targetX,
                targetY: targetY
            });
            client.socket.emit('adminDivineBlast', { targetX, targetY });
        }
    }

    executeAdminGodSkillQ() {
        this.createHeavenlyHealingWave();
        if (client && client.socket) {
            client.socket.emit('heavenlyHealingWave');
        }
    }

    // Blood Lust Skills
    executeBloodLustSkillZ(targetX, targetY) {
        this.createBloodTsunami(targetX, targetY);
        if (client && client.socket) {
            client.socket.emit('transformationAnimation', {
                transformationType: 'bloodLust',
                animationType: 'skill',
                x: game.currentPlayer.x,
                y: game.currentPlayer.y,
                targetX: targetX,
                targetY: targetY
            });
            client.socket.emit('bloodTsunami', { targetX, targetY });
        }
    }

    executeBloodLustSkillX(targetX, targetY) {
        this.createCrimsonBlitz(targetX, targetY);
        if (client && client.socket) {
            client.socket.emit('crimsonBlitz', { targetX, targetY });
        }
    }

    executeBloodLustSkillQ() {
        this.createSixTailBarrage();
        if (client && client.socket) {
            client.socket.emit('sixTailBarrage');
        }
    }

    // Shadow Ninja Skills
    executeShadowNinjaSkillZ() {
        this.createShadowCloneJutsu();
        if (client && client.socket) {
            client.socket.emit('transformationAnimation', {
                transformationType: 'shadowNinja',
                animationType: 'skill',
                x: game.currentPlayer.x,
                y: game.currentPlayer.y,
                targetX: game.currentPlayer.x,
                targetY: game.currentPlayer.y
            });
            client.socket.emit('shadowCloneJutsu');
        }
    }

    executeShadowNinjaSkillX(targetX, targetY) {
        this.createVoidStep(targetX, targetY);
        if (client && client.socket) {
            client.socket.emit('voidStep', { targetX, targetY });
        }
    }

    executeShadowNinjaSkillQ() {
        this.createDarknessDomain();
        if (client && client.socket) {
            client.socket.emit('darknessDomain');
        }
    }

    // Dragon Lord Skills
    executeDragonLordSkillZ(targetX, targetY) {
        this.createElementalBreath(targetX, targetY);
        if (client && client.socket) {
            client.socket.emit('elementalBreath', { targetX, targetY });
        }
    }

    executeDragonLordSkillX(targetX, targetY) {
        this.createDragonWingStorm(targetX, targetY);
        if (client && client.socket) {
            client.socket.emit('dragonWingStorm', { targetX, targetY });
        }
    }

    executeDragonLordSkillQ() {
        this.createAncientRoar();
        if (client && client.socket) {
            client.socket.emit('ancientRoar');
        }
    }

    // Phoenix Emperor Skills
    executePhoenixEmperorSkillZ() {
        this.createSolarFlareBurst();
        if (client && client.socket) {
            client.socket.emit('solarFlareBurst');
        }
    }

    executePhoenixEmperorSkillX(targetX, targetY) {
        this.createPhoenixDive(targetX, targetY);
        if (client && client.socket) {
            client.socket.emit('phoenixDive', { targetX, targetY });
        }
    }

    executePhoenixEmperorSkillQ() {
        this.createRebirthFlames();
        if (client && client.socket) {
            client.socket.emit('rebirthFlames');
        }
    }

    // Void Leviathan King Skills
    executeVoidLeviathanKingSkillZ(targetX, targetY) {
        this.createVoidTsunami(targetX, targetY);
        if (client && client.socket) {
            client.socket.emit('voidTsunami', { targetX, targetY });
        }
    }

    executeVoidLeviathanKingSkillX(targetX, targetY) {
        this.createDimensionalCoil(targetX, targetY);
        if (client && client.socket) {
            client.socket.emit('dimensionalCoil', { targetX, targetY });
        }
    }

    executeVoidLeviathanKingSkillQ() {
        this.createCosmicDevastation();
        if (client && client.socket) {
            client.socket.emit('cosmicDevastation');
        }
    }

    // Celestial Tiger God Skills
    executeCelestialTigerGodSkillZ(targetX, targetY) {
        this.createDivineLightningPounce(targetX, targetY);
        if (client && client.socket) {
            client.socket.emit('divineLightningPounce', { targetX, targetY });
        }
    }

    executeCelestialTigerGodSkillX() {
        this.createCelestialRoar();
        if (client && client.socket) {
            client.socket.emit('celestialRoar');
        }
    }

    executeCelestialTigerGodSkillQ() {
        this.createTigerGodDomain();
        if (client && client.socket) {
            client.socket.emit('tigerGodDomain');
        }
    }

    // Skill Effect Implementations
    createDivinePresenceEffect() {
        if (!game || !game.app) return;

        const effect = new PIXI.Container();
        
        // Create divine light pillars
        for (let i = 0; i < 8; i++) {
            const pillar = new PIXI.Graphics();
            pillar.beginFill(0xFFD700, 0.8);
            pillar.drawRect(-10, -200, 20, 400);
            pillar.endFill();
            
            const angle = (i / 8) * Math.PI * 2;
            pillar.x = Math.cos(angle) * 100;
            pillar.y = Math.sin(angle) * 100;
            pillar.rotation = angle;
            
            effect.addChild(pillar);
        }

        effect.x = game.currentPlayer.x;
        effect.y = game.currentPlayer.y;
        game.app.stage.addChild(effect);

        // Animate and remove
        let scale = 0;
        const animate = () => {
            if (effect.parent) {
                scale += 0.05;
                effect.scale.set(scale);
                effect.alpha = 1 - scale * 0.5;
                if (scale < 2) {
                    requestAnimationFrame(animate);
                } else {
                    game.app.stage.removeChild(effect);
                }
            }
        };
        animate();
    }

    createRainbowDivineBlast(targetX, targetY) {
        if (!game || !game.app) return;

        const colors = [0xFF0000, 0xFF7F00, 0xFFFF00, 0x00FF00, 0x0000FF, 0x4B0082, 0x9400D3];
        
        for (let i = 0; i < colors.length; i++) {
            setTimeout(() => {
                const blast = new PIXI.Graphics();
                blast.beginFill(colors[i], 0.8);
                blast.drawCircle(0, 0, 30);
                blast.endFill();

                blast.x = game.currentPlayer.x;
                blast.y = game.currentPlayer.y;
                game.app.stage.addChild(blast);

                const dx = targetX - blast.x;
                const dy = targetY - blast.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const speed = 15;
                const vx = (dx / distance) * speed;
                const vy = (dy / distance) * speed;

                const animate = () => {
                    if (blast.parent) {
                        blast.x += vx;
                        blast.y += vy;
                        blast.scale.set(blast.scale.x + 0.02);

                        const traveled = Math.sqrt((blast.x - game.currentPlayer.x) ** 2 + (blast.y - game.currentPlayer.y) ** 2);
                        if (traveled >= distance) {
                            game.app.stage.removeChild(blast);
                        } else {
                            requestAnimationFrame(animate);
                        }
                    }
                };
                animate();
            }, i * 100);
        }
    }

    createHeavenlyHealingWave() {
        if (!game || !game.app) return;

        const wave = new PIXI.Graphics();
        wave.lineStyle(8, 0xFFD700, 0.8);
        wave.drawCircle(0, 0, 50);
        wave.x = game.currentPlayer.x;
        wave.y = game.currentPlayer.y;
        game.app.stage.addChild(wave);

        let radius = 50;
        const animate = () => {
            if (wave.parent) {
                wave.clear();
                wave.lineStyle(8, 0xFFD700, 0.8 - (radius / 500));
                wave.drawCircle(0, 0, radius);
                radius += 10;
                if (radius < 500) {
                    requestAnimationFrame(animate);
                } else {
                    game.app.stage.removeChild(wave);
                }
            }
        };
        animate();
    }

    createBloodTsunami(targetX, targetY) {
        if (!game || !game.app) return;

        for (let i = 0; i < 10; i++) {
            setTimeout(() => {
                const wave = new PIXI.Graphics();
                wave.beginFill(0x8B0000, 0.8);
                wave.drawRect(-40, -20, 80, 40);
                wave.endFill();

                const angle = Math.atan2(targetY - game.currentPlayer.y, targetX - game.currentPlayer.x);
                const spreadAngle = angle + (i - 5) * 0.2;
                
                wave.x = game.currentPlayer.x;
                wave.y = game.currentPlayer.y;
                wave.rotation = spreadAngle;
                game.app.stage.addChild(wave);

                const speed = 12;
                const vx = Math.cos(spreadAngle) * speed;
                const vy = Math.sin(spreadAngle) * speed;

                let distance = 0;
                const animate = () => {
                    if (wave.parent && distance < 400) {
                        wave.x += vx;
                        wave.y += vy;
                        distance += speed;
                        requestAnimationFrame(animate);
                    } else if (wave.parent) {
                        game.app.stage.removeChild(wave);
                    }
                };
                animate();
            }, i * 50);
        }
    }

    createCrimsonBlitz(targetX, targetY) {
        if (!game || !game.app || !game.currentPlayer) return;

        const trail = new PIXI.Graphics();
        trail.lineStyle(6, 0xFF0000, 0.8);
        trail.moveTo(game.currentPlayer.x, game.currentPlayer.y);
        trail.lineTo(targetX, targetY);
        game.app.stage.addChild(trail);

        // Teleport effect
        const oldX = game.currentPlayer.x;
        const oldY = game.currentPlayer.y;
        game.currentPlayer.x = targetX;
        game.currentPlayer.y = targetY;

        setTimeout(() => {
            if (trail.parent) {
                game.app.stage.removeChild(trail);
            }
        }, 500);
    }

    createSixTailBarrage() {
        if (!game || !game.app || !this.nineTails) return;

        this.nineTails.forEach((tail, index) => {
            setTimeout(() => {
                for (let i = 0; i < 5; i++) {
                    setTimeout(() => {
                        const projectile = new PIXI.Graphics();
                        projectile.beginFill(0x8B0000, 0.8); // Same color as body/tails
                        projectile.drawCircle(0, 0, 8);
                        projectile.endFill();

                        projectile.x = tail.x + game.currentPlayer.x;
                        projectile.y = tail.y + game.currentPlayer.y;
                        game.app.stage.addChild(projectile);

                        const angle = Math.random() * Math.PI * 2;
                        const speed = 8;
                        const vx = Math.cos(angle) * speed;
                        const vy = Math.sin(angle) * speed;

                        let distance = 0;
                        const animate = () => {
                            if (projectile.parent && distance < 300) {
                                projectile.x += vx;
                                projectile.y += vy;
                                distance += speed;
                                requestAnimationFrame(animate);
                            } else if (projectile.parent) {
                                game.app.stage.removeChild(projectile);
                            }
                        };
                        animate();
                    }, i * 100);
                }
            }, index * 200);
        });
    }

    createShadowCloneJutsu() {
        if (!game || !game.app) return;

        for (let i = 0; i < 5; i++) {
            const clone = new PIXI.Graphics();
            clone.beginFill(0x444444, 0.7);
            clone.lineStyle(2, 0x8A2BE2);
            clone.drawCircle(0, 0, 20);
            clone.endFill();

            const angle = (i / 5) * Math.PI * 2;
            clone.x = game.currentPlayer.x + Math.cos(angle) * 80;
            clone.y = game.currentPlayer.y + Math.sin(angle) * 80;
            game.app.stage.addChild(clone);

            setTimeout(() => {
                if (clone.parent) {
                    game.app.stage.removeChild(clone);
                }
            }, 3000);
        }
    }

    createVoidStep(targetX, targetY) {
        if (!game || !game.app || !game.currentPlayer) return;

        // Create void portal at current position
        const portal1 = new PIXI.Graphics();
        portal1.beginFill(0x8A2BE2, 0.8);
        portal1.drawCircle(0, 0, 30);
        portal1.endFill();
        portal1.x = game.currentPlayer.x;
        portal1.y = game.currentPlayer.y;
        game.app.stage.addChild(portal1);

        // Create void portal at target position
        const portal2 = new PIXI.Graphics();
        portal2.beginFill(0x8A2BE2, 0.8);
        portal2.drawCircle(0, 0, 30);
        portal2.endFill();
        portal2.x = targetX;
        portal2.y = targetY;
        game.app.stage.addChild(portal2);

        // Teleport player
        setTimeout(() => {
            game.currentPlayer.x = targetX;
            game.currentPlayer.y = targetY;
        }, 200);

        // Remove portals
        setTimeout(() => {
            if (portal1.parent) game.app.stage.removeChild(portal1);
            if (portal2.parent) game.app.stage.removeChild(portal2);
        }, 1000);
    }

    createDarknessDomain() {
        if (!game || !game.app) return;

        const darkness = new PIXI.Graphics();
        darkness.beginFill(0x000000, 0.7);
        darkness.drawCircle(0, 0, 200);
        darkness.endFill();
        darkness.x = game.currentPlayer.x;
        darkness.y = game.currentPlayer.y;
        game.app.stage.addChild(darkness);

        setTimeout(() => {
            if (darkness.parent) {
                game.app.stage.removeChild(darkness);
            }
        }, 5000);
    }

    createElementalBreath(targetX, targetY) {
        if (!game || !game.app) return;

        const elements = [0xFF0000, 0x0000FF, 0xFFFF00]; // Fire, Ice, Lightning
        
        elements.forEach((color, index) => {
            setTimeout(() => {
                const breath = new PIXI.Graphics();
                breath.beginFill(color, 0.8);
                
                // Create cone shape for breath
                breath.moveTo(0, 0);
                breath.lineTo(200, -50);
                breath.lineTo(200, 50);
                breath.lineTo(0, 0);
                breath.endFill();

                const angle = Math.atan2(targetY - game.currentPlayer.y, targetX - game.currentPlayer.x);
                breath.x = game.currentPlayer.x;
                breath.y = game.currentPlayer.y;
                breath.rotation = angle;
                game.app.stage.addChild(breath);

                setTimeout(() => {
                    if (breath.parent) {
                        game.app.stage.removeChild(breath);
                    }
                }, 1000);
            }, index * 300);
        });
    }

    createDragonWingStorm(targetX, targetY) {
        if (!game || !game.app) return;

        for (let i = 0; i < 3; i++) {
            const tornado = new PIXI.Graphics();
            tornado.lineStyle(8, 0x87CEEB, 0.8);
            
            // Draw tornado spiral
            for (let j = 0; j < 50; j++) {
                const angle = (j / 50) * Math.PI * 6;
                const radius = j * 2;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius - j * 4;
                
                if (j === 0) {
                    tornado.moveTo(x, y);
                } else {
                    tornado.lineTo(x, y);
                }
            }

            tornado.x = targetX + (i - 1) * 100;
            tornado.y = targetY;
            game.app.stage.addChild(tornado);

            let rotation = 0;
            const animate = () => {
                if (tornado.parent && rotation < Math.PI * 4) {
                    tornado.rotation += 0.2;
                    rotation += 0.2;
                    requestAnimationFrame(animate);
                } else if (tornado.parent) {
                    game.app.stage.removeChild(tornado);
                }
            };
            animate();
        }
    }

    createAncientRoar() {
        if (!game || !game.app) return;

        // Create shockwave rings
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const ring = new PIXI.Graphics();
                ring.lineStyle(6, 0xFFD700, 0.8);
                ring.drawCircle(0, 0, 80);
                ring.x = game.currentPlayer.x;
                ring.y = game.currentPlayer.y;
                game.app.stage.addChild(ring);

                let scale = 1;
                const animate = () => {
                    if (ring.parent && scale < 6) {
                        scale += 0.1;
                        ring.scale.set(scale);
                        ring.alpha = 1 - (scale / 6);
                        requestAnimationFrame(animate);
                    } else if (ring.parent) {
                        game.app.stage.removeChild(ring);
                    }
                };
                animate();
            }, i * 200);
        }

        // Create meteors
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                const meteor = new PIXI.Graphics();
                meteor.beginFill(0xFF4500, 0.9);
                meteor.drawCircle(0, 0, 15);
                meteor.endFill();

                meteor.x = game.currentPlayer.x + (Math.random() - 0.5) * 600;
                meteor.y = game.currentPlayer.y - 400;
                game.app.stage.addChild(meteor);

                const targetY = game.currentPlayer.y + (Math.random() - 0.5) * 300;
                const speed = 12;

                const animate = () => {
                    if (meteor.parent && meteor.y < targetY) {
                        meteor.y += speed;
                        requestAnimationFrame(animate);
                    } else if (meteor.parent) {
                        // Explosion effect
                        const explosion = new PIXI.Graphics();
                        explosion.beginFill(0xFF4500, 0.8);
                        explosion.drawCircle(0, 0, 40);
                        explosion.endFill();
                        explosion.x = meteor.x;
                        explosion.y = meteor.y;
                        game.app.stage.addChild(explosion);
                        
                        game.app.stage.removeChild(meteor);
                        
                        setTimeout(() => {
                            if (explosion.parent) {
                                game.app.stage.removeChild(explosion);
                            }
                        }, 500);
                    }
                };
                animate();
            }, i * 300);
        }
    }

    createSolarFlareBurst() {
        if (!game || !game.app) return;

        const flare = new PIXI.Graphics();
        flare.beginFill(0xFFD700, 0.9);
        flare.drawCircle(0, 0, 50);
        flare.endFill();
        flare.x = game.currentPlayer.x;
        flare.y = game.currentPlayer.y;
        game.app.stage.addChild(flare);

        let scale = 1;
        const animate = () => {
            if (flare.parent && scale < 8) {
                scale += 0.2;
                flare.scale.set(scale);
                flare.alpha = 1 - (scale / 8);
                requestAnimationFrame(animate);
            } else if (flare.parent) {
                game.app.stage.removeChild(flare);
            }
        };
        animate();
    }

    createPhoenixDive(targetX, targetY) {
        if (!game || !game.app || !game.currentPlayer) return;

        // Create fire trail
        const trail = new PIXI.Graphics();
        trail.lineStyle(10, 0xFF4500, 0.8);
        trail.moveTo(game.currentPlayer.x, game.currentPlayer.y);
        trail.lineTo(targetX, targetY);
        game.app.stage.addChild(trail);

        // Move player in arc
        const startX = game.currentPlayer.x;
        const startY = game.currentPlayer.y;
        const midY = Math.min(startY, targetY) - 200; // Arc height
        
        let progress = 0;
        const animate = () => {
            if (progress < 1) {
                progress += 0.05;
                
                // Quadratic bezier curve for arc movement
                const t = progress;
                const invT = 1 - t;
                
                game.currentPlayer.x = invT * invT * startX + 2 * invT * t * ((startX + targetX) / 2) + t * t * targetX;
                game.currentPlayer.y = invT * invT * startY + 2 * invT * t * midY + t * t * targetY;
                
                requestAnimationFrame(animate);
            } else {
                // Impact explosion
                const explosion = new PIXI.Graphics();
                explosion.beginFill(0xFF4500, 0.8);
                explosion.drawCircle(0, 0, 60);
                explosion.endFill();
                explosion.x = targetX;
                explosion.y = targetY;
                game.app.stage.addChild(explosion);
                
                setTimeout(() => {
                    if (explosion.parent) game.app.stage.removeChild(explosion);
                    if (trail.parent) game.app.stage.removeChild(trail);
                }, 1000);
            }
        };
        animate();
    }

    createRebirthFlames() {
        if (!game || !game.app) return;

        const flames = new PIXI.Graphics();
        flames.beginFill(0xFF4500, 0.8);
        flames.drawCircle(0, 0, 100);
        flames.endFill();
        flames.x = game.currentPlayer.x;
        flames.y = game.currentPlayer.y;
        game.app.stage.addChild(flames);

        // Pulsing effect
        let pulse = 0;
        const animate = () => {
            if (flames.parent && pulse < Math.PI * 4) {
                pulse += 0.2;
                flames.scale.set(1 + Math.sin(pulse) * 0.3);
                requestAnimationFrame(animate);
            } else if (flames.parent) {
                game.app.stage.removeChild(flames);
            }
        };
        animate();
    }

    createVoidTsunami(targetX, targetY) {
        if (!game || !game.app) return;

        for (let i = 0; i < 15; i++) {
            setTimeout(() => {
                const voidWave = new PIXI.Graphics();
                voidWave.beginFill(0x4400aa, 0.8);
                voidWave.drawRect(-50, -25, 100, 50);
                voidWave.endFill();

                const angle = Math.atan2(targetY - game.currentPlayer.y, targetX - game.currentPlayer.x);
                const spreadAngle = angle + (i - 7) * 0.15;
                
                voidWave.x = game.currentPlayer.x;
                voidWave.y = game.currentPlayer.y;
                voidWave.rotation = spreadAngle;
                game.app.stage.addChild(voidWave);

                const speed = 15;
                const vx = Math.cos(spreadAngle) * speed;
                const vy = Math.sin(spreadAngle) * speed;

                let distance = 0;
                const animate = () => {
                    if (voidWave.parent && distance < 500) {
                        voidWave.x += vx;
                        voidWave.y += vy;
                        distance += speed;
                        voidWave.scale.set(voidWave.scale.x + 0.01);
                        requestAnimationFrame(animate);
                    } else if (voidWave.parent) {
                        game.app.stage.removeChild(voidWave);
                    }
                };
                animate();
            }, i * 30);
        }
    }

    createDimensionalCoil(targetX, targetY) {
        if (!game || !game.app) return;

        const coil = new PIXI.Graphics();
        coil.lineStyle(8, 0x8800ff, 0.8);
        
        // Create spiral coil
        for (let i = 0; i < 100; i++) {
            const angle = (i / 100) * Math.PI * 8;
            const radius = (i / 100) * 150;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) {
                coil.moveTo(x, y);
            } else {
                coil.lineTo(x, y);
            }
        }

        coil.x = targetX;
        coil.y = targetY;
        game.app.stage.addChild(coil);

        let rotation = 0;
        const animate = () => {
            if (coil.parent && rotation < Math.PI * 6) {
                coil.rotation += 0.3;
                rotation += 0.3;
                requestAnimationFrame(animate);
            } else if (coil.parent) {
                game.app.stage.removeChild(coil);
            }
        };
        animate();
    }

    createCosmicDevastation() {
        if (!game || !game.app) return;

        // Create multiple cosmic explosions
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const explosion = new PIXI.Graphics();
                explosion.beginFill(0x8800ff, 0.8);
                explosion.drawStar(0, 0, 8, 30, 15);
                explosion.endFill();

                const angle = (i / 12) * Math.PI * 2;
                explosion.x = game.currentPlayer.x + Math.cos(angle) * 200;
                explosion.y = game.currentPlayer.y + Math.sin(angle) * 200;
                game.app.stage.addChild(explosion);

                let scale = 0.1;
                const animate = () => {
                    if (explosion.parent && scale < 3) {
                        scale += 0.1;
                        explosion.scale.set(scale);
                        explosion.rotation += 0.1;
                        requestAnimationFrame(animate);
                    } else if (explosion.parent) {
                        game.app.stage.removeChild(explosion);
                    }
                };
                animate();
            }, i * 200);
        }
    }

    createDivineLightningPounce(targetX, targetY) {
        if (!game || !game.app || !game.currentPlayer) return;

        // Create lightning trail
        const lightning = new PIXI.Graphics();
        lightning.lineStyle(6, 0x00FFFF, 0.9);
        
        // Jagged lightning effect
        let currentX = game.currentPlayer.x;
        let currentY = game.currentPlayer.y;
        lightning.moveTo(currentX, currentY);
        
        const segments = 10;
        for (let i = 1; i <= segments; i++) {
            const progress = i / segments;
            const nextX = game.currentPlayer.x + (targetX - game.currentPlayer.x) * progress + (Math.random() - 0.5) * 50;
            const nextY = game.currentPlayer.y + (targetY - game.currentPlayer.y) * progress + (Math.random() - 0.5) * 50;
            lightning.lineTo(nextX, nextY);
            currentX = nextX;
            currentY = nextY;
        }
        
        game.app.stage.addChild(lightning);

        // Teleport player with lightning effect
        setTimeout(() => {
            game.currentPlayer.x = targetX;
            game.currentPlayer.y = targetY;
            
            // Lightning impact
            const impact = new PIXI.Graphics();
            impact.beginFill(0x00FFFF, 0.8);
            impact.drawStar(0, 0, 6, 40, 20);
            impact.endFill();
            impact.x = targetX;
            impact.y = targetY;
            game.app.stage.addChild(impact);
            
            setTimeout(() => {
                if (impact.parent) game.app.stage.removeChild(impact);
                if (lightning.parent) game.app.stage.removeChild(lightning);
            }, 800);
        }, 200);
    }

    createCelestialRoar() {
        if (!game || !game.app) return;

        // Create massive shockwave with celestial energy
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                const wave = new PIXI.Graphics();
                wave.lineStyle(8, 0xFFD700, 0.8);
                wave.drawCircle(0, 0, 100 + i * 30);
                wave.x = game.currentPlayer.x;
                wave.y = game.currentPlayer.y;
                game.app.stage.addChild(wave);

                let scale = 1;
                const animate = () => {
                    if (wave.parent && scale < 5) {
                        scale += 0.08;
                        wave.scale.set(scale);
                        wave.alpha = 1 - (scale / 5);
                        requestAnimationFrame(animate);
                    } else if (wave.parent) {
                        game.app.stage.removeChild(wave);
                    }
                };
                animate();
            }, i * 100);
        }

        // Create divine judgment beams
        for (let i = 0; i < 16; i++) {
            setTimeout(() => {
                const beam = new PIXI.Graphics();
                beam.beginFill(0x00FFFF, 0.8);
                beam.drawRect(-10, -300, 20, 600);
                beam.endFill();

                const angle = (i / 16) * Math.PI * 2;
                beam.x = game.currentPlayer.x + Math.cos(angle) * 200;
                beam.y = game.currentPlayer.y + Math.sin(angle) * 200;
                beam.rotation = angle;
                game.app.stage.addChild(beam);

                setTimeout(() => {
                    if (beam.parent) {
                        game.app.stage.removeChild(beam);
                    }
                }, 1500);
            }, i * 50);
        }
    }

    createTigerGodDomain() {
        if (!game || !game.app) return;

        const domain = new PIXI.Graphics();
        domain.beginFill(0xFFD700, 0.3);
        domain.lineStyle(5, 0x00FFFF, 0.8);
        domain.drawCircle(0, 0, 300);
        domain.endFill();
        domain.x = game.currentPlayer.x;
        domain.y = game.currentPlayer.y;
        game.app.stage.addChild(domain);

        // Add tiger markings in the domain
        for (let i = 0; i < 8; i++) {
            const marking = new PIXI.Graphics();
            marking.lineStyle(6, 0x000000, 0.8);
            const angle = (i / 8) * Math.PI * 2;
            const x1 = Math.cos(angle) * 200;
            const y1 = Math.sin(angle) * 200;
            const x2 = Math.cos(angle) * 250;
            const y2 = Math.sin(angle) * 250;
            
            marking.moveTo(x1, y1);
            marking.lineTo(x2, y2);
            marking.x = game.currentPlayer.x;
            marking.y = game.currentPlayer.y;
            game.app.stage.addChild(marking);

            setTimeout(() => {
                if (marking.parent) {
                    game.app.stage.removeChild(marking);
                }
            }, 8000);
        }

        setTimeout(() => {
            if (domain.parent) {
                game.app.stage.removeChild(domain);
            }
        }, 8000);
    }
}

const ui = new UI();

// Attach keyboard event listener globally
document.addEventListener('keydown', (e) => {
    if (game && game.currentPlayer) {
        // Movement keys are handled in game.js
        if (e.key === 'm') {
            ui.showTransformationModal();
        }

        if (game && game.handleKeyDown) {
            game.handleKeyDown(e);
        }

        // Spell hotkeys
        const spellKeys = {
            '1': 'fire',
            '2': 'ice', 
            '3': 'lightning',
            '4': 'earth',
            '5': 'wind',
            '6': 'shadow',
            '7': 'light',
            '8': 'void',
            '9': 'soul'
        };

        if (spellKeys[e.key] && game.currentPlayer && game.currentPlayer.playerData) {
            const spellType = spellKeys[e.key];
            if (game.currentPlayer.playerData.magicLevels[spellType] > 0) {
                game.selectedSpell = spellType;
                ui.updateSpellSelection();
            }
        }

        // Transformation skill hotkeys
        if (ui.activeTransformation && ui.transformations) {
            const activeTransformationData = ui.transformations[ui.activeTransformation];
            if (activeTransformationData && activeTransformationData.skills) {
                const now = Date.now();

                if (e.key.toLowerCase() === 'z' && activeTransformationData.skills.z) {
                    const skill = activeTransformationData.skills.z;
                    const lastUsed = ui.skillCooldowns.get('z') || 0;
                    if (now - lastUsed >= skill.cooldown) {
                        ui.useTransformationSkill('z');
                        ui.skillCooldowns.set('z', now);
                    }
                }

                if (e.key.toLowerCase() === 'x' && activeTransformationData.skills.x) {
                    const skill = activeTransformationData.skills.x;
                    const lastUsed = ui.skillCooldowns.get('x') || 0;
                    if (now - lastUsed >= skill.cooldown) {
                        ui.useTransformationSkill('x');
                        ui.skillCooldowns.set('x', now);
                    }
                }

                if (e.key.toLowerCase() === 'q' && activeTransformationData.skills.q) {
                    const skill = activeTransformationData.skills.q;
                    const lastUsed = ui.skillCooldowns.get('q') || 0;
                    if (now - lastUsed >= skill.cooldown) {
                        ui.useTransformationSkill('q');
                        ui.skillCooldowns.set('q', now);
                    }
                }
            }
        }
    }
});