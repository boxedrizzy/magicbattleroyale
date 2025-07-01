class Game {
    constructor() {
        this.app = new PIXI.Application({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0x2c3e50,
            antialias: true
        });
        
        document.getElementById('gameCanvas').appendChild(this.app.view);
        
        this.players = new Map();
        this.scrolls = new Map();
        this.spells = new Map();
        this.environments = new Map();
        
        this.currentPlayer = null;
        this.keys = {};
        this.mousePosition = { x: 0, y: 0 };
        this.selectedSpell = null;
        this.camera = { x: 0, y: 0 };
        this.worldSize = { width: 6000, height: 6000 };
        this.magicCooldowns = {
            fire: 0,
            ice: 0,
            lightning: 0,
            earth: 0,
            wind: 0,
            shadow: 0,
            light: 0,
            void: 0,
            soul: 0
        };
        this.magicReloadTimes = {
            fire: 800,      // 0.8 seconds
            ice: 600,       // 0.6 seconds
            lightning: 1200, // 1.2 seconds
            earth: 2000,    // 2 seconds
            wind: 1500,     // 1.5 seconds
            shadow: 3000,   // 3 seconds
            light: 2500,    // 2.5 seconds
            void: 2000,     // 2 seconds
            soul: 3500      // 3.5 seconds
        };
        
        this.demonStatues = new Map();
        this.activeDemonStatues = new Map();
        this.statuesKilled = 0;
        
        this.init();
        
        // Start health regeneration timer (every second)
        setInterval(() => {
            this.updateHealthRegeneration();
        }, 1000);
    }
    
    init() {
        this.setupEventListeners();
        this.createWorld();
        this.initializeMagicMenu();
        this.initializeMinimap();
        this.initializeLeaderboard();
        this.startGameLoop();
    }
    
    setupEventListeners() {
        // Enhanced global error handler
        window.addEventListener('unhandledrejection', (event) => {
            // Suppress console warnings for undefined errors and handled rejections
            if (event.reason && event.reason.message && 
                (event.reason.message.includes('WebSocket') || 
                 event.reason.message.includes('socket') ||
                 event.reason.message.includes('undefined'))) {
                event.preventDefault();
                return;
            }
            console.warn('Unhandled promise rejection:', event.reason);
            event.preventDefault();
        });

        window.addEventListener('error', (event) => {
            // Suppress console warnings for minor errors
            if (event.error && event.error.message && 
                (event.error.message.includes('WebSocket') || 
                 event.error.message.includes('socket') ||
                 event.error.message.includes('undefined'))) {
                return;
            }
            console.warn('Global error:', event.error);
        });

        // Keyboard events
        window.addEventListener('keydown', (e) => {
            const key = e.key ? e.key.toLowerCase() : '';
            this.keys[key] = true;
            if (e.key === 'Shift') {
                this.keys['shift'] = true;
            }
            
            // Transformation skill hotkeys
            if (ui && ui.activeTransformation) {
                if (e.key === 'z' || e.key === 'Z') {
                    ui.useTransformationSkill('z');
                } else if (e.key === 'x' || e.key === 'X') {
                    ui.useTransformationSkill('x');
                } else if (e.key === 'q' || e.key === 'Q') {
                    ui.useTransformationSkill('q');
                }
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
            
            if (spellKeys[e.key] && this.currentPlayer && this.currentPlayer.playerData) {
                const spellType = spellKeys[e.key];
                if (this.currentPlayer.playerData.magicLevels[spellType] > 0) {
                    this.selectedSpell = spellType;
                    this.updateSpellSelection();
                }
            }
        });
        
        window.addEventListener('keyup', (e) => {
            const key = e.key ? e.key.toLowerCase() : '';
            this.keys[key] = false;
            if (e.key === 'Shift') {
                this.keys['shift'] = false;
            }
            
            // Handle transformation skill key releases
            if (ui && ui.activeTransformation) {
                if (e.key === 'z' || e.key === 'Z') {
                    ui.keysPressed.delete('z');
                    if (ui.activeTransformation === 'dragonLord') {
                        ui.stopDragonBeam();
                    }
                }
            }
        });
        
        // Mouse events
        this.app.view.addEventListener('mousemove', (e) => {
            const rect = this.app.view.getBoundingClientRect();
            this.mousePosition.x = e.clientX - rect.left;
            this.mousePosition.y = e.clientY - rect.top;
            
            // Update wall preview if earth magic is selected
            if (this.updateWallPreview) {
                this.updateWallPreview();
            }
        });
        
        this.app.view.addEventListener('click', (e) => {
            if (this.currentPlayer) {
                const rect = this.app.view.getBoundingClientRect();
                const worldX = (e.clientX - rect.left) + this.camera.x;
                const worldY = (e.clientY - rect.top) + this.camera.y;
                
                if (e.button === 0) { // Left click
                    if (this.selectedSpell && this.currentPlayer.playerData.magicLevels[this.selectedSpell] > 0) {
                        // Check cooldown before casting
                        if (this.magicCooldowns[this.selectedSpell] <= 0) {
                            this.castSpell(this.selectedSpell, worldX, worldY);
                            this.magicCooldowns[this.selectedSpell] = this.magicReloadTimes[this.selectedSpell];
                        }
                    } else {
                        // Swing wand if no spell selected
                        this.swingWand(worldX, worldY);
                    }
                }
            }
        });
        
        // Resize handler
        window.addEventListener('resize', () => {
            this.app.renderer.resize(window.innerWidth, window.innerHeight);
        });
    }
    
    createWorld() {
        // Create larger world background
        const background = new PIXI.Graphics();
        background.beginFill(0x1e3a1e);
        background.drawRect(0, 0, this.worldSize.width, this.worldSize.height);
        background.endFill();
        this.app.stage.addChild(background);
        
        // Add environmental objects across the larger world
        this.addEnvironmentalObjects();
        
        // Create world container for camera movement
        this.worldContainer = new PIXI.Container();
        this.app.stage.addChild(this.worldContainer);
    }
    
    addEnvironmentalObjects() {
        this.envPositions = []; // Track positions to prevent overlap
        
        // Add paths across the map first
        this.createPaths();
        
        // Add dungeon entrance (after paths so it overlays them)
        this.createDungeonEntrance();
        this.app.stage.addChild(this.dungeonEntrance);
        
        // Add scattered pebbles
        this.createPebbles();
        
        // Add bushes for concealment
        this.createBushes();
        
        // Add demon statues
        this.createDemonStatues();
        
        // Trees across the larger world
        for (let i = 0; i < 50; i++) {
            const treeContainer = new PIXI.Container();
            
            // Generate non-overlapping position that avoids trails
            let x, y, attempts = 0;
            do {
                x = Math.random() * (this.worldSize.width - 200) + 100;
                y = Math.random() * (this.worldSize.height - 200) + 100;
                attempts++;
            } while ((this.isPositionOccupied(x, y, 60) || this.isPositionOnTrail(x, y, 50)) && attempts < 100);
            
            // Shadow with black border
            const shadow = new PIXI.Graphics();
            shadow.lineStyle(1, 0x000000); // Black border
            shadow.beginFill(0x000000, 0.3);
            shadow.drawEllipse(2, 12, 12, 6);
            shadow.endFill();
            treeContainer.addChild(shadow);
            
            // Try to load tree texture, fallback to graphics if not available
            const treeTexture = PIXI.Texture.from('assets/tree.png');
            treeTexture.baseTexture.on('error', () => {
                // Fallback to graphics if image fails to load
                const treeGraphics = new PIXI.Graphics();
                treeGraphics.lineStyle(3, 0x000000); // Black border
                treeGraphics.beginFill(0x2d5016);
                treeGraphics.drawCircle(0, 0, 15);
                treeGraphics.endFill();
                treeContainer.addChild(treeGraphics);
            });
            
            const treeSprite = new PIXI.Sprite(treeTexture);
            treeSprite.anchor.set(0.5);
            treeSprite.scale.set(0.4); // Smaller trees
            
            // Add black border to tree sprite
            const treeBorder = new PIXI.Graphics();
            treeBorder.lineStyle(3, 0x000000);
            treeBorder.drawCircle(0, 0, 18); // Slightly larger than tree
            treeContainer.addChild(treeBorder);
            treeContainer.addChild(treeSprite);
            
            treeContainer.x = x;
            treeContainer.y = y;
            treeContainer.interactive = true;
            treeContainer.buttonMode = true;
            treeContainer.envType = 'tree';
            treeContainer.health = 3;
            treeContainer.maxHealth = 3;
            treeContainer.radius = 15; // Collision radius
            
            this.envPositions.push({x, y, radius: 60}); // Track position
            
            const envId = `tree_${i}`;
            this.environments.set(envId, treeContainer);
            this.app.stage.addChild(treeContainer);
        }
        
        // Rocks across the larger world
        for (let i = 0; i < 30; i++) {
            const rockContainer = new PIXI.Container();
            
            // Generate non-overlapping position that avoids trails
            let x, y, attempts = 0;
            do {
                x = Math.random() * (this.worldSize.width - 200) + 100;
                y = Math.random() * (this.worldSize.height - 200) + 100;
                attempts++;
            } while ((this.isPositionOccupied(x, y, 50) || this.isPositionOnTrail(x, y, 50)) && attempts < 100);
            
            // Shadow with black border
            const shadow = new PIXI.Graphics();
            shadow.lineStyle(1, 0x000000); // Black border
            shadow.beginFill(0x000000, 0.3);
            shadow.drawEllipse(2, 15, 15, 8);
            shadow.endFill();
            rockContainer.addChild(shadow);
            
            // Create rock graphics with black border
            const rock = new PIXI.Graphics();
            rock.lineStyle(4, 0x000000); // Black border
            rock.beginFill(0x666666);
            rock.drawPolygon([
                -15, 10,   // bottom left
                -20, -5,   // top left
                -5, -15,   // top middle
                10, -10,   // top right
                20, 5,     // bottom right
                5, 15      // bottom middle
            ]);
            rock.endFill();
            rockContainer.addChild(rock);
            
            rockContainer.x = x;
            rockContainer.y = y;
            rockContainer.interactive = true;
            rockContainer.buttonMode = true;
            rockContainer.envType = 'rock';
            rockContainer.health = 5;
            rockContainer.maxHealth = 5;
            rockContainer.radius = 20; // Collision radius
            
            this.envPositions.push({x, y, radius: 50}); // Track position
            
            const envId = `rock_${i}`;
            this.environments.set(envId, rockContainer);
            this.app.stage.addChild(rockContainer);
        }
    }
    
    createDungeonEntrance() {
        const dungeonEntrance = new PIXI.Container();
        
        // Dungeon portal base
        const portalBase = new PIXI.Graphics();
        portalBase.beginFill(0x2c2c2c);
        portalBase.lineStyle(3, 0x666666);
        portalBase.drawEllipse(0, 0, 80, 40);
        portalBase.endFill();
        dungeonEntrance.addChild(portalBase);
        
        // Portal opening
        const portal = new PIXI.Graphics();
        portal.beginFill(0x1a0033);
        portal.lineStyle(2, 0x8a2be2);
        portal.drawEllipse(0, -5, 60, 30);
        portal.endFill();
        dungeonEntrance.addChild(portal);
        
        // Mystical glow
        const glow = new PIXI.Graphics();
        glow.beginFill(0x8a2be2, 0.3);
        glow.drawEllipse(0, -5, 80, 40);
        glow.endFill();
        dungeonEntrance.addChild(glow);
        
        // Portal particles
        for (let i = 0; i < 8; i++) {
            const particle = new PIXI.Graphics();
            particle.beginFill(0x9932cc, 0.8);
            particle.drawCircle(0, 0, 3);
            particle.endFill();
            
            const angle = (i / 8) * Math.PI * 2;
            particle.x = Math.cos(angle) * 45;
            particle.y = Math.sin(angle) * 25 - 5;
            dungeonEntrance.addChild(particle);
        }
        
        // Position dungeon in center of map (on top of trails)
        dungeonEntrance.x = this.worldSize.width / 2;
        dungeonEntrance.y = this.worldSize.height / 2;
        dungeonEntrance.isDungeonEntrance = true;
        dungeonEntrance.radius = 80;
        
        // Add dungeon AFTER trails but BEFORE other objects
        this.dungeonEntrance = dungeonEntrance;
        
        // Reserve space for dungeon
        this.envPositions.push({x: dungeonEntrance.x, y: dungeonEntrance.y, radius: 120});
    }
    
    createPaths() {
        // Create main paths connecting different areas - wider and going to map edges
        this.pathData = [
            // Horizontal path
            { startX: 0, startY: this.worldSize.height / 2, endX: this.worldSize.width, endY: this.worldSize.height / 2 },
            // Vertical path
            { startX: this.worldSize.width / 2, startY: 0, endX: this.worldSize.width / 2, endY: this.worldSize.height },
            // Diagonal paths
            { startX: 0, startY: 0, endX: this.worldSize.width, endY: this.worldSize.height },
            { startX: this.worldSize.width, startY: 0, endX: 0, endY: this.worldSize.height }
        ];
        
        this.pathData.forEach(path => {
            const pathGraphics = new PIXI.Graphics();
            pathGraphics.lineStyle(40, 0x8B7355, 0.6); // Wider brown dirt path
            pathGraphics.moveTo(path.startX, path.startY);
            pathGraphics.lineTo(path.endX, path.endY);
            
            // Add path texture
            pathGraphics.lineStyle(30, 0xA0895A, 0.4);
            pathGraphics.moveTo(path.startX, path.startY);
            pathGraphics.lineTo(path.endX, path.endY);
            
            this.app.stage.addChild(pathGraphics);
        });
    }
    
    createPebbles() {
        // Scatter pebbles across the map (avoiding trails)
        for (let i = 0; i < 200; i++) {
            const pebble = new PIXI.Graphics();
            const size = 2 + Math.random() * 4;
            const color = Math.random() > 0.5 ? 0x888888 : 0x666666;
            
            pebble.lineStyle(1, 0x000000); // Black border
            pebble.beginFill(color);
            pebble.drawCircle(0, 0, size);
            pebble.endFill();
            
            // Random position avoiding other objects and trails
            let x, y, attempts = 0;
            do {
                x = Math.random() * this.worldSize.width;
                y = Math.random() * this.worldSize.height;
                attempts++;
            } while ((this.isPositionOccupied(x, y, 30) || this.isPositionOnTrail(x, y, 25)) && attempts < 50);
            
            pebble.x = x;
            pebble.y = y;
            this.app.stage.addChild(pebble);
        }
        
        // Add some larger decorative stones (avoiding trails)
        for (let i = 0; i < 30; i++) {
            const stone = new PIXI.Graphics();
            const size = 8 + Math.random() * 12;
            
            stone.lineStyle(3, 0x000000); // Black border
            stone.beginFill(0x777777);
            
            // Create irregular stone shape
            const points = [];
            const numPoints = 6 + Math.floor(Math.random() * 4);
            for (let j = 0; j < numPoints; j++) {
                const angle = (j / numPoints) * Math.PI * 2;
                const radius = size * (0.8 + Math.random() * 0.4);
                points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
            stone.drawPolygon(points);
            stone.endFill();
            
            let x, y, attempts = 0;
            do {
                x = Math.random() * this.worldSize.width;
                y = Math.random() * this.worldSize.height;
                attempts++;
            } while ((this.isPositionOccupied(x, y, 40) || this.isPositionOnTrail(x, y, 35)) && attempts < 50);
            
            stone.x = x;
            stone.y = y;
            this.app.stage.addChild(stone);
        }
    }
    
    createBushes() {
        this.bushes = new Map();
        
        // Create bushes scattered around the map for concealment
        for (let i = 0; i < 40; i++) {
            const bushContainer = new PIXI.Container();
            
            // Bush graphics with black border
            const bush = new PIXI.Graphics();
            bush.lineStyle(3, 0x000000); // Black border
            bush.beginFill(0x228B22);
            
            // Create irregular bush shape
            const points = [];
            const numPoints = 8;
            for (let j = 0; j < numPoints; j++) {
                const angle = (j / numPoints) * Math.PI * 2;
                const radius = 25 + Math.random() * 15;
                points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
            bush.drawPolygon(points);
            bush.endFill();
            
            // Add some darker spots for texture with black borders
            for (let k = 0; k < 5; k++) {
                const spot = new PIXI.Graphics();
                spot.lineStyle(1, 0x000000); // Black border
                spot.beginFill(0x006400, 0.7);
                spot.drawCircle((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 3 + Math.random() * 5);
                spot.endFill();
                bushContainer.addChild(spot);
            }
            
            bushContainer.addChild(bush);
            
            // Position avoiding other objects and trails
            let x, y, attempts = 0;
            do {
                x = Math.random() * (this.worldSize.width - 200) + 100;
                y = Math.random() * (this.worldSize.height - 200) + 100;
                attempts++;
            } while ((this.isPositionOccupied(x, y, 70) || this.isPositionOnTrail(x, y, 50)) && attempts < 100);
            
            bushContainer.x = x;
            bushContainer.y = y;
            bushContainer.envType = 'bush';
            bushContainer.radius = 35;
            bushContainer.concealsPlayer = true;
            
            this.envPositions.push({x, y, radius: 70});
            
            const bushId = `bush_${i}`;
            this.bushes.set(bushId, bushContainer);
            this.app.stage.addChild(bushContainer);
        }
    }
    
    createDemonStatues() {
        // Create demon statues in clusters around the map
        const clusterCenters = [
            { x: 600, y: 600 },    // Top-left cluster
            { x: 2400, y: 600 },   // Top-right cluster
            { x: 600, y: 2400 },   // Bottom-left cluster
            { x: 2400, y: 2400 },  // Bottom-right cluster
            { x: 1500, y: 1500 }   // Center cluster
        ];
        
        let statueIndex = 0;
        clusterCenters.forEach((center, clusterIdx) => {
            const statuesPerCluster = clusterIdx === 4 ? 5 : 3; // More statues in center
            
            for (let i = 0; i < statuesPerCluster; i++) {
                const statueContainer = new PIXI.Container();
                
                // Position within cluster radius
                let x, y, attempts = 0;
                do {
                    const angle = Math.random() * Math.PI * 2;
                    const distance = Math.random() * 120 + 50; // 50-170 pixels from center
                    x = center.x + Math.cos(angle) * distance;
                    y = center.y + Math.sin(angle) * distance;
                    attempts++;
                } while ((this.isPositionOccupied(x, y, 80) || this.isPositionOnTrail(x, y, 60)) && attempts < 50);
                
                // Fallback to cluster center if no valid position found
                if (attempts >= 50) {
                    x = center.x + (Math.random() - 0.5) * 200;
                    y = center.y + (Math.random() - 0.5) * 200;
                }
            
            // Create stone statue appearance
            const statueBody = new PIXI.Graphics();
            statueBody.lineStyle(4, 0x000000); // Black outline
            statueBody.beginFill(0x666666); // Gray stone
            
            // Statue base
            statueBody.drawRect(-15, 10, 30, 15);
            
            // Main body
            statueBody.drawRect(-12, -10, 24, 20);
            
            // Head
            statueBody.drawCircle(0, -20, 10);
            
            // Horns
            statueBody.drawPolygon([-8, -25, -10, -35, -6, -30]);
            statueBody.drawPolygon([8, -25, 10, -35, 6, -30]);
            
            statueBody.endFill();
            
            // Wings (folded)
            const leftWing = new PIXI.Graphics();
            leftWing.lineStyle(3, 0x000000);
            leftWing.beginFill(0x555555);
            leftWing.drawPolygon([-12, -5, -25, -10, -20, 5, -15, 8]);
            leftWing.endFill();
            
            const rightWing = new PIXI.Graphics();
            rightWing.lineStyle(3, 0x000000);
            rightWing.beginFill(0x555555);
            rightWing.drawPolygon([12, -5, 25, -10, 20, 5, 15, 8]);
            rightWing.endFill();
            
            statueContainer.addChild(leftWing);
            statueContainer.addChild(rightWing);
            statueContainer.addChild(statueBody);
            
            // Shadow
            const shadow = new PIXI.Graphics();
            shadow.lineStyle(1, 0x000000);
            shadow.beginFill(0x000000, 0.3);
            shadow.drawEllipse(0, 25, 20, 8);
            shadow.endFill();
            statueContainer.addChild(shadow);
            
            statueContainer.x = x;
            statueContainer.y = y;
            statueContainer.isStatue = true;
            statueContainer.isAwake = false;
            statueContainer.activationRadius = 100;
            statueContainer.attackRadius = 150;
            statueContainer.health = 80;
            statueContainer.maxHealth = 80;
            statueContainer.damage = 25;
            statueContainer.speed = 60;
            statueContainer.lastAttackTime = 0;
            statueContainer.attackCooldown = 3000; // 3 seconds
            statueContainer.envType = 'demonStatue';
            
            this.envPositions.push({x, y, radius: 80});
            
            const statueId = `demon_statue_${statueIndex}`;
                this.demonStatues.set(statueId, statueContainer);
                this.app.stage.addChild(statueContainer);
                statueIndex++;
            }
        });
    }
    
    isPositionOccupied(x, y, minDistance) {
        return this.envPositions.some(pos => {
            const dx = pos.x - x;
            const dy = pos.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < minDistance;
        });
    }
    
    isPositionOnTrail(x, y, buffer = 30) {
        if (!this.pathData) return false;
        
        return this.pathData.some(path => {
            const dx = path.endX - path.startX;
            const dy = path.endY - path.startY;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length === 0) return false;
            
            const t = Math.max(0, Math.min(1, ((x - path.startX) * dx + (y - path.startY) * dy) / (length * length)));
            const projX = path.startX + t * dx;
            const projY = path.startY + t * dy;
            
            const distance = Math.sqrt((x - projX) * (x - projX) + (y - projY) * (y - projY));
            return distance < buffer;
        });
    }
    
    checkCollisionWithEnvironment(newX, newY) {
        // Check regular environment objects
        const envCollision = Array.from(this.environments.values()).some(env => {
            const dx = env.x - newX;
            const dy = env.y - newY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < (env.radius + 20); // Player radius of 20
        });
        
        if (envCollision) return true;
        
        // Check demon statues (both dormant and active)
        const statueCollision = Array.from(this.demonStatues.values()).some(statue => {
            const dx = statue.x - newX;
            const dy = statue.y - newY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < 35; // Statue collision radius
        });
        
        if (statueCollision) return true;
        
        const activeDemonCollision = Array.from(this.activeDemonStatues.values()).some(demon => {
            const dx = demon.x - newX;
            const dy = demon.y - newY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < 35; // Demon collision radius
        });
        
        return activeDemonCollision;
    }
    
    createPlayer(playerData) {
        const playerContainer = new PIXI.Container();
        
        // Player border
        const border = new PIXI.Graphics();
        border.lineStyle(3, 0x000000); // Black border
        border.drawCircle(0, 0, 22);
        playerContainer.addChild(border);
        
        // Player body (circle) - human tan skin color
        const body = new PIXI.Graphics();
        body.beginFill(0xF4C2A1); // Light tan/peach human skin color
        body.lineStyle(2, 0xD2B48C); // Slightly darker tan outline
        body.drawCircle(0, 0, 20);
        body.endFill();
        playerContainer.addChild(body);
        
        // Eyes with black borders
        const leftEye = new PIXI.Graphics();
        leftEye.lineStyle(1, 0x000000); // Black border
        leftEye.beginFill(0xffffff);
        leftEye.drawCircle(-8, -8, 4);
        leftEye.endFill();
        leftEye.beginFill(0x000000);
        leftEye.drawCircle(-8, -8, 2);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.lineStyle(1, 0x000000); // Black border
        rightEye.beginFill(0xffffff);
        rightEye.drawCircle(8, -8, 4);
        rightEye.endFill();
        rightEye.beginFill(0x000000);
        rightEye.drawCircle(8, -8, 2);
        rightEye.endFill();
        
        playerContainer.addChild(leftEye);
        playerContainer.addChild(rightEye);
        
        // Improved Wand with black borders - positioned in front of player face
        const wand = new PIXI.Graphics();
        // Wand handle with black border
        wand.lineStyle(6, 0x000000); // Black border
        wand.moveTo(15, 0);
        wand.lineTo(35, -2);
        wand.lineStyle(4, 0x8b4513); // Brown handle
        wand.moveTo(15, 0);  // Start closer to player center
        wand.lineTo(35, -2); // Extend forward in front of face
        
        // Wand tip with crystal and black border
        wand.lineStyle(2, 0x000000); // Black border
        wand.beginFill(0x4169E1);
        wand.drawPolygon([35, -2, 40, -6, 45, -2, 40, 2]);
        wand.endFill();
        
        // Glowing effect with black border
        wand.lineStyle(1, 0x000000); // Black border
        wand.beginFill(0xFFFFFF, 0.3);
        wand.drawCircle(42, -2, 6);
        wand.endFill();
        playerContainer.addChild(wand);
        
        // Health bar background with border and rounded edges
        const healthBarBorder = new PIXI.Graphics();
        healthBarBorder.lineStyle(2, 0x000000);
        healthBarBorder.beginFill(0x333333);
        healthBarBorder.drawRoundedRect(-22, -37, 44, 10, 5);
        healthBarBorder.endFill();
        
        const healthBarBg = new PIXI.Graphics();
        healthBarBg.beginFill(0x444444);
        healthBarBg.drawRoundedRect(-20, -35, 40, 6, 3);
        healthBarBg.endFill();
        
        const healthBar = new PIXI.Graphics();
        const healthPercent = playerData.health / playerData.maxHealth;
        healthBar.beginFill(healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000);
        healthBar.drawRoundedRect(-20, -35, 40 * healthPercent, 6, 3);
        healthBar.endFill();
        
        playerContainer.addChild(healthBarBorder);
        playerContainer.addChild(healthBarBg);
        playerContainer.addChild(healthBar);
        
        // Player name with proper border
        const nameText = new PIXI.Text(playerData.name, {
            fontSize: 12,
            fill: 0xffffff,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            stroke: 0x000000,
            strokeThickness: 3,
            dropShadow: true,
            dropShadowColor: 0x000000,
            dropShadowBlur: 2,
            dropShadowDistance: 1
        });
        nameText.anchor.set(0.5);
        nameText.y = -52;
        playerContainer.addChild(nameText);
        
        playerContainer.x = playerData.x;
        playerContainer.y = playerData.y;
        playerContainer.rotation = playerData.rotation || 0;
        
        // Store references
        playerContainer.healthBar = healthBar;
        playerContainer.nameText = nameText;
        playerContainer.playerData = playerData;
        
        return playerContainer;
    }
    
    createScroll(scrollData) {
        const scrollContainer = new PIXI.Container();
        
        // Mystical glow background
        const glow = new PIXI.Graphics();
        const color = this.getScrollColor(scrollData.type);
        glow.beginFill(color, 0.3);
        glow.drawCircle(0, 0, 25);
        glow.endFill();
        scrollContainer.addChild(glow);
        
        // Main scroll circle
        const scrollCircle = new PIXI.Graphics();
        scrollCircle.beginFill(color, 0.8);
        scrollCircle.lineStyle(3, 0xffd700);
        scrollCircle.drawCircle(0, 0, 20);
        scrollCircle.endFill();
        scrollContainer.addChild(scrollCircle);
        
        // Try to load actual scroll image
        const scrollTexture = PIXI.Texture.from(`assets/${scrollData.type}scroll.png`);
        
        const scrollSprite = new PIXI.Sprite(scrollTexture);
        scrollSprite.anchor.set(0.5);
        scrollSprite.x = 0;
        scrollSprite.y = 0;
        
        // Always set proper size to fit exactly inside circle (circle radius is 20)
        const circleRadius = 20;
        const maxImageSize = circleRadius * 1.6; // Image should be 80% of circle diameter
        
        // Function to properly size the sprite once texture is loaded
        const sizeSprite = () => {
            if (scrollTexture.valid) {
                const originalWidth = scrollTexture.width;
                const originalHeight = scrollTexture.height;
                
                if (originalWidth > 0 && originalHeight > 0) {
                    const scale = Math.min(maxImageSize / originalWidth, maxImageSize / originalHeight);
                    scrollSprite.scale.set(scale);
                } else {
                    // Fallback scale if dimensions are invalid
                    scrollSprite.scale.set(0.5);
                }
            } else {
                // Set a reasonable default scale
                scrollSprite.scale.set(0.5);
            }
        };
        
        scrollTexture.baseTexture.on('error', () => {
            // Remove sprite and add fallback symbol
            if (scrollSprite.parent) {
                scrollSprite.parent.removeChild(scrollSprite);
            }
            
            const symbol = new PIXI.Graphics();
            symbol.beginFill(0xffffff);
            symbol.lineStyle(2, 0x000000);
            
            switch(scrollData.type) {
                case 'fire':
                    symbol.drawPolygon([-6, 6, 0, -8, 6, 6, 0, 2]);
                    break;
                case 'ice':
                    symbol.drawPolygon([0, -8, -6, -2, -3, 2, 0, 8, 3, 2, 6, -2]);
                    break;
                case 'lightning':
                    symbol.drawPolygon([-4, -8, 2, -2, -2, 0, 4, 8, -2, 2, 2, 0]);
                    break;
                case 'earth':
                    symbol.drawRect(-6, -6, 12, 12);
                    break;
                case 'wind':
                    for (let i = 0; i < 3; i++) {
                        symbol.drawCircle(0, 0, 3 + i * 2);
                    }
                    break;
                case 'shadow':
                    symbol.drawCircle(0, 0, 8);
                    symbol.beginHole();
                    symbol.drawCircle(0, 0, 4);
                    symbol.endHole();
                    break;
                case 'light':
                    for (let i = 0; i < 8; i++) {
                        const angle = (i / 8) * Math.PI * 2;
                        symbol.moveTo(0, 0);
                        symbol.lineTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
                    }
                    break;
                case 'void':
                    symbol.drawCircle(0, 0, 8);
                    symbol.beginFill(0x000000);
                    symbol.drawCircle(0, 0, 4);
                    symbol.endFill();
                    break;
            }
            symbol.endFill();
            scrollContainer.addChild(symbol);
        });
        
        scrollTexture.baseTexture.on('loaded', () => {
            sizeSprite();
        });
        
        // Size immediately if already loaded
        if (scrollTexture.baseTexture.valid) {
            sizeSprite();
        }
        
        scrollContainer.addChild(scrollSprite);
        
        // Make interactive for hover events
        scrollContainer.interactive = true;
        scrollContainer.buttonMode = true;
        
        // Hover events for rarity display
        scrollContainer.on('pointerover', () => {
            this.showScrollRarity(scrollData, scrollContainer.x, scrollContainer.y);
        });
        
        scrollContainer.on('pointerout', () => {
            this.hideScrollRarity();
        });
        
        // Floating animation
        scrollContainer.floatOffset = Math.random() * Math.PI * 2;
        
        scrollContainer.x = scrollData.x;
        scrollContainer.y = scrollData.y;
        scrollContainer.scrollData = scrollData;
        
        return scrollContainer;
    }
    
    showScrollRarity(scrollData, x, y) {
        const screenX = x - this.camera.x;
        const screenY = y - this.camera.y - 40; // Show above scroll
        
        if (ui && ui.rarityPopup) {
            const popup = ui.rarityPopup;
            const rarityText = popup.querySelector('.rarity-text');
            
            if (rarityText) {
                rarityText.textContent = scrollData.rarity.toUpperCase();
                rarityText.className = `rarity-text rarity-${scrollData.rarity}`;
                
                popup.style.left = screenX + 'px';
                popup.style.top = screenY + 'px';
                popup.classList.remove('hidden');
                popup.classList.add('show');
            }
        }
    }
    
    hideScrollRarity() {
        if (ui && ui.rarityPopup) {
            ui.rarityPopup.classList.remove('show');
            ui.rarityPopup.classList.add('hidden');
        }
    }
    
    getScrollColor(type) {
        const colors = {
            fire: 0xff4444,
            ice: 0x4444ff,
            lightning: 0xffff44,
            earth: 0x44aa44,
            wind: 0x44ffff,
            shadow: 0xaa44aa,
            light: 0xffffff
        };
        return colors[type] || 0xffffff;
    }
    
    createAnimal(animalData) {
        const animalContainer = new PIXI.Container();
        
        // Create animal based on type with proper 2D top-down appearance
        switch(animalData.type) {
            case 'deer':
                this.createDeer(animalContainer, animalData);
                break;
            case 'rabbit':
                this.createRabbit(animalContainer, animalData);
                break;
            case 'wolf':
                this.createWolf(animalContainer, animalData);
                break;
            case 'bear':
                this.createBear(animalContainer, animalData);
                break;
            case 'snake':
                this.createSnake(animalContainer, animalData);
                break;
            case 'scorpion':
                this.createScorpion(animalContainer, animalData);
                break;
            case 'lizard':
                this.createLizard(animalContainer, animalData);
                break;
            case 'penguin':
                this.createPenguin(animalContainer, animalData);
                break;
            case 'seal':
                this.createSeal(animalContainer, animalData);
                break;
            case 'polar_bear':
                this.createPolarBear(animalContainer, animalData);
                break;
            case 'ice_wolf':
                this.createIceWolf(animalContainer, animalData);
                break;
            case 'frog':
                this.createFrog(animalContainer, animalData);
                break;
            case 'alligator':
                this.createAlligator(animalContainer, animalData);
                break;
            case 'will_o_wisp':
                this.createWillOWisp(animalContainer, animalData);
                break;
            case 'salamander':
                this.createSalamander(animalContainer, animalData);
                break;
            case 'fire_elemental':
                this.createFireElemental(animalContainer, animalData);
                break;
            case 'lava_slug':
                this.createLavaSlug(animalContainer, animalData);
                break;
            case 'phoenix':
                this.createPhoenix(animalContainer, animalData);
                break;
            default:
                this.createGenericAnimal(animalContainer, animalData);
        }
        
        // Health bar for animals
        const healthBarBg = new PIXI.Graphics();
        healthBarBg.beginFill(0x333333);
        healthBarBg.drawRect(-20, -animalData.size - 15, 40, 5);
        healthBarBg.endFill();
        
        const healthBar = new PIXI.Graphics();
        const healthPercent = animalData.health / animalData.maxHealth;
        healthBar.beginFill(healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000);
        healthBar.drawRect(-20, -animalData.size - 15, 40 * healthPercent, 5);
        healthBar.endFill();
        
        animalContainer.addChild(healthBarBg);
        animalContainer.addChild(healthBar);
        
        // Position and properties
        animalContainer.x = animalData.x;
        animalContainer.y = animalData.y;
        animalContainer.animalData = animalData;
        animalContainer.healthBar = healthBar;
        
        // Add animation properties
        animalContainer.animationTime = 0;
        animalContainer.movementDirection = Math.random() * Math.PI * 2;
        animalContainer.lastMovementChange = Date.now();
        
        // Start animal-specific animations
        this.startAnimalAnimation(animalContainer);
        
        return animalContainer;
    }
    
    createDeer(container, animalData) {
        // Deer body (oval, brown)
        const body = new PIXI.Graphics();
        body.lineStyle(2, 0x8B4513);
        body.beginFill(0xD2B48C);
        body.drawEllipse(0, 0, animalData.size * 0.8, animalData.size * 1.2);
        body.endFill();
        container.addChild(body);
        
        // Head (smaller oval)
        const head = new PIXI.Graphics();
        head.lineStyle(2, 0x8B4513);
        head.beginFill(0xDEB887);
        head.drawEllipse(0, -animalData.size * 0.7, animalData.size * 0.6, animalData.size * 0.5);
        head.endFill();
        container.addChild(head);
        
        // Antlers
        const antlers = new PIXI.Graphics();
        antlers.lineStyle(3, 0x8B4513);
        antlers.moveTo(-8, -animalData.size * 0.9);
        antlers.lineTo(-12, -animalData.size * 1.2);
        antlers.moveTo(-8, -animalData.size * 0.9);
        antlers.lineTo(-6, -animalData.size * 1.1);
        antlers.moveTo(8, -animalData.size * 0.9);
        antlers.lineTo(12, -animalData.size * 1.2);
        antlers.moveTo(8, -animalData.size * 0.9);
        antlers.lineTo(6, -animalData.size * 1.1);
        container.addChild(antlers);
        
        // Eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0x000000);
        leftEye.drawCircle(-4, -animalData.size * 0.7, 2);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0x000000);
        rightEye.drawCircle(4, -animalData.size * 0.7, 2);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
        
        // Spots
        for (let i = 0; i < 4; i++) {
            const spot = new PIXI.Graphics();
            spot.beginFill(0xF5DEB3);
            spot.drawCircle((Math.random() - 0.5) * animalData.size, (Math.random() - 0.5) * animalData.size * 0.8, 3);
            spot.endFill();
            container.addChild(spot);
        }
    }
    
    createRabbit(container, animalData) {
        // Rabbit body (small oval)
        const body = new PIXI.Graphics();
        body.lineStyle(2, 0x8B4513);
        body.beginFill(0xF5F5DC);
        body.drawEllipse(0, 0, animalData.size * 0.7, animalData.size * 0.9);
        body.endFill();
        container.addChild(body);
        
        // Head (circle)
        const head = new PIXI.Graphics();
        head.lineStyle(2, 0x8B4513);
        head.beginFill(0xFAFAD2);
        head.drawCircle(0, -animalData.size * 0.5, animalData.size * 0.4);
        head.endFill();
        container.addChild(head);
        
        // Long ears
        const leftEar = new PIXI.Graphics();
        leftEar.lineStyle(2, 0x8B4513);
        leftEar.beginFill(0xF5F5DC);
        leftEar.drawEllipse(-6, -animalData.size * 0.8, 4, 12);
        leftEar.endFill();
        
        const rightEar = new PIXI.Graphics();
        rightEar.lineStyle(2, 0x8B4513);
        rightEar.beginFill(0xF5F5DC);
        rightEar.drawEllipse(6, -animalData.size * 0.8, 4, 12);
        rightEar.endFill();
        
        container.addChild(leftEar);
        container.addChild(rightEar);
        
        // Eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0x000000);
        leftEye.drawCircle(-3, -animalData.size * 0.5, 2);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0x000000);
        rightEye.drawCircle(3, -animalData.size * 0.5, 2);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
        
        // Fluffy tail
        const tail = new PIXI.Graphics();
        tail.lineStyle(1, 0x8B4513);
        tail.beginFill(0xFFFFFF);
        tail.drawCircle(0, animalData.size * 0.6, 4);
        tail.endFill();
        container.addChild(tail);
    }
    
    createWolf(container, animalData) {
        // Wolf body (larger oval)
        const body = new PIXI.Graphics();
        body.lineStyle(2, 0x000000);
        body.beginFill(0x696969);
        body.drawEllipse(0, 0, animalData.size * 0.9, animalData.size * 1.1);
        body.endFill();
        container.addChild(body);
        
        // Head (triangular shape)
        const head = new PIXI.Graphics();
        head.lineStyle(2, 0x000000);
        head.beginFill(0x778899);
        head.drawPolygon([0, -animalData.size * 0.9, -8, -animalData.size * 0.5, 8, -animalData.size * 0.5]);
        head.endFill();
        container.addChild(head);
        
        // Pointed ears
        const leftEar = new PIXI.Graphics();
        leftEar.lineStyle(2, 0x000000);
        leftEar.beginFill(0x696969);
        leftEar.drawPolygon([-6, -animalData.size * 0.7, -10, -animalData.size * 0.9, -2, -animalData.size * 0.8]);
        leftEar.endFill();
        
        const rightEar = new PIXI.Graphics();
        rightEar.lineStyle(2, 0x000000);
        rightEar.beginFill(0x696969);
        rightEar.drawPolygon([6, -animalData.size * 0.7, 10, -animalData.size * 0.9, 2, -animalData.size * 0.8]);
        rightEar.endFill();
        
        container.addChild(leftEar);
        container.addChild(rightEar);
        
        // Glowing eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0xFFFF00);
        leftEye.drawCircle(-4, -animalData.size * 0.7, 3);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0xFFFF00);
        rightEye.drawCircle(4, -animalData.size * 0.7, 3);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
        
        // Tail
        const tail = new PIXI.Graphics();
        tail.lineStyle(2, 0x000000);
        tail.beginFill(0x696969);
        tail.drawEllipse(0, animalData.size * 0.8, 6, 15);
        tail.endFill();
        container.addChild(tail);
    }
    
    createBear(container, animalData) {
        // Bear body (large circle)
        const body = new PIXI.Graphics();
        body.lineStyle(3, 0x000000);
        body.beginFill(0x8B4513);
        body.drawCircle(0, 0, animalData.size);
        body.endFill();
        container.addChild(body);
        
        // Head (smaller circle)
        const head = new PIXI.Graphics();
        head.lineStyle(2, 0x000000);
        head.beginFill(0xA0522D);
        head.drawCircle(0, -animalData.size * 0.6, animalData.size * 0.6);
        head.endFill();
        container.addChild(head);
        
        // Round ears
        const leftEar = new PIXI.Graphics();
        leftEar.lineStyle(2, 0x000000);
        leftEar.beginFill(0x8B4513);
        leftEar.drawCircle(-8, -animalData.size * 0.9, 6);
        leftEar.endFill();
        
        const rightEar = new PIXI.Graphics();
        rightEar.lineStyle(2, 0x000000);
        rightEar.beginFill(0x8B4513);
        rightEar.drawCircle(8, -animalData.size * 0.9, 6);
        rightEar.endFill();
        
        container.addChild(leftEar);
        container.addChild(rightEar);
        
        // Small eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0x000000);
        leftEye.drawCircle(-6, -animalData.size * 0.6, 2);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0x000000);
        rightEye.drawCircle(6, -animalData.size * 0.6, 2);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
        
        // Snout
        const snout = new PIXI.Graphics();
        snout.lineStyle(1, 0x000000);
        snout.beginFill(0x000000);
        snout.drawCircle(0, -animalData.size * 0.4, 3);
        snout.endFill();
        container.addChild(snout);
    }
    
    createSnake(container, animalData) {
        // Snake body (long segmented)
        const segments = 6;
        for (let i = 0; i < segments; i++) {
            const segment = new PIXI.Graphics();
            segment.lineStyle(2, 0x000000);
            segment.beginFill(i === 0 ? 0x32CD32 : 0x228B22);
            const size = i === 0 ? animalData.size * 0.6 : animalData.size * 0.4;
            segment.drawCircle(0, i * 8, size);
            segment.endFill();
            container.addChild(segment);
            
            // Snake pattern
            if (i > 0) {
                const pattern = new PIXI.Graphics();
                pattern.beginFill(0x006400);
                pattern.drawCircle(-3, i * 8, 2);
                pattern.drawCircle(3, i * 8, 2);
                pattern.endFill();
                container.addChild(pattern);
            }
        }
        
        // Head with eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0xFF0000);
        leftEye.drawCircle(-4, -2, 2);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0xFF0000);
        rightEye.drawCircle(4, -2, 2);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
        
        // Forked tongue
        const tongue = new PIXI.Graphics();
        tongue.lineStyle(1, 0xFF0000);
        tongue.moveTo(0, -animalData.size * 0.5);
        tongue.lineTo(-2, -animalData.size * 0.7);
        tongue.moveTo(0, -animalData.size * 0.5);
        tongue.lineTo(2, -animalData.size * 0.7);
        container.addChild(tongue);
    }
    
    createScorpion(container, animalData) {
        // Scorpion body
        const body = new PIXI.Graphics();
        body.lineStyle(2, 0x000000);
        body.beginFill(0xDAA520);
        body.drawEllipse(0, 0, animalData.size * 0.8, animalData.size * 0.6);
        body.endFill();
        container.addChild(body);
        
        // Claws
        const leftClaw = new PIXI.Graphics();
        leftClaw.lineStyle(2, 0x000000);
        leftClaw.beginFill(0xB8860B);
        leftClaw.drawEllipse(-animalData.size * 0.9, -animalData.size * 0.3, 8, 6);
        leftClaw.endFill();
        
        const rightClaw = new PIXI.Graphics();
        rightClaw.lineStyle(2, 0x000000);
        rightClaw.beginFill(0xB8860B);
        rightClaw.drawEllipse(animalData.size * 0.9, -animalData.size * 0.3, 8, 6);
        rightClaw.endFill();
        
        container.addChild(leftClaw);
        container.addChild(rightClaw);
        
        // Segmented tail with stinger
        for (let i = 0; i < 4; i++) {
            const segment = new PIXI.Graphics();
            segment.lineStyle(1, 0x000000);
            segment.beginFill(0xFFD700);
            segment.drawCircle(0, animalData.size * 0.4 + i * 6, 3 - i * 0.5);
            segment.endFill();
            container.addChild(segment);
        }
        
        // Stinger
        const stinger = new PIXI.Graphics();
        stinger.lineStyle(2, 0x000000);
        stinger.beginFill(0x8B0000);
        stinger.drawPolygon([0, animalData.size * 0.8, -3, animalData.size * 0.9, 3, animalData.size * 0.9]);
        stinger.endFill();
        container.addChild(stinger);
        
        // Eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0x000000);
        leftEye.drawCircle(-4, -animalData.size * 0.2, 2);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0x000000);
        rightEye.drawCircle(4, -animalData.size * 0.2, 2);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
    }
    
    createLizard(container, animalData) {
        // Lizard body (oval)
        const body = new PIXI.Graphics();
        body.lineStyle(2, 0x000000);
        body.beginFill(0x9ACD32);
        body.drawEllipse(0, 0, animalData.size * 0.7, animalData.size * 1.0);
        body.endFill();
        container.addChild(body);
        
        // Head (triangular)
        const head = new PIXI.Graphics();
        head.lineStyle(2, 0x000000);
        head.beginFill(0xADFF2F);
        head.drawPolygon([0, -animalData.size * 0.8, -6, -animalData.size * 0.5, 6, -animalData.size * 0.5]);
        head.endFill();
        container.addChild(head);
        
        // Long tail
        const tail = new PIXI.Graphics();
        tail.lineStyle(2, 0x000000);
        tail.beginFill(0x9ACD32);
        tail.drawEllipse(0, animalData.size * 0.8, 4, 20);
        tail.endFill();
        container.addChild(tail);
        
        // Eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0x000000);
        leftEye.drawCircle(-3, -animalData.size * 0.7, 2);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0x000000);
        rightEye.drawCircle(3, -animalData.size * 0.7, 2);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
        
        // Scale pattern
        for (let i = 0; i < 3; i++) {
            const scale = new PIXI.Graphics();
            scale.beginFill(0x7CFC00);
            scale.drawCircle((Math.random() - 0.5) * animalData.size * 0.8, (Math.random() - 0.5) * animalData.size * 0.6, 2);
            scale.endFill();
            container.addChild(scale);
        }
    }
    
    createPenguin(container, animalData) {
        // Penguin body (oval)
        const body = new PIXI.Graphics();
        body.lineStyle(2, 0x000000);
        body.beginFill(0x000000);
        body.drawEllipse(0, 0, animalData.size * 0.8, animalData.size * 1.0);
        body.endFill();
        container.addChild(body);
        
        // White belly
        const belly = new PIXI.Graphics();
        belly.beginFill(0xFFFFFF);
        belly.drawEllipse(0, animalData.size * 0.1, animalData.size * 0.5, animalData.size * 0.7);
        belly.endFill();
        container.addChild(belly);
        
        // Head
        const head = new PIXI.Graphics();
        head.lineStyle(2, 0x000000);
        head.beginFill(0x000000);
        head.drawCircle(0, -animalData.size * 0.6, animalData.size * 0.5);
        head.endFill();
        container.addChild(head);
        
        // Orange beak
        const beak = new PIXI.Graphics();
        beak.beginFill(0xFF4500);
        beak.drawPolygon([0, -animalData.size * 0.4, -3, -animalData.size * 0.5, 3, -animalData.size * 0.5]);
        beak.endFill();
        container.addChild(beak);
        
        // Flippers
        const leftFlipper = new PIXI.Graphics();
        leftFlipper.lineStyle(2, 0x000000);
        leftFlipper.beginFill(0x000000);
        leftFlipper.drawEllipse(-animalData.size * 0.8, 0, 6, 12);
        leftFlipper.endFill();
        
        const rightFlipper = new PIXI.Graphics();
        rightFlipper.lineStyle(2, 0x000000);
        rightFlipper.beginFill(0x000000);
        rightFlipper.drawEllipse(animalData.size * 0.8, 0, 6, 12);
        rightFlipper.endFill();
        
        container.addChild(leftFlipper);
        container.addChild(rightFlipper);
        
        // Eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0x000000);
        leftEye.drawCircle(-4, -animalData.size * 0.6, 2);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0x000000);
        rightEye.drawCircle(4, -animalData.size * 0.6, 2);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
    }
    
    createSeal(container, animalData) {
        // Seal body (elongated oval)
        const body = new PIXI.Graphics();
        body.lineStyle(2, 0x000000);
        body.beginFill(0x708090);
        body.drawEllipse(0, 0, animalData.size * 0.9, animalData.size * 1.2);
        body.endFill();
        container.addChild(body);
        
        // Head
        const head = new PIXI.Graphics();
        head.lineStyle(2, 0x000000);
        head.beginFill(0x778899);
        head.drawCircle(0, -animalData.size * 0.7, animalData.size * 0.5);
        head.endFill();
        container.addChild(head);
        
        // Flippers
        const leftFlipper = new PIXI.Graphics();
        leftFlipper.lineStyle(2, 0x000000);
        leftFlipper.beginFill(0x696969);
        leftFlipper.drawEllipse(-animalData.size * 0.7, 0, 8, 15);
        leftFlipper.endFill();
        
        const rightFlipper = new PIXI.Graphics();
        rightFlipper.lineStyle(2, 0x000000);
        rightFlipper.beginFill(0x696969);
        rightFlipper.drawEllipse(animalData.size * 0.7, 0, 8, 15);
        rightFlipper.endFill();
        
        container.addChild(leftFlipper);
        container.addChild(rightFlipper);
        
        // Tail flippers
        const tailFlipper = new PIXI.Graphics();
        tailFlipper.lineStyle(2, 0x000000);
        tailFlipper.beginFill(0x696969);
        tailFlipper.drawEllipse(0, animalData.size * 0.9, 12, 8);
        tailFlipper.endFill();
        container.addChild(tailFlipper);
        
        // Whiskers
        const whiskers = new PIXI.Graphics();
        whiskers.lineStyle(1, 0x000000);
        whiskers.moveTo(-8, -animalData.size * 0.6);
        whiskers.lineTo(-15, -animalData.size * 0.65);
        whiskers.moveTo(8, -animalData.size * 0.6);
        whiskers.lineTo(15, -animalData.size * 0.65);
        container.addChild(whiskers);
        
        // Eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0x000000);
        leftEye.drawCircle(-5, -animalData.size * 0.7, 3);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0x000000);
        rightEye.drawCircle(5, -animalData.size * 0.7, 3);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
    }
    
    createPolarBear(container, animalData) {
        // Similar to bear but white and larger
        const body = new PIXI.Graphics();
        body.lineStyle(3, 0x000000);
        body.beginFill(0xFFFAF0);
        body.drawCircle(0, 0, animalData.size);
        body.endFill();
        container.addChild(body);
        
        const head = new PIXI.Graphics();
        head.lineStyle(2, 0x000000);
        head.beginFill(0xFFFFFF);
        head.drawCircle(0, -animalData.size * 0.6, animalData.size * 0.6);
        head.endFill();
        container.addChild(head);
        
        // Round ears
        const leftEar = new PIXI.Graphics();
        leftEar.lineStyle(2, 0x000000);
        leftEar.beginFill(0xFFFAF0);
        leftEar.drawCircle(-8, -animalData.size * 0.9, 6);
        leftEar.endFill();
        
        const rightEar = new PIXI.Graphics();
        rightEar.lineStyle(2, 0x000000);
        rightEar.beginFill(0xFFFAF0);
        rightEar.drawCircle(8, -animalData.size * 0.9, 6);
        rightEar.endFill();
        
        container.addChild(leftEar);
        container.addChild(rightEar);
        
        // Black nose
        const nose = new PIXI.Graphics();
        nose.beginFill(0x000000);
        nose.drawCircle(0, -animalData.size * 0.4, 3);
        nose.endFill();
        container.addChild(nose);
        
        // Eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0x000000);
        leftEye.drawCircle(-6, -animalData.size * 0.6, 2);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0x000000);
        rightEye.drawCircle(6, -animalData.size * 0.6, 2);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
    }
    
    createIceWolf(container, animalData) {
        // Similar to wolf but with ice effects
        const body = new PIXI.Graphics();
        body.lineStyle(2, 0x87CEEB);
        body.beginFill(0xE6E6FA);
        body.drawEllipse(0, 0, animalData.size * 0.9, animalData.size * 1.1);
        body.endFill();
        container.addChild(body);
        
        const head = new PIXI.Graphics();
        head.lineStyle(2, 0x87CEEB);
        head.beginFill(0xF0F8FF);
        head.drawPolygon([0, -animalData.size * 0.9, -8, -animalData.size * 0.5, 8, -animalData.size * 0.5]);
        head.endFill();
        container.addChild(head);
        
        // Pointed ears
        const leftEar = new PIXI.Graphics();
        leftEar.lineStyle(2, 0x87CEEB);
        leftEar.beginFill(0xE6E6FA);
        leftEar.drawPolygon([-6, -animalData.size * 0.7, -10, -animalData.size * 0.9, -2, -animalData.size * 0.8]);
        leftEar.endFill();
        
        const rightEar = new PIXI.Graphics();
        rightEar.lineStyle(2, 0x87CEEB);
        rightEar.beginFill(0xE6E6FA);
        rightEar.drawPolygon([6, -animalData.size * 0.7, 10, -animalData.size * 0.9, 2, -animalData.size * 0.8]);
        rightEar.endFill();
        
        container.addChild(leftEar);
        container.addChild(rightEar);
        
        // Ice blue eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0x00BFFF);
        leftEye.drawCircle(-4, -animalData.size * 0.7, 3);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0x00BFFF);
        rightEye.drawCircle(4, -animalData.size * 0.7, 3);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
        
        // Ice crystals on fur
        for (let i = 0; i < 3; i++) {
            const crystal = new PIXI.Graphics();
            crystal.beginFill(0xB0E0E6);
            crystal.drawPolygon([0, -4, -2, 0, 0, 4, 2, 0]);
            crystal.x = (Math.random() - 0.5) * animalData.size;
            crystal.y = (Math.random() - 0.5) * animalData.size * 0.8;
            crystal.scale.set(0.5);
            container.addChild(crystal);
        }
    }
    
    createFrog(container, animalData) {
        // Frog body (round)
        const body = new PIXI.Graphics();
        body.lineStyle(2, 0x000000);
        body.beginFill(0x32CD32);
        body.drawCircle(0, 0, animalData.size);
        body.endFill();
        container.addChild(body);
        
        // Large bulging eyes
        const leftEye = new PIXI.Graphics();
        leftEye.lineStyle(2, 0x000000);
        leftEye.beginFill(0x228B22);
        leftEye.drawCircle(-6, -animalData.size * 0.6, 5);
        leftEye.endFill();
        leftEye.beginFill(0x000000);
        leftEye.drawCircle(-6, -animalData.size * 0.6, 2);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.lineStyle(2, 0x000000);
        rightEye.beginFill(0x228B22);
        rightEye.drawCircle(6, -animalData.size * 0.6, 5);
        rightEye.endFill();
        rightEye.beginFill(0x000000);
        rightEye.drawCircle(6, -animalData.size * 0.6, 2);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
        
        // Webbed feet
        const leftFoot = new PIXI.Graphics();
        leftFoot.lineStyle(1, 0x000000);
        leftFoot.beginFill(0x228B22);
        leftFoot.drawPolygon([-10, 8, -15, 12, -8, 15, -5, 12]);
        leftFoot.endFill();
        
        const rightFoot = new PIXI.Graphics();
        rightFoot.lineStyle(1, 0x000000);
        rightFoot.beginFill(0x228B22);
        rightFoot.drawPolygon([10, 8, 15, 12, 8, 15, 5, 12]);
        rightFoot.endFill();
        
        container.addChild(leftFoot);
        container.addChild(rightFoot);
        
        // Spots
        for (let i = 0; i < 3; i++) {
            const spot = new PIXI.Graphics();
            spot.beginFill(0x006400);
            spot.drawCircle((Math.random() - 0.5) * animalData.size * 0.8, (Math.random() - 0.5) * animalData.size * 0.8, 2);
            spot.endFill();
            container.addChild(spot);
        }
    }
    
    createAlligator(container, animalData) {
        // Alligator body (long oval)
        const body = new PIXI.Graphics();
        body.lineStyle(3, 0x000000);
        body.beginFill(0x556B2F);
        body.drawEllipse(0, 0, animalData.size * 1.2, animalData.size * 0.8);
        body.endFill();
        container.addChild(body);
        
        // Long snout
        const snout = new PIXI.Graphics();
        snout.lineStyle(2, 0x000000);
        snout.beginFill(0x6B8E23);
        snout.drawEllipse(0, -animalData.size * 1.0, animalData.size * 0.8, animalData.size * 0.4);
        snout.endFill();
        container.addChild(snout);
        
        // Eyes on top of head
        const leftEye = new PIXI.Graphics();
        leftEye.lineStyle(1, 0x000000);
        leftEye.beginFill(0xFFFF00);
        leftEye.drawCircle(-6, -animalData.size * 0.4, 4);
        leftEye.endFill();
        leftEye.beginFill(0x000000);
        leftEye.drawCircle(-6, -animalData.size * 0.4, 1);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.lineStyle(1, 0x000000);
        rightEye.beginFill(0xFFFF00);
        rightEye.drawCircle(6, -animalData.size * 0.4, 4);
        rightEye.endFill();
        rightEye.beginFill(0x000000);
        rightEye.drawCircle(6, -animalData.size * 0.4, 1);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
        
        // Teeth
        for (let i = 0; i < 6; i++) {
            const tooth = new PIXI.Graphics();
            tooth.beginFill(0xFFFFFF);
            tooth.drawPolygon([0, 0, -1, -3, 1, -3]);
            tooth.x = -animalData.size * 0.6 + i * 4;
            tooth.y = -animalData.size * 0.9;
            container.addChild(tooth);
        }
        
        // Powerful tail
        const tail = new PIXI.Graphics();
        tail.lineStyle(2, 0x000000);
        tail.beginFill(0x556B2F);
        tail.drawEllipse(0, animalData.size * 1.2, animalData.size * 0.6, animalData.size * 0.8);
        tail.endFill();
        container.addChild(tail);
        
        // Scale pattern
        for (let i = 0; i < 5; i++) {
            const scale = new PIXI.Graphics();
            scale.beginFill(0x8FBC8F);
            scale.drawRect((Math.random() - 0.5) * animalData.size, (Math.random() - 0.5) * animalData.size * 0.6, 3, 2);
            scale.endFill();
            container.addChild(scale);
        }
    }
    
    createWillOWisp(container, animalData) {
        // Wisp core (glowing orb)
        const core = new PIXI.Graphics();
        core.beginFill(0x00FFFF);
        core.drawCircle(0, 0, animalData.size * 0.6);
        core.endFill();
        container.addChild(core);
        
        // Outer glow
        const glow = new PIXI.Graphics();
        glow.beginFill(0x87CEEB, 0.5);
        glow.drawCircle(0, 0, animalData.size);
        glow.endFill();
        container.addChild(glow);
        
        // Floating particles
        for (let i = 0; i < 6; i++) {
            const particle = new PIXI.Graphics();
            particle.beginFill(0xE0FFFF, 0.8);
            particle.drawCircle(0, 0, 2);
            particle.endFill();
            
            const angle = (i / 6) * Math.PI * 2;
            particle.x = Math.cos(angle) * animalData.size * 0.8;
            particle.y = Math.sin(angle) * animalData.size * 0.8;
            container.addChild(particle);
        }
        
        // No traditional eyes, just a mystical center
        const center = new PIXI.Graphics();
        center.beginFill(0xFFFFFF);
        center.drawCircle(0, 0, 3);
        center.endFill();
        container.addChild(center);
    }
    
    createSalamander(container, animalData) {
        // Salamander body (lizard-like but with fire theme)
        const body = new PIXI.Graphics();
        body.lineStyle(2, 0x8B0000);
        body.beginFill(0xFF4500);
        body.drawEllipse(0, 0, animalData.size * 0.8, animalData.size * 1.0);
        body.endFill();
        container.addChild(body);
        
        // Head
        const head = new PIXI.Graphics();
        head.lineStyle(2, 0x8B0000);
        head.beginFill(0xFF6347);
        head.drawPolygon([0, -animalData.size * 0.8, -6, -animalData.size * 0.5, 6, -animalData.size * 0.5]);
        head.endFill();
        container.addChild(head);
        
        // Long tail
        const tail = new PIXI.Graphics();
        tail.lineStyle(2, 0x8B0000);
        tail.beginFill(0xFF4500);
        tail.drawEllipse(0, animalData.size * 0.8, 4, 20);
        tail.endFill();
        container.addChild(tail);
        
        // Fire-colored eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0xFFFF00);
        leftEye.drawCircle(-3, -animalData.size * 0.7, 2);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0xFFFF00);
        rightEye.drawCircle(3, -animalData.size * 0.7, 2);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
        
        // Fire spots
        for (let i = 0; i < 3; i++) {
            const fireSpot = new PIXI.Graphics();
            fireSpot.beginFill(0xFF0000);
            fireSpot.drawCircle((Math.random() - 0.5) * animalData.size * 0.8, (Math.random() - 0.5) * animalData.size * 0.6, 2);
            fireSpot.endFill();
            container.addChild(fireSpot);
        }
    }
    
    createFireElemental(container, animalData) {
        // Elemental core
        const core = new PIXI.Graphics();
        core.lineStyle(2, 0x8B0000);
        core.beginFill(0xFF0000);
        core.drawCircle(0, 0, animalData.size * 0.7);
        core.endFill();
        container.addChild(core);
        
        // Flame wisps
        for (let i = 0; i < 8; i++) {
            const flame = new PIXI.Graphics();
            flame.beginFill(i % 2 === 0 ? 0xFF4500 : 0xFFFF00, 0.8);
            const flameSize = 4 + Math.random() * 4;
            flame.drawPolygon([0, -flameSize, -flameSize/2, flameSize/2, flameSize/2, flameSize/2]);
            flame.endFill();
            
            const angle = (i / 8) * Math.PI * 2;
            flame.x = Math.cos(angle) * animalData.size * 0.9;
            flame.y = Math.sin(angle) * animalData.size * 0.9;
            flame.rotation = angle;
            container.addChild(flame);
        }
        
        // Glowing center
        const center = new PIXI.Graphics();
        center.beginFill(0xFFFFFF);
        center.drawCircle(0, 0, 4);
        center.endFill();
        container.addChild(center);
        
        // Fire eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0xFFFF00);
        leftEye.drawCircle(-6, -6, 3);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0xFFFF00);
        rightEye.drawCircle(6, -6, 3);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
    }
    
    createLavaSlug(container, animalData) {
        // Slug body (elongated blob)
        const body = new PIXI.Graphics();
        body.lineStyle(2, 0x000000);
        body.beginFill(0x8B0000);
        body.drawEllipse(0, 0, animalData.size * 1.2, animalData.size * 0.6);
        body.endFill();
        container.addChild(body);
        
        // Lava patterns
        for (let i = 0; i < 4; i++) {
            const lava = new PIXI.Graphics();
            lava.beginFill(0xFF4500);
            lava.drawEllipse((Math.random() - 0.5) * animalData.size, (Math.random() - 0.5) * animalData.size * 0.4, 4, 2);
            lava.endFill();
            container.addChild(lava);
        }
        
        // Glowing trail behind
        const trail = new PIXI.Graphics();
        trail.beginFill(0xFF0000, 0.6);
        trail.drawEllipse(animalData.size * 0.8, 0, 8, 4);
        trail.endFill();
        container.addChild(trail);
        
        // Simple eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0xFFFF00);
        leftEye.drawCircle(-animalData.size * 0.4, -4, 2);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0xFFFF00);
        rightEye.drawCircle(-animalData.size * 0.2, -4, 2);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
    }
    
    createPhoenix(container, animalData) {
        // Phoenix body (bird-like)
        const body = new PIXI.Graphics();
        body.lineStyle(2, 0x8B0000);
        body.beginFill(0xFF6347);
        body.drawEllipse(0, 0, animalData.size * 0.8, animalData.size * 1.0);
        body.endFill();
        container.addChild(body);
        
        // Head
        const head = new PIXI.Graphics();
        head.lineStyle(2, 0x8B0000);
        head.beginFill(0xFF4500);
        head.drawCircle(0, -animalData.size * 0.6, animalData.size * 0.5);
        head.endFill();
        container.addChild(head);
        
        // Magnificent tail feathers
        for (let i = 0; i < 5; i++) {
            const feather = new PIXI.Graphics();
            const colors = [0xFF0000, 0xFF4500, 0xFFFF00, 0xFF8C00];
            feather.lineStyle(1, 0x8B0000);
            feather.beginFill(colors[i % colors.length]);
            feather.drawEllipse(0, 0, 6, 20);
            feather.endFill();
            
            feather.x = (i - 2) * 4;
            feather.y = animalData.size * 0.8;
            feather.rotation = (i - 2) * 0.2;
            container.addChild(feather);
        }
        
        // Wings spread
        const leftWing = new PIXI.Graphics();
        leftWing.lineStyle(2, 0x8B0000);
        leftWing.beginFill(0xFF6347);
        leftWing.drawEllipse(-animalData.size * 0.9, 0, 12, 20);
        leftWing.endFill();
        
        const rightWing = new PIXI.Graphics();
        rightWing.lineStyle(2, 0x8B0000);
        rightWing.beginFill(0xFF6347);
        rightWing.drawEllipse(animalData.size * 0.9, 0, 12, 20);
        rightWing.endFill();
        
        container.addChild(leftWing);
        container.addChild(rightWing);
        
        // Golden beak
        const beak = new PIXI.Graphics();
        beak.beginFill(0xFFD700);
        beak.drawPolygon([0, -animalData.size * 0.4, -3, -animalData.size * 0.5, 3, -animalData.size * 0.5]);
        beak.endFill();
        container.addChild(beak);
        
        // Blazing eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0xFFFF00);
        leftEye.drawCircle(-4, -animalData.size * 0.6, 3);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0xFFFF00);
        rightEye.drawCircle(4, -animalData.size * 0.6, 3);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
        
        // Fire aura
        const aura = new PIXI.Graphics();
        aura.beginFill(0xFF4500, 0.3);
        aura.drawCircle(0, 0, animalData.size * 1.3);
        aura.endFill();
        container.addChildAt(aura, 0);
    }
    
    createGenericAnimal(container, animalData) {
        // Fallback for any missing types
        const body = new PIXI.Graphics();
        body.lineStyle(2, 0x000000);
        body.beginFill(0x8B4513);
        body.drawCircle(0, 0, animalData.size);
        body.endFill();
        container.addChild(body);
        
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0x000000);
        leftEye.drawCircle(-animalData.size * 0.3, -animalData.size * 0.3, 2);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0x000000);
        rightEye.drawCircle(animalData.size * 0.3, -animalData.size * 0.3, 2);
        rightEye.endFill();
        
        container.addChild(leftEye);
        container.addChild(rightEye);
    }
    
    startAnimalAnimation(animalContainer) {
        const animate = () => {
            if (!animalContainer.parent) return;
            
            animalContainer.animationTime += 0.05;
            const animalData = animalContainer.animalData;
            
            // Different animations based on animal type
            switch(animalData.type) {
                case 'rabbit':
                    // Hopping animation
                    animalContainer.y += Math.sin(animalContainer.animationTime * 3) * 2;
                    break;
                    
                case 'snake':
                    // Slithering motion
                    animalContainer.children.forEach((segment, index) => {
                        if (index > 0) {
                            segment.x = Math.sin(animalContainer.animationTime + index * 0.5) * 3;
                        }
                    });
                    break;
                    
                case 'will_o_wisp':
                    // Floating and pulsing
                    animalContainer.y += Math.sin(animalContainer.animationTime * 2) * 1.5;
                    animalContainer.alpha = 0.7 + Math.sin(animalContainer.animationTime * 4) * 0.3;
                    break;
                    
                case 'fire_elemental':
                case 'phoenix':
                    // Flickering flames
                    animalContainer.children.forEach((child, index) => {
                        if (child.beginFill) {
                            child.alpha = 0.8 + Math.sin(animalContainer.animationTime * 5 + index) * 0.2;
                        }
                    });
                    break;
                    
                case 'penguin':
                    // Waddle animation
                    animalContainer.rotation = Math.sin(animalContainer.animationTime * 2) * 0.1;
                    break;
                    
                case 'frog':
                    // Occasional hop
                    if (Math.sin(animalContainer.animationTime) > 0.95) {
                        animalContainer.y -= 5;
                        setTimeout(() => {
                            if (animalContainer.parent) animalContainer.y += 5;
                        }, 200);
                    }
                    break;
                    
                default:
                    // Gentle idle animation for most animals
                    animalContainer.y += Math.sin(animalContainer.animationTime) * 0.5;
                    animalContainer.rotation = Math.sin(animalContainer.animationTime * 0.5) * 0.05;
            }
            
            // Random movement direction changes
            if (Date.now() - animalContainer.lastMovementChange > 3000 + Math.random() * 2000) {
                animalContainer.movementDirection = Math.random() * Math.PI * 2;
                animalContainer.lastMovementChange = Date.now();
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    createSpellEffect(spellData) {
        const spellContainer = new PIXI.Container();
        
        // Spell projectile with black border
        const spell = new PIXI.Graphics();
        const color = this.getScrollColor(spellData.type);
        spell.lineStyle(2, 0x000000); // Black border
        spell.beginFill(color);
        spell.drawCircle(0, 0, 8);
        spell.endFill();
        
        // Add glow effect with black border
        const glow = new PIXI.Graphics();
        glow.lineStyle(1, 0x000000); // Black border
        glow.beginFill(color, 0.3);
        glow.drawCircle(0, 0, 15);
        glow.endFill();
        
        spellContainer.addChild(glow);
        spellContainer.addChild(spell);
        
        spellContainer.x = spellData.x;
        spellContainer.y = spellData.y;
        spellContainer.spellData = spellData;
        
        // Calculate movement direction
        const dx = spellData.targetX - spellData.x;
        const dy = spellData.targetY - spellData.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        spellContainer.velocityX = (dx / distance) * 300; // pixels per second
        spellContainer.velocityY = (dy / distance) * 300;
        
        return spellContainer;
    }
    
    swingWand(targetX, targetY) {
        if (!this.currentPlayer) return;
        
        // Check for environmental objects in range
        this.checkEnvironmentHit(targetX, targetY);
        
        // Check for players in range
        this.checkPlayerHit(targetX, targetY);
        
        // Visual wand swing effect
        this.createWandSwingEffect();
    }
    
    checkEnvironmentHit(targetX, targetY) {
        const swingRange = 60;
        this.environments.forEach((env, envId) => {
            const dx = env.x - this.currentPlayer.x;
            const dy = env.y - this.currentPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < swingRange) {
                env.health--;
                game.showDamageNumber(1, env.x, env.y, '#ffaa00');
                
                if (env.health <= 0) {
                    // Give experience for destroying environment
                    const expGain = env.envType === 'tree' ? 5 : 8;
                    client.socket.emit('gainExperience', expGain);
                    
                    // Move to random location instead of removing
                    let newX, newY, attempts = 0;
                    do {
                        newX = Math.random() * (this.worldSize.width - 200) + 100;
                        newY = Math.random() * (this.worldSize.height - 200) + 100;
                        attempts++;
                    } while (this.isPositionOccupied(newX, newY, 60) && attempts < 50);
                    
                    env.x = newX;
                    env.y = newY;
                    env.health = env.maxHealth; // Reset health
                    env.alpha = 1;
                    
                    // Update position tracking
                    this.envPositions = this.envPositions.filter(pos => {
                        const dx = pos.x - env.x;
                        const dy = pos.y - env.y;
                        return Math.sqrt(dx * dx + dy * dy) > 30;
                    });
                    this.envPositions.push({x: newX, y: newY, radius: env.envType === 'tree' ? 60 : 50});
                } else {
                    // Damage effect on environment
                    env.alpha = 0.5;
                    setTimeout(() => { env.alpha = 1; }, 200);
                }
            }
        });
    }
    
    checkPlayerHit(targetX, targetY) {
        const swingRange = 50;
        this.players.forEach((player, playerId) => {
            if (playerId !== client.socket.id) {
                const dx = player.x - this.currentPlayer.x;
                const dy = player.y - this.currentPlayer.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < swingRange) {
                    client.socket.emit('playerHit', {
                        targetId: playerId,
                        damage: 15
                    });
                }
            }
        });
    }
    
    createWandSwingEffect() {
        if (!this.currentPlayer) return;
        
        // Create wand swing arc effect
        const wand = this.currentPlayer.children.find(child => child.lineStyle);
        if (wand) {
            // Animate the wand rotation
            const originalRotation = wand.rotation;
            wand.rotation = originalRotation - 0.5;
            
            // Swing animation
            const swingDuration = 300;
            const startTime = Date.now();
            
            const animateSwing = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / swingDuration, 1);
                
                if (progress < 0.5) {
                    // Swing forward
                    wand.rotation = originalRotation - 0.5 + (progress * 2 * 1.0);
                } else {
                    // Swing back
                    wand.rotation = originalRotation + 0.5 - ((progress - 0.5) * 2 * 0.5);
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animateSwing);
                } else {
                    wand.rotation = originalRotation;
                }
            };
            
            requestAnimationFrame(animateSwing);
        }
    }

    castSpell(spellType, targetX, targetY) {
        try {
            if (this.currentPlayer && this.currentPlayer.playerData && this.currentPlayer.playerData.magicLevels[spellType] > 0) {
                // Calculate wand position
                const wandX = this.currentPlayer.x + Math.cos(this.currentPlayer.rotation) * 40;
                const wandY = this.currentPlayer.y + Math.sin(this.currentPlayer.rotation) * 40;
                
                const selectedSpell = this.currentPlayer.playerData.selectedSpells[spellType];
                const spellLevel = this.currentPlayer.playerData.magicLevels[spellType];
                
                const spellData = {
                    type: spellType,
                    spellName: selectedSpell,
                    x: wandX,
                    y: wandY,
                    targetX: targetX,
                    targetY: targetY,
                    level: spellLevel
                };
                
                // Create unique spell mechanics based on type
                this.createSpellMechanics(spellType, selectedSpell, targetX, targetY, spellLevel);
                
                // Enhanced broadcasting for all spell types
                if (client && client.socket && client.socket.connected) {
                    // Send spell casting data to server
                    client.socket.emit('castSpell', spellData);
                    
                    // Send comprehensive spell animation data for broadcasting
                    client.socket.emit('spellAnimation', {
                        playerId: client.socket.id,
                        spellId: `spell_${Date.now()}_${client.socket.id}`,
                        type: spellType,
                        spellName: selectedSpell,
                        level: spellLevel,
                        x: wandX,
                        y: wandY,
                        targetX: targetX,
                        targetY: targetY,
                        playerName: this.currentPlayer.playerData.name,
                        timestamp: Date.now()
                    });
                    
                    // Send transformation animation if player is transformed
                    if (ui && ui.activeTransformation) {
                        client.socket.emit('transformationAnimation', {
                            transformationType: ui.activeTransformation,
                            animationType: 'spellCast',
                            x: this.currentPlayer.x,
                            y: this.currentPlayer.y,
                            targetX: targetX,
                            targetY: targetY
                        });
                    }
                    
                    // Send attack animation data for special attacks
                    if (this.isSpecialAttack(selectedSpell)) {
                        client.socket.emit('attackAnimation', {
                            attackType: this.getAttackType(selectedSpell),
                            x: wandX,
                            y: wandY,
                            targetX: targetX,
                            targetY: targetY,
                            damage: spellLevel * 20,
                            spellType: spellType
                        });
                    }
                    
                    console.log(`Broadcasting ${spellType} spell: ${selectedSpell} (Level ${spellLevel})`);
                }
            }
        } catch (error) {
            console.warn('Error casting spell:', error);
        }
    }

    isSpecialAttack(spellName) {
        const specialAttacks = [
            'Divine Presence', 'Rainbow Divine Blast', 'Mega Fireball', 
            'Tsunami', 'Apocalypse Fire', 'Reality Tear', 'Dimension Collapse'
        ];
        return specialAttacks.includes(spellName);
    }

    getAttackType(spellName) {
        const attackTypes = {
            'Divine Presence': 'divine_presence',
            'Rainbow Divine Blast': 'rainbow_divine_blast',
            'Mega Fireball': 'mega_fireball',
            'Tsunami': 'tsunami',
            'Apocalypse Fire': 'apocalypse_fire',
            'Reality Tear': 'reality_tear',
            'Dimension Collapse': 'dimension_collapse'
        };
        return attackTypes[spellName] || 'standard';
    }
    
    playSpellAnimation(data) {
        // Play the appropriate spell animation based on the data received
        this.createSpellMechanics(data.type, data.spellName, data.targetX, data.targetY, data.level);
    }

    playTransformationAnimation(data) {
        // Handle transformation animations from other players
        if (ui && ui.createTransformationEffect) {
            ui.createTransformationEffect(data.transformationType, data.x, data.y);
        }
    }

    // Enhanced broadcasting visual effect handlers
    createEnhancedSpellProjectile(data) {
        try {
            // Create enhanced spell projectile with trail and particles
            const projectileContainer = new PIXI.Container();
            
            // Main projectile
            const projectile = new PIXI.Graphics();
            projectile.beginFill(data.color || 0xFFFFFF);
            projectile.drawCircle(0, 0, data.particles?.size || 5);
            projectile.endFill();
            projectileContainer.addChild(projectile);
            
            // Trail effect
            let trail = null;
            if (data.trail?.enabled) {
                trail = new PIXI.Graphics();
                trail.lineStyle(data.trail.length / 10, data.trail.color || data.color, 0.6);
                trail.moveTo(-data.trail.length, 0);
                trail.lineTo(0, 0);
                projectileContainer.addChild(trail);
            }
            
            projectileContainer.x = data.startX;
            projectileContainer.y = data.startY;
            
            // Calculate movement
            const dx = data.endX - data.startX;
            const dy = data.endY - data.startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const speed = data.speed || 10;
            const duration = distance / speed * 16; // 60fps
            
            projectileContainer.rotation = Math.atan2(dy, dx);
            
            this.app.stage.addChild(projectileContainer);
            
            // Animate projectile
            let progress = 0;
            const animateProjectile = () => {
                if (progress < 1 && projectileContainer.parent) {
                    progress += 1 / duration;
                    projectileContainer.x = data.startX + dx * progress;
                    projectileContainer.y = data.startY + dy * progress;
                    
                    // Update trail fade
                    if (trail) {
                        trail.alpha = 1 - progress * 0.3;
                    }
                    
                    requestAnimationFrame(animateProjectile);
                } else if (projectileContainer.parent) {
                    this.app.stage.removeChild(projectileContainer);
                }
            };
            animateProjectile();
            
        } catch (error) {
            console.warn('Error creating enhanced spell projectile:', error);
        }
    }

    createTransformationEffects(data) {
        try {
            // Create transformation visual effects
            const effectContainer = new PIXI.Container();
            effectContainer.x = data.x;
            effectContainer.y = data.y;
            
            // Particles
            if (data.particles) {
                for (let i = 0; i < (data.particles.count || 30); i++) {
                    const particle = new PIXI.Graphics();
                    particle.beginFill(data.particles.color || 0xFFFFFF);
                    particle.drawCircle(0, 0, data.particles.size || 3);
                    particle.endFill();
                    
                    const angle = Math.random() * Math.PI * 2;
                    const radius = Math.random() * 50;
                    particle.x = Math.cos(angle) * radius;
                    particle.y = Math.sin(angle) * radius;
                    
                    effectContainer.addChild(particle);
                    
                    // Animate particle
                    const animateParticle = () => {
                        if (particle.parent && particle.alpha > 0) {
                            particle.y -= 2;
                            particle.alpha -= 0.02;
                            particle.rotation += 0.1;
                            requestAnimationFrame(animateParticle);
                        }
                    };
                    setTimeout(() => animateParticle(), i * 10);
                }
            }
            
            // Aura
            if (data.aura) {
                const aura = new PIXI.Graphics();
                aura.beginFill(data.aura.color || 0xFFFFFF, data.aura.intensity || 0.3);
                aura.drawCircle(0, 0, data.aura.radius || 100);
                aura.endFill();
                effectContainer.addChild(aura);
                
                if (data.aura.pulse) {
                    const pulseAnimation = () => {
                        if (aura.parent) {
                            aura.scale.x = 1 + Math.sin(Date.now() * 0.005) * 0.2;
                            aura.scale.y = 1 + Math.sin(Date.now() * 0.005) * 0.2;
                            requestAnimationFrame(pulseAnimation);
                        }
                    };
                    pulseAnimation();
                }
            }
            
            this.app.stage.addChild(effectContainer);
            
            setTimeout(() => {
                if (effectContainer.parent) {
                    this.app.stage.removeChild(effectContainer);
                }
            }, data.duration || 3000);
            
        } catch (error) {
            console.warn('Error creating transformation effects:', error);
        }
    }

    createAttackEffects(data) {
        try {
            // Create enhanced attack visual effects
            const effectContainer = new PIXI.Container();
            effectContainer.x = data.startX;
            effectContainer.y = data.startY;
            
            // Screen shake
            if (data.screenShake) {
                this.createScreenShake(data.screenShake.intensity, data.screenShake.duration);
            }
            
            // Shockwave
            if (data.shockwave) {
                this.createShockwave(data.startX, data.startY, data.shockwave);
            }
            
            this.app.stage.addChild(effectContainer);
            
            setTimeout(() => {
                if (effectContainer.parent) {
                    this.app.stage.removeChild(effectContainer);
                }
            }, 2000);
            
        } catch (error) {
            console.warn('Error creating attack effects:', error);
        }
    }

    showDamageEffect(data) {
        try {
            // Enhanced damage visual feedback
            const damageContainer = new PIXI.Container();
            damageContainer.x = data.x;
            damageContainer.y = data.y;
            
            // Damage particles
            if (data.effects?.particles) {
                for (let i = 0; i < data.effects.particles.count; i++) {
                    const particle = new PIXI.Graphics();
                    particle.beginFill(data.effects.particles.color || 0xFF0000);
                    particle.drawCircle(0, 0, 2);
                    particle.endFill();
                    
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 5 + 2;
                    particle.vx = Math.cos(angle) * speed;
                    particle.vy = Math.sin(angle) * speed;
                    
                    damageContainer.addChild(particle);
                    
                    const animateParticle = () => {
                        if (particle.parent && particle.alpha > 0) {
                            particle.x += particle.vx;
                            particle.y += particle.vy;
                            particle.vy += 0.2; // gravity
                            particle.alpha -= 0.05;
                            requestAnimationFrame(animateParticle);
                        }
                    };
                    animateParticle();
                }
            }
            
            this.app.stage.addChild(damageContainer);
            
            // Show damage number
            this.showDamageNumber(data.damage, data.x, data.y);
            
            setTimeout(() => {
                if (damageContainer.parent) {
                    this.app.stage.removeChild(damageContainer);
                }
            }, 1000);
            
        } catch (error) {
            console.warn('Error showing damage effect:', error);
        }
    }

    showDeathEffect(data) {
        try {
            // Enhanced death visual effects
            const deathContainer = new PIXI.Container();
            deathContainer.x = data.x;
            deathContainer.y = data.y;
            
            // Death explosion
            const explosion = new PIXI.Graphics();
            explosion.beginFill(0xFF0000, 0.8);
            explosion.drawCircle(0, 0, 50);
            explosion.endFill();
            deathContainer.addChild(explosion);
            
            // Expanding animation
            explosion.scale.set(0.1);
            const expandAnimation = () => {
                if (explosion.scale.x < 2 && explosion.parent) {
                    explosion.scale.x += 0.1;
                    explosion.scale.y += 0.1;
                    explosion.alpha -= 0.05;
                    requestAnimationFrame(expandAnimation);
                }
            };
            expandAnimation();
            
            this.app.stage.addChild(deathContainer);
            
            setTimeout(() => {
                if (deathContainer.parent) {
                    this.app.stage.removeChild(deathContainer);
                }
            }, 1000);
            
        } catch (error) {
            console.warn('Error showing death effect:', error);
        }
    }

    showLevelUpEffect(data) {
        try {
            // Level up celebration effect
            const levelUpContainer = new PIXI.Container();
            levelUpContainer.x = data.x;
            levelUpContainer.y = data.y;
            
            // Golden burst
            const burst = new PIXI.Graphics();
            burst.beginFill(0xFFD700, 0.8);
            burst.drawCircle(0, 0, 80);
            burst.endFill();
            levelUpContainer.addChild(burst);
            
            // Sparkles
            for (let i = 0; i < 20; i++) {
                const sparkle = new PIXI.Graphics();
                sparkle.beginFill(0xFFFFFF);
                sparkle.drawCircle(0, 0, 3);
                sparkle.endFill();
                
                const angle = (i / 20) * Math.PI * 2;
                sparkle.x = Math.cos(angle) * 60;
                sparkle.y = Math.sin(angle) * 60;
                levelUpContainer.addChild(sparkle);
                
                // Sparkle animation
                const animateSparkle = () => {
                    if (sparkle.parent && sparkle.alpha > 0) {
                        sparkle.alpha -= 0.02;
                        sparkle.y -= 1;
                        requestAnimationFrame(animateSparkle);
                    }
                };
                setTimeout(() => animateSparkle(), i * 50);
            }
            
            this.app.stage.addChild(levelUpContainer);
            
            setTimeout(() => {
                if (levelUpContainer.parent) {
                    this.app.stage.removeChild(levelUpContainer);
                }
            }, 2000);
            
        } catch (error) {
            console.warn('Error showing level up effect:', error);
        }
    }

    showHealingWaveEffect(data) {
        try {
            // Healing wave visual effect
            const healingContainer = new PIXI.Container();
            healingContainer.x = data.x;
            healingContainer.y = data.y;
            
            // Expanding healing wave
            const wave = new PIXI.Graphics();
            wave.lineStyle(8, 0x00FF00, 0.6);
            wave.drawCircle(0, 0, 50);
            healingContainer.addChild(wave);
            
            // Expanding animation
            const expandWave = () => {
                if (wave.scale.x < data.radius / 50 && wave.parent) {
                    wave.scale.x += 0.1;
                    wave.scale.y += 0.1;
                    wave.alpha -= 0.02;
                    requestAnimationFrame(expandWave);
                }
            };
            expandWave();
            
            this.app.stage.addChild(healingContainer);
            
            setTimeout(() => {
                if (healingContainer.parent) {
                    this.app.stage.removeChild(healingContainer);
                }
            }, 3000);
            
        } catch (error) {
            console.warn('Error showing healing wave effect:', error);
        }
    }

    createScreenShake(intensity, duration) {
        try {
            const originalX = this.app.stage.x;
            const originalY = this.app.stage.y;
            let elapsed = 0;
            
            const shakeAnimation = () => {
                if (elapsed < duration) {
                    const shakeX = (Math.random() - 0.5) * intensity;
                    const shakeY = (Math.random() - 0.5) * intensity;
                    
                    this.app.stage.x = originalX + shakeX;
                    this.app.stage.y = originalY + shakeY;
                    
                    elapsed += 16; // ~60fps
                    requestAnimationFrame(shakeAnimation);
                } else {
                    this.app.stage.x = originalX;
                    this.app.stage.y = originalY;
                }
            };
            shakeAnimation();
            
        } catch (error) {
            console.warn('Error creating screen shake:', error);
        }
    }

    createShockwave(x, y, shockwaveData) {
        try {
            const shockwave = new PIXI.Graphics();
            shockwave.lineStyle(6, shockwaveData.color || 0xFFFFFF, 0.8);
            shockwave.drawCircle(0, 0, 10);
            shockwave.x = x;
            shockwave.y = y;
            
            this.app.stage.addChild(shockwave);
            
            // Expanding shockwave animation
            const expandShockwave = () => {
                if (shockwave.scale.x < shockwaveData.radius / 10 && shockwave.parent) {
                    shockwave.scale.x += shockwaveData.speed / 10;
                    shockwave.scale.y += shockwaveData.speed / 10;
                    shockwave.alpha -= 0.03;
                    requestAnimationFrame(expandShockwave);
                } else if (shockwave.parent) {
                    this.app.stage.removeChild(shockwave);
                }
            };
            expandShockwave();
            
        } catch (error) {
            console.warn('Error creating shockwave:', error);
        }
    }

    playAttackAnimation(data) {
        // Handle special attack animations from other players
        switch(data.attackType) {
            case 'divine_presence':
                this.createDivinePresence(data.targetX, data.targetY, 10);
                break;
            case 'rainbow_divine_blast':
                this.createRainbowDivineBlast(data.targetX, data.targetY, 10);
                break;
            case 'mega_fireball':
                this.createApocalypseFire(data.targetX, data.targetY, 10);
                break;
            case 'tsunami':
                this.createBloodTsunami(data.targetX, data.targetY, 10);
                break;
            case 'reality_tear':
                this.createRealityTear(data.targetX, data.targetY, 10);
                break;
            case 'dimension_collapse':
                this.createDimensionCollapse(data.targetX, data.targetY, 10);
                break;
        }
    }

    updatePlayerTransformation(playerId, transformationType) {
        // Update visual appearance of other players when they transform
        const player = this.players.get(playerId);
        if (!player) return;

        // Add visual indicators for transformed players
        if (!player.transformationIndicator) {
            player.transformationIndicator = new PIXI.Graphics();
            player.addChild(player.transformationIndicator);
        }

        player.transformationIndicator.clear();

        // Create transformation indicator based on type
        const colors = {
            adminGod: 0xFFFFFF,
            bloodLust: 0xFF0000,
            shadowNinja: 0x8A2BE2,
            dragonLord: 0xFFD700,
            phoenixEmperor: 0xFF4500,
            voidLeviathanKing: 0x8800FF,
            celestialTigerGod: 0x00FFFF
        };

        const color = colors[transformationType] || 0xFFFFFF;

        // Create glowing ring around transformed player
        player.transformationIndicator.lineStyle(4, color, 0.8);
        player.transformationIndicator.drawCircle(0, 0, 35);

        // Add pulsing animation
        player.transformationIndicator.alpha = 0.8;
        const pulseAnimation = () => {
            if (player.transformationIndicator && player.transformationIndicator.parent) {
                player.transformationIndicator.alpha = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
                player.transformationIndicator.scale.set(1 + Math.sin(Date.now() * 0.003) * 0.1);
                requestAnimationFrame(pulseAnimation);
            }
        };
        pulseAnimation();
    }

    removePlayerTransformation(playerId) {
        // Remove transformation visual indicators
        const player = this.players.get(playerId);
        if (!player) return;

        if (player.transformationIndicator && player.transformationIndicator.parent) {
            player.removeChild(player.transformationIndicator);
            player.transformationIndicator = null;
        }
    }

    createSpellMechanics(spellType, spellName, targetX, targetY, level) {
        // Handle transformation skills
        if (spellName === 'Divine Presence') {
            this.createDivinePresence(targetX, targetY, level);
            return;
        }
        if (spellName === 'Rainbow Divine Blast') {
            this.createRainbowDivineBlast(targetX, targetY, level);
            return;
        }
        if (spellName === 'Heavenly Healing Wave') {
            this.createHeavenlyHealingWave(targetX, targetY, level);
            return;
        }
        if (spellName === 'Blood Tsunami') {
            this.createBloodTsunami(targetX, targetY, level);
            return;
        }
        if (spellName === 'Crimson Blitz') {
            this.createCrimsonBlitz(targetX, targetY, level);
            return;
        }
        if (spellName === 'Nine-Tail Barrage') {
            this.createNineTailBarrage(targetX, targetY, level);
            return;
        }
        if (spellName === 'Shadow Clone Jutsu') {
            this.createShadowCloneJutsu(targetX, targetY, level);
            return;
        }
        if (spellName === 'Void Step') {
            this.createVoidStep(targetX, targetY, level);
            return;
        }
        if (spellName === 'Darkness Domain') {
            this.createDarknessDomain(targetX, targetY, level);
            return;
        }
        if (spellName === 'Primal Roar') {
            this.createPrimalRoar(targetX, targetY, level);
            return;
        }
        if (spellName === 'Wild Charge') {
            this.createWildCharge(targetX, targetY, level);
            return;
        }
        if (spellName === 'Pack Summon') {
            this.createPackSummon(targetX, targetY, level);
            return;
        }
        
        // Use spell name to determine exact spell mechanics
        switch(spellName) {
            // Fire spells
            case 'Fireball':
                this.createFireball(targetX, targetY, level);
                break;
            case 'Flame Burst':
                this.createFlameBurst(targetX, targetY, level);
                break;
            case 'Inferno Blast':
                this.createInfernoBlast(targetX, targetY, level);
                break;
            case 'Apocalypse Fire':
                this.createApocalypseFire(targetX, targetY, level);
                break;
            
            // Ice spells
            case 'Water Bullet':
                this.createWaterBullet(targetX, targetY, level);
                break;
            case 'Ice Shard':
                this.createIceShard(targetX, targetY, level);
                break;
            case 'Frost Storm':
                this.createFrostStorm(targetX, targetY, level);
                break;
            case 'Absolute Zero':
                this.createAbsoluteZero(targetX, targetY, level);
                break;
            
            // Lightning spells
            case 'Lightning Bolt':
                this.createLightningBolt(targetX, targetY, level);
                break;
            case 'Chain Lightning':
                this.createChainLightning(targetX, targetY, level);
                break;
            case 'Thunder Storm':
                this.createThunderStorm(targetX, targetY, level);
                break;
            case 'God\'s Wrath':
                this.createGodsWrath(targetX, targetY, level);
                break;
            
            // Earth spells
            case 'Earth Wall':
                this.createEarthWall(targetX, targetY, level);
                break;
            case 'Stone Spikes':
                this.createStoneSpikes(targetX, targetY, level);
                break;
            case 'Earthquake':
                this.createEarthquake(targetX, targetY, level);
                break;
            case 'Continental Drift':
                this.createContinentalDrift(targetX, targetY, level);
                break;
            
            // Wind spells
            case 'Wind Blast':
                this.createWindBlast(targetX, targetY, level);
                break;
            case 'Tornado':
                this.createTornado(targetX, targetY, level);
                break;
            case 'Hurricane':
                this.createHurricane(targetX, targetY, level);
                break;
            case 'Atmospheric Collapse':
                this.createAtmosphericCollapse(targetX, targetY, level);
                break;
            
            // Shadow spells
            case 'Dark Hole':
                this.createDarkHole(targetX, targetY, level);
                break;
            case 'Shadow Void':
                this.createShadowVoid(targetX, targetY, level);
                break;
            case 'Black Hole':
                this.createBlackHole(targetX, targetY, level);
                break;
            case 'Reality Erasure':
                this.createRealityErasure(targetX, targetY, level);
                break;
            
            // Light spells
            case 'Light Beam':
                this.createLightBeam(targetX, targetY, level);
                break;
            case 'Holy Nova':
                this.createHolyNova(targetX, targetY, level);
                break;
            case 'Divine Wrath':
                this.createDivineWrath(targetX, targetY, level);
                break;
            case 'Genesis Burst':
                this.createGenesisBurst(targetX, targetY, level);
                break;
            
            // Void spells
            case 'Void Blast':
                this.createVoidBlast(targetX, targetY, level);
                break;
            case 'Reality Tear':
                this.createRealityTear(targetX, targetY, level);
                break;
            case 'Dimension Collapse':
                this.createDimensionCollapse(targetX, targetY, level);
                break;
            case 'Universal Void':
                this.createUniversalVoid(targetX, targetY, level);
                break;
            
            // Soul spells
            case 'Soul Drain':
                this.createSoulDrain(targetX, targetY, level);
                break;
            case 'Spirit Army':
                this.createSpiritArmy(targetX, targetY, level);
                break;
            case 'Soul Storm':
                this.createSoulStorm(targetX, targetY, level);
                break;
            case 'Death Incarnate':
                this.createDeathIncarnate(targetX, targetY, level);
                break;
        }
    }
    
    createFireball(targetX, targetY, level) {
        // Enhanced fireball with trailing flames
        const fireballContainer = new PIXI.Container();
        
        // Main fireball core
        const core = new PIXI.Graphics();
        core.beginFill(0xffff44); // Bright yellow core
        core.drawCircle(0, 0, 6);
        core.endFill();
        
        // Inner flame
        const innerFlame = new PIXI.Graphics();
        innerFlame.beginFill(0xff6600, 0.8); // Orange
        innerFlame.drawCircle(0, 0, 10);
        innerFlame.endFill();
        
        // Outer flame
        const outerFlame = new PIXI.Graphics();
        outerFlame.beginFill(0xff4444, 0.6); // Red
        outerFlame.drawCircle(0, 0, 14);
        outerFlame.endFill();
        
        // Heat distortion
        const heatWave = new PIXI.Graphics();
        heatWave.beginFill(0xff8800, 0.3);
        heatWave.drawCircle(0, 0, 18);
        heatWave.endFill();
        
        fireballContainer.addChild(heatWave);
        fireballContainer.addChild(outerFlame);
        fireballContainer.addChild(innerFlame);
        fireballContainer.addChild(core);
        
        fireballContainer.x = this.currentPlayer.x;
        fireballContainer.y = this.currentPlayer.y;
        this.app.stage.addChild(fireballContainer);
        
        // Create trailing fire particles
        const trailParticles = [];
        
        // Animate projectile movement
        const dx = targetX - this.currentPlayer.x;
        const dy = targetY - this.currentPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = 450;
        const time = distance / speed * 1000;
        
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / time;
            
            if (progress < 1) {
                fireballContainer.x = this.currentPlayer.x + dx * progress;
                fireballContainer.y = this.currentPlayer.y + dy * progress;
                fireballContainer.rotation += 0.15;
                
                // Add flame particles
                if (Math.random() > 0.7) {
                    const particle = new PIXI.Graphics();
                    particle.beginFill(Math.random() > 0.5 ? 0xff4444 : 0xff8800, 0.8);
                    particle.drawCircle(0, 0, 3 + Math.random() * 3);
                    particle.endFill();
                    
                    particle.x = fireballContainer.x + (Math.random() - 0.5) * 20;
                    particle.y = fireballContainer.y + (Math.random() - 0.5) * 20;
                    this.app.stage.addChild(particle);
                    trailParticles.push(particle);
                    
                    // Fade particle
                    setTimeout(() => {
                        if (particle.parent) {
                            this.app.stage.removeChild(particle);
                        }
                    }, 300);
                }
                
                requestAnimationFrame(animate);
            } else {
                // Enhanced explosion
                this.createFireExplosion(targetX, targetY, 1);
                this.checkAreaDamage(targetX, targetY, 60, 15, 'fire');
                this.checkEnvironmentDamage(targetX, targetY, 60, 2);
                
                // Clean up
                if (fireballContainer.parent) {
                    this.app.stage.removeChild(fireballContainer);
                }
                trailParticles.forEach(particle => {
                    if (particle.parent) {
                        this.app.stage.removeChild(particle);
                    }
                });
            }
        };
        animate();
    }
    
    createFlameBurst(targetX, targetY, level) {
        // Larger explosion with multiple fireballs
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const angle = (i / 3) * Math.PI * 2;
                const burstX = targetX + Math.cos(angle) * 60;
                const burstY = targetY + Math.sin(angle) * 60;
                
                const burst = new PIXI.Graphics();
                burst.beginFill(0xff4444);
                burst.drawCircle(0, 0, 15);
                burst.endFill();
                
                burst.x = burstX;
                burst.y = burstY;
                this.app.stage.addChild(burst);
                
                this.createExplosion(burstX, burstY, 2);
                this.checkAreaDamage(burstX, burstY, 70, 25, 'fire');
                
                setTimeout(() => {
                    if (burst.parent) {
                        this.app.stage.removeChild(burst);
                    }
                }, 800);
            }, i * 150);
        }
    }
    
    createInfernoBlast(targetX, targetY, level) {
        // Massive fire explosion
        const inferno = new PIXI.Graphics();
        inferno.beginFill(0xff0000, 0.8);
        inferno.drawCircle(0, 0, 100);
        inferno.endFill();
        
        inferno.beginFill(0xff4444, 0.6);
        inferno.drawCircle(0, 0, 80);
        inferno.endFill();
        
        inferno.beginFill(0xff8800, 0.4);
        inferno.drawCircle(0, 0, 60);
        inferno.endFill();
        
        inferno.x = targetX;
        inferno.y = targetY;
        this.app.stage.addChild(inferno);
        
        // Expanding animation
        inferno.scale.set(0.1);
        const animate = () => {
            if (inferno.scale.x < 1) {
                inferno.scale.x += 0.1;
                inferno.scale.y += 0.1;
                inferno.rotation += 0.05;
                requestAnimationFrame(animate);
            }
        };
        animate();
        
        this.checkAreaDamage(targetX, targetY, 120, 35, 'fire');
        this.checkEnvironmentDamage(targetX, targetY, 120, 4);
        
        setTimeout(() => {
            if (inferno.parent) {
                this.app.stage.removeChild(inferno);
            }
        }, 1500);
    }
    
    createWaterBullet(targetX, targetY, level) {
        // Fast moving water projectile
        const bullet = new PIXI.Graphics();
        bullet.beginFill(0x4444ff);
        bullet.drawCircle(0, 0, 6);
        bullet.endFill();
        
        bullet.x = this.currentPlayer.x;
        bullet.y = this.currentPlayer.y;
        this.app.stage.addChild(bullet);
        
        // Very fast movement
        const dx = targetX - this.currentPlayer.x;
        const dy = targetY - this.currentPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = 600; // Very fast
        const time = distance / speed * 1000;
        
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / time;
            
            if (progress < 1) {
                bullet.x = this.currentPlayer.x + dx * progress;
                bullet.y = this.currentPlayer.y + dy * progress;
                requestAnimationFrame(animate);
            } else {
                this.checkAreaDamage(targetX, targetY, 30, 12, 'ice');
                if (bullet.parent) {
                    this.app.stage.removeChild(bullet);
                }
            }
        };
        animate();
    }
    
    createIceShard(targetX, targetY, level) {
        // Sharp ice projectile with piercing effect
        const shard = new PIXI.Graphics();
        shard.beginFill(0x88ccff);
        shard.lineStyle(2, 0xffffff);
        shard.drawPolygon([
            0, -15,    // top point
            -8, 8,     // bottom left
            8, 8       // bottom right
        ]);
        shard.endFill();
        
        shard.x = this.currentPlayer.x;
        shard.y = this.currentPlayer.y;
        
        // Rotate towards target
        const angle = Math.atan2(targetY - this.currentPlayer.y, targetX - this.currentPlayer.x);
        shard.rotation = angle + Math.PI / 2;
        
        this.app.stage.addChild(shard);
        
        // Movement animation
        const dx = targetX - this.currentPlayer.x;
        const dy = targetY - this.currentPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = 500;
        const time = distance / speed * 1000;
        
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / time;
            
            if (progress < 1) {
                shard.x = this.currentPlayer.x + dx * progress;
                shard.y = this.currentPlayer.y + dy * progress;
                requestAnimationFrame(animate);
            } else {
                this.checkAreaDamage(targetX, targetY, 40, 20, 'ice');
                if (shard.parent) {
                    this.app.stage.removeChild(shard);
                }
            }
        };
        animate();
    }
    
    createFrostStorm(targetX, targetY, level) {
        // Multiple ice shards in a spread
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const angle = (i / 5) * Math.PI * 2;
                const stormX = targetX + Math.cos(angle) * 80;
                const stormY = targetY + Math.sin(angle) * 80;
                
                const shard = new PIXI.Graphics();
                shard.beginFill(0x66aaff);
                shard.lineStyle(2, 0xffffff);
                // Create ice crystal shape instead of star
                shard.drawPolygon([
                    0, -12,    // top
                    -8, -4,    // top left
                    -12, 0,    // left
                    -8, 4,     // bottom left
                    0, 12,     // bottom
                    8, 4,      // bottom right
                    12, 0,     // right
                    8, -4      // top right
                ]);
                shard.endFill();
                
                shard.x = stormX;
                shard.y = stormY;
                this.app.stage.addChild(shard);
                
                // Spinning animation
                const spinAnimation = () => {
                    shard.rotation += 0.2;
                    if (shard.parent) {
                        requestAnimationFrame(spinAnimation);
                    }
                };
                spinAnimation();
                
                this.checkAreaDamage(stormX, stormY, 50, 30, 'ice');
                
                setTimeout(() => {
                    if (shard.parent) {
                        this.app.stage.removeChild(shard);
                    }
                }, 1200);
            }, i * 100);
        }
    }
    
    createEarthWall(targetX, targetY, level) {
        const wallContainer = new PIXI.Container();
        const width = 25;
        const height = 120;
        
        // Basic earth wall
        const border = new PIXI.Graphics();
        border.lineStyle(4, 0x000000);
        border.drawRect(-width/2 - 2, -height/2 - 2, width + 4, height + 4);
        wallContainer.addChild(border);
        
        const wall = new PIXI.Graphics();
        wall.beginFill(0x44aa44);
        wall.lineStyle(2, 0x228822);
        wall.drawRect(-width/2, -height/2, width, height);
        wall.endFill();
        wallContainer.addChild(wall);
        
        wallContainer.x = targetX;
        wallContainer.y = targetY;
        wallContainer.spellType = 'earth';
        wallContainer.damage = 20;
        wallContainer.isWall = true;
        wallContainer.wallWidth = width;
        wallContainer.wallHeight = height;
        
        // Use the same rotation as the preview if it exists
        if (this.wallPreview) {
            wallContainer.rotation = this.wallPreview.rotation;
        } else {
            // Fallback: orient towards player's facing direction
            const dx = targetX - this.currentPlayer.x;
            const dy = targetY - this.currentPlayer.y;
            const angle = Math.atan2(dy, dx);
            wallContainer.rotation = angle + Math.PI / 2;
        }
        
        this.app.stage.addChild(wallContainer);
        this.wallObjects = this.wallObjects || new Map();
        const wallId = `wall_${Date.now()}`;
        this.wallObjects.set(wallId, wallContainer);
        
        // Remove preview after placing wall
        if (this.wallPreview && this.wallPreview.parent) {
            this.app.stage.removeChild(this.wallPreview);
            this.wallPreview = null;
        }
        
        setTimeout(() => {
            if (wallContainer.parent) {
                this.app.stage.removeChild(wallContainer);
                this.wallObjects.delete(wallId);
            }
        }, 10000);
    }
    
    createStoneSpikes(targetX, targetY, level) {
        // Sharp stone projectiles that shoot forward
        for (let i = 0; i < 3; i++) {
            const spike = new PIXI.Graphics();
            spike.beginFill(0x666666);
            spike.lineStyle(2, 0x444444);
            spike.drawPolygon([
                0, -20,    // sharp tip
                -6, 6,     // left base
                6, 6       // right base
            ]);
            spike.endFill();
            
            const angle = Math.atan2(targetY - this.currentPlayer.y, targetX - this.currentPlayer.x) + (i - 1) * 0.3;
            spike.x = this.currentPlayer.x;
            spike.y = this.currentPlayer.y;
            spike.rotation = angle + Math.PI / 2;
            
            this.app.stage.addChild(spike);
            
            // Animate forward movement
            const moveDistance = 200;
            const endX = spike.x + Math.cos(angle) * moveDistance;
            const endY = spike.y + Math.sin(angle) * moveDistance;
            
            const startTime = Date.now();
            const duration = 800;
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / duration;
                
                if (progress < 1) {
                    spike.x = this.currentPlayer.x + Math.cos(angle) * moveDistance * progress;
                    spike.y = this.currentPlayer.y + Math.sin(angle) * moveDistance * progress;
                    requestAnimationFrame(animate);
                } else {
                    this.checkAreaDamage(endX, endY, 40, 30, 'earth');
                    if (spike.parent) {
                        this.app.stage.removeChild(spike);
                    }
                }
            };
            
            setTimeout(() => animate(), i * 200);
        }
    }
    
    createEarthquake(targetX, targetY, level) {
        // Massive earthquake with improved visuals
        const earthquakeContainer = new PIXI.Container();
        earthquakeContainer.x = targetX;
        earthquakeContainer.y = targetY;
        
        // Create realistic ground cracks
        for (let i = 0; i < 12; i++) {
            const crack = new PIXI.Graphics();
            crack.lineStyle(6, 0x4a2c17); // Dark brown
            crack.lineStyle(3, 0x8B4513); // Lighter brown outline
            
            const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const length = 120 + Math.random() * 80;
            
            // Create jagged crack
            let currentX = 0;
            let currentY = 0;
            crack.moveTo(currentX, currentY);
            
            const segments = 6;
            for (let j = 1; j <= segments; j++) {
                const progress = j / segments;
                const targetX = Math.cos(angle) * length * progress;
                const targetY = Math.sin(angle) * length * progress;
                
                // Add jagged variation
                const jaggerX = targetX + (Math.random() - 0.5) * 20;
                const jaggerY = targetY + (Math.random() - 0.5) * 20;
                
                crack.lineTo(jaggerX, jaggerY);
                currentX = jaggerX;
                currentY = jaggerY;
            }
            
            earthquakeContainer.addChild(crack);
        }
        
        // Add rising earth spikes
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                const spikeAngle = (i / 8) * Math.PI * 2;
                const spikeDistance = 60 + Math.random() * 40;
                const spikeX = targetX + Math.cos(spikeAngle) * spikeDistance;
                const spikeY = targetY + Math.sin(spikeAngle) * spikeDistance;
                
                const spike = new PIXI.Graphics();
                spike.beginFill(0x654321);
                spike.lineStyle(2, 0x8B4513);
                spike.drawPolygon([
                    0, -30,    // tip
                    -12, 15,   // left base
                    12, 15     // right base
                ]);
                spike.endFill();
                
                spike.x = spikeX;
                spike.y = spikeY + 20; // Start underground
                spike.alpha = 0;
                this.app.stage.addChild(spike);
                
                // Animate spike rising
                const riseAnimation = () => {
                    if (spike.y > spikeY - 30) {
                        spike.y -= 2;
                        spike.alpha = Math.min(1, spike.alpha + 0.1);
                        requestAnimationFrame(riseAnimation);
                    }
                };
                riseAnimation();
                
                // Remove spike after duration
                setTimeout(() => {
                    if (spike.parent) {
                        this.app.stage.removeChild(spike);
                    }
                }, 3000);
            }, i * 200);
        }
        
        this.app.stage.addChild(earthquakeContainer);
        
        // Enhanced shake effect
        let shakeIntensity = 25;
        const shakeAnimation = () => {
            if (shakeIntensity > 0) {
                earthquakeContainer.x = targetX + (Math.random() - 0.5) * shakeIntensity;
                earthquakeContainer.y = targetY + (Math.random() - 0.5) * shakeIntensity;
                
                // Shake the entire screen slightly
                this.app.stage.x += (Math.random() - 0.5) * (shakeIntensity * 0.3);
                this.app.stage.y += (Math.random() - 0.5) * (shakeIntensity * 0.3);
                
                shakeIntensity *= 0.92;
                requestAnimationFrame(shakeAnimation);
            } else {
                // Reset stage position
                this.app.stage.x = -this.camera.x;
                this.app.stage.y = -this.camera.y;
            }
        };
        shakeAnimation();
        
        // Multiple expanding damage waves
        for (let wave = 0; wave < 4; wave++) {
            setTimeout(() => {
                this.checkAreaDamage(targetX, targetY, 120 + wave * 30, 40, 'earth');
                
                // Visual wave effect
                const waveRing = new PIXI.Graphics();
                waveRing.lineStyle(4, 0x8B4513, 0.8);
                waveRing.drawCircle(targetX, targetY, 120 + wave * 30);
                this.app.stage.addChild(waveRing);
                
                setTimeout(() => {
                    if (waveRing.parent) {
                        this.app.stage.removeChild(waveRing);
                    }
                }, 800);
            }, wave * 400);
        }
        
        setTimeout(() => {
            if (earthquakeContainer.parent) {
                this.app.stage.removeChild(earthquakeContainer);
            }
        }, 3000);
    }
    
    createDarkHole(targetX, targetY, level) {
        // Basic dark hole
        const holeContainer = new PIXI.Container();
        const size = 50;
        
        const border = new PIXI.Graphics();
        border.lineStyle(4, 0x000000);
        border.drawCircle(0, 0, size + 4);
        holeContainer.addChild(border);
        
        const hole = new PIXI.Graphics();
        hole.beginFill(0x330033);
        hole.drawCircle(0, 0, size);
        hole.endFill();
        
        hole.beginFill(0x000000);
        hole.drawCircle(0, 0, size * 0.6);
        hole.endFill();
        holeContainer.addChild(hole);
        
        holeContainer.x = targetX;
        holeContainer.y = targetY;
        holeContainer.spellType = 'shadow';
        holeContainer.damage = 40;
        holeContainer.pullRadius = size * 2;
        holeContainer.pullForce = 1;
        holeContainer.isDarkHole = true;
        
        this.app.stage.addChild(holeContainer);
        this.darkHoles = this.darkHoles || new Map();
        const holeId = `hole_${Date.now()}`;
        this.darkHoles.set(holeId, holeContainer);
        
        const animateHole = () => {
            if (holeContainer.parent) {
                holeContainer.rotation += 0.1;
                requestAnimationFrame(animateHole);
            }
        };
        animateHole();
        
        setTimeout(() => {
            if (holeContainer.parent) {
                this.app.stage.removeChild(holeContainer);
                this.darkHoles.delete(holeId);
            }
        }, 8000);
    }
    
    createShadowVoid(targetX, targetY, level) {
        // Larger gravitational pull with shadow tendrils
        const voidContainer = new PIXI.Container();
        const size = 80;
        
        // Outer void
        const outerVoid = new PIXI.Graphics();
        outerVoid.beginFill(0x220022, 0.8);
        outerVoid.drawCircle(0, 0, size);
        outerVoid.endFill();
        voidContainer.addChild(outerVoid);
        
        // Inner void
        const innerVoid = new PIXI.Graphics();
        innerVoid.beginFill(0x000000);
        innerVoid.drawCircle(0, 0, size * 0.5);
        innerVoid.endFill();
        voidContainer.addChild(innerVoid);
        
        // Shadow tendrils
        for (let i = 0; i < 8; i++) {
            const tendril = new PIXI.Graphics();
            tendril.lineStyle(4, 0x440044, 0.8);
            
            const angle = (i / 8) * Math.PI * 2;
            const length = 120;
            
            tendril.moveTo(0, 0);
            tendril.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
            voidContainer.addChild(tendril);
        }
        
        voidContainer.x = targetX;
        voidContainer.y = targetY;
        voidContainer.spellType = 'shadow';
        voidContainer.damage = 50;
        voidContainer.pullRadius = size * 3;
        voidContainer.pullForce = 2;
        voidContainer.isDarkHole = true;
        
        this.app.stage.addChild(voidContainer);
        this.darkHoles = this.darkHoles || new Map();
        const voidId = `void_${Date.now()}`;
        this.darkHoles.set(voidId, voidContainer);
        
        const animateVoid = () => {
            if (voidContainer.parent) {
                voidContainer.rotation += 0.2;
                requestAnimationFrame(animateVoid);
            }
        };
        animateVoid();
        
        setTimeout(() => {
            if (voidContainer.parent) {
                this.app.stage.removeChild(voidContainer);
                this.darkHoles.delete(voidId);
            }
        }, 12000);
    }
    
    createBlackHole(targetX, targetY, level) {
        // Massive gravitational effect with reality distortion
        const blackHoleContainer = new PIXI.Container();
        
        // Event horizon
        const eventHorizon = new PIXI.Graphics();
        eventHorizon.beginFill(0x000000);
        eventHorizon.drawCircle(0, 0, 120);
        eventHorizon.endFill();
        blackHoleContainer.addChild(eventHorizon);
        
        // Accretion disk
        for (let ring = 0; ring < 5; ring++) {
            const disk = new PIXI.Graphics();
            disk.lineStyle(8, 0x440044, 0.8 - ring * 0.15);
            disk.drawCircle(0, 0, 150 + ring * 20);
            blackHoleContainer.addChild(disk);
        }
        
        // Distortion rings
        for (let i = 0; i < 10; i++) {
            const distortion = new PIXI.Graphics();
            distortion.lineStyle(2, 0x660066, 0.5);
            distortion.drawCircle(0, 0, 120 + i * 15);
            blackHoleContainer.addChild(distortion);
        }
        
        blackHoleContainer.x = targetX;
        blackHoleContainer.y = targetY;
        blackHoleContainer.spellType = 'shadow';
        blackHoleContainer.damage = 60;
        blackHoleContainer.pullRadius = 300; // Massive pull radius
        blackHoleContainer.pullForce = 3; // Very strong pull
        blackHoleContainer.isDarkHole = true;
        
        this.app.stage.addChild(blackHoleContainer);
        this.darkHoles = this.darkHoles || new Map();
        const blackHoleId = `blackhole_${Date.now()}`;
        this.darkHoles.set(blackHoleId, blackHoleContainer);
        
        // Spawn shadow soldiers around the black hole
        this.spawnShadowSoldiers(targetX, targetY, 3);
        
        const animateBlackHole = () => {
            if (blackHoleContainer.parent) {
                blackHoleContainer.rotation += 0.3;
                requestAnimationFrame(animateBlackHole);
            }
        };
        animateBlackHole();
        
        setTimeout(() => {
            if (blackHoleContainer.parent) {
                this.app.stage.removeChild(blackHoleContainer);
                this.darkHoles.delete(blackHoleId);
            }
        }, 15000);
    }
    
    spawnShadowSoldiers(centerX, centerY, level) {
        const numSoldiers = level === 2 ? 2 : 4;
        const radius = 80;
        
        for (let i = 0; i < numSoldiers; i++) {
            const angle = (i / numSoldiers) * Math.PI * 2;
            const soldierX = centerX + Math.cos(angle) * radius;
            const soldierY = centerY + Math.sin(angle) * radius;
            
            this.createShadowSoldier(soldierX, soldierY, level);
        }
    }
    
    spawnShadowKnights(centerX, centerY, count) {
        const radius = 120;
        
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const knightX = centerX + Math.cos(angle) * radius;
            const knightY = centerY + Math.sin(angle) * radius;
            
            this.createShadowKnight(knightX, knightY);
        }
    }
    
    createShadowSoldier(x, y, level) {
        const soldierContainer = new PIXI.Container();
        
        // Tombstone first
        const tombstone = new PIXI.Graphics();
        tombstone.beginFill(0x444444);
        tombstone.lineStyle(2, 0x000000);
        tombstone.drawRoundedRect(-8, -20, 16, 25, 3);
        tombstone.endFill();
        soldierContainer.addChild(tombstone);
        
        soldierContainer.x = x;
        soldierContainer.y = y;
        this.app.stage.addChild(soldierContainer);
        
        // Animate tombstone rising and soldier emerging
        setTimeout(() => {
            // Remove tombstone
            soldierContainer.removeChild(tombstone);
            
            // Create shadow soldier
            const border = new PIXI.Graphics();
            border.lineStyle(3, 0x000000);
            border.drawCircle(0, -10, 17);
            soldierContainer.addChild(border);
            
            const body = new PIXI.Graphics();
            body.beginFill(0x111111, 0.9);
            body.drawCircle(0, -10, 15);
            body.endFill();
            soldierContainer.addChild(body);
            
            // Red glowing eyes
            const leftEye = new PIXI.Graphics();
            leftEye.beginFill(0xff0000);
            leftEye.drawCircle(-6, -15, 3);
            leftEye.endFill();
            
            const rightEye = new PIXI.Graphics();
            rightEye.beginFill(0xff0000);
            rightEye.drawCircle(6, -15, 3);
            rightEye.endFill();
            
            soldierContainer.addChild(leftEye);
            soldierContainer.addChild(rightEye);
            
            soldierContainer.spellType = 'shadowSoldier';
            soldierContainer.damage = 20 + (level * 10);
            soldierContainer.health = 30 + (level * 20);
            soldierContainer.maxHealth = soldierContainer.health;
            soldierContainer.speed = 50;
            soldierContainer.level = level;
            
            this.shadowSoldiers = this.shadowSoldiers || new Map();
            const soldierId = `soldier_${Date.now()}_${Math.random()}`;
            this.shadowSoldiers.set(soldierId, soldierContainer);
            
            // Soldier lasts for 15 seconds
            setTimeout(() => {
                if (soldierContainer.parent) {
                    this.app.stage.removeChild(soldierContainer);
                    this.shadowSoldiers.delete(soldierId);
                }
            }, 15000);
        }, 500);
    }
    
    createShadowKnight(x, y) {
        const knightContainer = new PIXI.Container();
        
        // Shadow portal first
        const portal = new PIXI.Graphics();
        portal.beginFill(0x220022);
        portal.lineStyle(3, 0x8800ff);
        portal.drawCircle(0, 0, 20);
        portal.endFill();
        knightContainer.addChild(portal);
        
        knightContainer.x = x;
        knightContainer.y = y;
        this.app.stage.addChild(knightContainer);
        
        // Animate portal opening and knight emerging
        setTimeout(() => {
            // Remove portal
            knightContainer.removeChild(portal);
            
            // Create shadow knight (larger than soldiers)
            const border = new PIXI.Graphics();
            border.lineStyle(4, 0x000000);
            border.drawCircle(0, -12, 22);
            knightContainer.addChild(border);
            
            const body = new PIXI.Graphics();
            body.beginFill(0x1a001a, 0.95);
            body.drawCircle(0, -12, 20);
            body.endFill();
            knightContainer.addChild(body);
            
            // Dark armor plates
            const armor = new PIXI.Graphics();
            armor.beginFill(0x330033);
            armor.lineStyle(2, 0x110011);
            armor.drawRect(-15, -25, 30, 20);
            armor.endFill();
            knightContainer.addChild(armor);
            
            // Purple glowing eyes
            const leftEye = new PIXI.Graphics();
            leftEye.beginFill(0xaa00ff);
            leftEye.drawCircle(-8, -18, 4);
            leftEye.endFill();
            
            const rightEye = new PIXI.Graphics();
            rightEye.beginFill(0xaa00ff);
            rightEye.drawCircle(8, -18, 4);
            rightEye.endFill();
            
            knightContainer.addChild(leftEye);
            knightContainer.addChild(rightEye);
            
            // Knight sword
            const sword = new PIXI.Graphics();
            sword.lineStyle(6, 0x444444);
            sword.moveTo(18, -15);
            sword.lineTo(35, -25);
            sword.lineStyle(3, 0x666666);
            sword.moveTo(18, -15);
            sword.lineTo(35, -25);
            knightContainer.addChild(sword);
            
            knightContainer.spellType = 'shadowKnight';
            knightContainer.damage = 45; // Higher damage than soldiers
            knightContainer.health = 80; // More health
            knightContainer.maxHealth = knightContainer.health;
            knightContainer.speed = 75; // Faster than soldiers
            knightContainer.attackSpeed = 1500; // Faster attacks
            
            this.shadowSoldiers = this.shadowSoldiers || new Map();
            const knightId = `knight_${Date.now()}_${Math.random()}`;
            this.shadowSoldiers.set(knightId, knightContainer);
            
            // Knight lasts for 20 seconds
            setTimeout(() => {
                if (knightContainer.parent) {
                    this.app.stage.removeChild(knightContainer);
                    this.shadowSoldiers.delete(knightId);
                }
            }, 20000);
        }, 600);
    }
    
    createLightningBolt(targetX, targetY, level) {
        // Simple straight lightning bolt
        const lightning = new PIXI.Graphics();
        lightning.lineStyle(6, 0x000000); // Black border
        lightning.moveTo(this.currentPlayer.x, this.currentPlayer.y);
        lightning.lineTo(targetX, targetY);
        
        lightning.lineStyle(3, 0xffff44); // Yellow lightning
        lightning.moveTo(this.currentPlayer.x, this.currentPlayer.y);
        lightning.lineTo(targetX, targetY);
        
        this.app.stage.addChild(lightning);
        this.checkLightningHit(targetX, targetY, 25);
        
        setTimeout(() => {
            if (lightning.parent) {
                this.app.stage.removeChild(lightning);
            }
        }, 200);
    }
    
    createChainLightning(targetX, targetY, level) {
        // Lightning that chains between players
        const lightning = new PIXI.Graphics();
        lightning.lineStyle(8, 0x000000); // Thicker black border
        
        // Create zigzag pattern
        const steps = 8;
        const stepX = (targetX - this.currentPlayer.x) / steps;
        const stepY = (targetY - this.currentPlayer.y) / steps;
        
        lightning.moveTo(this.currentPlayer.x, this.currentPlayer.y);
        for (let i = 1; i <= steps; i++) {
            const x = this.currentPlayer.x + stepX * i + (Math.random() - 0.5) * 40;
            const y = this.currentPlayer.y + stepY * i + (Math.random() - 0.5) * 40;
            lightning.lineTo(x, y);
        }
        
        // Yellow lightning on top
        lightning.lineStyle(4, 0xffff00);
        lightning.moveTo(this.currentPlayer.x, this.currentPlayer.y);
        for (let i = 1; i <= steps; i++) {
            const x = this.currentPlayer.x + stepX * i + (Math.random() - 0.5) * 40;
            const y = this.currentPlayer.y + stepY * i + (Math.random() - 0.5) * 40;
            lightning.lineTo(x, y);
        }
        
        this.app.stage.addChild(lightning);
        this.checkAreaDamage(targetX, targetY, 80, 35, 'lightning');
        
        setTimeout(() => {
            if (lightning.parent) {
                this.app.stage.removeChild(lightning);
            }
        }, 400);
    }
    
    createThunderStorm(targetX, targetY, level) {
        // Multiple lightning strikes in an area with realistic lightning patterns
        for (let i = 0; i < 7; i++) {
            setTimeout(() => {
                const randomX = targetX + (Math.random() - 0.5) * 200;
                const randomY = targetY + (Math.random() - 0.5) * 200;
                
                const lightning = new PIXI.Graphics();
                
                // Create jagged lightning bolt
                const segments = 8;
                const startY = randomY - 300;
                const endY = randomY;
                const stepY = (endY - startY) / segments;
                
                // Black outline
                lightning.lineStyle(8, 0x000000);
                lightning.moveTo(randomX, startY);
                let currentX = randomX;
                for (let j = 1; j <= segments; j++) {
                    const nextY = startY + stepY * j;
                    const zigzag = (Math.random() - 0.5) * 60;
                    currentX += zigzag;
                    lightning.lineTo(currentX, nextY);
                }
                
                // Bright lightning
                lightning.lineStyle(4, 0xffffff);
                lightning.moveTo(randomX, startY);
                currentX = randomX;
                for (let j = 1; j <= segments; j++) {
                    const nextY = startY + stepY * j;
                    const zigzag = (Math.random() - 0.5) * 60;
                    currentX += zigzag;
                    lightning.lineTo(currentX, nextY);
                }
                
                // Electric core
                lightning.lineStyle(2, 0x88ddff);
                lightning.moveTo(randomX, startY);
                currentX = randomX;
                for (let j = 1; j <= segments; j++) {
                    const nextY = startY + stepY * j;
                    const zigzag = (Math.random() - 0.5) * 60;
                    currentX += zigzag;
                    lightning.lineTo(currentX, nextY);
                }
                
                // Add branching lightning
                if (Math.random() > 0.5) {
                    const branchStart = segments / 2;
                    const branchY = startY + stepY * branchStart;
                    lightning.lineStyle(3, 0xaaaaff);
                    lightning.moveTo(currentX, branchY);
                    lightning.lineTo(currentX + (Math.random() - 0.5) * 100, branchY + 80);
                }
                
                this.app.stage.addChild(lightning);
                this.checkAreaDamage(randomX, randomY, 80, 45, 'lightning');
                
                // Add flash effect
                const flash = new PIXI.Graphics();
                flash.beginFill(0xffffff, 0.3);
                flash.drawCircle(randomX, randomY, 120);
                flash.endFill();
                this.app.stage.addChild(flash);
                
                setTimeout(() => {
                    if (lightning.parent) {
                        this.app.stage.removeChild(lightning);
                    }
                    if (flash.parent) {
                        this.app.stage.removeChild(flash);
                    }
                }, 400);
            }, i * 150);
        }
    }
    
    createWindBlast(targetX, targetY, level) {
        // Simple wind blast
        const blastContainer = new PIXI.Container();
        const size = 60;
        
        const border = new PIXI.Graphics();
        border.lineStyle(3, 0x000000);
        border.drawCircle(0, 0, size + 2);
        blastContainer.addChild(border);
        
        const blast = new PIXI.Graphics();
        blast.beginFill(0x44ffff, 0.4);
        blast.drawCircle(0, 0, size);
        blast.endFill();
        blastContainer.addChild(blast);
        
        // Wind lines
        for (let i = 0; i < 6; i++) {
            const line = new PIXI.Graphics();
            const angle = (i / 6) * Math.PI * 2;
            line.lineStyle(2, 0x88ffff, 0.8);
            line.moveTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
            line.lineTo(Math.cos(angle) * 50, Math.sin(angle) * 50);
            blastContainer.addChild(line);
        }
        
        blastContainer.x = targetX;
        blastContainer.y = targetY;
        this.app.stage.addChild(blastContainer);
        
        this.checkAreaDamage(targetX, targetY, 70, 30, 'wind');
        
        setTimeout(() => {
            if (blastContainer.parent) {
                this.app.stage.removeChild(blastContainer);
            }
        }, 1000);
    }
    
    createTornado(targetX, targetY, level) {
        // Spinning wind vortex with gravity pull
        const tornadoContainer = new PIXI.Container();
        
        // Create spiral effect
        for (let ring = 0; ring < 5; ring++) {
            const spiral = new PIXI.Graphics();
            spiral.lineStyle(4, 0x44ffff, 0.8 - ring * 0.15);
            
            const radius = 20 + ring * 15;
            const points = 20;
            
            for (let i = 0; i <= points; i++) {
                const angle = (i / points) * Math.PI * 4; // Multiple rotations
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                
                if (i === 0) {
                    spiral.moveTo(x, y);
                } else {
                    spiral.lineTo(x, y);
                }
            }
            
            tornadoContainer.addChild(spiral);
        }
        
        tornadoContainer.x = targetX;
        tornadoContainer.y = targetY;
        tornadoContainer.spellType = 'tornado';
        tornadoContainer.pullRadius = 150;
        tornadoContainer.pullForce = 2;
        tornadoContainer.damage = 40;
        this.app.stage.addChild(tornadoContainer);
        
        // Store tornado for pull effect
        this.tornadoes = this.tornadoes || new Map();
        const tornadoId = `tornado_${Date.now()}`;
        this.tornadoes.set(tornadoId, tornadoContainer);
        
        // Spinning animation
        const spinAnimation = () => {
            if (tornadoContainer.parent) {
                tornadoContainer.rotation += 0.3;
                requestAnimationFrame(spinAnimation);
            }
        };
        spinAnimation();
        
        this.checkAreaDamage(targetX, targetY, 90, 40, 'wind');
        
        setTimeout(() => {
            if (tornadoContainer.parent) {
                this.app.stage.removeChild(tornadoContainer);
                this.tornadoes.delete(tornadoId);
            }
        }, 3000);
    }
    
    createHurricane(targetX, targetY, level) {
        // Massive wind storm
        const hurricaneContainer = new PIXI.Container();
        
        // Multiple tornado effects
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const offsetX = Math.cos(angle) * 80;
            const offsetY = Math.sin(angle) * 80;
            
            const tornado = new PIXI.Graphics();
            tornado.lineStyle(6, 0x00ffff, 0.9);
            
            // Create larger spiral
            for (let j = 0; j < 30; j++) {
                const spiralAngle = (j / 30) * Math.PI * 6;
                const spiralRadius = j * 3;
                const x = offsetX + Math.cos(spiralAngle) * spiralRadius;
                const y = offsetY + Math.sin(spiralAngle) * spiralRadius;
                
                if (j === 0) {
                    tornado.moveTo(x, y);
                } else {
                    tornado.lineTo(x, y);
                }
            }
            
            hurricaneContainer.addChild(tornado);
        }
        
        hurricaneContainer.x = targetX;
        hurricaneContainer.y = targetY;
        this.app.stage.addChild(hurricaneContainer);
        
        // Counter-rotating animation
        const spinAnimation = () => {
            if (hurricaneContainer.parent) {
                hurricaneContainer.rotation += 0.2;
                requestAnimationFrame(spinAnimation);
            }
        };
        spinAnimation();
        
        // Multiple damage waves
        for (let wave = 0; wave < 4; wave++) {
            setTimeout(() => {
                this.checkAreaDamage(targetX, targetY, 120, 50, 'wind');
            }, wave * 300);
        }
        
        setTimeout(() => {
            if (hurricaneContainer.parent) {
                this.app.stage.removeChild(hurricaneContainer);
            }
        }, 2000);
    }
    
    createLightBeam(targetX, targetY, level) {
        // Simple piercing light ray
        const beamContainer = new PIXI.Container();
        const width = 20;
        
        const dx = targetX - this.currentPlayer.x;
        const dy = targetY - this.currentPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const border = new PIXI.Graphics();
        border.beginFill(0x000000);
        border.drawRect(0, -width/2 - 2, distance, width + 4);
        border.endFill();
        beamContainer.addChild(border);
        
        const beam = new PIXI.Graphics();
        beam.beginFill(0xffffff, 0.9);
        beam.drawRect(0, -width/2, distance, width);
        beam.endFill();
        beamContainer.addChild(beam);
        
        beamContainer.x = this.currentPlayer.x;
        beamContainer.y = this.currentPlayer.y;
        beamContainer.rotation = Math.atan2(dy, dx);
        
        this.app.stage.addChild(beamContainer);
        this.checkBeamHits(this.currentPlayer.x, this.currentPlayer.y, targetX, targetY, 50);
        
        setTimeout(() => {
            if (beamContainer.parent) {
                this.app.stage.removeChild(beamContainer);
            }
        }, 600);
    }
    
    createHolyNova(targetX, targetY, level) {
        // Radial light explosion
        const novaContainer = new PIXI.Container();
        
        // Central light burst
        const center = new PIXI.Graphics();
        center.beginFill(0xffffff, 0.9);
        center.drawCircle(0, 0, 60);
        center.endFill();
        novaContainer.addChild(center);
        
        // Radiating light beams
        for (let i = 0; i < 12; i++) {
            const beam = new PIXI.Graphics();
            beam.lineStyle(8, 0xffffaa, 0.8);
            
            const angle = (i / 12) * Math.PI * 2;
            const length = 150;
            
            beam.moveTo(0, 0);
            beam.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
            novaContainer.addChild(beam);
        }
        
        // Outer glow rings
        for (let ring = 0; ring < 4; ring++) {
            const glow = new PIXI.Graphics();
            glow.lineStyle(4, 0xffffff, 0.6 - ring * 0.15);
            glow.drawCircle(0, 0, 80 + ring * 25);
            novaContainer.addChild(glow);
        }
        
        novaContainer.x = targetX;
        novaContainer.y = targetY;
        this.app.stage.addChild(novaContainer);
        
        // Expanding animation
        novaContainer.scale.set(0.1);
        const expandAnimation = () => {
            if (novaContainer.scale.x < 1) {
                novaContainer.scale.x += 0.1;
                novaContainer.scale.y += 0.1;
                novaContainer.rotation += 0.05;
                requestAnimationFrame(expandAnimation);
            }
        };
        expandAnimation();
        
        this.checkAreaDamage(targetX, targetY, 150, 60, 'light');
        
        setTimeout(() => {
            if (novaContainer.parent) {
                this.app.stage.removeChild(novaContainer);
            }
        }, 1200);
    }
    
    createDivineWrath(targetX, targetY, level) {
        // Ultimate light attack with multiple beams from sky
        const wrathContainer = new PIXI.Container();
        
        // Create multiple divine beams from above
        for (let i = 0; i < 7; i++) {
            setTimeout(() => {
                const angle = (i / 7) * Math.PI * 2;
                const beamX = targetX + Math.cos(angle) * 100;
                const beamY = targetY + Math.sin(angle) * 100;
                
                const beam = new PIXI.Graphics();
                beam.beginFill(0xffffff, 0.95);
                beam.drawRect(-15, -200, 30, 200);
                beam.endFill();
                
                // Divine glow
                const glow = new PIXI.Graphics();
                glow.beginFill(0xffffaa, 0.6);
                glow.drawRect(-25, -200, 50, 200);
                glow.endFill();
                beam.addChild(glow);
                
                beam.x = beamX;
                beam.y = beamY;
                
                this.app.stage.addChild(beam);
                this.checkAreaDamage(beamX, beamY, 80, 70, 'light');
                
                setTimeout(() => {
                    if (beam.parent) {
                        this.app.stage.removeChild(beam);
                    }
                }, 1000);
            }, i * 150);
        }
        
        // Final massive light explosion
        setTimeout(() => {
            const finalBurst = new PIXI.Graphics();
            finalBurst.beginFill(0xffffff, 0.8);
            finalBurst.drawCircle(0, 0, 200);
            finalBurst.endFill();
            
            finalBurst.x = targetX;
            finalBurst.y = targetY;
            this.app.stage.addChild(finalBurst);
            
            this.checkAreaDamage(targetX, targetY, 200, 70, 'light');
            
            setTimeout(() => {
                if (finalBurst.parent) {
                    this.app.stage.removeChild(finalBurst);
                }
            }, 800);
        }, 1000);
    }
    
    checkTreeBlocking(fromX, fromY, toX, toY) {
        // Check if trees block line of sight
        const trees = Array.from(this.environments.values()).filter(env => env.envType === 'tree');
        
        for (const tree of trees) {
            const distance = this.pointToLineDistance(tree.x, tree.y, fromX, fromY, toX, toY);
            if (distance < tree.radius + 10) { // Tree radius plus small buffer
                return true;
            }
        }
        return false;
    }

    checkAreaDamage(centerX, centerY, radius, damage, spellType) {
        // Check player damage
        this.players.forEach((player, playerId) => {
            if (playerId !== client.socket.id) {
                const dx = player.x - centerX;
                const dy = player.y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < radius) {
                    // Check if trees block the damage (except for soul magic which bypasses blocking)
                    if (spellType === 'soul' || !this.checkTreeBlocking(centerX, centerY, player.x, player.y)) {
                        this.showDamageNumber(damage, player.x, player.y);
                        client.socket.emit('playerHit', {
                            targetId: playerId,
                            damage: damage,
                            spellType: spellType
                        });
                    }
                }
            }
        });
        
        // Animal damage checking removed

        // Check void creature damage in dungeon
        if (this.voidCreatures) {
            this.voidCreatures.forEach((creature, creatureId) => {
                const dx = creature.x - centerX;
                const dy = creature.y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < radius) {
                    creature.health -= damage;
                    this.showDamageNumber(damage, creature.x, creature.y, '#ff8800');
                    
                    // Create damage effect on creature
                    creature.alpha = 0.5;
                    setTimeout(() => { 
                        if (creature.parent) creature.alpha = 1; 
                    }, 200);
                    
                    if (creature.health <= 0) {
                        // Creature defeated
                        this.app.stage.removeChild(creature);
                        this.voidCreatures.delete(creatureId);
                        
                        // Update dungeon progress
                        if (ui && ui.isDungeonMode) {
                            ui.updateDungeonProgress();
                        }
                        
                        // Experience for defeating void creature
                        client.socket.emit('gainExperience', 50);
                        ui.addEnemyDefeat();
                    }
                }
            });
        }
        
        // Check dormant demon statue damage and awakening
        if (this.demonStatues) {
            this.demonStatues.forEach((statue, statueId) => {
                const dx = statue.x - centerX;
                const dy = statue.y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < radius) {
                    // Soul magic bypasses tree blocking for demon statues
                    if (spellType === 'soul' || !this.checkTreeBlocking(centerX, centerY, statue.x, statue.y)) {
                        // Damage the dormant statue
                        if (!statue.health) {
                            statue.health = 80; // Initialize health if not set
                            statue.maxHealth = 80;
                        }
                        
                        statue.health -= damage;
                        this.showDamageNumber(damage, statue.x, statue.y, '#666666');
                        
                        // Create damage effect on statue
                        statue.alpha = 0.5;
                        setTimeout(() => { 
                            if (statue.parent) statue.alpha = 1; 
                        }, 200);
                        
                        if (statue.health <= 0) {
                            // Dormant statue destroyed
                            this.createDemonDeathEffect(statue.x, statue.y);
                            this.app.stage.removeChild(statue);
                            this.demonStatues.delete(statueId);
                            
                            // Increment statues killed counter
                            this.statuesKilled++;
                            
                            // Soul magic leveling - ONLY through statue kills
                            if (this.currentPlayer && this.currentPlayer.playerData) {
                                if (this.currentPlayer.playerData.magicLevels.soul === 0 && this.statuesKilled >= 5) {
                                    // Unlock soul magic at level 1
                                    client.socket.emit('unlockSoulMagic');
                                    this.showSoulMagicUnlockEffect(statue.x, statue.y);
                                } else if (this.currentPlayer.playerData.magicLevels.soul > 0) {
                                    // Level up soul magic through statue kills
                                    const newLevel = Math.min(10, this.currentPlayer.playerData.magicLevels.soul + 1);
                                    client.socket.emit('levelUpSoulMagic', newLevel);
                                    this.showSoulLevelUpEffect(statue.x, statue.y, newLevel);
                                }
                            }
                            
                            // Experience for defeating statue
                            client.socket.emit('gainExperience', 75);
                            ui.addEnemyDefeat();
                        } else if (!statue.isAwake) {
                            // Wake up the statue when hit by magic (only if still alive)
                            this.awakenDemonStatue(statue, statueId);
                        }
                    }
                }
            });
        }

        // Check active demon statue damage
        if (this.activeDemonStatues) {
            this.activeDemonStatues.forEach((demon, demonId) => {
                const dx = demon.x - centerX;
                const dy = demon.y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < radius) {
                    // Soul magic bypasses tree blocking for demon statues
                    if (spellType === 'soul' || !this.checkTreeBlocking(centerX, centerY, demon.x, demon.y)) {
                        demon.health -= damage;
                        this.showDamageNumber(damage, demon.x, demon.y, '#ff0000');
                        
                        // Create damage effect on demon
                        demon.alpha = 0.5;
                        setTimeout(() => { 
                            if (demon.parent) demon.alpha = 1; 
                        }, 200);
                        
                        if (demon.health <= 0) {
                            // Demon defeated
                            this.createDemonDeathEffect(demon.x, demon.y);
                            this.app.stage.removeChild(demon);
                            this.activeDemonStatues.delete(demonId);
                            
                            // Increment statues killed counter
                            this.statuesKilled++;
                            
                            // Soul magic leveling - ONLY through statue kills
                            if (this.currentPlayer && this.currentPlayer.playerData) {
                                if (this.currentPlayer.playerData.magicLevels.soul === 0 && this.statuesKilled >= 5) {
                                    // Unlock soul magic at level 1
                                    client.socket.emit('unlockSoulMagic');
                                    this.showSoulMagicUnlockEffect(demon.x, demon.y);
                                } else if (this.currentPlayer.playerData.magicLevels.soul > 0) {
                                    // Level up soul magic through statue kills
                                    const newLevel = Math.min(10, this.currentPlayer.playerData.magicLevels.soul + 1);
                                    client.socket.emit('levelUpSoulMagic', newLevel);
                                    this.showSoulLevelUpEffect(demon.x, demon.y, newLevel);
                                }
                            }
                            
                            // Experience for defeating demon
                            client.socket.emit('gainExperience', 75);
                            ui.addEnemyDefeat();
                        }
                    }
                }
            });
        }
    }
    
    checkEnvironmentDamage(centerX, centerY, radius, damage) {
        this.environments.forEach((env, envId) => {
            const dx = env.x - centerX;
            const dy = env.y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < radius) {
                env.health -= damage;
                this.showDamageNumber(damage, env.x, env.y, '#ffaa00');
                
                if (env.health <= 0) {
                    this.moveEnvironmentObject(env, envId);
                } else {
                    env.alpha = 0.5;
                    setTimeout(() => { env.alpha = 1; }, 200);
                }
            }
        });
    }
    
    checkBeamHits(startX, startY, endX, endY, damage) {
        this.players.forEach((player, playerId) => {
            if (playerId !== client.socket.id) {
                // Check if player intersects with beam line
                const dist = this.pointToLineDistance(player.x, player.y, startX, startY, endX, endY);
                if (dist < 30) {
                    this.showDamageNumber(damage, player.x, player.y, '#ffffff');
                    client.socket.emit('playerHit', {
                        targetId: playerId,
                        damage: damage,
                        spellType: 'light'
                    });
                }
            }
        });
        
        // Check dormant demon statue damage
        if (this.demonStatues) {
            this.demonStatues.forEach((statue, statueId) => {
                const dist = this.pointToLineDistance(statue.x, statue.y, startX, startY, endX, endY);
                if (dist < 30) {
                    // Damage the dormant statue
                    if (!statue.health) {
                        statue.health = 80;
                        statue.maxHealth = 80;
                    }
                    
                    statue.health -= damage;
                    this.showDamageNumber(damage, statue.x, statue.y, '#666666');
                    
                    // Create damage effect
                    statue.alpha = 0.5;
                    setTimeout(() => { 
                        if (statue.parent) statue.alpha = 1; 
                    }, 200);
                    
                    if (statue.health <= 0) {
                        // Dormant statue destroyed
                        this.createDemonDeathEffect(statue.x, statue.y);
                        this.app.stage.removeChild(statue);
                        this.demonStatues.delete(statueId);
                        
                        this.statuesKilled++;
                        
                        if (this.statuesKilled >= 5 && this.currentPlayer && this.currentPlayer.playerData) {
                            if (this.currentPlayer.playerData.magicLevels.soul === 0) {
                                client.socket.emit('unlockSoulMagic');
                                this.showSoulMagicUnlockEffect(statue.x, statue.y);
                            }
                        }
                        
                        client.socket.emit('gainExperience', 75);
                        ui.addEnemyDefeat();
                    } else if (!statue.isAwake) {
                        // Wake up the statue when hit by light beam
                        this.awakenDemonStatue(statue, statueId);
                    }
                }
            });
        }
        
        // Check active demon statue damage
        if (this.activeDemonStatues) {
            this.activeDemonStatues.forEach((demon, demonId) => {
                const dist = this.pointToLineDistance(demon.x, demon.y, startX, startY, endX, endY);
                if (dist < 30) {
                    demon.health -= damage;
                    this.showDamageNumber(damage, demon.x, demon.y, '#ff0000');
                    
                    demon.alpha = 0.5;
                    setTimeout(() => { 
                        if (demon.parent) demon.alpha = 1; 
                    }, 200);
                    
                    if (demon.health <= 0) {
                        this.createDemonDeathEffect(demon.x, demon.y);
                        this.app.stage.removeChild(demon);
                        this.activeDemonStatues.delete(demonId);
                        
                        this.statuesKilled++;
                        
                        if (this.statuesKilled >= 5 && this.currentPlayer && this.currentPlayer.playerData) {
                            if (this.currentPlayer.playerData.magicLevels.soul === 0) {
                                client.socket.emit('unlockSoulMagic');
                                this.showSoulMagicUnlockEffect(demon.x, demon.y);
                            }
                        }
                        
                        client.socket.emit('gainExperience', 75);
                        ui.addEnemyDefeat();
                    }
                }
            });
        }
    }
    
    checkLightningHit(targetX, targetY, damage) {
        this.players.forEach((player, playerId) => {
            if (playerId !== client.socket.id) {
                const dx = player.x - targetX;
                const dy = player.y - targetY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 50) {
                    this.showDamageNumber(damage, player.x, player.y, '#ffff44');
                    client.socket.emit('playerHit', {
                        targetId: playerId,
                        damage: damage,
                        spellType: 'lightning'
                    });
                }
            }
        });
        
        // Check dormant demon statue damage
        if (this.demonStatues) {
            this.demonStatues.forEach((statue, statueId) => {
                const dx = statue.x - targetX;
                const dy = statue.y - targetY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 50) {
                    // Damage the dormant statue
                    if (!statue.health) {
                        statue.health = 80;
                        statue.maxHealth = 80;
                    }
                    
                    statue.health -= damage;
                    this.showDamageNumber(damage, statue.x, statue.y, '#666666');
                    
                    // Create damage effect
                    statue.alpha = 0.5;
                    setTimeout(() => { 
                        if (statue.parent) statue.alpha = 1; 
                    }, 200);
                    
                    if (statue.health <= 0) {
                        // Dormant statue destroyed
                        this.createDemonDeathEffect(statue.x, statue.y);
                        this.app.stage.removeChild(statue);
                        this.demonStatues.delete(statueId);
                        
                        this.statuesKilled++;
                        
                        if (this.statuesKilled >= 5 && this.currentPlayer && this.currentPlayer.playerData) {
                            if (this.currentPlayer.playerData.magicLevels.soul === 0) {
                                client.socket.emit('unlockSoulMagic');
                                this.showSoulMagicUnlockEffect(statue.x, statue.y);
                            }
                        }
                        
                        client.socket.emit('gainExperience', 75);
                        ui.addEnemyDefeat();
                    } else if (!statue.isAwake) {
                        // Wake up the statue when hit by lightning
                        this.awakenDemonStatue(statue, statueId);
                    }
                }
            });
        }
        
        // Check active demon statue damage
        if (this.activeDemonStatues) {
            this.activeDemonStatues.forEach((demon, demonId) => {
                const dx = demon.x - targetX;
                const dy = demon.y - targetY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 50) {
                    demon.health -= damage;
                    this.showDamageNumber(damage, demon.x, demon.y, '#ff0000');
                    
                    demon.alpha = 0.5;
                    setTimeout(() => { 
                        if (demon.parent) demon.alpha = 1; 
                    }, 200);
                    
                    if (demon.health <= 0) {
                        this.createDemonDeathEffect(demon.x, demon.y);
                        this.app.stage.removeChild(demon);
                        this.activeDemonStatues.delete(demonId);
                        
                        this.statuesKilled++;
                        
                        if (this.statuesKilled >= 5 && this.currentPlayer && this.currentPlayer.playerData) {
                            if (this.currentPlayer.playerData.magicLevels.soul === 0) {
                                client.socket.emit('unlockSoulMagic');
                                this.showSoulMagicUnlockEffect(demon.x, demon.y);
                            }
                        }
                        
                        client.socket.emit('gainExperience', 75);
                        ui.addEnemyDefeat();
                    }
                }
            });
        }
    }
    
    awakenDemonStatue(statue, statueId) {
        // Mark statue as awake
        statue.isAwake = true;
        
        // Store position and remove old statue
        const statueX = statue.x;
        const statueY = statue.y;
        
        // Create awakening effect
        const awakeningEffect = new PIXI.Graphics();
        awakeningEffect.beginFill(0xff0000, 0.8);
        awakeningEffect.drawCircle(0, 0, 50);
        awakeningEffect.endFill();
        awakeningEffect.x = statueX;
        awakeningEffect.y = statueY;
        this.app.stage.addChild(awakeningEffect);
        
        // Remove dormant statue first
        this.app.stage.removeChild(statue);
        this.demonStatues.delete(statueId);
        
        // Create active demon at the same position
        this.createActiveDemon(statueX, statueY, statueId);
        
        // Fade out awakening effect
        setTimeout(() => {
            if (awakeningEffect.parent) {
                this.app.stage.removeChild(awakeningEffect);
            }
        }, 500);
    }

    createActiveDemon(x, y, originalStatueId) {
        const demonContainer = new PIXI.Container();
        
        // Create active demon appearance (red glowing version)
        const border = new PIXI.Graphics();
        border.lineStyle(4, 0xff0000); // Red outline
        border.drawCircle(0, -10, 22);
        demonContainer.addChild(border);
        
        const body = new PIXI.Graphics();
        body.beginFill(0x330000); // Dark red body
        body.drawCircle(0, -10, 20);
        body.endFill();
        demonContainer.addChild(body);
        
        // Glowing red eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0xff0000);
        leftEye.drawCircle(-8, -15, 4);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0xff0000);
        rightEye.drawCircle(8, -15, 4);
        rightEye.endFill();
        
        demonContainer.addChild(leftEye);
        demonContainer.addChild(rightEye);
        
        // Wings (spread and animated)
        const leftWing = new PIXI.Graphics();
        leftWing.lineStyle(3, 0x000000);
        leftWing.beginFill(0x660000);
        leftWing.drawPolygon([-12, -5, -35, -20, -30, 10, -15, 8]);
        leftWing.endFill();
        
        const rightWing = new PIXI.Graphics();
        rightWing.lineStyle(3, 0x000000);
        rightWing.beginFill(0x660000);
        rightWing.drawPolygon([12, -5, 35, -20, 30, 10, 15, 8]);
        rightWing.endFill();
        
        demonContainer.addChild(leftWing);
        demonContainer.addChild(rightWing);
        
        // Shadow
        const shadow = new PIXI.Graphics();
        shadow.lineStyle(1, 0x000000);
        shadow.beginFill(0x000000, 0.3);
        shadow.drawEllipse(0, 25, 20, 8);
        shadow.endFill();
        demonContainer.addChild(shadow);
        
        demonContainer.x = x;
        demonContainer.y = y;
        demonContainer.health = 80;
        demonContainer.maxHealth = 80;
        demonContainer.damage = 25;
        demonContainer.speed = 80; // Faster when active
        demonContainer.lastAttackTime = 0;
        demonContainer.attackCooldown = 2000; // Faster attacks
        demonContainer.activationRadius = 100;
        demonContainer.attackRadius = 150;
        demonContainer.envType = 'activeDemon';
        demonContainer.isAwake = true;
        
        // Wing animation
        demonContainer.wingAnimation = 0;
        const animateWings = () => {
            if (demonContainer.parent && demonContainer.isAwake) {
                demonContainer.wingAnimation += 0.15;
                leftWing.rotation = Math.sin(demonContainer.wingAnimation) * 0.3;
                rightWing.rotation = -Math.sin(demonContainer.wingAnimation) * 0.3;
                requestAnimationFrame(animateWings);
            }
        };
        animateWings();
        
        this.app.stage.addChild(demonContainer);
        this.activeDemonStatues.set(`active_${originalStatueId}`, demonContainer);
    }

    createDemonDeathEffect(x, y) {
        // Create dramatic death effect for demons
        const deathContainer = new PIXI.Container();
        deathContainer.x = x;
        deathContainer.y = y;
        
        // Soul escaping effect
        const soul = new PIXI.Graphics();
        soul.beginFill(0x8B0000, 0.8);
        soul.drawCircle(0, 0, 15);
        soul.endFill();
        soul.y = -20;
        deathContainer.addChild(soul);
        
        // Animate soul floating upward
        const soulAnimation = () => {
            soul.y -= 3;
            soul.alpha *= 0.98;
            if (soul.alpha > 0.1 && soul.parent) {
                requestAnimationFrame(soulAnimation);
            }
        };
        soulAnimation();
        
        // Fire explosion
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const particle = new PIXI.Graphics();
                const colors = [0xFF0000, 0xFF4400, 0xFF8800, 0xFFAA00];
                particle.beginFill(colors[Math.floor(Math.random() * colors.length)]);
                particle.drawCircle(0, 0, 3 + Math.random() * 4);
                particle.endFill();
                
                const angle = (i / 20) * Math.PI * 2 + Math.random() * 0.5;
                const speed = 2 + Math.random() * 4;
                particle.x = Math.cos(angle) * 10;
                particle.y = Math.sin(angle) * 10;
                deathContainer.addChild(particle);
                
                // Animate particles
                const velX = Math.cos(angle) * speed;
                const velY = Math.sin(angle) * speed - 1;
                const animateParticle = () => {
                    particle.x += velX;
                    particle.y += velY;
                    particle.alpha *= 0.96;
                    
                    if (particle.alpha > 0.1 && particle.parent) {
                        requestAnimationFrame(animateParticle);
                    } else if (particle.parent) {
                        deathContainer.removeChild(particle);
                    }
                };
                animateParticle();
            }, i * 30);
        }
        
        this.app.stage.addChild(deathContainer);
        
        setTimeout(() => {
            if (deathContainer.parent) {
                this.app.stage.removeChild(deathContainer);
            }
        }, 3000);
    }
    
    // Soul Magic Spells
    createSoulDrain(targetX, targetY, level) {
        // Dark vortex that pulls soul particles in spiraling motions
        const soulDrainContainer = new PIXI.Container();
        soulDrainContainer.x = targetX;
        soulDrainContainer.y = targetY;
        
        // Dark vortex center
        const vortexCore = new PIXI.Graphics();
        vortexCore.beginFill(0x4A0E4E, 0.9);
        vortexCore.drawCircle(0, 0, 25);
        vortexCore.endFill();
        
        // Inner dark hole
        const darkCenter = new PIXI.Graphics();
        darkCenter.beginFill(0x1A0A1A);
        darkCenter.drawCircle(0, 0, 12);
        darkCenter.endFill();
        
        soulDrainContainer.addChild(vortexCore);
        soulDrainContainer.addChild(darkCenter);
        
        // Create spiraling soul particles
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const soulParticle = new PIXI.Graphics();
                soulParticle.beginFill(0x8A2BE2, 0.8);
                soulParticle.drawCircle(0, 0, 3 + Math.random() * 2);
                soulParticle.endFill();
                
                // Start particles at random positions around the vortex
                const startAngle = Math.random() * Math.PI * 2;
                const startRadius = 60 + Math.random() * 40;
                soulParticle.x = Math.cos(startAngle) * startRadius;
                soulParticle.y = Math.sin(startAngle) * startRadius;
                soulDrainContainer.addChild(soulParticle);
                
                // Animate spiraling toward center
                let currentRadius = startRadius;
                let currentAngle = startAngle;
                const spiralAnimation = () => {
                    if (currentRadius > 5) {
                        currentRadius *= 0.96;
                        currentAngle += 0.15;
                        soulParticle.x = Math.cos(currentAngle) * currentRadius;
                        soulParticle.y = Math.sin(currentAngle) * currentRadius;
                        soulParticle.alpha = Math.max(0.3, currentRadius / startRadius);
                        requestAnimationFrame(spiralAnimation);
                    } else {
                        soulDrainContainer.removeChild(soulParticle);
                    }
                };
                spiralAnimation();
            }, i * 100);
        }
        
        this.app.stage.addChild(soulDrainContainer);
        
        // Pulsing vortex animation
        let pulseScale = 1;
        let pulseDirection = 1;
        const pulseAnimation = () => {
            if (soulDrainContainer.parent) {
                pulseScale += pulseDirection * 0.02;
                if (pulseScale > 1.3 || pulseScale < 0.8) {
                    pulseDirection *= -1;
                }
                vortexCore.scale.set(pulseScale);
                soulDrainContainer.rotation += 0.05;
                requestAnimationFrame(pulseAnimation);
            }
        };
        pulseAnimation();
        
        this.checkAreaDamage(targetX, targetY, 80, 45, 'soul');
        
        setTimeout(() => {
            if (soulDrainContainer.parent) {
                this.app.stage.removeChild(soulDrainContainer);
            }
        }, 4000);
    }
    
    createSpiritArmy(targetX, targetY, level) {
        // Summons multiple spirit warriors that emerge from ghostly portals
        const numSpirits = 3 + level;
        const radius = 100;
        
        for (let i = 0; i < numSpirits; i++) {
            setTimeout(() => {
                const angle = (i / numSpirits) * Math.PI * 2;
                const spiritX = targetX + Math.cos(angle) * radius;
                const spiritY = targetY + Math.sin(angle) * radius;
                
                // Create ghostly portal first
                const portal = new PIXI.Graphics();
                portal.beginFill(0x4A0E4E, 0.7);
                portal.lineStyle(3, 0x8A2BE2);
                portal.drawCircle(0, 0, 20);
                portal.endFill();
                portal.x = spiritX;
                portal.y = spiritY;
                this.app.stage.addChild(portal);
                
                // Portal opening animation
                portal.scale.set(0);
                const openPortal = () => {
                    if (portal.scale.x < 1) {
                        portal.scale.x += 0.1;
                        portal.scale.y += 0.1;
                        portal.rotation += 0.2;
                        requestAnimationFrame(openPortal);
                    }
                };
                openPortal();
                
                // Create spirit warrior after portal opens
                setTimeout(() => {
                    const spiritContainer = new PIXI.Container();
                    
                    // Spirit body (translucent)
                    const spiritBody = new PIXI.Graphics();
                    spiritBody.beginFill(0x8A2BE2, 0.6);
                    spiritBody.lineStyle(2, 0x4A0E4E);
                    spiritBody.drawCircle(0, -10, 15);
                    spiritBody.endFill();
                    
                    // Glowing red eyes
                    const leftEye = new PIXI.Graphics();
                    leftEye.beginFill(0xFF0000);
                    leftEye.drawCircle(-6, -15, 3);
                    leftEye.endFill();
                    
                    const rightEye = new PIXI.Graphics();
                    rightEye.beginFill(0xFF0000);
                    rightEye.drawCircle(6, -15, 3);
                    rightEye.endFill();
                    
                    // Soul weapon (ethereal sword)
                    const soulWeapon = new PIXI.Graphics();
                    soulWeapon.lineStyle(4, 0x8A2BE2, 0.8);
                    soulWeapon.moveTo(18, -15);
                    soulWeapon.lineTo(35, -25);
                    soulWeapon.lineStyle(2, 0xFFFFFF, 0.6);
                    soulWeapon.moveTo(18, -15);
                    soulWeapon.lineTo(35, -25);
                    
                    spiritContainer.addChild(spiritBody);
                    spiritContainer.addChild(leftEye);
                    spiritContainer.addChild(rightEye);
                    spiritContainer.addChild(soulWeapon);
                    
                    spiritContainer.x = spiritX;
                    spiritContainer.y = spiritY;
                    spiritContainer.alpha = 0;
                    this.app.stage.addChild(spiritContainer);
                    
                    // Spirit emerging animation
                    const emergeAnimation = () => {
                        if (spiritContainer.alpha < 0.8) {
                            spiritContainer.alpha += 0.05;
                            spiritContainer.y -= 1;
                            requestAnimationFrame(emergeAnimation);
                        }
                    };
                    emergeAnimation();
                    
                    // Floating animation
                    let floatOffset = Math.random() * Math.PI * 2;
                    const floatAnimation = () => {
                        if (spiritContainer.parent) {
                            floatOffset += 0.05;
                            spiritContainer.y += Math.sin(floatOffset) * 0.5;
                            spiritContainer.rotation = Math.sin(floatOffset * 0.5) * 0.1;
                            requestAnimationFrame(floatAnimation);
                        }
                    };
                    floatAnimation();
                    
                    // Store spirit for cleanup
                    this.spiritArmy = this.spiritArmy || new Map();
                    const spiritId = `spirit_${Date.now()}_${i}`;
                    this.spiritArmy.set(spiritId, spiritContainer);
                    
                    // Remove spirit after duration
                    setTimeout(() => {
                        if (spiritContainer.parent) {
                            this.app.stage.removeChild(spiritContainer);
                            this.spiritArmy.delete(spiritId);
                        }
                    }, 15000);
                    
                    // Remove portal
                    if (portal.parent) {
                        this.app.stage.removeChild(portal);
                    }
                }, 800);
            }, i * 300);
        }
        
        this.checkAreaDamage(targetX, targetY, 120, 35, 'soul');
    }
    
    createSoulStorm(targetX, targetY, level) {
        // Massive storm with swirling soul energy and tormented souls
        const stormContainer = new PIXI.Container();
        stormContainer.x = targetX;
        stormContainer.y = targetY;
        
        // Storm center
        const stormCenter = new PIXI.Graphics();
        stormCenter.beginFill(0x4A0E4E, 0.8);
        stormCenter.drawCircle(0, 0, 60);
        stormCenter.endFill();
        
        // Multiple energy rings
        for (let ring = 0; ring < 5; ring++) {
            const energyRing = new PIXI.Graphics();
            energyRing.lineStyle(8, 0x8A2BE2, 0.7 - ring * 0.1);
            energyRing.drawCircle(0, 0, 70 + ring * 25);
            stormContainer.addChild(energyRing);
        }
        
        stormContainer.addChild(stormCenter);
        this.app.stage.addChild(stormContainer);
        
        // Create tormented souls flying outward chaotically
        for (let i = 0; i < 15; i++) {
            setTimeout(() => {
                const tormentedSoul = new PIXI.Graphics();
                tormentedSoul.beginFill(0x8A2BE2, 0.8);
                tormentedSoul.lineStyle(2, 0x4A0E4E);
                
                // Ghostly wispy shape
                tormentedSoul.drawPolygon([
                    0, -10,    // top
                    -8, -5,    // left
                    -10, 5,    // bottom left
                    -3, 12,    // bottom
                    3, 12,     // bottom
                    10, 5,     // bottom right
                    8, -5      // right
                ]);
                tormentedSoul.endFill();
                
                // Glowing eyes
                const soulEye1 = new PIXI.Graphics();
                soulEye1.beginFill(0xFF0000);
                soulEye1.drawCircle(-3, -7, 2);
                soulEye1.endFill();
                
                const soulEye2 = new PIXI.Graphics();
                soulEye2.beginFill(0xFF0000);
                soulEye2.drawCircle(3, -7, 2);
                soulEye2.endFill();
                
                tormentedSoul.addChild(soulEye1);
                tormentedSoul.addChild(soulEye2);
                
                tormentedSoul.x = targetX + (Math.random() - 0.5) * 40;
                tormentedSoul.y = targetY + (Math.random() - 0.5) * 40;
                this.app.stage.addChild(tormentedSoul);
                
                // Chaotic movement
                const chaosVelX = (Math.random() - 0.5) * 8;
                const chaosVelY = (Math.random() - 0.5) * 8;
                let chaosTime = 0;
                
                const chaosAnimation = () => {
                    if (tormentedSoul.parent && chaosTime < 200) {
                        chaosTime++;
                        tormentedSoul.x += chaosVelX + Math.sin(chaosTime * 0.1) * 2;
                        tormentedSoul.y += chaosVelY + Math.cos(chaosTime * 0.1) * 2;
                        tormentedSoul.rotation += 0.1;
                        tormentedSoul.alpha = Math.max(0, 1 - chaosTime / 200);
                        requestAnimationFrame(chaosAnimation);
                    } else if (tormentedSoul.parent) {
                        this.app.stage.removeChild(tormentedSoul);
                    }
                };
                chaosAnimation();
            }, i * 100);
        }
        
        // Storm rotation animation
        const stormAnimation = () => {
            if (stormContainer.parent) {
                stormContainer.rotation += 0.1;
                stormContainer.children.forEach((child, index) => {
                    if (child !== stormCenter) {
                        child.rotation -= 0.05 * (index + 1);
                    }
                });
                requestAnimationFrame(stormAnimation);
            }
        };
        stormAnimation();
        
        // Multiple damage waves
        for (let wave = 0; wave < 3; wave++) {
            setTimeout(() => {
                this.checkAreaDamage(targetX, targetY, 100 + wave * 20, 55, 'soul');
            }, wave * 800);
        }
        
        setTimeout(() => {
            if (stormContainer.parent) {
                this.app.stage.removeChild(stormContainer);
            }
        }, 5000);
    }
    
    createDeathIncarnate(targetX, targetY, level) {
        // Ultimate soul spell - manifests Death itself
        const deathContainer = new PIXI.Container();
        deathContainer.x = targetX;
        deathContainer.y = targetY;
        
        // Massive dark presence
        const deathPresence = new PIXI.Graphics();
        deathPresence.beginFill(0x1A0A1A, 0.95);
        deathPresence.lineStyle(5, 0x4A0E4E);
        deathPresence.drawCircle(0, 0, 80);
        deathPresence.endFill();
        
        // Death's "body" - larger and more imposing
        const deathBody = new PIXI.Graphics();
        deathBody.beginFill(0x2A0A2A, 0.9);
        deathBody.lineStyle(4, 0x000000);
        deathBody.drawCircle(0, -20, 40);
        deathBody.endFill();
        
        // Massive glowing red eyes
        const deathEye1 = new PIXI.Graphics();
        deathEye1.beginFill(0xFF0000);
        deathEye1.drawCircle(-15, -30, 8);
        deathEye1.endFill();
        
        const deathEye2 = new PIXI.Graphics();
        deathEye2.beginFill(0xFF0000);
        deathEye2.drawCircle(15, -30, 8);
        deathEye2.endFill();
        
        // Eye glow effects
        const eyeGlow1 = new PIXI.Graphics();
        eyeGlow1.beginFill(0xFF0000, 0.3);
        eyeGlow1.drawCircle(-15, -30, 15);
        eyeGlow1.endFill();
        
        const eyeGlow2 = new PIXI.Graphics();
        eyeGlow2.beginFill(0xFF0000, 0.3);
        eyeGlow2.drawCircle(15, -30, 15);
        eyeGlow2.endFill();
        
        deathContainer.addChild(deathPresence);
        deathContainer.addChild(eyeGlow1);
        deathContainer.addChild(eyeGlow2);
        deathContainer.addChild(deathBody);
        deathContainer.addChild(deathEye1);
        deathContainer.addChild(deathEye2);
        
        this.app.stage.addChild(deathContainer);
        
        // Death manifestation animation
        deathContainer.scale.set(0);
        const manifestAnimation = () => {
            if (deathContainer.scale.x < 1.5) {
                deathContainer.scale.x += 0.05;
                deathContainer.scale.y += 0.05;
                deathContainer.rotation += 0.02;
                requestAnimationFrame(manifestAnimation);
            }
        };
        manifestAnimation();
        
        // Pulsing eye glow
        let glowIntensity = 1;
        let glowDirection = 1;
        const glowAnimation = () => {
            if (deathContainer.parent) {
                glowIntensity += glowDirection * 0.05;
                if (glowIntensity > 2 || glowIntensity < 0.5) {
                    glowDirection *= -1;
                }
                eyeGlow1.alpha = glowIntensity * 0.3;
                eyeGlow2.alpha = glowIntensity * 0.3;
                deathEye1.scale.set(glowIntensity);
                deathEye2.scale.set(glowIntensity);
                requestAnimationFrame(glowAnimation);
            }
        };
        glowAnimation();
        
        // Spawn spirit armies around Death
        for (let army = 0; army < 2; army++) {
            setTimeout(() => {
                const armyAngle = (army / 2) * Math.PI * 2;
                const armyX = targetX + Math.cos(armyAngle) * 150;
                const armyY = targetY + Math.sin(armyAngle) * 150;
                this.createSpiritArmy(armyX, armyY, level);
            }, army * 1000);
        }
        
        // Multiple expanding damage waves representing Death's power
        for (let wave = 0; wave < 4; wave++) {
            setTimeout(() => {
                this.checkAreaDamage(targetX, targetY, 120 + wave * 40, 80, 'soul');
                
                // Visual death wave
                const deathWave = new PIXI.Graphics();
                deathWave.lineStyle(8, 0x4A0E4E, 0.8);
                deathWave.drawCircle(targetX, targetY, 120 + wave * 40);
                this.app.stage.addChild(deathWave);
                
                setTimeout(() => {
                    if (deathWave.parent) {
                        this.app.stage.removeChild(deathWave);
                    }
                }, 1000);
            }, wave * 500);
        }
        
        setTimeout(() => {
            if (deathContainer.parent) {
                this.app.stage.removeChild(deathContainer);
            }
        }, 8000);
    }
    
    // Transformation Skill Visual Effects
    
    createDivinePresence(targetX, targetY, level) {
        const presenceContainer = new PIXI.Container();
        presenceContainer.x = targetX;
        presenceContainer.y = targetY;
        
        // Divine light pillar
        const pillar = new PIXI.Graphics();
        pillar.beginFill(0xffffff, 0.8);
        pillar.drawRect(-50, -500, 100, 500);
        pillar.endFill();
        presenceContainer.addChild(pillar);
        
        // Golden rings
        for (let i = 0; i < 5; i++) {
            const ring = new PIXI.Graphics();
            ring.lineStyle(8, 0xffd700, 0.8);
            ring.drawCircle(0, 0, 80 + i * 40);
            presenceContainer.addChild(ring);
            
            // Rotating rings
            const rotateRing = () => {
                if (ring.parent) {
                    ring.rotation += 0.05 * (i % 2 === 0 ? 1 : -1);
                    requestAnimationFrame(rotateRing);
                }
            };
            rotateRing();
        }
        
        this.app.stage.addChild(presenceContainer);
        
        setTimeout(() => {
            if (presenceContainer.parent) {
                this.app.stage.removeChild(presenceContainer);
            }
        }, 5000);
    }
    
    createRainbowDivineBlast(targetX, targetY, level) {
        const blastContainer = new PIXI.Container();
        blastContainer.x = targetX;
        blastContainer.y = targetY;
        
        // Rainbow colors
        const colors = [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x0088ff, 0x0000ff, 0x8800ff];
        
        // Create expanding rainbow rings
        for (let i = 0; i < colors.length; i++) {
            setTimeout(() => {
                const ring = new PIXI.Graphics();
                ring.beginFill(colors[i], 0.6);
                ring.drawCircle(0, 0, 50);
                ring.endFill();
                blastContainer.addChild(ring);
                
                // Expanding animation
                const expandRing = () => {
                    if (ring.scale.x < 10) {
                        ring.scale.x += 0.3;
                        ring.scale.y += 0.3;
                        ring.alpha *= 0.95;
                        requestAnimationFrame(expandRing);
                    } else if (ring.parent) {
                        blastContainer.removeChild(ring);
                    }
                };
                expandRing();
            }, i * 100);
        }
        
        this.app.stage.addChild(blastContainer);
        this.checkAreaDamage(targetX, targetY, 500, 999, 'divine');
        
        setTimeout(() => {
            if (blastContainer.parent) {
                this.app.stage.removeChild(blastContainer);
            }
        }, 3000);
    }
    
    createHeavenlyHealingWave(targetX, targetY, level) {
        const healContainer = new PIXI.Container();
        healContainer.x = targetX;
        healContainer.y = targetY;
        
        // Healing wave
        const wave = new PIXI.Graphics();
        wave.beginFill(0x00ff88, 0.5);
        wave.drawCircle(0, 0, 50);
        wave.endFill();
        healContainer.addChild(wave);
        
        // Expanding healing wave
        const expandWave = () => {
            if (wave.scale.x < 20) {
                wave.scale.x += 0.2;
                wave.scale.y += 0.2;
                wave.alpha *= 0.98;
                requestAnimationFrame(expandWave);
            }
        };
        expandWave();
        
        // Healing particles
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                const particle = new PIXI.Graphics();
                particle.beginFill(0x00ff88, 0.8);
                particle.drawCircle(0, 0, 5);
                particle.endFill();
                
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * 400;
                particle.x = Math.cos(angle) * distance;
                particle.y = Math.sin(angle) * distance;
                healContainer.addChild(particle);
                
                // Float upward
                const floatParticle = () => {
                    particle.y -= 3;
                    particle.alpha *= 0.98;
                    if (particle.alpha > 0.1) {
                        requestAnimationFrame(floatParticle);
                    } else if (particle.parent) {
                        healContainer.removeChild(particle);
                    }
                };
                floatParticle();
            }, i * 50);
        }
        
        this.app.stage.addChild(healContainer);
        
        setTimeout(() => {
            if (healContainer.parent) {
                this.app.stage.removeChild(healContainer);
            }
        }, 4000);
    }
    
    createBloodTsunami(targetX, targetY, level) {
        const tsunamiContainer = new PIXI.Container();
        tsunamiContainer.x = targetX;
        tsunamiContainer.y = targetY;
        
        // Blood wave
        const wave = new PIXI.Graphics();
        wave.beginFill(0x8b0000, 0.8);
        wave.drawEllipse(0, 0, 100, 50);
        wave.endFill();
        tsunamiContainer.addChild(wave);
        
        // Expanding blood tsunami
        const expandTsunami = () => {
            if (wave.scale.x < 8) {
                wave.scale.x += 0.15;
                wave.scale.y += 0.1;
                wave.rotation += 0.02;
                requestAnimationFrame(expandTsunami);
            }
        };
        expandTsunami();
        
        // Blood particles
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const blood = new PIXI.Graphics();
                blood.beginFill(0xdc143c, 0.9);
                blood.drawCircle(0, 0, 3 + Math.random() * 4);
                blood.endFill();
                
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * 300;
                blood.x = Math.cos(angle) * distance;
                blood.y = Math.sin(angle) * distance;
                tsunamiContainer.addChild(blood);
                
                // Splatter animation
                const splatter = () => {
                    blood.x += (Math.random() - 0.5) * 4;
                    blood.y += Math.random() * 2;
                    blood.alpha *= 0.97;
                    if (blood.alpha > 0.1) {
                        requestAnimationFrame(splatter);
                    } else if (blood.parent) {
                        tsunamiContainer.removeChild(blood);
                    }
                };
                splatter();
            }, i * 30);
        }
        
        this.app.stage.addChild(tsunamiContainer);
        this.checkAreaDamage(targetX, targetY, 400, 150, 'blood');
        
        setTimeout(() => {
            if (tsunamiContainer.parent) {
                this.app.stage.removeChild(tsunamiContainer);
            }
        }, 5000);
    }
    
    createCrimsonBlitz(targetX, targetY, level) {
        const blitzContainer = new PIXI.Container();
        blitzContainer.x = targetX;
        blitzContainer.y = targetY;
        
        // Multiple crimson slashes
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                const slash = new PIXI.Graphics();
                slash.lineStyle(8, 0xff0000, 0.9);
                
                const angle = (i / 8) * Math.PI * 2;
                slash.moveTo(0, 0);
                slash.lineTo(Math.cos(angle) * 100, Math.sin(angle) * 100);
                blitzContainer.addChild(slash);
                
                // Slash animation
                slash.alpha = 0;
                const animateSlash = () => {
                    if (slash.alpha < 1) {
                        slash.alpha += 0.2;
                        requestAnimationFrame(animateSlash);
                    } else {
                        setTimeout(() => {
                            slash.alpha *= 0.9;
                            if (slash.alpha > 0.1) {
                                requestAnimationFrame(() => animateSlash());
                            } else if (slash.parent) {
                                blitzContainer.removeChild(slash);
                            }
                        }, 200);
                    }
                };
                animateSlash();
            }, i * 50);
        }
        
        this.app.stage.addChild(blitzContainer);
        this.checkAreaDamage(targetX, targetY, 250, 100, 'crimson');
        
        setTimeout(() => {
            if (blitzContainer.parent) {
                this.app.stage.removeChild(blitzContainer);
            }
        }, 2000);
    }
    
    createNineTailBarrage(targetX, targetY, level) {
        // Create 9 tail attacks
        for (let i = 0; i < 9; i++) {
            setTimeout(() => {
                const tailContainer = new PIXI.Container();
                
                const angle = (i / 9) * Math.PI * 2;
                const tailX = targetX + Math.cos(angle) * 150;
                const tailY = targetY + Math.sin(angle) * 150;
                
                tailContainer.x = tailX;
                tailContainer.y = tailY;
                
                // Tail strike effect
                const tail = new PIXI.Graphics();
                tail.beginFill(0xff4500, 0.8);
                tail.drawEllipse(0, 0, 60, 20);
                tail.endFill();
                tail.rotation = angle;
                tailContainer.addChild(tail);
                
                // Impact effect
                const impact = new PIXI.Graphics();
                impact.beginFill(0xff8800, 0.6);
                impact.drawCircle(0, 0, 40);
                impact.endFill();
                tailContainer.addChild(impact);
                
                this.app.stage.addChild(tailContainer);
                
                // Animation
                tailContainer.scale.set(0);
                const animateTail = () => {
                    if (tailContainer.scale.x < 1.5) {
                        tailContainer.scale.x += 0.15;
                        tailContainer.scale.y += 0.15;
                        tailContainer.rotation += 0.1;
                        requestAnimationFrame(animateTail);
                    } else {
                        setTimeout(() => {
                            if (tailContainer.parent) {
                                this.app.stage.removeChild(tailContainer);
                            }
                        }, 500);
                    }
                };
                animateTail();
            }, i * 200);
        }
        
        this.checkAreaDamage(targetX, targetY, 300, 200, 'ninetail');
    }
    
    createShadowCloneJutsu(targetX, targetY, level) {
        const cloneContainer = new PIXI.Container();
        cloneContainer.x = targetX;
        cloneContainer.y = targetY;
        
        // Create multiple shadow clones
        for (let i = 0; i < 5; i++) {
            const clone = new PIXI.Graphics();
            clone.beginFill(0x222222, 0.7);
            clone.drawCircle(0, 0, 20);
            clone.endFill();
            
            const angle = (i / 5) * Math.PI * 2;
            clone.x = Math.cos(angle) * 80;
            clone.y = Math.sin(angle) * 80;
            
            // Clone eyes
            const eye1 = new PIXI.Graphics();
            eye1.beginFill(0xff0000);
            eye1.drawCircle(-8, -8, 3);
            eye1.endFill();
            
            const eye2 = new PIXI.Graphics();
            eye2.beginFill(0xff0000);
            eye2.drawCircle(8, -8, 3);
            eye2.endFill();
            
            clone.addChild(eye1);
            clone.addChild(eye2);
            cloneContainer.addChild(clone);
            
            // Clone animation
            clone.alpha = 0;
            const animateClone = () => {
                if (clone.alpha < 0.8) {
                    clone.alpha += 0.1;
                    clone.scale.x += 0.05;
                    clone.scale.y += 0.05;
                    requestAnimationFrame(animateClone);
                }
            };
            animateClone();
        }
        
        this.app.stage.addChild(cloneContainer);
        
        setTimeout(() => {
            if (cloneContainer.parent) {
                this.app.stage.removeChild(cloneContainer);
            }
        }, 8000);
    }
    
    createVoidStep(targetX, targetY, level) {
        const voidContainer = new PIXI.Container();
        voidContainer.x = targetX;
        voidContainer.y = targetY;
        
        // Void portal
        const portal = new PIXI.Graphics();
        portal.beginFill(0x000000);
        portal.drawCircle(0, 0, 60);
        portal.endFill();
        
        // Void energy
        const energy = new PIXI.Graphics();
        energy.lineStyle(4, 0x8800ff, 0.8);
        energy.drawCircle(0, 0, 80);
        voidContainer.addChild(energy);
        voidContainer.addChild(portal);
        
        // Pulsing animation
        const pulseVoid = () => {
            if (voidContainer.parent) {
                const scale = 1 + Math.sin(Date.now() * 0.01) * 0.3;
                portal.scale.set(scale);
                energy.rotation += 0.1;
                requestAnimationFrame(pulseVoid);
            }
        };
        pulseVoid();
        
        this.app.stage.addChild(voidContainer);
        this.checkAreaDamage(targetX, targetY, 150, 120, 'void');
        
        setTimeout(() => {
            if (voidContainer.parent) {
                this.app.stage.removeChild(voidContainer);
            }
        }, 3000);
    }
    
    createDarknessDomain(targetX, targetY, level) {
        const domainContainer = new PIXI.Container();
        domainContainer.x = targetX;
        domainContainer.y = targetY;
        
        // Dark domain circle
        const domain = new PIXI.Graphics();
        domain.beginFill(0x000000, 0.8);
        domain.drawCircle(0, 0, 200);
        domain.endFill();
        domainContainer.addChild(domain);
        
        // Dark energy spirals
        for (let i = 0; i < 8; i++) {
            const spiral = new PIXI.Graphics();
            spiral.lineStyle(3, 0x4400aa, 0.7);
            
            for (let j = 0; j < 20; j++) {
                const angle = (j / 20) * Math.PI * 4 + (i / 8) * Math.PI * 2;
                const radius = j * 8;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                
                if (j === 0) {
                    spiral.moveTo(x, y);
                } else {
                    spiral.lineTo(x, y);
                }
            }
            
            domainContainer.addChild(spiral);
            
            // Rotating spirals
            const rotateSpiral = () => {
                if (spiral.parent) {
                    spiral.rotation += 0.05 * (i % 2 === 0 ? 1 : -1);
                    requestAnimationFrame(rotateSpiral);
                }
            };
            rotateSpiral();
        }
        
        this.app.stage.addChild(domainContainer);
        this.checkAreaDamage(targetX, targetY, 350, 80, 'shadow');
        
        setTimeout(() => {
            if (domainContainer.parent) {
                this.app.stage.removeChild(domainContainer);
            }
        }, 6000);
    }
    
    createPrimalRoar(targetX, targetY, level) {
        const roarContainer = new PIXI.Container();
        roarContainer.x = targetX;
        roarContainer.y = targetY;
        
        // Sound wave rings
        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                const wave = new PIXI.Graphics();
                wave.lineStyle(8, 0xffaa00, 0.8);
                wave.drawCircle(0, 0, 50);
                roarContainer.addChild(wave);
                
                // Expanding wave
                const expandWave = () => {
                    if (wave.scale.x < 8) {
                        wave.scale.x += 0.2;
                        wave.scale.y += 0.2;
                        wave.alpha *= 0.95;
                        requestAnimationFrame(expandWave);
                    } else if (wave.parent) {
                        roarContainer.removeChild(wave);
                    }
                };
                expandWave();
            }, i * 150);
        }
        
        this.app.stage.addChild(roarContainer);
        this.checkAreaDamage(targetX, targetY, 300, 90, 'primal');
        
        setTimeout(() => {
            if (roarContainer.parent) {
                this.app.stage.removeChild(roarContainer);
            }
        }, 2000);
    }
    
    createWildCharge(targetX, targetY, level) {
        const chargeContainer = new PIXI.Container();
        chargeContainer.x = targetX;
        chargeContainer.y = targetY;
        
        // Charge impact
        const impact = new PIXI.Graphics();
        impact.beginFill(0x8b4513, 0.8);
        impact.drawCircle(0, 0, 80);
        impact.endFill();
        chargeContainer.addChild(impact);
        
        // Dust clouds
        for (let i = 0; i < 12; i++) {
            const dust = new PIXI.Graphics();
            dust.beginFill(0xd2b48c, 0.6);
            dust.drawCircle(0, 0, 15);
            dust.endFill();
            
            const angle = (i / 12) * Math.PI * 2;
            dust.x = Math.cos(angle) * 60;
            dust.y = Math.sin(angle) * 60;
            chargeContainer.addChild(dust);
            
            // Dust animation
            const animateDust = () => {
                dust.scale.x += 0.05;
                dust.scale.y += 0.05;
                dust.alpha *= 0.95;
                if (dust.alpha > 0.1) {
                    requestAnimationFrame(animateDust);
                } else if (dust.parent) {
                    chargeContainer.removeChild(dust);
                }
            };
            animateDust();
        }
        
        this.app.stage.addChild(chargeContainer);
        this.checkAreaDamage(targetX, targetY, 200, 130, 'beast');
        
        setTimeout(() => {
            if (chargeContainer.parent) {
                this.app.stage.removeChild(chargeContainer);
            }
        }, 2000);
    }
    
    createPackSummon(targetX, targetY, level) {
        const packContainer = new PIXI.Container();
        packContainer.x = targetX;
        packContainer.y = targetY;
        
        // Summon multiple wolves
        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                const wolf = new PIXI.Graphics();
                wolf.beginFill(0x696969, 0.8);
                wolf.drawCircle(0, 0, 15);
                wolf.endFill();
                
                // Wolf eyes
                const eye1 = new PIXI.Graphics();
                eye1.beginFill(0xffff00);
                eye1.drawCircle(-6, -6, 2);
                eye1.endFill();
                
                const eye2 = new PIXI.Graphics();
                eye2.beginFill(0xffff00);
                eye2.drawCircle(6, -6, 2);
                eye2.endFill();
                
                wolf.addChild(eye1);
                wolf.addChild(eye2);
                
                const angle = (i / 6) * Math.PI * 2;
                wolf.x = Math.cos(angle) * 100;
                wolf.y = Math.sin(angle) * 100;
                packContainer.addChild(wolf);
                
                // Wolf howl animation
                wolf.alpha = 0;
                const animateWolf = () => {
                    if (wolf.alpha < 0.9) {
                        wolf.alpha += 0.1;
                        wolf.y -= 1;
                        requestAnimationFrame(animateWolf);
                    }
                };
                animateWolf();
            }, i * 300);
        }
        
        this.app.stage.addChild(packContainer);
        
        setTimeout(() => {
            if (packContainer.parent) {
                this.app.stage.removeChild(packContainer);
            }
        }, 8000);
    }
    
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        
        return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
    }

    playSpellAnimation(data) {
        // Create the appropriate spell effect based on the spell type and name
        this.createSpellMechanics(data.type, data.spellName, data.targetX, data.targetY, data.level);
    }

    playTransformationAnimation(data) {
        // Handle transformation animations from other players
        if (data.animationType === 'skill') {
            // Create visual effects for transformation skills
            this.createTransformationSkillEffect(data.transformationType, data.x, data.y, data.targetX, data.targetY);
        }
    }

    playAttackAnimation(data) {
        // Handle attack animations from other players
        this.createAttackEffect(data.attackType, data.x, data.y, data.targetX, data.targetY, data.damage);
    }

    createTransformationSkillEffect(transformationType, x, y, targetX, targetY) {
        // Create visual effects for transformation skills
        switch(transformationType) {
            case 'adminGod':
                this.createDivinePresence(targetX, targetY, 10);
                break;
            case 'bloodLust':
                this.createBloodTsunami(targetX, targetY, 5);
                break;
            case 'nineTailFox':
                this.createNineTailBarrage(targetX, targetY, 5);
                break;
            case 'shadowNinja':
                this.createShadowCloneJutsu(targetX, targetY, 5);
                break;
            case 'voidLord':
                this.createVoidStep(targetX, targetY, 5);
                break;
            case 'dragonLord':
                this.createPrimalRoar(targetX, targetY, 5);
                break;
            case 'celestialTiger':
                this.createWildCharge(targetX, targetY, 5);
                break;
        }
    }

    createAttackEffect(attackType, x, y, targetX, targetY, damage) {
        // Create visual effects for special attacks
        switch(attackType) {
            case 'divine_presence':
                this.createDivinePresence(targetX, targetY, 10);
                break;
            case 'rainbow_divine_blast':
                this.createRainbowDivineBlast(targetX, targetY, 10);
                break;
            case 'mega_fireball':
                this.createInfernoBlast(targetX, targetY, 5);
                break;
            case 'tsunami':
                this.createBloodTsunami(targetX, targetY, 5);
                break;
            case 'apocalypse_fire':
                this.createApocalypseFire(targetX, targetY, 5);
                break;
            case 'reality_tear':
                this.createRealityTear(targetX, targetY, 5);
                break;
            case 'dimension_collapse':
                this.createDimensionCollapse(targetX, targetY, 5);
                break;
        }
    }
    
    // Void Magic Spells
    createVoidBlast(targetX, targetY, level) {
        // Enhanced void energy projectile with orbiting particles
        const voidContainer = new PIXI.Container();
        
        // Main void sphere
        const voidBlast = new PIXI.Graphics();
        voidBlast.beginFill(0x8800ff, 0.9);
        voidBlast.drawCircle(0, 0, 12);
        voidBlast.endFill();
        
        // Void core with pulsing effect
        const core = new PIXI.Graphics();
        core.beginFill(0x000000);
        core.drawCircle(0, 0, 6);
        core.endFill();
        voidContainer.addChild(core);
        
        // Void energy ring
        const energyRing = new PIXI.Graphics();
        energyRing.lineStyle(3, 0xaa00ff, 0.8);
        energyRing.drawCircle(0, 0, 18);
        voidContainer.addChild(energyRing);
        
        voidContainer.addChild(voidBlast);
        
        // Create orbiting void particles
        const particles = [];
        for (let i = 0; i < 6; i++) {
            const particle = new PIXI.Graphics();
            particle.beginFill(0x8800ff, 0.7);
            particle.drawCircle(0, 0, 2);
            particle.endFill();
            
            const angle = (i / 6) * Math.PI * 2;
            particle.x = Math.cos(angle) * 25;
            particle.y = Math.sin(angle) * 25;
            particles.push({ sprite: particle, angle: angle });
            voidContainer.addChild(particle);
        }
        
        voidContainer.x = this.currentPlayer.x;
        voidContainer.y = this.currentPlayer.y;
        this.app.stage.addChild(voidContainer);
        
        // Projectile movement with particle animation
        const dx = targetX - this.currentPlayer.x;
        const dy = targetY - this.currentPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = 400;
        const time = distance / speed * 1000;
        
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / time;
            
            if (progress < 1) {
                voidContainer.x = this.currentPlayer.x + dx * progress;
                voidContainer.y = this.currentPlayer.y + dy * progress;
                
                // Rotate main blast and energy ring
                voidBlast.rotation += 0.15;
                energyRing.rotation -= 0.2;
                
                // Animate orbiting particles
                particles.forEach((particle, index) => {
                    particle.angle += 0.3;
                    particle.sprite.x = Math.cos(particle.angle) * 25;
                    particle.sprite.y = Math.sin(particle.angle) * 25;
                });
                
                // Pulsing core effect
                const pulseScale = 1 + Math.sin(elapsed * 0.01) * 0.3;
                core.scale.set(pulseScale);
                
                requestAnimationFrame(animate);
            } else {
                // Void explosion effect
                this.createVoidExplosion(targetX, targetY);
                this.checkAreaDamage(targetX, targetY, 80, 65, 'void');
                if (voidContainer.parent) {
                    this.app.stage.removeChild(voidContainer);
                }
            }
        };
        animate();
    }
    
    createVoidExplosion(x, y) {
        // Enhanced void explosion with reality distortion
        const explosionContainer = new PIXI.Container();
        explosionContainer.x = x;
        explosionContainer.y = y;
        
        // Central void core
        const voidCore = new PIXI.Graphics();
        voidCore.beginFill(0x000000);
        voidCore.drawCircle(0, 0, 20);
        voidCore.endFill();
        explosionContainer.addChild(voidCore);
        
        // Void energy waves
        for (let i = 0; i < 4; i++) {
            const wave = new PIXI.Graphics();
            wave.lineStyle(6, 0x8800ff, 0.8 - i * 0.2);
            wave.drawCircle(0, 0, 30 + i * 20);
            explosionContainer.addChild(wave);
        }
        
        // Reality distortion particles
        for (let i = 0; i < 15; i++) {
            const particle = new PIXI.Graphics();
            particle.beginFill(0xaa00ff, 0.7);
            particle.drawCircle(0, 0, 3);
            particle.endFill();
            
            const angle = (i / 15) * Math.PI * 2;
            const distance = 40 + Math.random() * 30;
            particle.x = Math.cos(angle) * distance;
            particle.y = Math.sin(angle) * distance;
            explosionContainer.addChild(particle);
            
            // Animate particles flying outward
            const particleVelX = Math.cos(angle) * 3;
            const particleVelY = Math.sin(angle) * 3;
            const animateParticle = () => {
                particle.x += particleVelX;
                particle.y += particleVelY;
                particle.alpha *= 0.95;
                
                if (particle.alpha > 0.1 && particle.parent) {
                    requestAnimationFrame(animateParticle);
                }
            };
            setTimeout(() => animateParticle(), i * 50);
        }
        
        this.app.stage.addChild(explosionContainer);
        
        // Expanding animation
        explosionContainer.scale.set(0.1);
        const expandAnimation = () => {
            if (explosionContainer.scale.x < 1.5) {
                explosionContainer.scale.x += 0.1;
                explosionContainer.scale.y += 0.1;
                explosionContainer.rotation += 0.05;
                requestAnimationFrame(expandAnimation);
            }
        };
        expandAnimation();
        
        setTimeout(() => {
            if (explosionContainer.parent) {
                this.app.stage.removeChild(explosionContainer);
            }
        }, 1200);
    }
    
    createRealityTear(targetX, targetY, level) {
        // Enhanced reality tear with void energy leaking through
        const tearContainer = new PIXI.Container();
        tearContainer.x = targetX;
        tearContainer.y = targetY;
        
        // Create jagged reality tear
        const tear = new PIXI.Graphics();
        tear.lineStyle(10, 0x000000);
        tear.lineStyle(6, 0x8800ff);
        tear.lineStyle(3, 0xaa00ff);
        
        // Main tear
        tear.moveTo(-80, -8);
        tear.lineTo(80, 8);
        
        // Secondary tears
        tear.moveTo(-60, -20);
        tear.lineTo(60, 20);
        tear.moveTo(-40, 15);
        tear.lineTo(40, -15);
        
        tearContainer.addChild(tear);
        
        // Void energy leaking through the tears
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const particle = new PIXI.Graphics();
                particle.beginFill(0x8800ff, 0.8);
                particle.drawCircle(0, 0, 3 + Math.random() * 3);
                particle.endFill();
                
                particle.x = (Math.random() - 0.5) * 160;
                particle.y = (Math.random() - 0.5) * 40;
                tearContainer.addChild(particle);
                
                // Animate void energy escaping
                const velX = (Math.random() - 0.5) * 4;
                const velY = (Math.random() - 0.5) * 4;
                const animateEscape = () => {
                    particle.x += velX;
                    particle.y += velY;
                    particle.alpha *= 0.96;
                    particle.rotation += 0.1;
                    
                    if (particle.alpha > 0.1 && particle.parent) {
                        requestAnimationFrame(animateEscape);
                    } else if (particle.parent) {
                        tearContainer.removeChild(particle);
                    }
                };
                animateEscape();
            }, i * 100);
        }
        
        // Reality distortion effect
        let distortionIntensity = 0.3;
        const distortAnimation = () => {
            if (distortionIntensity > 0) {
                tearContainer.children.forEach(child => {
                    if (child !== tear) {
                        child.x += (Math.random() - 0.5) * distortionIntensity * 10;
                        child.y += (Math.random() - 0.5) * distortionIntensity * 10;
                    }
                });
                distortionIntensity *= 0.98;
                requestAnimationFrame(distortAnimation);
            }
        };
        distortAnimation();
        
        this.app.stage.addChild(tearContainer);
        this.checkAreaDamage(targetX, targetY, 100, 75, 'void');
        
        setTimeout(() => {
            if (tearContainer.parent) {
                this.app.stage.removeChild(tearContainer);
            }
        }, 3000);
    }
    
    createDimensionCollapse(targetX, targetY, level) {
        // Collapses dimensional space
        const collapseContainer = new PIXI.Container();
        collapseContainer.x = targetX;
        collapseContainer.y = targetY;
        
        // Create dimensional rings collapsing inward
        for (let ring = 0; ring < 6; ring++) {
            const dimensionRing = new PIXI.Graphics();
            dimensionRing.lineStyle(6, 0x8800ff, 0.8 - ring * 0.1);
            dimensionRing.drawCircle(0, 0, 100 + ring * 30);
            collapseContainer.addChild(dimensionRing);
            
            // Animate collapse
            dimensionRing.scale.set(2);
            const collapseAnimation = () => {
                if (dimensionRing.scale.x > 0.1) {
                    dimensionRing.scale.x *= 0.92;
                    dimensionRing.scale.y *= 0.92;
                    dimensionRing.rotation += 0.15;
                    requestAnimationFrame(collapseAnimation);
                }
            };
            setTimeout(() => collapseAnimation(), ring * 200);
        }
        
        // Reality distortion effect
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const distortion = new PIXI.Graphics();
                distortion.beginFill(0x220044, 0.6);
                distortion.drawRect(
                    (Math.random() - 0.5) * 200,
                    (Math.random() - 0.5) * 200,
                    Math.random() * 20,
                    Math.random() * 20
                );
                distortion.endFill();
                collapseContainer.addChild(distortion);
                
                setTimeout(() => {
                    if (distortion.parent) {
                        collapseContainer.removeChild(distortion);
                    }
                }, 1000);
            }, i * 100);
        }
        
        this.app.stage.addChild(collapseContainer);
        this.checkAreaDamage(targetX, targetY, 120, 85, 'void');
        
        setTimeout(() => {
            if (collapseContainer.parent) {
                this.app.stage.removeChild(collapseContainer);
            }
        }, 4000);
    }
    
    createUniversalVoid(targetX, targetY, level) {
        // SSS Void Spell - Universal Void that consumes reality itself
        const voidContainer = new PIXI.Container();
        voidContainer.x = targetX;
        voidContainer.y = targetY;
        
        // Create massive void sphere that grows
        const universalVoid = new PIXI.Graphics();
        universalVoid.beginFill(0x000000);
        universalVoid.drawCircle(0, 0, 50);
        universalVoid.endFill();
        voidContainer.addChild(universalVoid);
        
        // Create reality distortion rings
        for (let ring = 0; ring < 15; ring++) {
            setTimeout(() => {
                const distortionRing = new PIXI.Graphics();
                distortionRing.lineStyle(8, 0x8800ff, 0.9 - ring * 0.05);
                distortionRing.drawCircle(0, 0, 80 + ring * 40);
                voidContainer.addChild(distortionRing);
                
                // Animate ring collapse
                distortionRing.scale.set(3);
                const collapseAnimation = () => {
                    if (distortionRing.scale.x > 0.1) {
                        distortionRing.scale.x *= 0.9;
                        distortionRing.scale.y *= 0.9;
                        distortionRing.rotation += 0.2;
                        requestAnimationFrame(collapseAnimation);
                    }
                };
                collapseAnimation();
                
                // Multiple damage waves
                this.checkAreaDamage(targetX, targetY, 80 + ring * 40, 120, 'void');
                
                setTimeout(() => {
                    if (distortionRing.parent) {
                        voidContainer.removeChild(distortionRing);
                    }
                }, 2000);
            }, ring * 150);
        }
        
        // Create void tendrils that seek out players
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const tendril = new PIXI.Graphics();
                tendril.lineStyle(6, 0xaa00ff, 0.8);
                
                // Find nearest player for targeting
                let nearestPlayer = null;
                let nearestDistance = Infinity;
                
                this.players.forEach((player, playerId) => {
                    if (playerId !== client.socket.id) {
                        const dx = player.x - targetX;
                        const dy = player.y - targetY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance < nearestDistance) {
                            nearestDistance = distance;
                            nearestPlayer = player;
                        }
                    }
                });
                
                if (nearestPlayer) {
                    tendril.moveTo(0, 0);
                    tendril.lineTo(nearestPlayer.x - targetX, nearestPlayer.y - targetY);
                    voidContainer.addChild(tendril);
                    
                    this.checkAreaDamage(nearestPlayer.x, nearestPlayer.y, 60, 100, 'void');
                }
                
                setTimeout(() => {
                    if (tendril.parent) {
                        voidContainer.removeChild(tendril);
                    }
                }, 1500);
            }, i * 100);
        }
        
        // Massive screen distortion effect
        let distortionIntensity = 1.0;
        const distortAnimation = () => {
            if (distortionIntensity > 0) {
                // Shake entire screen
                this.app.stage.x += (Math.random() - 0.5) * distortionIntensity * 20;
                this.app.stage.y += (Math.random() - 0.5) * distortionIntensity * 20;
                
                // Distort void container
                voidContainer.children.forEach(child => {
                    child.alpha = 0.5 + Math.random() * distortionIntensity * 0.5;
                });
                
                distortionIntensity *= 0.97;
                requestAnimationFrame(distortAnimation);
            } else {
                // Reset stage position
                this.app.stage.x = -this.camera.x;
                this.app.stage.y = -this.camera.y;
            }
        };
        distortAnimation();
        
        this.app.stage.addChild(voidContainer);
        
        setTimeout(() => {
            if (voidContainer.parent) {
                this.app.stage.removeChild(voidContainer);
            }
        }, 6000);
    }

    createApocalypseFire(targetX, targetY, level) {
        // Massive fire apocalypse effect
        const fireContainer = new PIXI.Container();
        fireContainer.x = targetX;
        fireContainer.y = targetY;
        
        // Create expanding fire waves
        for (let wave = 0; wave < 8; wave++) {
            setTimeout(() => {
                const fireWave = new PIXI.Graphics();
                fireWave.beginFill(0xff0000, 0.8 - wave * 0.1);
                fireWave.drawCircle(0, 0, 50 + wave * 30);
                fireWave.endFill();
                fireContainer.addChild(fireWave);
                
                // Expanding animation
                fireWave.scale.set(0.1);
                const expandAnimation = () => {
                    if (fireWave.scale.x < 3) {
                        fireWave.scale.x += 0.1;
                        fireWave.scale.y += 0.1;
                        fireWave.alpha *= 0.98;
                        requestAnimationFrame(expandAnimation);
                    } else if (fireWave.parent) {
                        fireContainer.removeChild(fireWave);
                    }
                };
                expandAnimation();
            }, wave * 200);
        }
        
        this.app.stage.addChild(fireContainer);
        this.checkAreaDamage(targetX, targetY, 300, 100, 'fire');
        
        setTimeout(() => {
            if (fireContainer.parent) {
                this.app.stage.removeChild(fireContainer);
            }
        }, 4000);
    }

    createAbsoluteZero(targetX, targetY, level) {
        // Ultimate ice spell
        const iceContainer = new PIXI.Container();
        iceContainer.x = targetX;
        iceContainer.y = targetY;
        
        const frozenField = new PIXI.Graphics();
        frozenField.beginFill(0x87ceeb, 0.8);
        frozenField.drawCircle(0, 0, 150);
        frozenField.endFill();
        iceContainer.addChild(frozenField);
        
        // Ice crystals
        for (let i = 0; i < 20; i++) {
            const crystal = new PIXI.Graphics();
            crystal.beginFill(0xffffff);
            crystal.drawPolygon([0, -10, -5, 0, 0, 10, 5, 0]);
            crystal.endFill();
            
            const angle = Math.random() * Math.PI * 2;
            crystal.x = Math.cos(angle) * (Math.random() * 100);
            crystal.y = Math.sin(angle) * (Math.random() * 100);
            iceContainer.addChild(crystal);
        }
        
        this.app.stage.addChild(iceContainer);
        this.checkAreaDamage(targetX, targetY, 150, 80, 'ice');
        
        setTimeout(() => {
            if (iceContainer.parent) {
                this.app.stage.removeChild(iceContainer);
            }
        }, 3000);
    }

    createGodsWrath(targetX, targetY, level) {
        // Ultimate lightning spell
        const lightningContainer = new PIXI.Container();
        lightningContainer.x = targetX;
        lightningContainer.y = targetY;
        
        // Multiple massive lightning strikes
        for (let i = 0; i < 10; i++) {
            setTimeout(() => {
                const lightning = new PIXI.Graphics();
                lightning.lineStyle(15, 0xffffff);
                lightning.moveTo(0, -500);
                lightning.lineTo((Math.random() - 0.5) * 100, 0);
                lightningContainer.addChild(lightning);
                
                setTimeout(() => {
                    if (lightning.parent) {
                        lightningContainer.removeChild(lightning);
                    }
                }, 300);
            }, i * 100);
        }
        
        this.app.stage.addChild(lightningContainer);
        this.checkAreaDamage(targetX, targetY, 200, 120, 'lightning');
        
        setTimeout(() => {
            if (lightningContainer.parent) {
                this.app.stage.removeChild(lightningContainer);
            }
        }, 2000);
    }

    createContinentalDrift(targetX, targetY, level) {
        // Ultimate earth spell
        const earthContainer = new PIXI.Container();
        earthContainer.x = targetX;
        earthContainer.y = targetY;
        
        // Massive earth upheaval
        for (let i = 0; i < 15; i++) {
            const earthSpike = new PIXI.Graphics();
            earthSpike.beginFill(0x8b4513);
            earthSpike.drawPolygon([0, -100, -30, 30, 30, 30]);
            earthSpike.endFill();
            
            const angle = (i / 15) * Math.PI * 2;
            earthSpike.x = Math.cos(angle) * 100;
            earthSpike.y = Math.sin(angle) * 100;
            earthContainer.addChild(earthSpike);
        }
        
        this.app.stage.addChild(earthContainer);
        this.checkAreaDamage(targetX, targetY, 250, 100, 'earth');
        
        setTimeout(() => {
            if (earthContainer.parent) {
                this.app.stage.removeChild(earthContainer);
            }
        }, 4000);
    }

    createAtmosphericCollapse(targetX, targetY, level) {
        // Ultimate wind spell
        const windContainer = new PIXI.Container();
        windContainer.x = targetX;
        windContainer.y = targetY;
        
        // Massive atmospheric disturbance
        for (let ring = 0; ring < 10; ring++) {
            const windRing = new PIXI.Graphics();
            windRing.lineStyle(8, 0x44ffff, 0.8);
            windRing.drawCircle(0, 0, 50 + ring * 20);
            windContainer.addChild(windRing);
            
            const rotateRing = () => {
                if (windRing.parent) {
                    windRing.rotation += 0.3 + ring * 0.1;
                    requestAnimationFrame(rotateRing);
                }
            };
            rotateRing();
        }
        
        this.app.stage.addChild(windContainer);
        this.checkAreaDamage(targetX, targetY, 300, 110, 'wind');
        
        setTimeout(() => {
            if (windContainer.parent) {
                this.app.stage.removeChild(windContainer);
            }
        }, 5000);
    }

    createRealityErasure(targetX, targetY, level) {
        // Ultimate shadow spell
        const shadowContainer = new PIXI.Container();
        shadowContainer.x = targetX;
        shadowContainer.y = targetY;
        
        // Reality erasure effect
        const erasure = new PIXI.Graphics();
        erasure.beginFill(0x000000);
        erasure.drawCircle(0, 0, 200);
        erasure.endFill();
        shadowContainer.addChild(erasure);
        
        this.app.stage.addChild(shadowContainer);
        this.checkAreaDamage(targetX, targetY, 200, 150, 'shadow');
        
        setTimeout(() => {
            if (shadowContainer.parent) {
                this.app.stage.removeChild(shadowContainer);
            }
        }, 3000);
    }

    createGenesisBurst(targetX, targetY, level) {
        // Ultimate light spell
        const lightContainer = new PIXI.Container();
        lightContainer.x = targetX;
        lightContainer.y = targetY;
        
        // Genesis creation burst
        const burst = new PIXI.Graphics();
        burst.beginFill(0xffffff, 0.9);
        burst.drawCircle(0, 0, 250);
        burst.endFill();
        lightContainer.addChild(burst);
        
        this.app.stage.addChild(lightContainer);
        this.checkAreaDamage(targetX, targetY, 250, 140, 'light');
        
        setTimeout(() => {
            if (lightContainer.parent) {
                this.app.stage.removeChild(lightContainer);
            }
        }, 2000);
    }
    
    // Soul Magic Spells
    createSoulDrain(targetX, targetY, level) {
        // Level-specific soul drain animations
        const drainContainer = new PIXI.Container();
        drainContainer.x = targetX;
        drainContainer.y = targetY;
        
        if (level === 1) {
            // Level 1: Basic soul drain with simple spiral
            const drainCircle = new PIXI.Graphics();
            drainCircle.beginFill(0x660066, 0.6);
            drainCircle.drawCircle(0, 0, 60);
            drainCircle.endFill();
            
            const soulSpiral = new PIXI.Graphics();
            soulSpiral.lineStyle(3, 0xaa00aa);
            for (let i = 0; i < 20; i++) {
                const angle = (i / 20) * Math.PI * 4;
                const radius = 40 - (i / 20) * 35;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                
                if (i === 0) {
                    soulSpiral.moveTo(x, y);
                } else {
                    soulSpiral.lineTo(x, y);
                }
            }
            
            drainContainer.addChild(drainCircle);
            drainContainer.addChild(soulSpiral);
            
            // Simple rotation
            const spinAnimation = () => {
                if (drainContainer.parent) {
                    soulSpiral.rotation += 0.2;
                    requestAnimationFrame(spinAnimation);
                }
            };
            spinAnimation();
            
            // Add soul particles being drawn in
            for (let i = 0; i < 8; i++) {
                setTimeout(() => {
                    const particle = new PIXI.Graphics();
                    particle.beginFill(0x8800aa, 0.8);
                    particle.drawCircle(0, 0, 3);
                    particle.endFill();
                    
                    const angle = Math.random() * Math.PI * 2;
                    const startRadius = 120;
                    particle.x = targetX + Math.cos(angle) * startRadius;
                    particle.y = targetY + Math.sin(angle) * startRadius;
                    
                    this.app.stage.addChild(particle);
                    
                    // Animate particle being sucked toward center
                    const suckAnimation = () => {
                        const dx = targetX - particle.x;
                        const dy = targetY - particle.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        if (dist > 15) {
                            particle.x += (dx / dist) * 4;
                            particle.y += (dy / dist) * 4;
                            particle.rotation += 0.2;
                            requestAnimationFrame(suckAnimation);
                        } else if (particle.parent) {
                            this.app.stage.removeChild(particle);
                        }
                    };
                    suckAnimation();
                }, i * 150);
            }
            
        } else if (level === 2) {
            // Level 2: Dual spirals with soul wisps
            const drainCircle = new PIXI.Graphics();
            drainCircle.beginFill(0x660066, 0.7);
            drainCircle.drawCircle(0, 0, 80);
            drainCircle.endFill();
            
            // Create dual counter-rotating spirals
            for (let spiralNum = 0; spiralNum < 2; spiralNum++) {
                const spiral = new PIXI.Graphics();
                spiral.lineStyle(4, spiralNum === 0 ? 0xaa00aa : 0xcc00cc);
                
                for (let i = 0; i < 25; i++) {
                    const angle = (i / 25) * Math.PI * 5 + (spiralNum * Math.PI);
                    const radius = 50 - (i / 25) * 45;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    
                    if (i === 0) {
                        spiral.moveTo(x, y);
                    } else {
                        spiral.lineTo(x, y);
                    }
                }
                drainContainer.addChild(spiral);
                
                // Counter-rotating spirals
                const rotateSpiral = () => {
                    if (drainContainer.parent) {
                        spiral.rotation += spiralNum === 0 ? 0.25 : -0.25;
                        requestAnimationFrame(rotateSpiral);
                    }
                };
                rotateSpiral();
            }
            
            drainContainer.addChild(drainCircle);
            
            // Add floating soul wisps
            for (let i = 0; i < 6; i++) {
                setTimeout(() => {
                    const wisp = new PIXI.Graphics();
                    wisp.beginFill(0x9900bb, 0.8);
                    wisp.drawCircle(0, 0, 4);
                    wisp.endFill();
                    
                    const angle = (i / 6) * Math.PI * 2;
                    wisp.x = Math.cos(angle) * 70;
                    wisp.y = Math.sin(angle) * 70;
                    drainContainer.addChild(wisp);
                    
                    // Floating animation
                    const floatAnimation = () => {
                        if (wisp.parent) {
                            wisp.x += Math.sin(Date.now() * 0.005 + i) * 0.5;
                            wisp.y += Math.cos(Date.now() * 0.005 + i) * 0.5;
                            wisp.alpha = 0.6 + Math.sin(Date.now() * 0.01 + i) * 0.4;
                            requestAnimationFrame(floatAnimation);
                        }
                    };
                    floatAnimation();
                }, i * 200);
            }
            
            // Enhanced soul particle attraction
            for (let i = 0; i < 12; i++) {
                setTimeout(() => {
                    const particle = new PIXI.Graphics();
                    particle.beginFill(0xaa00aa, 0.8);
                    particle.drawCircle(0, 0, 4);
                    particle.endFill();
                    
                    const angle = Math.random() * Math.PI * 2;
                    const startRadius = 150;
                    particle.x = targetX + Math.cos(angle) * startRadius;
                    particle.y = targetY + Math.sin(angle) * startRadius;
                    
                    this.app.stage.addChild(particle);
                    
                    const suckAnimation = () => {
                        const dx = targetX - particle.x;
                        const dy = targetY - particle.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        if (dist > 20) {
                            particle.x += (dx / dist) * 5;
                            particle.y += (dy / dist) * 5;
                            particle.rotation += 0.3;
                            requestAnimationFrame(suckAnimation);
                        } else if (particle.parent) {
                            this.app.stage.removeChild(particle);
                        }
                    };
                    suckAnimation();
                }, i * 100);
            }
            
        } else if (level === 3) {
            // Level 3: Triple vortex with soul energy beams
            const drainCircle = new PIXI.Graphics();
            drainCircle.beginFill(0x660066, 0.8);
            drainCircle.drawCircle(0, 0, 100);
            drainCircle.endFill();
            
            // Three interconnected vortices
            for (let vortexNum = 0; vortexNum < 3; vortexNum++) {
                const vortex = new PIXI.Graphics();
                vortex.lineStyle(5, [0xaa00aa, 0xcc00cc, 0x8800bb][vortexNum]);
                
                const centerAngle = (vortexNum / 3) * Math.PI * 2;
                const centerX = Math.cos(centerAngle) * 30;
                const centerY = Math.sin(centerAngle) * 30;
                
                for (let i = 0; i < 30; i++) {
                    const angle = (i / 30) * Math.PI * 6;
                    const radius = 40 - (i / 30) * 35;
                    const x = centerX + Math.cos(angle) * radius;
                    const y = centerY + Math.sin(angle) * radius;
                    
                    if (i === 0) {
                        vortex.moveTo(x, y);
                    } else {
                        vortex.lineTo(x, y);
                    }
                }
                drainContainer.addChild(vortex);
                
                // Independent rotation for each vortex
                const rotateVortex = () => {
                    if (drainContainer.parent) {
                        vortex.rotation += 0.3 + vortexNum * 0.1;
                        requestAnimationFrame(rotateVortex);
                    }
                };
                rotateVortex();
            }
            
            drainContainer.addChild(drainCircle);
            
            // Energy beams connecting vortices
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    const beam = new PIXI.Graphics();
                    beam.lineStyle(3, 0xdd00dd, 0.8);
                    
                    const angle1 = (i / 3) * Math.PI * 2;
                    const angle2 = ((i + 1) / 3) * Math.PI * 2;
                    const x1 = Math.cos(angle1) * 30;
                    const y1 = Math.sin(angle1) * 30;
                    const x2 = Math.cos(angle2) * 30;
                    const y2 = Math.sin(angle2) * 30;
                    
                    beam.moveTo(x1, y1);
                    beam.lineTo(x2, y2);
                    drainContainer.addChild(beam);
                    
                    // Pulsing beam
                    const pulseBeam = () => {
                        if (beam.parent) {
                            beam.alpha = 0.5 + Math.sin(Date.now() * 0.01 + i) * 0.3;
                            requestAnimationFrame(pulseBeam);
                        }
                    };
                    pulseBeam();
                }, i * 300);
            }
            
            // Advanced soul collection with multiple waves
            for (let wave = 0; wave < 3; wave++) {
                setTimeout(() => {
                    for (let i = 0; i < 8; i++) {
                        setTimeout(() => {
                            const particle = new PIXI.Graphics();
                            particle.beginFill(0xbb00bb, 0.9);
                            particle.drawCircle(0, 0, 5);
                            particle.endFill();
                            
                            const angle = (i / 8) * Math.PI * 2 + wave * 0.5;
                            const startRadius = 180 + wave * 30;
                            particle.x = targetX + Math.cos(angle) * startRadius;
                            particle.y = targetY + Math.sin(angle) * startRadius;
                            
                            this.app.stage.addChild(particle);
                            
                            const suckAnimation = () => {
                                const dx = targetX - particle.x;
                                const dy = targetY - particle.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                
                                if (dist > 25) {
                                    particle.x += (dx / dist) * 6;
                                    particle.y += (dy / dist) * 6;
                                    particle.rotation += 0.4;
                                    requestAnimationFrame(suckAnimation);
                                } else if (particle.parent) {
                                    this.app.stage.removeChild(particle);
                                }
                            };
                            suckAnimation();
                        }, i * 80);
                    }
                }, wave * 600);
            }
            
        } else if (level >= 4) {
            // Level 4: Massive soul vortex with skull manifestations
            const drainCircle = new PIXI.Graphics();
            drainCircle.beginFill(0x330033, 0.9);
            drainCircle.drawCircle(0, 0, 120);
            drainCircle.endFill();
            
            // Central void
            const voidCore = new PIXI.Graphics();
            voidCore.beginFill(0x000000);
            voidCore.drawCircle(0, 0, 25);
            voidCore.endFill();
            
            // Multiple layered spirals
            for (let layer = 0; layer < 4; layer++) {
                const spiral = new PIXI.Graphics();
                spiral.lineStyle(6 - layer, [0xff00ff, 0xcc00cc, 0xaa00aa, 0x8800bb][layer]);
                
                for (let i = 0; i < 40; i++) {
                    const angle = (i / 40) * Math.PI * 8 + layer * Math.PI / 2;
                    const radius = (80 - layer * 15) - (i / 40) * (70 - layer * 10);
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    
                    if (i === 0) {
                        spiral.moveTo(x, y);
                    } else {
                        spiral.lineTo(x, y);
                    }
                }
                drainContainer.addChild(spiral);
                
                // Complex rotation patterns
                const rotateSpiral = () => {
                    if (drainContainer.parent) {
                        spiral.rotation += (0.4 - layer * 0.1) * (layer % 2 === 0 ? 1 : -1);
                        requestAnimationFrame(rotateSpiral);
                    }
                };
                rotateSpiral();
            }
            
            drainContainer.addChild(drainCircle);
            drainContainer.addChild(voidCore);
            
            // Manifestation of soul skulls
            for (let i = 0; i < 8; i++) {
                setTimeout(() => {
                    const skull = new PIXI.Graphics();
                    skull.beginFill(0xbbbbbb, 0.8);
                    skull.lineStyle(2, 0x8800aa);
                    skull.drawCircle(0, 0, 8);
                    skull.beginFill(0x000000);
                    skull.drawCircle(-3, -2, 2);
                    skull.drawCircle(3, -2, 2);
                    skull.drawRect(-4, 2, 8, 3);
                    skull.endFill();
                    
                    const angle = (i / 8) * Math.PI * 2;
                    skull.x = Math.cos(angle) * 90;
                    skull.y = Math.sin(angle) * 90;
                    drainContainer.addChild(skull);
                    
                    // Orbiting skulls
                    const orbitSkull = () => {
                        if (skull.parent) {
                            const currentAngle = Math.atan2(skull.y, skull.x);
                            const newAngle = currentAngle + 0.05;
                            const radius = 90 + Math.sin(Date.now() * 0.003 + i) * 10;
                            skull.x = Math.cos(newAngle) * radius;
                            skull.y = Math.sin(newAngle) * radius;
                            skull.rotation += 0.1;
                            requestAnimationFrame(orbitSkull);
                        }
                    };
                    orbitSkull();
                }, i * 150);
            }
            
            // Pulsing void core
            const pulseCore = () => {
                if (voidCore.parent) {
                    const pulseScale = 1 + Math.sin(Date.now() * 0.008) * 0.3;
                    voidCore.scale.set(pulseScale);
                    requestAnimationFrame(pulseCore);
                }
            };
            pulseCore();
            
            // Master-level soul collection with ghostly apparitions
            for (let wave = 0; wave < 5; wave++) {
                setTimeout(() => {
                    for (let i = 0; i < 12; i++) {
                        setTimeout(() => {
                            const ghost = new PIXI.Graphics();
                            ghost.beginFill(0xdddddd, 0.7);
                            ghost.lineStyle(2, 0x8800aa);
                            ghost.drawCircle(0, 0, 6);
                            ghost.beginFill(0x000000);
                            ghost.drawCircle(-2, -2, 1);
                            ghost.drawCircle(2, -2, 1);
                            ghost.drawCircle(0, 2, 1);
                            ghost.endFill();
                            
                            const angle = (i / 12) * Math.PI * 2 + wave * 0.4;
                            const startRadius = 220 + wave * 40;
                            ghost.x = targetX + Math.cos(angle) * startRadius;
                            ghost.y = targetY + Math.sin(angle) * startRadius;
                            
                            this.app.stage.addChild(ghost);
                            
                            const suckAnimation = () => {
                                const dx = targetX - ghost.x;
                                const dy = targetY - ghost.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                
                                if (dist > 30) {
                                    ghost.x += (dx / dist) * (7 + level);
                                    ghost.y += (dy / dist) * (7 + level);
                                    ghost.rotation += 0.5;
                                    ghost.alpha = Math.max(0.3, 1 - (220 - dist) / 220);
                                    requestAnimationFrame(suckAnimation);
                                } else if (ghost.parent) {
                                    // Create soul absorption effect
                                    const absorption = new PIXI.Graphics();
                                    absorption.beginFill(0xcc00cc, 0.8);
                                    absorption.drawCircle(0, 0, 15);
                                    absorption.endFill();
                                    absorption.x = ghost.x;
                                    absorption.y = ghost.y;
                                    this.app.stage.addChild(absorption);
                                    
                                    setTimeout(() => {
                                        if (absorption.parent) this.app.stage.removeChild(absorption);
                                    }, 300);
                                    
                                    this.app.stage.removeChild(ghost);
                                }
                            };
                            suckAnimation();
                        }, i * 60);
                    }
                }, wave * 500);
            }
        }
        
        this.app.stage.addChild(drainContainer);
        
        // Enhanced damage and healing based on level
        let totalDamageDealt = 0;
        const baseRadius = 60 + level * 20;
        const baseDamage = 30 + level * 15;
        
        // Initial area damage
        this.checkAreaDamage(targetX, targetY, baseRadius, baseDamage, 'soul');
        
        // Continuous damage over time
        const damageInterval = setInterval(() => {
            this.players.forEach((player, playerId) => {
                if (playerId !== client.socket.id) {
                    const dx = player.x - targetX;
                    const dy = player.y - targetY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < baseRadius) {
                        const damage = Math.floor(baseDamage / 4); // Damage per tick
                        totalDamageDealt += damage;
                        this.showDamageNumber(damage, player.x, player.y, '#660066');
                        client.socket.emit('playerHit', {
                            targetId: playerId,
                            damage: damage,
                            spellType: 'soul'
                        });
                    }
                }
            });
            
            // Check demon statue damage each tick
            this.checkAreaDamage(targetX, targetY, baseRadius, Math.floor(baseDamage / 4), 'soul');
            
            // Heal player based on damage dealt this tick
            if (totalDamageDealt > 0 && this.currentPlayer) {
                const healAmount = Math.floor(totalDamageDealt * (0.3 + level * 0.1));
                if (healAmount > 0) {
                    this.showDamageNumber(healAmount, this.currentPlayer.x, this.currentPlayer.y, '#00ff00');
                    client.socket.emit('healPlayer', healAmount);
                }
                totalDamageDealt = 0; // Reset for next tick
            }
        }, 500); // Damage every 0.5 seconds
        
        const duration = 2000 + level * 800;
        setTimeout(() => {
            clearInterval(damageInterval);
            if (drainContainer.parent) {
                // Fade out animation
                const fadeAnimation = () => {
                    drainContainer.alpha *= 0.9;
                    drainContainer.scale.x *= 0.98;
                    drainContainer.scale.y *= 0.98;
                    if (drainContainer.alpha > 0.1) {
                        requestAnimationFrame(fadeAnimation);
                    } else if (drainContainer.parent) {
                        this.app.stage.removeChild(drainContainer);
                    }
                };
                fadeAnimation();
            }
        }, duration);
    }
    
    createSpiritArmy(targetX, targetY, level) {
        if (level === 1) {
            // Level 1: Basic spirit summoning with simple circle
            const spiritCount = 3;
            const radius = 80;
            
            // Simple summoning circle
            const summonCircle = new PIXI.Container();
            summonCircle.x = targetX;
            summonCircle.y = targetY;
            
            const circle = new PIXI.Graphics();
            circle.lineStyle(4, 0x8800aa, 0.8);
            circle.drawCircle(0, 0, radius);
            summonCircle.addChild(circle);
            
            // Basic triangle pattern
            const triangle = new PIXI.Graphics();
            triangle.lineStyle(3, 0xaa00aa);
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
                const x = Math.cos(angle) * 50;
                const y = Math.sin(angle) * 50;
                
                if (i === 0) {
                    triangle.moveTo(x, y);
                } else {
                    triangle.lineTo(x, y);
                }
            }
            triangle.lineTo(Math.cos(-Math.PI / 2) * 50, Math.sin(-Math.PI / 2) * 50);
            summonCircle.addChild(triangle);
            
            this.app.stage.addChild(summonCircle);
            
            // Simple appearance
            summonCircle.alpha = 0;
            summonCircle.scale.set(0.5);
            const appearAnimation = () => {
                if (summonCircle.alpha < 1) {
                    summonCircle.alpha += 0.15;
                    summonCircle.scale.x += 0.1;
                    summonCircle.scale.y += 0.1;
                    requestAnimationFrame(appearAnimation);
                }
            };
            appearAnimation();
            
            // Summon 3 basic spirits
            for (let i = 0; i < spiritCount; i++) {
                setTimeout(() => {
                    const angle = (i / spiritCount) * Math.PI * 2;
                    const spiritX = targetX + Math.cos(angle) * radius;
                    const spiritY = targetY + Math.sin(angle) * radius;
                    this.createSoulSpirit(spiritX, spiritY, 1);
                }, i * 500);
            }
            
            // Initial damage from summoning
            this.checkAreaDamage(targetX, targetY, radius + 40, 35, 'soul');
            
            setTimeout(() => {
                if (summonCircle.parent) {
                    this.app.stage.removeChild(summonCircle);
                }
            }, 3000);
            
        } else if (level === 2) {
            // Level 2: Enhanced summoning with pentagram
            const spiritCount = 5;
            const radius = 100;
            
            const summonCircle = new PIXI.Container();
            summonCircle.x = targetX;
            summonCircle.y = targetY;
            
            // Double circle
            const outerCircle = new PIXI.Graphics();
            outerCircle.lineStyle(6, 0x8800aa, 0.9);
            outerCircle.drawCircle(0, 0, radius);
            outerCircle.lineStyle(3, 0xaa00aa, 0.7);
            outerCircle.drawCircle(0, 0, radius - 15);
            summonCircle.addChild(outerCircle);
            
            // Pentagram
            const pentagram = new PIXI.Graphics();
            pentagram.lineStyle(4, 0xcc00cc, 0.8);
            for (let i = 0; i < 5; i++) {
                const angle1 = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const angle2 = ((i + 2) * 2 * Math.PI) / 5 - Math.PI / 2;
                const radius2 = 60;
                
                pentagram.moveTo(Math.cos(angle1) * radius2, Math.sin(angle1) * radius2);
                pentagram.lineTo(Math.cos(angle2) * radius2, Math.sin(angle2) * radius2);
            }
            summonCircle.addChild(pentagram);
            
            // Soul flames at pentagram points
            for (let i = 0; i < 5; i++) {
                const flame = new PIXI.Graphics();
                flame.beginFill(0xaa00ff, 0.8);
                flame.drawCircle(0, 0, 6);
                flame.endFill();
                
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                flame.x = Math.cos(angle) * 60;
                flame.y = Math.sin(angle) * 60;
                summonCircle.addChild(flame);
                
                // Flickering flame
                const flickerFlame = () => {
                    if (flame.parent) {
                        flame.alpha = 0.6 + Math.sin(Date.now() * 0.02 + i) * 0.4;
                        flame.scale.set(0.8 + Math.sin(Date.now() * 0.015 + i) * 0.3);
                        requestAnimationFrame(flickerFlame);
                    }
                };
                flickerFlame();
            }
            
            this.app.stage.addChild(summonCircle);
            
            // Enhanced appearance with rotation
            summonCircle.alpha = 0;
            summonCircle.scale.set(0.2);
            const appearAnimation = () => {
                if (summonCircle.alpha < 1) {
                    summonCircle.alpha += 0.12;
                    summonCircle.scale.x += 0.08;
                    summonCircle.scale.y += 0.08;
                    summonCircle.rotation += 0.05;
                    requestAnimationFrame(appearAnimation);
                }
            };
            appearAnimation();
            
            // Summon 5 enhanced spirits
            for (let i = 0; i < spiritCount; i++) {
                setTimeout(() => {
                    const angle = (i / spiritCount) * Math.PI * 2;
                    const spiritX = targetX + Math.cos(angle) * radius;
                    const spiritY = targetY + Math.sin(angle) * radius;
                    
                    // Enhanced emergence effect
                    const emergence = new PIXI.Graphics();
                    emergence.beginFill(0x8800aa, 0.8);
                    emergence.drawCircle(0, 0, 25);
                    emergence.endFill();
                    emergence.x = spiritX;
                    emergence.y = spiritY;
                    this.app.stage.addChild(emergence);
                    
                    emergence.scale.set(0);
                    const emergeAnimation = () => {
                        if (emergence.scale.x < 1.5) {
                            emergence.scale.x += 0.15;
                            emergence.scale.y += 0.15;
                            emergence.alpha *= 0.95;
                            requestAnimationFrame(emergeAnimation);
                        } else if (emergence.parent) {
                            this.app.stage.removeChild(emergence);
                        }
                    };
                    emergeAnimation();
                    
                    setTimeout(() => {
                        this.createSoulSpirit(spiritX, spiritY, 2);
                    }, 600);
                }, i * 400);
            }
            
            // Enhanced damage from summoning
            this.checkAreaDamage(targetX, targetY, radius + 50, 45, 'soul');
            
            setTimeout(() => {
                if (summonCircle.parent) {
                    this.app.stage.removeChild(summonCircle);
                }
            }, 4000);
            
        } else if (level === 3) {
            // Level 3: Advanced summoning with multiple circles and runes
            const spiritCount = 7;
            const radius = 120;
            
            const summonCircle = new PIXI.Container();
            summonCircle.x = targetX;
            summonCircle.y = targetY;
            
            // Triple nested circles
            for (let ring = 0; ring < 3; ring++) {
                const circle = new PIXI.Graphics();
                circle.lineStyle(8 - ring * 2, [0x8800aa, 0xaa00aa, 0xcc00cc][ring], 0.9 - ring * 0.1);
                circle.drawCircle(0, 0, radius - ring * 20);
                summonCircle.addChild(circle);
            }
            
            // Complex sigil pattern
            const sigil = new PIXI.Graphics();
            sigil.lineStyle(5, 0xdd00dd, 0.8);
            
            // Draw complex geometric pattern
            for (let i = 0; i < 7; i++) {
                const angle = (i / 7) * Math.PI * 2;
                const x1 = Math.cos(angle) * 70;
                const y1 = Math.sin(angle) * 70;
                const x2 = Math.cos(angle + Math.PI) * 35;
                const y2 = Math.sin(angle + Math.PI) * 35;
                
                sigil.moveTo(x1, y1);
                sigil.lineTo(x2, y2);
            }
            summonCircle.addChild(sigil);
            
            // Mystical runes around outer circle
            for (let i = 0; i < 12; i++) {
                const rune = new PIXI.Graphics();
                rune.lineStyle(2, 0x9900bb);
                
                // Different rune shapes based on position
                if (i % 3 === 0) {
                    rune.drawRect(-4, -4, 8, 8);
                    rune.moveTo(-4, 0);
                    rune.lineTo(4, 0);
                } else if (i % 3 === 1) {
                    rune.drawCircle(0, 0, 4);
                    rune.moveTo(0, -6);
                    rune.lineTo(0, 6);
                } else {
                    rune.drawPolygon([-4, 4, 0, -4, 4, 4]);
                }
                
                const angle = (i / 12) * Math.PI * 2;
                rune.x = Math.cos(angle) * (radius + 30);
                rune.y = Math.sin(angle) * (radius + 30);
                rune.rotation = angle;
                summonCircle.addChild(rune);
                
                // Glowing runes
                const glowRune = () => {
                    if (rune.parent) {
                        rune.alpha = 0.7 + Math.sin(Date.now() * 0.01 + i) * 0.3;
                        requestAnimationFrame(glowRune);
                    }
                };
                glowRune();
            }
            
            this.app.stage.addChild(summonCircle);
            
            // Dramatic appearance with multiple rotations
            summonCircle.alpha = 0;
            summonCircle.scale.set(0.1);
            const appearAnimation = () => {
                if (summonCircle.alpha < 1) {
                    summonCircle.alpha += 0.08;
                    summonCircle.scale.x += 0.06;
                    summonCircle.scale.y += 0.06;
                    summonCircle.rotation += 0.03;
                    requestAnimationFrame(appearAnimation);
                }
            };
            appearAnimation();
            
            // Summon 7 powerful spirits with staggered timing
            for (let i = 0; i < spiritCount; i++) {
                setTimeout(() => {
                    const angle = (i / spiritCount) * Math.PI * 2;
                    const spiritX = targetX + Math.cos(angle) * radius;
                    const spiritY = targetY + Math.sin(angle) * radius;
                    
                    // Powerful emergence with soul lightning
                    const emergence = new PIXI.Graphics();
                    emergence.beginFill(0x6600aa, 0.9);
                    emergence.drawCircle(0, 0, 35);
                    emergence.endFill();
                    emergence.x = spiritX;
                    emergence.y = spiritY;
                    this.app.stage.addChild(emergence);
                    
                    // Lightning bolts
                    for (let bolt = 0; bolt < 4; bolt++) {
                        const lightning = new PIXI.Graphics();
                        lightning.lineStyle(3, 0xaa00ff);
                        const boltAngle = (bolt / 4) * Math.PI * 2;
                        lightning.moveTo(0, 0);
                        lightning.lineTo(Math.cos(boltAngle) * 40, Math.sin(boltAngle) * 40);
                        emergence.addChild(lightning);
                    }
                    
                    emergence.scale.set(0);
                    const emergeAnimation = () => {
                        if (emergence.scale.x < 1.8) {
                            emergence.scale.x += 0.12;
                            emergence.scale.y += 0.12;
                            emergence.rotation += 0.1;
                            emergence.alpha *= 0.96;
                            requestAnimationFrame(emergeAnimation);
                        } else if (emergence.parent) {
                            this.app.stage.removeChild(emergence);
                        }
                    };
                    emergeAnimation();
                    
                    setTimeout(() => {
                        this.createSoulSpirit(spiritX, spiritY, 3);
                    }, 800);
                }, i * 300);
            }
            
            // Powerful damage from advanced summoning
            this.checkAreaDamage(targetX, targetY, radius + 60, 55, 'soul');
            
            setTimeout(() => {
                if (summonCircle.parent) {
                    this.app.stage.removeChild(summonCircle);
                }
            }, 5000);
            
        } else if (level >= 4) {
            // Level 4: Master-level summoning with portal magic
            const spiritCount = 10;
            const radius = 150;
            
            const summonCircle = new PIXI.Container();
            summonCircle.x = targetX;
            summonCircle.y = targetY;
            
            // Massive multi-layered summoning array
            for (let ring = 0; ring < 5; ring++) {
                const circle = new PIXI.Graphics();
                const colors = [0xff00ff, 0xcc00cc, 0xaa00aa, 0x8800aa, 0x660088];
                circle.lineStyle(10 - ring, colors[ring], 1 - ring * 0.1);
                circle.drawCircle(0, 0, radius - ring * 25);
                summonCircle.addChild(circle);
                
                // Rotating rings
                const rotateRing = () => {
                    if (circle.parent) {
                        circle.rotation += (0.02 + ring * 0.01) * (ring % 2 === 0 ? 1 : -1);
                        requestAnimationFrame(rotateRing);
                    }
                };
                rotateRing();
            }
            
            // Master-level sigil
            const masterSigil = new PIXI.Graphics();
            masterSigil.lineStyle(6, 0xffaaff, 0.9);
            
            // Draw complex star pattern
            for (let layer = 0; layer < 3; layer++) {
                const points = 8 + layer * 2;
                for (let i = 0; i < points; i++) {
                    const angle1 = (i / points) * Math.PI * 2;
                    const angle2 = ((i + 1) / points) * Math.PI * 2;
                    const radius1 = 80 - layer * 20;
                    const radius2 = 40 - layer * 10;
                    
                    const x1 = Math.cos(angle1) * radius1;
                    const y1 = Math.sin(angle1) * radius1;
                    const x2 = Math.cos(angle2) * radius2;
                    const y2 = Math.sin(angle2) * radius2;
                    
                    masterSigil.moveTo(x1, y1);
                    masterSigil.lineTo(x2, y2);
                }
            }
            summonCircle.addChild(masterSigil);
            
            // Portal rifts at key points
            for (let i = 0; i < 8; i++) {
                const rift = new PIXI.Graphics();
                rift.lineStyle(4, 0x000000);
                rift.beginFill(0x220044, 0.8);
                rift.drawEllipse(0, 0, 15, 5);
                rift.endFill();
                
                const angle = (i / 8) * Math.PI * 2;
                rift.x = Math.cos(angle) * 100;
                rift.y = Math.sin(angle) * 100;
                rift.rotation = angle + Math.PI / 2;
                summonCircle.addChild(rift);
                
                // Pulsing rifts
                const pulseRift = () => {
                    if (rift.parent) {
                        rift.scale.set(0.8 + Math.sin(Date.now() * 0.015 + i) * 0.4);
                        rift.alpha = 0.6 + Math.sin(Date.now() * 0.02 + i) * 0.4;
                        requestAnimationFrame(pulseRift);
                    }
                };
                pulseRift();
            }
            
            // Ancient runes
            for (let i = 0; i < 16; i++) {
                const rune = new PIXI.Graphics();
                rune.lineStyle(3, 0xbb00bb);
                
                // Complex rune shapes
                const runeType = i % 4;
                switch (runeType) {
                    case 0:
                        rune.drawRect(-6, -6, 12, 12);
                        rune.moveTo(-6, 0);
                        rune.lineTo(6, 0);
                        rune.moveTo(0, -6);
                        rune.lineTo(0, 6);
                        break;
                    case 1:
                        rune.drawCircle(0, 0, 6);
                        rune.beginHole();
                        rune.drawCircle(0, 0, 3);
                        rune.endHole();
                        break;
                    case 2:
                        rune.drawPolygon([-6, 6, 0, -6, 6, 6, 0, 2]);
                        break;
                    case 3:
                        for (let j = 0; j < 6; j++) {
                            const spineAngle = (j / 6) * Math.PI * 2;
                            rune.moveTo(0, 0);
                            rune.lineTo(Math.cos(spineAngle) * 6, Math.sin(spineAngle) * 6);
                        }
                        break;
                }
                
                const angle = (i / 16) * Math.PI * 2;
                rune.x = Math.cos(angle) * (radius + 40);
                rune.y = Math.sin(angle) * (radius + 40);
                rune.rotation = angle;
                summonCircle.addChild(rune);
                
                // Mystical glow
                const glowRune = () => {
                    if (rune.parent) {
                        rune.alpha = 0.5 + Math.sin(Date.now() * 0.008 + i) * 0.5;
                        rune.scale.set(0.8 + Math.sin(Date.now() * 0.01 + i) * 0.3);
                        requestAnimationFrame(glowRune);
                    }
                };
                glowRune();
            }
            
            this.app.stage.addChild(summonCircle);
            
            // Epic appearance animation
            summonCircle.alpha = 0;
            summonCircle.scale.set(0.05);
            const appearAnimation = () => {
                if (summonCircle.alpha < 1) {
                    summonCircle.alpha += 0.05;
                    summonCircle.scale.x += 0.04;
                    summonCircle.scale.y += 0.04;
                    summonCircle.rotation += 0.02;
                    requestAnimationFrame(appearAnimation);
                }
            };
            appearAnimation();
            
            // Summon 10 master-level spirits
            for (let i = 0; i < spiritCount; i++) {
                setTimeout(() => {
                    const angle = (i / spiritCount) * Math.PI * 2;
                    const spiritX = targetX + Math.cos(angle) * radius;
                    const spiritY = targetY + Math.sin(angle) * radius;
                    
                    // Epic portal emergence
                    const portal = new PIXI.Graphics();
                    portal.beginFill(0x000000);
                    portal.drawCircle(0, 0, 40);
                    portal.endFill();
                    portal.lineStyle(4, 0xff00ff);
                    portal.drawCircle(0, 0, 45);
                    portal.x = spiritX;
                    portal.y = spiritY;
                    this.app.stage.addChild(portal);
                    
                    // Portal energy spirals
                    for (let spiral = 0; spiral < 3; spiral++) {
                        const spiralGraphic = new PIXI.Graphics();
                        spiralGraphic.lineStyle(2, [0xff00ff, 0xcc00cc, 0xaa00aa][spiral]);
                        
                        for (let point = 0; point < 20; point++) {
                            const spiralAngle = (point / 20) * Math.PI * 4 + spiral * Math.PI / 3;
                            const spiralRadius = 20 - (point / 20) * 18;
                            const x = Math.cos(spiralAngle) * spiralRadius;
                            const y = Math.sin(spiralAngle) * spiralRadius;
                            
                            if (point === 0) {
                                spiralGraphic.moveTo(x, y);
                            } else {
                                spiralGraphic.lineTo(x, y);
                            }
                        }
                        portal.addChild(spiralGraphic);
                        
                        // Rotating spirals
                        const rotateSpiral = () => {
                            if (spiralGraphic.parent) {
                                spiralGraphic.rotation += 0.2 + spiral * 0.1;
                                requestAnimationFrame(rotateSpiral);
                            }
                        };
                        rotateSpiral();
                    }
                    
                    portal.scale.set(0);
                    const portalAnimation = () => {
                        if (portal.scale.x < 2) {
                            portal.scale.x += 0.1;
                            portal.scale.y += 0.1;
                            portal.rotation += 0.05;
                            portal.alpha *= 0.97;
                            requestAnimationFrame(portalAnimation);
                        } else if (portal.parent) {
                            this.app.stage.removeChild(portal);
                        }
                    };
                    portalAnimation();
                    
                    setTimeout(() => {
                        this.createSoulSpirit(spiritX, spiritY, 4);
                    }, 1000);
                }, i * 200);
            }
            
            // Master-level damage from epic summoning
            this.checkAreaDamage(targetX, targetY, radius + 80, 70, 'soul');
            
            setTimeout(() => {
                if (summonCircle.parent) {
                    const fadeAnimation = () => {
                        summonCircle.alpha *= 0.95;
                        summonCircle.rotation += 0.02;
                        if (summonCircle.alpha > 0.05) {
                            requestAnimationFrame(fadeAnimation);
                        } else if (summonCircle.parent) {
                            this.app.stage.removeChild(summonCircle);
                        }
                    };
                    fadeAnimation();
                }
            }, 6000);
        }
    }
    
    createSoulSpirit(x, y, level = 1) {
        const spiritContainer = new PIXI.Container();
        spiritContainer.x = x;
        spiritContainer.y = y;
        this.app.stage.addChild(spiritContainer);
        
        // Create enhanced soul spirit based on level
        const spiritSize = 12 + level * 3;
        const spiritBody = new PIXI.Graphics();
        spiritBody.beginFill(0xaa00aa, 0.8 + level * 0.05);
        spiritBody.drawCircle(0, -8, spiritSize);
        spiritBody.endFill();
        
        // Enhanced spirit aura
        const aura = new PIXI.Graphics();
        aura.beginFill(0x8800aa, 0.4);
        aura.drawCircle(0, -8, spiritSize + 8);
        aura.endFill();
        
        // Spirit eyes with level-based intensity
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0xff00ff);
        leftEye.drawCircle(-5, -12, 2 + level * 0.5);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0xff00ff);
        rightEye.drawCircle(5, -12, 2 + level * 0.5);
        rightEye.endFill();
        
        // Enhanced spirit trail
        const trail = new PIXI.Graphics();
        trail.beginFill(0x660066, 0.6);
        const trailSize = 8 + level * 2;
        trail.drawPolygon([0, 5, -trailSize, 20 + level * 3, trailSize, 20 + level * 3]);
        trail.endFill();
        
        // Soul particles around spirit
        const particles = [];
        for (let i = 0; i < 4 + level; i++) {
            const particle = new PIXI.Graphics();
            particle.beginFill(0xcc00cc, 0.7);
            particle.drawCircle(0, 0, 1 + Math.random() * 2);
            particle.endFill();
            
            const angle = (i / (4 + level)) * Math.PI * 2;
            particle.x = Math.cos(angle) * (spiritSize + 5);
            particle.y = Math.sin(angle) * (spiritSize + 5) - 8;
            particles.push({ sprite: particle, angle: angle, baseRadius: spiritSize + 5 });
            spiritContainer.addChild(particle);
        }
        
        spiritContainer.addChild(aura);
        spiritContainer.addChild(trail);
        spiritContainer.addChild(spiritBody);
        spiritContainer.addChild(leftEye);
        spiritContainer.addChild(rightEye);
        
        // Enhanced stats based on level
        spiritContainer.spellType = 'soulSpirit';
        spiritContainer.damage = 25 + level * 8;
        spiritContainer.health = 40 + level * 15;
        spiritContainer.maxHealth = spiritContainer.health;
        spiritContainer.speed = 80 + level * 10;
        spiritContainer.level = level;
        spiritContainer.particles = particles;
        
        // Enhanced floating and particle animation
        spiritContainer.floatOffset = Math.random() * Math.PI * 2;
        const animateSpirit = () => {
            if (spiritContainer.parent) {
                spiritContainer.floatOffset += 0.05;
                const floatY = Math.sin(spiritContainer.floatOffset) * 5;
                spiritBody.y = -8 + floatY;
                leftEye.y = -12 + floatY;
                rightEye.y = -12 + floatY;
                aura.y = -8 + floatY;
                
                // Animate particles orbiting around spirit
                particles.forEach((particle, index) => {
                    particle.angle += 0.1;
                    particle.sprite.x = Math.cos(particle.angle) * particle.baseRadius;
                    particle.sprite.y = Math.sin(particle.angle) * particle.baseRadius - 8 + floatY;
                    particle.sprite.alpha = 0.5 + Math.sin(particle.angle * 2) * 0.3;
                });
                
                // Pulsing aura
                aura.alpha = 0.3 + Math.sin(spiritContainer.floatOffset * 2) * 0.2;
                
                requestAnimationFrame(animateSpirit);
            }
        };
        animateSpirit();
        
        this.soulSpirits = this.soulSpirits || new Map();
        const spiritId = `spirit_${Date.now()}_${Math.random()}`;
        this.soulSpirits.set(spiritId, spiritContainer);
        
        // Spirit duration increases with level
        const duration = 20000 + level * 5000;
        setTimeout(() => {
            if (spiritContainer.parent) {
                // Death animation
                const fadeAnimation = () => {
                    spiritContainer.alpha *= 0.9;
                    spiritContainer.scale.x *= 0.98;
                    spiritContainer.scale.y *= 0.98;
                    if (spiritContainer.alpha > 0.1) {
                        requestAnimationFrame(fadeAnimation);
                    } else if (spiritContainer.parent) {
                        this.app.stage.removeChild(spiritContainer);
                        this.soulSpirits.delete(spiritId);
                    }
                };
                fadeAnimation();
            }
        }, duration);
    }
    
    createSoulStorm(targetX, targetY, level) {
        // Enhanced soul storm with level scaling
        const stormContainer = new PIXI.Container();
        stormContainer.x = targetX;
        stormContainer.y = targetY;
        
        // Create multiple soul tornadoes based on level
        const tornadoCount = Math.min(5, 2 + level);
        for (let tornado = 0; tornado < tornadoCount; tornado++) {
            const tornadoAngle = (tornado / tornadoCount) * Math.PI * 2;
            const tornadoDistance = tornado === 0 ? 0 : 80 + tornado * 40;
            const tornadoX = Math.cos(tornadoAngle) * tornadoDistance;
            const tornadoY = Math.sin(tornadoAngle) * tornadoDistance;
            
            const singleTornado = new PIXI.Container();
            singleTornado.x = tornadoX;
            singleTornado.y = tornadoY;
            
            // Create soul tornado rings
            for (let ring = 0; ring < 10 + level; ring++) {
                const spiral = new PIXI.Graphics();
                spiral.lineStyle(6 + level, 0x8800aa, 0.9 - ring * 0.08);
                
                const radius = 20 + ring * (15 + level * 2);
                const points = 40;
                
                for (let i = 0; i <= points; i++) {
                    const angle = (i / points) * Math.PI * (8 + level); // More rotations with level
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    
                    if (i === 0) {
                        spiral.moveTo(x, y);
                    } else {
                        spiral.lineTo(x, y);
                    }
                }
                
                singleTornado.addChild(spiral);
            }
            
            stormContainer.addChild(singleTornado);
        }
        
        // Enhanced soul particles
        const particleCount = 80 + level * 20;
        for (let i = 0; i < particleCount; i++) {
            setTimeout(() => {
                const particle = new PIXI.Graphics();
                particle.beginFill(0xaa00aa, 0.7 + level * 0.05);
                particle.drawCircle(0, 0, 2 + Math.random() * 3);
                particle.endFill();
                
                // Add soul faces to some particles
                if (Math.random() > 0.7) {
                    const face = new PIXI.Graphics();
                    face.lineStyle(1, 0xff00ff);
                    face.drawCircle(-1, -1, 0.5);
                    face.drawCircle(1, -1, 0.5);
                    face.moveTo(-1, 1);
                    face.lineTo(1, 1);
                    particle.addChild(face);
                }
                
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * (200 + level * 50) + 100;
                particle.x = Math.cos(angle) * distance;
                particle.y = Math.sin(angle) * distance;
                stormContainer.addChild(particle);
                
                // Enhanced spiral animation
                const spiralSpeed = 4 + level;
                const spiralAnimation = () => {
                    const dx = -particle.x;
                    const dy = -particle.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 15) {
                        // Add spiral motion
                        const spiralAngle = Math.atan2(dy, dx) + 0.5;
                        particle.x += Math.cos(spiralAngle) * spiralSpeed;
                        particle.y += Math.sin(spiralAngle) * spiralSpeed;
                        particle.rotation += 0.3;
                        particle.alpha = Math.max(0.3, 1 - (200 - dist) / 200);
                        requestAnimationFrame(spiralAnimation);
                    } else if (particle.parent) {
                        // Create mini explosion when particle reaches center
                        const explosion = new PIXI.Graphics();
                        explosion.beginFill(0xcc00cc, 0.8);
                        explosion.drawCircle(0, 0, 8);
                        explosion.endFill();
                        explosion.x = particle.x;
                        explosion.y = particle.y;
                        stormContainer.addChild(explosion);
                        
                        setTimeout(() => {
                            if (explosion.parent) stormContainer.removeChild(explosion);
                        }, 200);
                        
                        stormContainer.removeChild(particle);
                    }
                };
                spiralAnimation();
            }, i * 20);
        }
        
        // Soul energy lightning between tornadoes
        if (tornadoCount > 1) {
            for (let i = 0; i < tornadoCount; i++) {
                setTimeout(() => {
                    const lightning = new PIXI.Graphics();
                    lightning.lineStyle(4 + level, 0xdd00dd, 0.8);
                    
                    const startAngle = (i / tornadoCount) * Math.PI * 2;
                    const endAngle = ((i + 1) / tornadoCount) * Math.PI * 2;
                    const startDist = 80 + i * 40;
                    const endDist = 80 + ((i + 1) % tornadoCount) * 40;
                    
                    const startX = Math.cos(startAngle) * startDist;
                    const startY = Math.sin(startAngle) * startDist;
                    const endX = Math.cos(endAngle) * endDist;
                    const endY = Math.sin(endAngle) * endDist;
                    
                    // Create jagged lightning
                    lightning.moveTo(startX, startY);
                    const segments = 8;
                    for (let j = 1; j <= segments; j++) {
                        const progress = j / segments;
                        const x = startX + (endX - startX) * progress + (Math.random() - 0.5) * 30;
                        const y = startY + (endY - startY) * progress + (Math.random() - 0.5) * 30;
                        lightning.lineTo(x, y);
                    }
                    
                    stormContainer.addChild(lightning);
                    
                    setTimeout(() => {
                        if (lightning.parent) stormContainer.removeChild(lightning);
                    }, 500);
                }, i * 200);
            }
        }
        
        this.app.stage.addChild(stormContainer);
        
        // Enhanced spinning animation with multiple directions
        const spinAnimation = () => {
            if (stormContainer.parent) {
                stormContainer.rotation += 0.3 + level * 0.1;
                
                // Counter-rotate individual tornadoes
                stormContainer.children.forEach((child, index) => {
                    if (child.children) {
                        child.rotation -= 0.5 + level * 0.15;
                    }
                });
                
                requestAnimationFrame(spinAnimation);
            }
        };
        spinAnimation();
        
        // Enhanced damage waves with level scaling
        const waveCount = 8 + level * 2;
        for (let wave = 0; wave < waveCount; wave++) {
            setTimeout(() => {
                const waveRadius = 100 + wave * (25 + level * 5);
                const waveDamage = 45 + level * 15;
                this.checkAreaDamage(targetX, targetY, waveRadius, waveDamage, 'soul');
                
                // Visual wave effect
                const waveRing = new PIXI.Graphics();
                waveRing.lineStyle(6, 0xaa00aa, 0.7);
                waveRing.drawCircle(targetX, targetY, waveRadius);
                this.app.stage.addChild(waveRing);
                
                setTimeout(() => {
                    if (waveRing.parent) this.app.stage.removeChild(waveRing);
                }, 600);
            }, wave * 300);
        }
        
        setTimeout(() => {
            if (stormContainer.parent) {
                this.app.stage.removeChild(stormContainer);
            }
        }, 6000 + level * 1000);
    }
    
    createDeathIncarnate(targetX, targetY, level) {
        // SSS Soul Spell - Summons Death itself with incredible power
        const deathContainer = new PIXI.Container();
        deathContainer.x = targetX;
        deathContainer.y = targetY;
        
        // Massive death portal with multiple layers
        const portalLayers = [];
        for (let layer = 0; layer < 5; layer++) {
            const portal = new PIXI.Graphics();
            portal.beginFill(0x000000, 0.9 - layer * 0.1);
            portal.lineStyle(8 - layer, 0x8800aa, 0.9 - layer * 0.1);
            portal.drawCircle(0, 0, 120 - layer * 15);
            portal.endFill();
            portalLayers.push(portal);
            deathContainer.addChild(portal);
        }
        
        // Void distortion rings
        for (let ring = 0; ring < 8; ring++) {
            const distortion = new PIXI.Graphics();
            distortion.lineStyle(4, 0x440044, 0.6);
            distortion.drawCircle(0, 0, 140 + ring * 25);
            deathContainer.addChild(distortion);
        }
        
        // Animate portal opening
        portalLayers.forEach((portal, index) => {
            portal.scale.set(0);
            setTimeout(() => {
                const openAnimation = () => {
                    if (portal.scale.x < 1.2) {
                        portal.scale.x += 0.05;
                        portal.scale.y += 0.05;
                        portal.rotation += 0.02 * (index % 2 === 0 ? 1 : -1);
                        requestAnimationFrame(openAnimation);
                    }
                };
                openAnimation();
            }, index * 200);
        });
        
        // Death incarnate emerging with dramatic effect
        setTimeout(() => {
            // Create Death figure with enhanced details
            const deathFigure = new PIXI.Graphics();
            
            // Death's massive robe with soul patterns
            deathFigure.beginFill(0x1a001a);
            deathFigure.lineStyle(5, 0x000000);
            deathFigure.drawRect(-50, -30, 100, 120);
            deathFigure.endFill();
            
            // Soul patterns on robe
            for (let i = 0; i < 12; i++) {
                const soulPattern = new PIXI.Graphics();
                soulPattern.lineStyle(2, 0x660066);
                soulPattern.drawCircle(0, 0, 3);
                soulPattern.x = (Math.random() - 0.5) * 80;
                soulPattern.y = (Math.random() - 0.5) * 100 + 20;
                deathFigure.addChild(soulPattern);
            }
            
            // Death's hood with dark void
            const hood = new PIXI.Graphics();
            hood.beginFill(0x000000);
            hood.lineStyle(4, 0x330033);
            hood.drawCircle(0, -60, 35);
            hood.endFill();
            
            // Glowing soul-fire eyes
            const leftEye = new PIXI.Graphics();
            leftEye.beginFill(0xff0000);
            leftEye.drawCircle(-12, -65, 6);
            leftEye.endFill();
            leftEye.beginFill(0xff6600);
            leftEye.drawCircle(-12, -65, 3);
            leftEye.endFill();
            
            const rightEye = new PIXI.Graphics();
            rightEye.beginFill(0xff0000);
            rightEye.drawCircle(12, -65, 6);
            rightEye.endFill();
            rightEye.beginFill(0xff6600);
            rightEye.drawCircle(12, -65, 3);
            rightEye.endFill();
            
            // Massive scythe with soul energy
            const scythe = new PIXI.Graphics();
            scythe.lineStyle(8, 0x444444);
            scythe.moveTo(30, -40);
            scythe.lineTo(80, -100);
            scythe.lineStyle(6, 0x666666);
            scythe.moveTo(30, -40);
            scythe.lineTo(80, -100);
            
            // Scythe blade
            scythe.lineStyle(4, 0x888888);
            scythe.beginFill(0x999999);
            scythe.drawPolygon([70, -110, 90, -90, 85, -85, 75, -105]);
            scythe.endFill();
            
            // Soul energy on scythe
            const scytheAura = new PIXI.Graphics();
            scytheAura.lineStyle(3, 0xaa00aa, 0.8);
            scytheAura.moveTo(30, -40);
            scytheAura.lineTo(80, -100);
            scytheAura.drawCircle(80, -100, 15);
            
            // Death's cape/wings
            const leftWing = new PIXI.Graphics();
            leftWing.beginFill(0x220022, 0.8);
            leftWing.lineStyle(3, 0x000000);
            leftWing.drawPolygon([-50, -20, -120, -60, -100, 40, -60, 60]);
            leftWing.endFill();
            
            const rightWing = new PIXI.Graphics();
            rightWing.beginFill(0x220022, 0.8);
            rightWing.lineStyle(3, 0x000000);
            rightWing.drawPolygon([50, -20, 120, -60, 100, 40, 60, 60]);
            rightWing.endFill();
            
            deathContainer.addChild(leftWing);
            deathContainer.addChild(rightWing);
            deathContainer.addChild(deathFigure);
            deathContainer.addChild(hood);
            deathContainer.addChild(leftEye);
            deathContainer.addChild(rightEye);
            deathContainer.addChild(scytheAura);
            deathContainer.addChild(scythe);
            
            // Animate Death's emergence
            deathFigure.y = 200;
            deathFigure.alpha = 0;
            const emergeAnimation = () => {
                if (deathFigure.y > -20) {
                    deathFigure.y -= 5;
                    deathFigure.alpha = Math.min(1, deathFigure.alpha + 0.05);
                    hood.y = deathFigure.y;
                    leftEye.y = deathFigure.y - 65;
                    rightEye.y = deathFigure.y - 65;
                    requestAnimationFrame(emergeAnimation);
                }
            };
            emergeAnimation();
            
            // Wing animation
            const wingAnimation = () => {
                if (deathContainer.parent) {
                    const wingFlap = Math.sin(Date.now() * 0.003) * 0.2;
                    leftWing.rotation = wingFlap;
                    rightWing.rotation = -wingFlap;
                    
                    // Eye glow pulsing
                    const eyeGlow = 0.8 + Math.sin(Date.now() * 0.01) * 0.2;
                    leftEye.alpha = eyeGlow;
                    rightEye.alpha = eyeGlow;
                    
                    requestAnimationFrame(wingAnimation);
                }
            };
            wingAnimation();
            
            // Death aura expanding with soul lightning
            for (let wave = 0; wave < 15; wave++) {
                setTimeout(() => {
                    const aura = new PIXI.Graphics();
                    aura.lineStyle(12, 0x8800aa, 0.9 - wave * 0.05);
                    aura.drawCircle(0, 0, 150 + wave * 80);
                    deathContainer.addChild(aura);
                    
                    // Soul lightning strikes
                    for (let lightning = 0; lightning < 5; lightning++) {
                        const bolt = new PIXI.Graphics();
                        bolt.lineStyle(6, 0xcc00cc);
                        const angle = (lightning / 5) * Math.PI * 2;
                        const distance = 150 + wave * 80;
                        bolt.moveTo(0, 0);
                        bolt.lineTo(Math.cos(angle) * distance, Math.sin(angle) * distance);
                        deathContainer.addChild(bolt);
                        
                        setTimeout(() => {
                            if (bolt.parent) deathContainer.removeChild(bolt);
                        }, 300);
                    }
                    
                    // Devastating damage in expanding waves
                    this.checkAreaDamage(targetX, targetY, 150 + wave * 80, 120 + wave * 10, 'soul');
                    
                    setTimeout(() => {
                        if (aura.parent) {
                            deathContainer.removeChild(aura);
                        }
                    }, 1500);
                }, wave * 150);
            }
            
            // Summon an army of enhanced soul spirits
            this.createSpiritArmy(targetX, targetY, 10); // Maximum level spirits
            
            // Create additional death effects
            for (let i = 0; i < 20; i++) {
                setTimeout(() => {
                    const skull = new PIXI.Graphics();
                    skull.beginFill(0xeeeeee);
                    skull.lineStyle(2, 0x000000);
                    skull.drawCircle(0, 0, 8);
                    skull.beginFill(0x000000);
                    skull.drawCircle(-3, -2, 2);
                    skull.drawCircle(3, -2, 2);
                    skull.drawRect(-4, 2, 8, 3);
                    skull.endFill();
                    
                    const angle = (i / 20) * Math.PI * 2;
                    skull.x = targetX + Math.cos(angle) * 300;
                    skull.y = targetY + Math.sin(angle) * 300;
                    this.app.stage.addChild(skull);
                    
                    // Skulls float toward Death
                    const floatAnimation = () => {
                        const dx = targetX - skull.x;
                        const dy = targetY - skull.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        if (dist > 50) {
                            skull.x += (dx / dist) * 3;
                            skull.y += (dy / dist) * 3;
                            skull.rotation += 0.1;
                            requestAnimationFrame(floatAnimation);
                        } else if (skull.parent) {
                            this.app.stage.removeChild(skull);
                        }
                    };
                    floatAnimation();
                }, i * 100);
            }
            
        }, 1500);
        
        this.app.stage.addChild(deathContainer);
        
        // Screen darkening effect
        const darkOverlay = new PIXI.Graphics();
        darkOverlay.beginFill(0x000000, 0.5);
        darkOverlay.drawRect(-this.app.screen.width, -this.app.screen.height, this.app.screen.width * 3, this.app.screen.height * 3);
        darkOverlay.endFill();
        this.app.stage.addChild(darkOverlay);
        
        // Gradual fade out of darkness
        setTimeout(() => {
            const fadeAnimation = () => {
                darkOverlay.alpha *= 0.95;
                if (darkOverlay.alpha > 0.01) {
                    requestAnimationFrame(fadeAnimation);
                } else if (darkOverlay.parent) {
                    this.app.stage.removeChild(darkOverlay);
                }
            };
            fadeAnimation();
        }, 2000);
        
        setTimeout(() => {
            if (deathContainer.parent) {
                this.app.stage.removeChild(deathContainer);
            }
        }, 10000);
    }
    
    showSoulMagicUnlockEffect(x, y) {
        // Create dramatic soul magic unlock effect
        const unlockEffect = new PIXI.Graphics();
        unlockEffect.beginFill(0x8800aa, 0.8);
        unlockEffect.drawCircle(0, 0, 150);
        unlockEffect.endFill();
        
        unlockEffect.x = x;
        unlockEffect.y = y;
        this.app.stage.addChild(unlockEffect);
        
        // Create soul particles
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                const particle = new PIXI.Graphics();
                particle.beginFill(0xaa00aa);
                particle.drawCircle(0, 0, 4);
                particle.endFill();
                
                const angle = (i / 30) * Math.PI * 2;
                particle.x = x + Math.cos(angle) * 100;
                particle.y = y + Math.sin(angle) * 100;
                this.app.stage.addChild(particle);
                
                // Animate particles
                const velX = Math.cos(angle) * 3;
                const velY = Math.sin(angle) * 3 - 2;
                const animateParticle = () => {
                    particle.x += velX;
                    particle.y += velY;
                    particle.alpha *= 0.95;
                    
                    if (particle.alpha > 0.1 && particle.parent) {
                        requestAnimationFrame(animateParticle);
                    } else if (particle.parent) {
                        this.app.stage.removeChild(particle);
                    }
                };
                animateParticle();
            }, i * 50);
        }
        
        // Show unlock message
        if (ui) {
            ui.showSoulMagicUnlock();
        }
        
        setTimeout(() => {
            if (unlockEffect.parent) {
                this.app.stage.removeChild(unlockEffect);
            }
        }, 3000);
    }

    showSoulLevelUpEffect(x, y, level) {
        // Create soul magic level up effect
        const levelUpEffect = new PIXI.Container();
        levelUpEffect.x = x;
        levelUpEffect.y = y;
        
        // Soul energy burst
        const burst = new PIXI.Graphics();
        burst.beginFill(0xaa00aa, 0.8);
        burst.drawCircle(0, 0, 80 + level * 10);
        burst.endFill();
        levelUpEffect.addChild(burst);
        
        // Level indicator
        const levelText = new PIXI.Text(`SOUL LEVEL ${level}`, {
            fontSize: 24,
            fill: 0xffffff,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            stroke: 0xaa00aa,
            strokeThickness: 4
        });
        levelText.anchor.set(0.5);
        levelText.y = -30;
        levelUpEffect.addChild(levelText);
        
        // Soul spiral
        const spiral = new PIXI.Graphics();
        spiral.lineStyle(6, 0xcc00cc);
        for (let i = 0; i < level * 2; i++) {
            const angle = (i / (level * 2)) * Math.PI * 4;
            const radius = i * 3;
            const pointX = Math.cos(angle) * radius;
            const pointY = Math.sin(angle) * radius;
            
            if (i === 0) {
                spiral.moveTo(pointX, pointY);
            } else {
                spiral.lineTo(pointX, pointY);
            }
        }
        levelUpEffect.addChild(spiral);
        
        this.app.stage.addChild(levelUpEffect);
        
        // Animate level up effect
        levelUpEffect.scale.set(0.1);
        const expandAnimation = () => {
            if (levelUpEffect.scale.x < 1.5) {
                levelUpEffect.scale.x += 0.1;
                levelUpEffect.scale.y += 0.1;
                levelUpEffect.rotation += 0.1;
                requestAnimationFrame(expandAnimation);
            }
        };
        expandAnimation();
        
        setTimeout(() => {
            if (levelUpEffect.parent) {
                this.app.stage.removeChild(levelUpEffect);
            }
        }, 2000);
    }

    updateSpellSelection() {
        if (ui && ui.updateSpellSelection) {
            ui.updateSpellSelection();
        }
    }

    updateWallPreview() {
        // Wall preview logic for earth magic
        if (this.selectedSpell === 'earth' && this.currentPlayer) {
            if (!this.wallPreview) {
                this.wallPreview = new PIXI.Graphics();
                this.wallPreview.alpha = 0.5;
                this.app.stage.addChild(this.wallPreview);
            }

            const worldX = this.mousePosition.x + this.camera.x;
            const worldY = this.mousePosition.y + this.camera.y;
            
            this.wallPreview.clear();
            this.wallPreview.lineStyle(2, 0x44aa44);
            this.wallPreview.beginFill(0x44aa44, 0.3);
            this.wallPreview.drawRect(-12.5, -60, 25, 120);
            this.wallPreview.endFill();
            
            this.wallPreview.x = worldX;
            this.wallPreview.y = worldY;
            
            // Orient towards player
            const dx = worldX - this.currentPlayer.x;
            const dy = worldY - this.currentPlayer.y;
            const angle = Math.atan2(dy, dx);
            this.wallPreview.rotation = angle + Math.PI / 2;
        } else if (this.wallPreview) {
            this.wallPreview.visible = false;
        }
    }

    updateHealthRegeneration() {
        if (this.currentPlayer && this.currentPlayer.playerData) {
            const currentHealth = this.currentPlayer.playerData.health;
            const maxHealth = this.currentPlayer.playerData.maxHealth;
            
            if (currentHealth < maxHealth) {
                // Regenerate 0.5% of max health per second (rounded up)
                const regenAmount = Math.ceil(maxHealth * 0.005);
                const newHealth = Math.min(maxHealth, currentHealth + regenAmount);
                
                if (newHealth !== currentHealth) {
                    this.currentPlayer.playerData.health = newHealth;
                    
                    // Update health bar
                    ui.updatePlayerInfo(this.currentPlayer.playerData);
                    
                    // Send to server
                    client.socket.emit('healthRegen', { health: newHealth });
                }
            }
        }
    }

    // SSS-Level Spell Animations
    createApocalypseFire(targetX, targetY, level) {
        // World-ending flames that consume everything
        const apocalypseContainer = new PIXI.Container();
        apocalypseContainer.x = targetX;
        apocalypseContainer.y = targetY;
        
        // Create massive fire rings expanding outward
        for (let ring = 0; ring < 8; ring++) {
            setTimeout(() => {
                const fireRing = new PIXI.Graphics();
                fireRing.lineStyle(20, 0xff0000, 0.9);
                fireRing.lineStyle(15, 0xff4400, 0.8);
                fireRing.lineStyle(10, 0xff8800, 0.7);
                fireRing.lineStyle(5, 0xffff00, 0.9);
                
                const radius = 100 + ring * 80;
                fireRing.drawCircle(0, 0, radius);
                apocalypseContainer.addChild(fireRing);
                
                // Animate ring expansion and fade
                fireRing.alpha = 0;
                const fadeIn = () => {
                    if (fireRing.alpha < 1) {
                        fireRing.alpha += 0.1;
                        fireRing.scale.x += 0.05;
                        fireRing.scale.y += 0.05;
                        requestAnimationFrame(fadeIn);
                    }
                };
                fadeIn();
                
                // Damage waves
                this.checkAreaDamage(targetX, targetY, radius, 100, 'fire');
                
                setTimeout(() => {
                    if (fireRing.parent) {
                        apocalypseContainer.removeChild(fireRing);
                    }
                }, 3000);
            }, ring * 300);
        }
        
        // Create fire pillars shooting up
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const angle = (i / 12) * Math.PI * 2;
                const distance = 150 + Math.random() * 200;
                const pillarX = targetX + Math.cos(angle) * distance;
                const pillarY = targetY + Math.sin(angle) * distance;
                
                const pillar = new PIXI.Graphics();
                pillar.beginFill(0xff4400, 0.8);
                pillar.drawRect(-20, 0, 40, -400);
                pillar.endFill();
                
                pillar.x = pillarX;
                pillar.y = pillarY;
                this.app.stage.addChild(pillar);
                
                this.checkAreaDamage(pillarX, pillarY, 50, 80, 'fire');
                
                setTimeout(() => {
                    if (pillar.parent) {
                        this.app.stage.removeChild(pillar);
                    }
                }, 2000);
            }, i * 200);
        }
        
        this.app.stage.addChild(apocalypseContainer);
        
        setTimeout(() => {
            if (apocalypseContainer.parent) {
                this.app.stage.removeChild(apocalypseContainer);
            }
        }, 5000);
    }
    
    createAbsoluteZero(targetX, targetY, level) {
        // Freezes time and space itself
        const freezeContainer = new PIXI.Container();
        freezeContainer.x = targetX;
        freezeContainer.y = targetY;
        
        // Create ice crystals spreading outward
        for (let layer = 0; layer < 6; layer++) {
            const crystal = new PIXI.Graphics();
            crystal.beginFill(0x88ccff, 0.9 - layer * 0.1);
            crystal.lineStyle(4, 0xffffff, 0.8);
            
            // Create hexagonal ice crystal
            const points = [];
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const radius = 50 + layer * 40;
                points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
            crystal.drawPolygon(points);
            crystal.endFill();
            
            crystal.rotation = (layer * Math.PI / 6);
            freezeContainer.addChild(crystal);
        }
        
        // Freeze effect on players
        this.players.forEach((player, playerId) => {
            const dx = player.x - targetX;
            const dy = player.y - targetY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 300) {
                // Create freeze effect
                const freezeEffect = new PIXI.Graphics();
                freezeEffect.beginFill(0x88ccff, 0.6);
                freezeEffect.drawCircle(player.x, player.y, 30);
                freezeEffect.endFill();
                this.app.stage.addChild(freezeEffect);
                
                setTimeout(() => {
                    if (freezeEffect.parent) {
                        this.app.stage.removeChild(freezeEffect);
                    }
                }, 3000);
            }
        });
        
        this.app.stage.addChild(freezeContainer);
        this.checkAreaDamage(targetX, targetY, 300, 90, 'ice');
        
        // Spinning animation
        const spinAnimation = () => {
            if (freezeContainer.parent) {
                freezeContainer.rotation += 0.02;
                requestAnimationFrame(spinAnimation);
            }
        };
        spinAnimation();
        
        setTimeout(() => {
            if (freezeContainer.parent) {
                this.app.stage.removeChild(freezeContainer);
            }
        }, 4000);
    }
    
    createGodsWrath(targetX, targetY, level) {
        // Divine lightning from the heavens
        const wrathContainer = new PIXI.Container();
        
        // Create divine portal in the sky
        const portal = new PIXI.Graphics();
        portal.beginFill(0xffffff, 0.9);
        portal.lineStyle(8, 0xffff00);
        portal.drawCircle(0, 0, 100);
        portal.endFill();
        
        portal.x = targetX;
        portal.y = targetY - 500;
        this.app.stage.addChild(portal);
        
        // Multiple divine lightning strikes
        for (let i = 0; i < 15; i++) {
            setTimeout(() => {
                const angle = (i / 15) * Math.PI * 2;
                const distance = Math.random() * 300;
                const strikeX = targetX + Math.cos(angle) * distance;
                const strikeY = targetY + Math.sin(angle) * distance;
                
                const lightning = new PIXI.Graphics();
                
                // Create divine lightning bolt
                lightning.lineStyle(12, 0x000000);
                lightning.moveTo(strikeX, strikeY - 500);
                lightning.lineTo(strikeX, strikeY);
                
                lightning.lineStyle(8, 0xffffff);
                lightning.moveTo(strikeX, strikeY - 500);
                lightning.lineTo(strikeX, strikeY);
                
                lightning.lineStyle(4, 0xffff00);
                lightning.moveTo(strikeX, strikeY - 500);
                lightning.lineTo(strikeX, strikeY);
                
                this.app.stage.addChild(lightning);
                this.checkAreaDamage(strikeX, strikeY, 80, 110, 'lightning');
                
                // Divine explosion at impact
                const explosion = new PIXI.Graphics();
                explosion.beginFill(0xffffff, 0.8);
                explosion.drawCircle(0, 0, 60);
                explosion.endFill();
                explosion.x = strikeX;
                explosion.y = strikeY;
                this.app.stage.addChild(explosion);
                
                setTimeout(() => {
                    if (lightning.parent) this.app.stage.removeChild(lightning);
                    if (explosion.parent) this.app.stage.removeChild(explosion);
                }, 800);
            }, i * 100);
        }
        
        setTimeout(() => {
            if (portal.parent) {
                this.app.stage.removeChild(portal);
            }
        }, 3000);
    }
    
    createContinentalDrift(targetX, targetY, level) {
        // Moves entire landmasses
        const driftContainer = new PIXI.Container();
        driftContainer.x = targetX;
        driftContainer.y = targetY;
        
        // Create massive earth plates
        for (let plate = 0; plate < 4; plate++) {
            const earthPlate = new PIXI.Graphics();
            earthPlate.beginFill(0x8B4513);
            earthPlate.lineStyle(8, 0x654321);
            
            const angle = (plate / 4) * Math.PI * 2;
            const points = [];
            for (let i = 0; i < 8; i++) {
                const pointAngle = angle + (i / 8) * Math.PI * 0.5;
                const radius = 200 + Math.random() * 100;
                points.push(Math.cos(pointAngle) * radius, Math.sin(pointAngle) * radius);
            }
            earthPlate.drawPolygon(points);
            earthPlate.endFill();
            
            driftContainer.addChild(earthPlate);
            
            // Animate plate movement
            const moveAnimation = () => {
                const moveDistance = 5;
                earthPlate.x += Math.cos(angle) * moveDistance;
                earthPlate.y += Math.sin(angle) * moveDistance;
                
                if (Math.abs(earthPlate.x) < 400) {
                    requestAnimationFrame(moveAnimation);
                }
            };
            setTimeout(() => moveAnimation(), plate * 500);
        }
        
        // Massive earthquake effect
        let shakeIntensity = 50;
        const shakeAnimation = () => {
            if (shakeIntensity > 0) {
                this.app.stage.x += (Math.random() - 0.5) * shakeIntensity;
                this.app.stage.y += (Math.random() - 0.5) * shakeIntensity;
                shakeIntensity *= 0.95;
                requestAnimationFrame(shakeAnimation);
            } else {
                this.app.stage.x = -this.camera.x;
                this.app.stage.y = -this.camera.y;
            }
        };
        shakeAnimation();
        
        this.app.stage.addChild(driftContainer);
        this.checkAreaDamage(targetX, targetY, 400, 95, 'earth');
        
        setTimeout(() => {
            if (driftContainer.parent) {
                this.app.stage.removeChild(driftContainer);
            }
        }, 6000);
    }
    
    createAtmosphericCollapse(targetX, targetY, level) {
        // Destroys the very air itself
        const collapseContainer = new PIXI.Container();
        collapseContainer.x = targetX;
        collapseContainer.y = targetY;
        
        // Create void rings that consume air
        for (let ring = 0; ring < 10; ring++) {
            setTimeout(() => {
                const voidRing = new PIXI.Graphics();
                voidRing.lineStyle(15, 0x000000, 0.8);
                voidRing.lineStyle(10, 0x444444, 0.6);
                voidRing.lineStyle(5, 0x888888, 0.4);
                
                const radius = 80 + ring * 60;
                voidRing.drawCircle(0, 0, radius);
                collapseContainer.addChild(voidRing);
                
                // Inward collapse animation
                voidRing.scale.set(2);
                const collapseAnimation = () => {
                    if (voidRing.scale.x > 0.1) {
                        voidRing.scale.x *= 0.95;
                        voidRing.scale.y *= 0.95;
                        voidRing.rotation += 0.1;
                        requestAnimationFrame(collapseAnimation);
                    }
                };
                collapseAnimation();
                
                this.checkAreaDamage(targetX, targetY, radius, 105, 'wind');
                
                setTimeout(() => {
                    if (voidRing.parent) {
                        collapseContainer.removeChild(voidRing);
                    }
                }, 2000);
            }, ring * 200);
        }
        
        // Create air particles being sucked in
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const particle = new PIXI.Graphics();
                particle.beginFill(0x88ccff, 0.6);
                particle.drawCircle(0, 0, 3);
                particle.endFill();
                
                const angle = Math.random() * Math.PI * 2;
                const distance = 400;
                particle.x = targetX + Math.cos(angle) * distance;
                particle.y = targetY + Math.sin(angle) * distance;
                
                this.app.stage.addChild(particle);
                
                // Animate particles being sucked toward center
                const suckAnimation = () => {
                    const dx = targetX - particle.x;
                    const dy = targetY - particle.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 20) {
                        particle.x += (dx / dist) * 8;
                        particle.y += (dy / dist) * 8;
                        requestAnimationFrame(suckAnimation);
                    } else if (particle.parent) {
                        this.app.stage.removeChild(particle);
                    }
                };
                suckAnimation();
            }, i * 50);
        }
        
        this.app.stage.addChild(collapseContainer);
        
        setTimeout(() => {
            if (collapseContainer.parent) {
                this.app.stage.removeChild(collapseContainer);
            }
        }, 5000);
    }
    
    createRealityErasure(targetX, targetY, level) {
        // SSS Shadow Spell - Reality Erasure with Shadow Knights
        const erasureContainer = new PIXI.Container();
        erasureContainer.x = targetX;
        erasureContainer.y = targetY;
        
        // Create moderate reality distortion effect (less overpowered)
        const distortion = new PIXI.Graphics();
        distortion.beginFill(0x220022, 0.7);
        distortion.drawCircle(0, 0, 120); // Reduced from 200
        distortion.endFill();
        
        // Add glitch effect
        for (let i = 0; i < 12; i++) {
            const glitch = new PIXI.Graphics();
            glitch.beginFill(Math.random() > 0.5 ? 0x8800ff : 0x4400aa, 0.6);
            glitch.drawRect(
                (Math.random() - 0.5) * 240,
                (Math.random() - 0.5) * 240,
                Math.random() * 30,
                Math.random() * 15
            );
            glitch.endFill();
            erasureContainer.addChild(glitch);
        }
        
        erasureContainer.addChild(distortion);
        
        // Moderate reality break animation
        let breakIntensity = 0.5;
        const breakAnimation = () => {
            if (breakIntensity > 0) {
                erasureContainer.children.forEach(child => {
                    child.x += (Math.random() - 0.5) * breakIntensity * 10;
                    child.y += (Math.random() - 0.5) * breakIntensity * 10;
                    child.alpha = 0.7 + Math.random() * breakIntensity * 0.3;
                });
                breakIntensity *= 0.96;
                requestAnimationFrame(breakAnimation);
            }
        };
        breakAnimation();
        
        // Spawn 6 Shadow Knights around the spell
        this.spawnShadowKnights(targetX, targetY, 6);
        
        // Create void rifts (reduced number and damage)
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const rift = new PIXI.Graphics();
                rift.beginFill(0x000000);
                rift.drawCircle(0, 0, 30);
                rift.endFill();
                
                const angle = (i / 3) * Math.PI * 2;
                rift.x = targetX + Math.cos(angle) * 100;
                rift.y = targetY + Math.sin(angle) * 100;
                
                this.app.stage.addChild(rift);
                this.checkAreaDamage(rift.x, rift.y, 60, 45, 'shadow'); // Reduced damage
                
                setTimeout(() => {
                    if (rift.parent) {
                        this.app.stage.removeChild(rift);
                    }
                }, 2000);
            }, i * 300);
        }
        
        this.app.stage.addChild(erasureContainer);
        this.checkAreaDamage(targetX, targetY, 150, 55, 'shadow'); // Reduced area and damage
        
        setTimeout(() => {
            if (erasureContainer.parent) {
                this.app.stage.removeChild(erasureContainer);
            }
        }, 3000);
    }
    
    createGenesisBurst(targetX, targetY, level) {
        // The light of creation itself
        const genesisContainer = new PIXI.Container();
        genesisContainer.x = targetX;
        genesisContainer.y = targetY;
        
        // Create creation light
        const coreLight = new PIXI.Graphics();
        coreLight.beginFill(0xffffff, 1);
        coreLight.drawCircle(0, 0, 30);
        coreLight.endFill();
        genesisContainer.addChild(coreLight);
        
        // Expanding rings of creation
        for (let ring = 0; ring < 12; ring++) {
            setTimeout(() => {
                const lightRing = new PIXI.Graphics();
                lightRing.lineStyle(20, 0xffffff, 0.9 - ring * 0.07);
                lightRing.lineStyle(15, 0xffffaa, 0.8 - ring * 0.06);
                lightRing.lineStyle(10, 0xffff88, 0.7 - ring * 0.05);
                
                const radius = 60 + ring * 50;
                lightRing.drawCircle(0, 0, radius);
                genesisContainer.addChild(lightRing);
                
                // Expanding animation
                lightRing.scale.set(0.1);
                const expandAnimation = () => {
                    if (lightRing.scale.x < 2) {
                        lightRing.scale.x += 0.08;
                        lightRing.scale.y += 0.08;
                        lightRing.rotation += 0.03;
                        requestAnimationFrame(expandAnimation);
                    }
                };
                expandAnimation();
                
                this.checkAreaDamage(targetX, targetY, radius, 115, 'light');
                
                setTimeout(() => {
                    if (lightRing.parent) {
                        genesisContainer.removeChild(lightRing);
                    }
                }, 3000);
            }, ring * 150);
        }
        
        // Create divine beams in all directions
        for (let i = 0; i < 16; i++) {
            setTimeout(() => {
                const beam = new PIXI.Graphics();
                beam.beginFill(0xffffff, 0.8);
                
                const angle = (i / 16) * Math.PI * 2;
                const length = 600;
                beam.drawRect(0, -10, length, 20);
                beam.rotation = angle;
                genesisContainer.addChild(beam);
                
                this.checkAreaDamage(
                    targetX + Math.cos(angle) * length / 2,
                    targetY + Math.sin(angle) * length / 2,
                    100, 90, 'light'
                );
                
                setTimeout(() => {
                    if (beam.parent) {
                        genesisContainer.removeChild(beam);
                    }
                }, 2000);
            }, i * 100);
        }
        
        this.app.stage.addChild(genesisContainer);
        
        setTimeout(() => {
            if (genesisContainer.parent) {
                this.app.stage.removeChild(genesisContainer);
            }
        }, 5000);
    }
    
    createExplosion(x, y, level) {
        for (let i = 0; i < 5 + level; i++) {
            const particle = new PIXI.Graphics();
            particle.beginFill(Math.random() > 0.5 ? 0xff4444 : 0xff8800);
            particle.drawCircle(0, 0, 3 + Math.random() * 5);
            particle.endFill();
            
            particle.x = x + (Math.random() - 0.5) * 40;
            particle.y = y + (Math.random() - 0.5) * 40;
            
            this.app.stage.addChild(particle);
            
            setTimeout(() => {
                if (particle.parent) {
                    this.app.stage.removeChild(particle);
                }
            }, 500);
        }
    }
    
    createFireExplosion(x, y, level) {
        // Enhanced fire explosion with multiple layers
        const explosionContainer = new PIXI.Container();
        explosionContainer.x = x;
        explosionContainer.y = y;
        
        // Central blast
        const centralBlast = new PIXI.Graphics();
        centralBlast.beginFill(0xffff44, 0.9); // Bright yellow center
        centralBlast.drawCircle(0, 0, 25);
        centralBlast.endFill();
        explosionContainer.addChild(centralBlast);
        
        // Fire ring
        const fireRing = new PIXI.Graphics();
        fireRing.beginFill(0xff6600, 0.7); // Orange ring
        fireRing.drawCircle(0, 0, 40);
        fireRing.endFill();
        explosionContainer.addChild(fireRing);
        
        // Outer flame
        const outerFlame = new PIXI.Graphics();
        outerFlame.beginFill(0xff4444, 0.5); // Red outer
        outerFlame.drawCircle(0, 0, 60);
        outerFlame.endFill();
        explosionContainer.addChild(outerFlame);
        
        this.app.stage.addChild(explosionContainer);
        
        // Animate explosion growth
        explosionContainer.scale.set(0.1);
        const growAnimation = () => {
            if (explosionContainer.scale.x < 1) {
                explosionContainer.scale.x += 0.15;
                explosionContainer.scale.y += 0.15;
                explosionContainer.rotation += 0.1;
                requestAnimationFrame(growAnimation);
            }
        };
        growAnimation();
        
        // Fire particles
        for (let i = 0; i < 15; i++) {
            setTimeout(() => {
                const particle = new PIXI.Graphics();
                const colors = [0xff4444, 0xff6600, 0xff8800, 0xffaa00];
                particle.beginFill(colors[Math.floor(Math.random() * colors.length)]);
                particle.drawCircle(0, 0, 4 + Math.random() * 6);
                particle.endFill();
                
                const angle = (Math.random() * Math.PI * 2);
                const distance = 30 + Math.random() * 50;
                particle.x = x + Math.cos(angle) * distance;
                particle.y = y + Math.sin(angle) * distance;
                
                this.app.stage.addChild(particle);
                
                // Animate particle
                const particleVelX = Math.cos(angle) * 2;
                const particleVelY = Math.sin(angle) * 2;
                const animateParticle = () => {
                    particle.x += particleVelX;
                    particle.y += particleVelY;
                    particle.alpha *= 0.95;
                    
                    if (particle.alpha > 0.1 && particle.parent) {
                        requestAnimationFrame(animateParticle);
                    } else if (particle.parent) {
                        this.app.stage.removeChild(particle);
                    }
                };
                animateParticle();
            }, i * 50);
        }
        
        setTimeout(() => {
            if (explosionContainer.parent) {
                this.app.stage.removeChild(explosionContainer);
            }
        }, 1000);
    }
    
    createDeathParticles(x, y) {
        // Create death particle effect
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const particle = new PIXI.Graphics();
                const particleType = Math.random();
                
                if (particleType < 0.3) {
                    // Skull particle
                    particle.beginFill(0xffffff);
                    particle.drawCircle(0, 0, 3);
                    particle.endFill();
                } else if (particleType < 0.6) {
                    // Blood particle
                    particle.beginFill(0x880000);
                    particle.drawCircle(0, 0, 2 + Math.random() * 3);
                    particle.endFill();
                } else {
                    // Spirit particle
                    particle.beginFill(0x888888, 0.7);
                    particle.drawCircle(0, 0, 4);
                    particle.endFill();
                }
                
                const angle = Math.random() * Math.PI * 2;
                const speed = 2 + Math.random() * 4;
                const distance = 20 + Math.random() * 40;
                
                particle.x = x;
                particle.y = y;
                this.app.stage.addChild(particle);
                
                // Animate particle
                const velX = Math.cos(angle) * speed;
                const velY = Math.sin(angle) * speed - 1; // Slight upward drift
                
                const animateParticle = () => {
                    particle.x += velX;
                    particle.y += velY;
                    particle.alpha *= 0.96;
                    
                    if (particle.alpha > 0.1 && particle.parent) {
                        requestAnimationFrame(animateParticle);
                    } else if (particle.parent) {
                        this.app.stage.removeChild(particle);
                    }
                };
                animateParticle();
            }, i * 30);
        }
    }
    
    createBurnEffect(env) {
        // Add burn effect to tree
        const burnEffect = new PIXI.Graphics();
        burnEffect.beginFill(0xff4444, 0.6);
        burnEffect.drawCircle(0, 0, 20);
        burnEffect.endFill();
        
        env.addChild(burnEffect);
        env.tint = 0x664422; // Darken the tree
        
        // Remove burn effect after 3 seconds
        setTimeout(() => {
            if (burnEffect.parent) {
                env.removeChild(burnEffect);
                env.tint = 0xffffff; // Reset color
            }
        }, 3000);
    }
    
    moveEnvironmentObject(env, envId) {
        // Give experience for destroying environment
        const expGain = env.envType === 'tree' ? 5 : 8;
        client.socket.emit('gainExperience', expGain);
        
        // Move to random location instead of removing
        let newX, newY, attempts = 0;
        do {
            newX = Math.random() * (this.worldSize.width - 200) + 100;
            newY = Math.random() * (this.worldSize.height - 200) + 100;
            attempts++;
        } while (this.isPositionOccupied(newX, newY, 60) && attempts < 50);
        
        env.x = newX;
        env.y = newY;
        env.health = env.maxHealth; // Reset health
        env.alpha = 1;
        env.tint = 0xffffff; // Reset any burn effects
        
        // Update position tracking
        this.envPositions = this.envPositions.filter(pos => {
            const dx = pos.x - env.x;
            const dy = pos.y - env.y;
            return Math.sqrt(dx * dx + dy * dy) > 30;
        });
        this.envPositions.push({x: newX, y: newY, radius: env.envType === 'tree' ? 60 : 50});
    }
    
    updateDemonStatues() {
        if (!this.currentPlayer) return;
        
        // Check dormant statues for player proximity
        this.demonStatues.forEach((statue, statueId) => {
            if (!statue.isAwake) {
                const dx = this.currentPlayer.x - statue.x;
                const dy = this.currentPlayer.y - statue.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < statue.activationRadius) {
                    this.awakeDemonStatue(statue, statueId);
                }
            }
        });
        
        // Update active demon statues
        this.activeDemonStatues.forEach((demon, demonId) => {
            this.updateActiveDemon(demon, demonId);
        });
    }
    
    awakeDemonStatue(statue, statueId) {
        statue.isAwake = true;
        
        // Transform statue to living demon
        statue.removeChildren();
        
        // Create living demon appearance
        const demonBody = new PIXI.Graphics();
        demonBody.lineStyle(4, 0x000000);
        demonBody.beginFill(0x8B0000); // Dark red
        
        // Main body
        demonBody.drawRect(-12, -10, 24, 20);
        
        // Head
        demonBody.drawCircle(0, -20, 10);
        
        // Glowing red horns
        demonBody.beginFill(0xFF0000);
        demonBody.drawPolygon([-8, -25, -10, -35, -6, -30]);
        demonBody.drawPolygon([8, -25, 10, -35, 6, -30]);
        demonBody.endFill();
        
        // Glowing red eyes
        const leftEye = new PIXI.Graphics();
        leftEye.beginFill(0xFF0000);
        leftEye.drawCircle(-5, -22, 3);
        leftEye.endFill();
        
        const rightEye = new PIXI.Graphics();
        rightEye.beginFill(0xFF0000);
        rightEye.drawCircle(5, -22, 3);
        rightEye.endFill();
        
        // Animated wings (spread)
        const leftWing = new PIXI.Graphics();
        leftWing.lineStyle(3, 0x000000);
        leftWing.beginFill(0x4B0000);
        leftWing.drawPolygon([-12, -5, -35, -15, -30, 10, -15, 8]);
        leftWing.endFill();
        
        const rightWing = new PIXI.Graphics();
        rightWing.lineStyle(3, 0x000000);
        rightWing.beginFill(0x4B0000);
        rightWing.drawPolygon([12, -5, 35, -15, 30, 10, 15, 8]);
        rightWing.endFill();
        
        // Evil aura
        const aura = new PIXI.Graphics();
        aura.beginFill(0xFF0000, 0.3);
        aura.drawCircle(0, -10, 25);
        aura.endFill();
        
        statue.addChild(aura);
        statue.addChild(leftWing);
        statue.addChild(rightWing);
        statue.addChild(demonBody);
        statue.addChild(leftEye);
        statue.addChild(rightEye);
        
        // Move to active demons map
        this.activeDemonStatues.set(statueId, statue);
        this.demonStatues.delete(statueId);
        
        // Create awakening effect
        this.createAwakeningEffect(statue.x, statue.y);
        
        // Pulsing animation
        statue.wingAnimation = 0;
        const animateWings = () => {
            if (statue.parent && statue.isAwake) {
                statue.wingAnimation += 0.1;
                leftWing.rotation = Math.sin(statue.wingAnimation) * 0.2;
                rightWing.rotation = -Math.sin(statue.wingAnimation) * 0.2;
                aura.alpha = 0.2 + Math.sin(statue.wingAnimation * 2) * 0.1;
                requestAnimationFrame(animateWings);
            }
        };
        animateWings();
    }
    
    updateActiveDemon(demon, demonId) {
        if (!this.currentPlayer) return;
        
        const dx = this.currentPlayer.x - demon.x;
        const dy = this.currentPlayer.y - demon.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Move towards player if not in attack range
        if (distance > demon.attackRadius && distance < 300) {
            const moveX = (dx / distance) * demon.speed * (1/60);
            const moveY = (dy / distance) * demon.speed * (1/60);
            demon.x += moveX;
            demon.y += moveY;
        }
        
        // Attack if in range and cooldown is ready
        const currentTime = Date.now();
        if (distance < demon.attackRadius && currentTime - demon.lastAttackTime > demon.attackCooldown) {
            demon.lastAttackTime = currentTime;
            this.demonCastEvilMagic(demon);
        }
        
        // Remove demon if too far from all players
        if (distance > 500) {
            this.app.stage.removeChild(demon);
            this.activeDemonStatues.delete(demonId);
        }
    }
    
    demonCastEvilMagic(demon) {
        if (!this.currentPlayer) return;
        
        // Random evil spell
        const spells = ['hellfire', 'cursedLightning', 'shadowBlast', 'demonicVoid'];
        const randomSpell = spells[Math.floor(Math.random() * spells.length)];
        
        switch(randomSpell) {
            case 'hellfire':
                this.demonHellfire(demon);
                break;
            case 'cursedLightning':
                this.demonCursedLightning(demon);
                break;
            case 'shadowBlast':
                this.demonShadowBlast(demon);
                break;
            case 'demonicVoid':
                this.demonVoidAttack(demon);
                break;
        }
    }
    
    demonHellfire(demon) {
        // Create hellfire explosion at player location
        const targetX = this.currentPlayer.x;
        const targetY = this.currentPlayer.y;
        
        const hellfire = new PIXI.Graphics();
        hellfire.beginFill(0xFF0000, 0.8);
        hellfire.drawCircle(0, 0, 60);
        hellfire.endFill();
        
        hellfire.beginFill(0xFF4400, 0.6);
        hellfire.drawCircle(0, 0, 40);
        hellfire.endFill();
        
        hellfire.beginFill(0xFFAA00, 0.4);
        hellfire.drawCircle(0, 0, 20);
        hellfire.endFill();
        
        hellfire.x = targetX;
        hellfire.y = targetY;
        this.app.stage.addChild(hellfire);
        
        // Damage player
        this.showDamageNumber(demon.damage, targetX, targetY, '#FF0000');
        client.socket.emit('playerHit', {
            targetId: client.socket.id,
            damage: demon.damage,
            spellType: 'demon'
        });
        
        setTimeout(() => {
            if (hellfire.parent) {
                this.app.stage.removeChild(hellfire);
            }
        }, 1000);
    }
    
    demonCursedLightning(demon) {
        // Create cursed lightning from demon to player
        const lightning = new PIXI.Graphics();
        lightning.lineStyle(8, 0x000000);
        lightning.moveTo(demon.x, demon.y);
        lightning.lineTo(this.currentPlayer.x, this.currentPlayer.y);
        
        lightning.lineStyle(6, 0x8B0000);
        lightning.moveTo(demon.x, demon.y);
        lightning.lineTo(this.currentPlayer.x, this.currentPlayer.y);
        
        lightning.lineStyle(3, 0xFF0000);
        lightning.moveTo(demon.x, demon.y);
        lightning.lineTo(this.currentPlayer.x, this.currentPlayer.y);
        
        this.app.stage.addChild(lightning);
        
        // Damage player
        this.showDamageNumber(demon.damage + 5, this.currentPlayer.x, this.currentPlayer.y, '#8B0000');
        client.socket.emit('playerHit', {
            targetId: client.socket.id,
            damage: demon.damage + 5,
            spellType: 'demon'
        });
        
        setTimeout(() => {
            if (lightning.parent) {
                this.app.stage.removeChild(lightning);
            }
        }, 300);
    }
    
    demonShadowBlast(demon) {
        // Create multiple shadow projectiles
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const shadowBlast = new PIXI.Graphics();
                shadowBlast.beginFill(0x4B0082, 0.8);
                shadowBlast.drawCircle(0, 0, 12);
                shadowBlast.endFill();
                
                shadowBlast.beginFill(0x000000, 0.6);
                shadowBlast.drawCircle(0, 0, 8);
                shadowBlast.endFill();
                
                shadowBlast.x = demon.x;
                shadowBlast.y = demon.y;
                this.app.stage.addChild(shadowBlast);
                
                // Animate towards player
                const dx = this.currentPlayer.x - demon.x;
                const dy = this.currentPlayer.y - demon.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const speed = 200;
                const time = distance / speed * 1000;
                
                const startTime = Date.now();
                const animate = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = elapsed / time;
                    
                    if (progress < 1) {
                        shadowBlast.x = demon.x + dx * progress;
                        shadowBlast.y = demon.y + dy * progress;
                        shadowBlast.rotation += 0.2;
                        requestAnimationFrame(animate);
                    } else {
                        // Check if hit player
                        const hitDx = shadowBlast.x - this.currentPlayer.x;
                        const hitDy = shadowBlast.y - this.currentPlayer.y;
                        if (Math.sqrt(hitDx * hitDx + hitDy * hitDy) < 40) {
                            this.showDamageNumber(demon.damage - 5, this.currentPlayer.x, this.currentPlayer.y, '#4B0082');
                            client.socket.emit('playerHit', {
                                targetId: client.socket.id,
                                damage: demon.damage - 5,
                                spellType: 'demon'
                            });
                        }
                        
                        if (shadowBlast.parent) {
                            this.app.stage.removeChild(shadowBlast);
                        }
                    }
                };
                animate();
            }, i * 200);
        }
    }
    
    demonVoidAttack(demon) {
        // Create void rift near player
        const voidRift = new PIXI.Graphics();
        voidRift.lineStyle(4, 0x8B0000);
        voidRift.beginFill(0x000000);
        voidRift.drawCircle(0, 0, 30);
        voidRift.endFill();
        
        voidRift.lineStyle(2, 0xFF0000);
        voidRift.drawCircle(0, 0, 45);
        
        voidRift.x = this.currentPlayer.x + (Math.random() - 0.5) * 60;
        voidRift.y = this.currentPlayer.y + (Math.random() - 0.5) * 60;
        this.app.stage.addChild(voidRift);
        
        // Pulling effect
        let pullTime = 0;
        const pullAnimation = () => {
            if (pullTime < 2000 && voidRift.parent) {
                const dx = voidRift.x - this.currentPlayer.x;
                const dy = voidRift.y - this.currentPlayer.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 80) {
                    // Pull player towards void
                    this.currentPlayer.x += (dx / distance) * 2;
                    this.currentPlayer.y += (dy / distance) * 2;
                    
                    if (distance < 40) {
                        this.showDamageNumber(demon.damage + 10, this.currentPlayer.x, this.currentPlayer.y, '#000000');
                        client.socket.emit('playerHit', {
                            targetId: client.socket.id,
                            damage: demon.damage + 10,
                            spellType: 'demon'
                        });
                    }
                }
                
                voidRift.rotation += 0.3;
                voidRift.scale.x = 1 + Math.sin(pullTime * 0.01) * 0.2;
                voidRift.scale.y = 1 + Math.sin(pullTime * 0.01) * 0.2;
                
                pullTime += 16;
                requestAnimationFrame(pullAnimation);
            } else if (voidRift.parent) {
                this.app.stage.removeChild(voidRift);
            }
        };
        pullAnimation();
    }
    
    createAwakeningEffect(x, y) {
        // Create dramatic awakening effect
        const awakeEffect = new PIXI.Graphics();
        awakeEffect.beginFill(0xFF0000, 0.8);
        awakeEffect.drawCircle(0, 0, 100);
        awakeEffect.endFill();
        
        awakeEffect.x = x;
        awakeEffect.y = y;
        awakeEffect.alpha = 0;
        this.app.stage.addChild(awakeEffect);
        
        // Pulse animation
        let pulseIntensity = 0;
        const pulseAnimation = () => {
            if (pulseIntensity < 1) {
                pulseIntensity += 0.1;
                awakeEffect.alpha = Math.sin(pulseIntensity * Math.PI) * 0.7;
                awakeEffect.scale.set(pulseIntensity * 2);
                requestAnimationFrame(pulseAnimation);
            } else if (awakeEffect.parent) {
                this.app.stage.removeChild(awakeEffect);
            }
        };
        pulseAnimation();
        
        // Create fire particles
        for (let i = 0; i < 15; i++) {
            setTimeout(() => {
                const particle = new PIXI.Graphics();
                particle.beginFill(0xFF4400);
                particle.drawCircle(0, 0, 4);
                particle.endFill();
                
                const angle = (i / 15) * Math.PI * 2;
                particle.x = x + Math.cos(angle) * 30;
                particle.y = y + Math.sin(angle) * 30;
                this.app.stage.addChild(particle);
                
                // Animate particles
                const velX = Math.cos(angle) * 3;
                const velY = Math.sin(angle) * 3 - 2;
                const animateParticle = () => {
                    particle.x += velX;
                    particle.y += velY;
                    particle.alpha *= 0.95;
                    
                    if (particle.alpha > 0.1 && particle.parent) {
                        requestAnimationFrame(animateParticle);
                    } else if (particle.parent) {
                        this.app.stage.removeChild(particle);
                    }
                };
                animateParticle();
            }, i * 50);
        }
    }
    
    createSpecialMagicEffect(spellType, x, y) {
        const screenX = x - this.camera.x;
        const screenY = y - this.camera.y;
        
        switch(spellType) {
            case 'fire':
                this.createFireEffect(screenX, screenY);
                break;
            case 'ice':
                this.createIceEffect(screenX, screenY);
                break;
            case 'lightning':
                this.createLightningEffect(screenX, screenY);
                break;
            case 'earth':
                this.createEarthEffect(screenX, screenY);
                break;
            case 'wind':
                this.createWindEffect(screenX, screenY);
                break;
            case 'shadow':
                this.createShadowEffect(screenX, screenY);
                break;
            case 'light':
                this.createLightEffect(screenX, screenY);
                break;
            case 'void':
                this.createVoidEffect(screenX, screenY);
                break;
        }
    }
    
    // Add void magic spell effect calls
    addSpell(spellData) {
        const spell = this.createSpellEffect(spellData);
        this.spells.set(spellData.id, spell);
        this.app.stage.addChild(spell);
        
        // Create special visual effects for void magic
        if (spellData.type === 'void') {
            this.createSpecialMagicEffect('void', spellData.targetX, spellData.targetY);
        }
    }
    
    createFireEffect(x, y) {
        for (let i = 0; i < 5; i++) {
            const flame = document.createElement('div');
            flame.style.position = 'fixed';
            flame.style.left = (x + Math.random() * 40 - 20) + 'px';
            flame.style.top = (y + Math.random() * 40 - 20) + 'px';
            flame.style.width = '20px';
            flame.style.height = '20px';
            flame.style.background = 'radial-gradient(circle, #ff4444, #ff8800)';
            flame.style.borderRadius = '50%';
            flame.style.animation = 'fireSpell 1s ease-out forwards';
            flame.style.pointerEvents = 'none';
            flame.style.zIndex = '998';
            
            document.body.appendChild(flame);
            setTimeout(() => {
                if (flame.parentNode) flame.parentNode.removeChild(flame);
            }, 1000);
        }
    }
    
    createIceEffect(x, y) {
        const ice = document.createElement('div');
        ice.style.position = 'fixed';
        ice.style.left = (x - 25) + 'px';
        ice.style.top = (y - 25) + 'px';
        ice.style.width = '50px';
        ice.style.height = '50px';
        ice.style.background = 'radial-gradient(circle, #4444ff, #88aaff)';
        ice.style.borderRadius = '20%';
        ice.style.animation = 'iceSpell 1.2s ease-out forwards';
        ice.style.pointerEvents = 'none';
        ice.style.zIndex = '998';
        
        document.body.appendChild(ice);
        setTimeout(() => {
            if (ice.parentNode) ice.parentNode.removeChild(ice);
        }, 1200);
    }
    
    createLightningEffect(x, y) {
        const lightning = document.createElement('div');
        lightning.style.position = 'fixed';
        lightning.style.left = (x - 15) + 'px';
        lightning.style.top = (y - 30) + 'px';
        lightning.style.width = '30px';
        lightning.style.height = '60px';
        lightning.style.background = 'linear-gradient(180deg, #ffff44, #ffffff)';
        lightning.style.animation = 'lightningSpell 0.8s ease-out forwards';
        lightning.style.pointerEvents = 'none';
        lightning.style.zIndex = '998';
        
        document.body.appendChild(lightning);
        setTimeout(() => {
            if (lightning.parentNode) lightning.parentNode.removeChild(lightning);
        }, 800);
    }
    
    createEarthEffect(x, y) {
        for (let i = 0; i < 3; i++) {
            const rock = document.createElement('div');
            rock.style.position = 'fixed';
            rock.style.left = (x + Math.random() * 60 - 30) + 'px';
            rock.style.top = (y + Math.random() * 60 - 30) + 'px';
            rock.style.width = '15px';
            rock.style.height = '15px';
            rock.style.background = '#44aa44';
            rock.style.borderRadius = '20%';
            rock.style.animation = 'earthSpell 1.5s ease-out forwards';
            rock.style.pointerEvents = 'none';
            rock.style.zIndex = '998';
            
            document.body.appendChild(rock);
            setTimeout(() => {
                if (rock.parentNode) rock.parentNode.removeChild(rock);
            }, 1500);
        }
    }
    
    createWindEffect(x, y) {
        const wind = document.createElement('div');
        wind.style.position = 'fixed';
        wind.style.left = (x - 40) + 'px';
        wind.style.top = (y - 40) + 'px';
        wind.style.width = '80px';
        wind.style.height = '80px';
        wind.style.border = '3px solid rgba(68, 255, 255, 0.6)';
        wind.style.borderRadius = '50%';
        wind.style.animation = 'windSpell 1s ease-out forwards';
        wind.style.pointerEvents = 'none';
        wind.style.zIndex = '998';
        
        document.body.appendChild(wind);
        setTimeout(() => {
            if (wind.parentNode) wind.parentNode.removeChild(wind);
        }, 1000);
    }
    
    createShadowEffect(x, y) {
        const shadow = document.createElement('div');
        shadow.style.position = 'fixed';
        shadow.style.left = (x - 30) + 'px';
        shadow.style.top = (y - 30) + 'px';
        shadow.style.width = '60px';
        shadow.style.height = '60px';
        shadow.style.background = 'radial-gradient(circle, #aa44aa, #000000)';
        shadow.style.borderRadius = '50%';
        shadow.style.animation = 'shadowSpell 1.3s ease-out forwards';
        shadow.style.pointerEvents = 'none';
        shadow.style.zIndex = '998';
        
        document.body.appendChild(shadow);
        setTimeout(() => {
            if (shadow.parentNode) shadow.parentNode.removeChild(shadow);
        }, 1300);
    }
    
    createLightEffect(x, y) {
        const light = document.createElement('div');
        light.style.position = 'fixed';
        light.style.left = (x - 35) + 'px';
        light.style.top = (y - 35) + 'px';
        light.style.width = '70px';
        light.style.height = '70px';
        light.style.background = 'radial-gradient(circle, #ffffff, rgba(255, 255, 255, 0))';
        light.style.borderRadius = '50%';
        light.style.animation = 'lightSpell 1s ease-out forwards';
        light.style.pointerEvents = 'none';
        light.style.zIndex = '998';
        
        document.body.appendChild(light);
        setTimeout(() => {
            if (light.parentNode) light.parentNode.removeChild(light);
        }, 1000);
    }
    
    createVoidEffect(x, y) {
        // Main void sphere
        const voidSphere = document.createElement('div');
        voidSphere.style.position = 'fixed';
        voidSphere.style.left = (x - 40) + 'px';
        voidSphere.style.top = (y - 40) + 'px';
        voidSphere.style.width = '80px';
        voidSphere.style.height = '80px';
        voidSphere.style.background = 'radial-gradient(circle, #000000, #8800ff, rgba(136, 0, 255, 0))';
        voidSphere.style.borderRadius = '50%';
        voidSphere.style.animation = 'voidSpell 1.5s ease-out forwards';
        voidSphere.style.pointerEvents = 'none';
        voidSphere.style.zIndex = '998';
        
        document.body.appendChild(voidSphere);
        
        // Add void particles
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.style.position = 'fixed';
                particle.style.width = '6px';
                particle.style.height = '6px';
                particle.style.background = '#aa00ff';
                particle.style.borderRadius = '50%';
                particle.style.pointerEvents = 'none';
                particle.style.zIndex = '997';
                
                const angle = (i / 8) * Math.PI * 2;
                const startRadius = 15;
                const endRadius = 60;
                
                particle.style.left = (x + Math.cos(angle) * startRadius - 3) + 'px';
                particle.style.top = (y + Math.sin(angle) * startRadius - 3) + 'px';
                
                document.body.appendChild(particle);
                
                // Animate particle moving outward
                let radius = startRadius;
                const animateParticle = () => {
                    radius += 2;
                    particle.style.left = (x + Math.cos(angle) * radius - 3) + 'px';
                    particle.style.top = (y + Math.sin(angle) * radius - 3) + 'px';
                    particle.style.opacity = Math.max(0, 1 - (radius - startRadius) / (endRadius - startRadius));
                    
                    if (radius < endRadius && particle.parentNode) {
                        requestAnimationFrame(animateParticle);
                    } else if (particle.parentNode) {
                        document.body.removeChild(particle);
                    }
                };
                animateParticle();
            }, i * 50);
        }
        
        setTimeout(() => {
            if (voidSphere.parentNode) voidSphere.parentNode.removeChild(voidSphere);
        }, 1500);
    }
    
    createMagicEffect(spellType, x, y) {
        const effect = document.createElement('div');
        effect.className = `magic-effect magic-${spellType}`;
        effect.style.left = x + 'px';
        effect.style.top = y + 'px';
        effect.style.width = '50px';
        effect.style.height = '50px';
        effect.style.marginLeft = '-25px';
        effect.style.marginTop = '-25px';
        
        document.body.appendChild(effect);
        
        setTimeout(() => {
            if (effect.parentNode) {
                effect.parentNode.removeChild(effect);
            }
        }, 2000);
    }
    
    updateSpellSelection() {
        // Update UI to show selected spell
        document.querySelectorAll('.spell-slot').forEach(slot => {
            slot.classList.remove('selected');
        });
        
        const selectedSlot = document.querySelector(`[data-type="${this.selectedSpell}"]`);
        if (selectedSlot) {
            selectedSlot.classList.add('selected');
        }
        
        // Update wall preview visibility
        this.updateWallPreview();
    }
    
    updateWallPreview() {
        // Remove existing preview
        if (this.wallPreview && this.wallPreview.parent) {
            this.app.stage.removeChild(this.wallPreview);
            this.wallPreview = null;
        }
        
        // Only show preview for earth spells that create walls
        if (this.selectedSpell === 'earth' && this.currentPlayer && this.currentPlayer.playerData) {
            const selectedSpell = this.currentPlayer.playerData.selectedSpells?.earth;
            if (selectedSpell === 'Earth Wall') {
                this.createWallPreview();
            }
        }
    }
    
    createWallPreview() {
        if (!this.currentPlayer) return;
        
        const worldX = this.mousePosition.x + this.camera.x;
        const worldY = this.mousePosition.y + this.camera.y;
        
        this.wallPreview = new PIXI.Container();
        const width = 25;
        const height = 120;
        
        // Semi-transparent preview wall
        const previewWall = new PIXI.Graphics();
        previewWall.beginFill(0x44aa44, 0.5);
        previewWall.lineStyle(2, 0x228822, 0.7);
        previewWall.drawRect(-width/2, -height/2, width, height);
        previewWall.endFill();
        
        // Add rotation based on mouse position relative to player
        const dx = worldX - this.currentPlayer.x;
        const dy = worldY - this.currentPlayer.y;
        const angle = Math.atan2(dy, dx);
        
        this.wallPreview.addChild(previewWall);
        this.wallPreview.x = worldX;
        this.wallPreview.y = worldY;
        this.wallPreview.rotation = angle + Math.PI / 2; // Perpendicular to mouse direction
        
        this.app.stage.addChild(this.wallPreview);
    }
    
    startGameLoop() {
        this.app.ticker.add((delta) => {
            this.update(delta);
        });
    }
    
    update(delta) {
        // Update magic cooldowns
        Object.keys(this.magicCooldowns).forEach(magic => {
            if (this.magicCooldowns[magic] > 0) {
                this.magicCooldowns[magic] -= delta * 16.67; // Convert to milliseconds
                if (this.magicCooldowns[magic] < 0) {
                    this.magicCooldowns[magic] = 0;
                }
            }
        });
        
        // Check bush concealment
        this.checkBushConcealment();
        
        // Update current player movement
        if (this.currentPlayer && client.socket) {
            let moved = false;
            const baseSpeed = 200;
            const speedMultiplier = this.keys['shift'] ? 2 : 1;
            const speed = baseSpeed * speedMultiplier * (delta / 60); // pixels per second
            
            let newX = this.currentPlayer.x;
            let newY = this.currentPlayer.y;
            
            if (this.keys['w'] || this.keys['arrowup']) {
                newY -= speed;
            }
            if (this.keys['s'] || this.keys['arrowdown']) {
                newY += speed;
            }
            if (this.keys['a'] || this.keys['arrowleft']) {
                newX -= speed;
            }
            if (this.keys['d'] || this.keys['arrowright']) {
                newX += speed;
            }
            
            // Check collision before moving
            if (!this.checkCollisionWithEnvironment(newX, newY)) {
                this.currentPlayer.x = newX;
                this.currentPlayer.y = newY;
                moved = true;
            }
            
            // Keep player within world bounds
            this.currentPlayer.x = Math.max(50, Math.min(this.worldSize.width - 50, this.currentPlayer.x));
            this.currentPlayer.y = Math.max(50, Math.min(this.worldSize.height - 50, this.currentPlayer.y));
            
            // Update camera to follow player
            this.updateCamera();
            
            // Update rotation to face cursor
            const worldMouseX = this.mousePosition.x + this.camera.x;
            const worldMouseY = this.mousePosition.y + this.camera.y;
            const dx = worldMouseX - this.currentPlayer.x;
            const dy = worldMouseY - this.currentPlayer.y;
            const rotation = Math.atan2(dy, dx);
            this.currentPlayer.rotation = rotation;
            
            if (moved || Math.abs(this.currentPlayer.rotation - (this.currentPlayer.lastRotation || 0)) > 0.1) {
                client.socket.emit('playerMove', {
                    x: this.currentPlayer.x,
                    y: this.currentPlayer.y,
                    rotation: this.currentPlayer.rotation
                });
                this.currentPlayer.lastRotation = this.currentPlayer.rotation;
            }
        }
        
        // Update cooldown display
        this.updateCooldownDisplay();
        
        // Update scroll floating animation
        this.scrolls.forEach(scroll => {
            scroll.y = scroll.scrollData.y + Math.sin(Date.now() * 0.003 + scroll.floatOffset) * 5;
        });
        
        // Update spell effects (keeping existing spell effect logic for some spells)
        
        // Update dark holes (pull effect)
        if (this.darkHoles) {
            this.darkHoles.forEach(hole => {
                this.players.forEach((player, playerId) => {
                    const dx = hole.x - player.x;
                    const dy = hole.y - player.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < hole.pullRadius) {
                        // Stronger pull effect based on level
                        const pullStrength = hole.pullForce || 1.5;
                        const pullX = (dx / distance) * pullStrength * delta;
                        const pullY = (dy / distance) * pullStrength * delta;
                        
                        if (playerId === client.socket.id) {
                            // Update current player position
                            this.currentPlayer.x += pullX;
                            this.currentPlayer.y += pullY;
                        }
                        
                        // Damage if very close
                        if (distance < 60) {
                            this.showDamageNumber(hole.damage, player.x, player.y, '#aa44aa');
                            client.socket.emit('playerHit', {
                                targetId: playerId,
                                damage: hole.damage,
                                spellType: 'shadow'
                            });
                        }
                    }
                });
            });
        }
        
        // Update tornadoes (pull effect)
        if (this.tornadoes) {
            this.tornadoes.forEach(tornado => {
                this.players.forEach((player, playerId) => {
                    const dx = tornado.x - player.x;
                    const dy = tornado.y - player.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < tornado.pullRadius) {
                        // Pull players toward tornado
                        const pullStrength = tornado.pullForce || 2;
                        const pullX = (dx / distance) * pullStrength * delta;
                        const pullY = (dy / distance) * pullStrength * delta;
                        
                        if (playerId === client.socket.id) {
                            this.currentPlayer.x += pullX;
                            this.currentPlayer.y += pullY;
                        }
                        
                        // Damage if close
                        if (distance < 80) {
                            this.showDamageNumber(tornado.damage, player.x, player.y, '#44ffff');
                            client.socket.emit('playerHit', {
                                targetId: playerId,
                                damage: tornado.damage,
                                spellType: 'wind'
                            });
                        }
                    }
                });
            });
        }
        
        // Check wall collisions
        if (this.wallObjects) {
            this.wallObjects.forEach(wall => {
                this.players.forEach((player, playerId) => {
                    const dx = Math.abs(wall.x - player.x);
                    const dy = Math.abs(wall.y - player.y);
                    const wallWidth = wall.wallWidth || 30;
                    const wallHeight = wall.wallHeight || 120;
                    
                    // Better collision detection for rectangular wall
                    if (dx < wallWidth/2 + 20 && dy < wallHeight/2 + 20) {
                        // Player is touching the wall
                        this.showDamageNumber(wall.damage, player.x, player.y, '#44aa44');
                        client.socket.emit('playerHit', {
                            targetId: playerId,
                            damage: wall.damage,
                            spellType: 'earth'
                        });
                    }
                });
            });
        }
        
        // Update void creatures in dungeon
        if (this.voidCreatures) {
            this.voidCreatures.forEach((creature, creatureId) => {
                // Move towards current player
                if (this.currentPlayer) {
                    const dx = this.currentPlayer.x - creature.x;
                    const dy = this.currentPlayer.y - creature.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance > 40) {
                        // Move towards player
                        creature.x += (dx / distance) * creature.speed * (delta / 60);
                        creature.y += (dy / distance) * creature.speed * (delta / 60);
                    } else {
                        // Attack player
                        const currentTime = Date.now();
                        if (!creature.lastAttackTime || currentTime - creature.lastAttackTime > 2500) {
                            creature.lastAttackTime = currentTime;
                            
                            this.showDamageNumber(creature.damage, this.currentPlayer.x, this.currentPlayer.y, '#ff00ff');
                            
                            // Create void attack effect
                            const voidAttack = new PIXI.Graphics();
                            voidAttack.beginFill(0xff00ff, 0.8);
                            voidAttack.drawCircle(0, 0, 30);
                            voidAttack.endFill();
                            voidAttack.x = this.currentPlayer.x;
                            voidAttack.y = this.currentPlayer.y;
                            this.app.stage.addChild(voidAttack);
                            
                            setTimeout(() => {
                                if (voidAttack.parent) {
                                    this.app.stage.removeChild(voidAttack);
                                }
                            }, 400);
                            
                            client.socket.emit('playerHit', {
                                targetId: client.socket.id,
                                damage: creature.damage,
                                spellType: 'void'
                            });
                        }
                    }
                }
            });
        }
        
        // Update demon statues
        this.updateDemonStatues();
        
        // Update soul spirits
        if (this.soulSpirits) {
            this.soulSpirits.forEach((spirit, spiritId) => {
                // Move towards nearest enemy player
                let nearestPlayer = null;
                let nearestDistance = Infinity;
                let nearestPlayerId = null;
                
                this.players.forEach((player, playerId) => {
                    if (playerId !== client.socket.id) { // Only target other players
                        const dx = player.x - spirit.x;
                        const dy = player.y - spirit.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance < nearestDistance) {
                            nearestDistance = distance;
                            nearestPlayer = player;
                            nearestPlayerId = playerId;
                        }
                    }
                });
                
                if (nearestPlayer && nearestDistance > 30) {
                    // Move towards player
                    const dx = nearestPlayer.x - spirit.x;
                    const dy = nearestPlayer.y - spirit.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    spirit.x += (dx / distance) * spirit.speed * (delta / 60);
                    spirit.y += (dy / distance) * spirit.speed * (delta / 60);
                } else if (nearestPlayer && nearestDistance <= 30) {
                    // Attack player
                    const currentTime = Date.now();
                    if (!spirit.lastAttackTime || currentTime - spirit.lastAttackTime > 1800) {
                        spirit.lastAttackTime = currentTime;
                        
                        this.showDamageNumber(spirit.damage, nearestPlayer.x, nearestPlayer.y, '#aa00aa');
                        
                        // Create soul attack effect
                        const attackEffect = new PIXI.Graphics();
                        attackEffect.beginFill(0xaa00aa, 0.8);
                        attackEffect.drawCircle(0, 0, 20);
                        attackEffect.endFill();
                        attackEffect.x = nearestPlayer.x;
                        attackEffect.y = nearestPlayer.y;
                        this.app.stage.addChild(attackEffect);
                        
                        setTimeout(() => {
                            if (attackEffect.parent) {
                                this.app.stage.removeChild(attackEffect);
                            }
                        }, 300);
                        
                        client.socket.emit('playerHit', {
                            targetId: nearestPlayerId,
                            damage: spirit.damage,
                            spellType: 'soul'
                        });
                    }
                }
            });
        }
        
        // Update shadow soldiers and knights
        if (this.shadowSoldiers) {
            this.shadowSoldiers.forEach((soldier, soldierId) => {
                // Move towards nearest player (including current player)
                let nearestPlayer = null;
                let nearestDistance = Infinity;
                let nearestPlayerId = null;
                
                this.players.forEach((player, playerId) => {
                    const dx = player.x - soldier.x;
                    const dy = player.y - soldier.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestPlayer = player;
                        nearestPlayerId = playerId;
                    }
                });
                
                if (nearestPlayer && nearestDistance > 35) {
                    // Move towards player
                    const dx = nearestPlayer.x - soldier.x;
                    const dy = nearestPlayer.y - soldier.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    soldier.x += (dx / distance) * soldier.speed * (delta / 60);
                    soldier.y += (dy / distance) * soldier.speed * (delta / 60);
                } else if (nearestPlayer && nearestDistance <= 35) {
                    // Attack player - knights attack faster than soldiers
                    const currentTime = Date.now();
                    const attackCooldown = soldier.attackSpeed || 2000;
                    
                    if (!soldier.lastAttackTime || currentTime - soldier.lastAttackTime > attackCooldown) {
                        soldier.lastAttackTime = currentTime;
                        
                        const damageColor = soldier.spellType === 'shadowKnight' ? '#aa00ff' : '#660066';
                        this.showDamageNumber(soldier.damage, nearestPlayer.x, nearestPlayer.y, damageColor);
                        
                        // Create attack visual effect
                        const attackEffect = new PIXI.Graphics();
                        const effectColor = soldier.spellType === 'shadowKnight' ? 0xaa00ff : 0x660066;
                        attackEffect.beginFill(effectColor, 0.8);
                        attackEffect.drawCircle(0, 0, soldier.spellType === 'shadowKnight' ? 25 : 20);
                        attackEffect.endFill();
                        attackEffect.x = nearestPlayer.x;
                        attackEffect.y = nearestPlayer.y;
                        this.app.stage.addChild(attackEffect);
                        
                        setTimeout(() => {
                            if (attackEffect.parent) {
                                this.app.stage.removeChild(attackEffect);
                            }
                        }, 300);
                        
                        client.socket.emit('playerHit', {
                            targetId: nearestPlayerId,
                            damage: soldier.damage,
                            spellType: soldier.spellType
                        });
                    }
                }
            });
        }
        
        // Update minimap every frame
        this.updateMinimap();
    }
    
    updateCamera() {
        if (!this.currentPlayer) return;
        
        // Center camera on player
        this.camera.x = this.currentPlayer.x - this.app.screen.width / 2;
        this.camera.y = this.currentPlayer.y - this.app.screen.height / 2;
        
        // Keep camera within world bounds
        this.camera.x = Math.max(0, Math.min(this.worldSize.width - this.app.screen.width, this.camera.x));
        this.camera.y = Math.max(0, Math.min(this.worldSize.height - this.app.screen.height, this.camera.y));
        
        // Apply camera position to stage
        this.app.stage.x = -this.camera.x;
        this.app.stage.y = -this.camera.y;
    }
    
    showDamageNumber(damage, x, y, color = '#ff4444') {
        const damageElement = document.createElement('div');
        damageElement.textContent = `-${damage}`;
        damageElement.className = 'damage-number';
        damageElement.style.left = (x - this.camera.x) + 'px';
        damageElement.style.top = (y - this.camera.y) + 'px';
        damageElement.style.color = color;
        
        document.body.appendChild(damageElement);
        
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
    
    initializeMagicMenu() {
        const magicMenuBtn = document.getElementById('magicMenuBtn');
        const magicModal = document.getElementById('magicUpgradeModal');
        const closeBtn = document.getElementById('closeMagicModal');
        
        magicMenuBtn.addEventListener('click', () => {
            this.showMagicMenu();
        });
        
        closeBtn.addEventListener('click', () => {
            magicModal.classList.add('hidden');
        });
        
        magicModal.addEventListener('click', (e) => {
            if (e.target === magicModal) {
                magicModal.classList.add('hidden');
            }
        });
    }
    
    showMagicMenu() {
        if (!this.currentPlayer || !this.currentPlayer.playerData) return;
        
        const modal = document.getElementById('magicUpgradeModal');
        const upgradeList = document.getElementById('magicUpgradeList');
        
        upgradeList.innerHTML = '';
        
        const magicTypes = ['fire', 'ice', 'lightning', 'earth', 'wind', 'shadow', 'light', 'void', 'soul'];
        const magicTypeNames = {
            fire: 'Fire Magic',
            ice: 'Water/Ice Magic', 
            lightning: 'Lightning Magic',
            earth: 'Earth Magic',
            wind: 'Wind Magic',
            shadow: 'Shadow Magic',
            light: 'Light Magic',
            void: 'Void Magic',
            soul: 'Soul Magic'
        };
        
        magicTypes.forEach(type => {
            const playerLevel = this.currentPlayer.playerData.magicLevels[type];
            if (playerLevel > 0) {
                const section = document.createElement('div');
                section.className = `magic-upgrade-section ${type}`;
                
                const header = document.createElement('div');
                header.className = 'magic-type-header';
                
                const icon = document.createElement('div');
                icon.className = `magic-type-icon ${type}-icon`;
                
                const name = document.createElement('div');
                name.className = 'magic-type-name';
                name.textContent = magicTypeNames[type];
                
                const level = document.createElement('div');
                level.className = 'magic-level';
                level.textContent = `Level ${playerLevel}`;
                
                header.appendChild(icon);
                header.appendChild(name);
                header.appendChild(level);
                
                const spellOptions = document.createElement('div');
                spellOptions.className = 'spell-options';
                
                // Add available spells for this magic type
                const spells = this.getMagicSpells(type);
                spells.forEach((spell, index) => {
                    let requiredLevel;
                    if (spell.sss) {
                        requiredLevel = 10; // SSS spells require level 10
                    } else {
                        requiredLevel = index + 1;
                    }
                    
                    const isUnlocked = playerLevel >= requiredLevel;
                    const isSelected = this.currentPlayer.playerData.selectedSpells && 
                                     this.currentPlayer.playerData.selectedSpells[type] === spell.name;
                    
                    const option = document.createElement('div');
                    option.className = `spell-option ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''} ${spell.sss ? 'sss-spell' : ''}`;
                    
                    const spellName = document.createElement('div');
                    spellName.className = 'spell-name';
                    spellName.textContent = spell.sss ? `⭐ ${spell.name} ⭐` : spell.name;
                    
                    const description = document.createElement('div');
                    description.className = 'spell-description';
                    description.textContent = spell.description;
                    
                    const damage = document.createElement('div');
                    damage.className = 'spell-damage';
                    damage.textContent = `${spell.damage} DMG`;
                    
                    if (spell.sss && !isUnlocked) {
                        const requirement = document.createElement('div');
                        requirement.className = 'spell-requirement';
                        requirement.textContent = 'Requires Magic Level 10';
                        option.appendChild(requirement);
                    }
                    
                    option.appendChild(spellName);
                    option.appendChild(description);
                    option.appendChild(damage);
                    
                    if (isUnlocked && !isSelected) {
                        option.addEventListener('click', () => {
                            this.selectSpell(type, spell.name);
                        });
                    }
                    
                    spellOptions.appendChild(option);
                });
                
                section.appendChild(header);
                section.appendChild(spellOptions);
                upgradeList.appendChild(section);
            }
        });
        
        modal.classList.remove('hidden');
    }
    
    initializeMinimap() {
        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.minimapScale = 200 / Math.max(this.worldSize.width, this.worldSize.height);
    }
    
    updateMinimap() {
        if (!this.minimapCtx || !this.currentPlayer) return;
        
        const ctx = this.minimapCtx;
        const scale = this.minimapScale;
        
        // Clear minimap
        ctx.clearRect(0, 0, 200, 200);
        
        // Draw world boundary
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, this.worldSize.width * scale, this.worldSize.height * scale);
        
        // Draw dungeon entrance
        if (this.dungeonEntrance) {
            ctx.fillStyle = '#8a2be2';
            ctx.beginPath();
            ctx.arc(
                this.dungeonEntrance.x * scale,
                this.dungeonEntrance.y * scale,
                5, 0, Math.PI * 2
            );
            ctx.fill();
        }
        
        // Draw other players
        this.players.forEach((player, playerId) => {
            if (playerId !== client.socket.id) {
                ctx.fillStyle = '#ff6666';
                ctx.beginPath();
                ctx.arc(player.x * scale, player.y * scale, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        
        // Draw current player
        ctx.fillStyle = '#66ff66';
        ctx.beginPath();
        ctx.arc(
            this.currentPlayer.x * scale,
            this.currentPlayer.y * scale,
            4, 0, Math.PI * 2
        );
        ctx.fill();
        
        // Draw scrolls
        this.scrolls.forEach(scroll => {
            const colors = {
                fire: '#ff4444',
                ice: '#4444ff',
                lightning: '#ffff44',
                earth: '#44aa44',
                wind: '#44ffff',
                shadow: '#aa44aa',
                light: '#ffffff',
                void: '#8800ff'
            };
            ctx.fillStyle = colors[scroll.scrollData.type] || '#ffffff';
            ctx.beginPath();
            ctx.arc(scroll.x * scale, scroll.y * scale, 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    initializeLeaderboard() {
        const toggleBtn = document.getElementById('toggleLeaderboard');
        const leaderboard = document.getElementById('leaderboard');
        
        toggleBtn.addEventListener('click', () => {
            leaderboard.classList.toggle('collapsed');
        });
        
        // Update leaderboard every 5 seconds
        setInterval(() => {
            this.updateLeaderboard();
        }, 5000);
    }
    
    updateLeaderboard() {
        const leaderboardList = document.getElementById('leaderboardList');
        if (!leaderboardList) return;
        
        // Get all players and sort by level, then by experience
        const players = Array.from(this.players.values()).map(player => ({
            name: player.playerData.name,
            level: player.playerData.level,
            socketId: player.playerData.socketId
        }));
        
        players.sort((a, b) => {
            if (a.level !== b.level) {
                return b.level - a.level; // Higher level first
            }
            return 0; // Same level, keep original order
        });
        
        // Update leaderboard display
        leaderboardList.innerHTML = '';
        players.forEach((player, index) => {
            const entry = document.createElement('div');
            entry.className = 'leaderboard-entry';
            if (player.socketId === client.socket.id) {
                entry.classList.add('current-player');
            }
            
            const rank = document.createElement('span');
            rank.className = 'leaderboard-rank';
            rank.textContent = `#${index + 1}`;
            
            const name = document.createElement('span');
            name.className = 'leaderboard-name';
            name.textContent = player.name;
            
            const level = document.createElement('span');
            level.className = 'leaderboard-level';
            level.textContent = `Lv.${player.level}`;
            
            entry.appendChild(rank);
            entry.appendChild(name);
            entry.appendChild(level);
            leaderboardList.appendChild(entry);
        });
    }
    
    getMagicSpells(type) {
        const spells = {
            fire: [
                { name: 'Fireball', damage: 15, description: 'Basic explosive fireball' },
                { name: 'Flame Burst', damage: 25, description: 'Larger explosive fireball' },
                { name: 'Inferno Blast', damage: 35, description: 'Massive fire explosion' },
                { name: 'Apocalypse Fire', damage: 65, description: 'SSS: World-ending flames that consume everything', sss: true }
            ],
            ice: [
                { name: 'Water Bullet', damage: 12, description: 'Fast water projectile' },
                { name: 'Ice Shard', damage: 20, description: 'Sharp piercing ice' },
                { name: 'Frost Storm', damage: 30, description: 'Multiple ice projectiles' },
                { name: 'Absolute Zero', damage: 60, description: 'SSS: Freezes time and space itself', sss: true }
            ],
            lightning: [
                { name: 'Lightning Bolt', damage: 25, description: 'Instant electric strike' },
                { name: 'Chain Lightning', damage: 35, description: 'Lightning that jumps' },
                { name: 'Thunder Storm', damage: 45, description: 'Area lightning attack' },
                { name: 'God\'s Wrath', damage: 70, description: 'SSS: Divine lightning from the heavens', sss: true }
            ],
            earth: [
                { name: 'Earth Wall', damage: 20, description: 'Damaging barrier wall' },
                { name: 'Stone Spikes', damage: 30, description: 'Sharp stone projectiles' },
                { name: 'Earthquake', damage: 40, description: 'Ground shaking attack' },
                { name: 'Continental Drift', damage: 62, description: 'SSS: Moves entire landmasses', sss: true }
            ],
            wind: [
                { name: 'Wind Blast', damage: 30, description: 'Powerful wind attack' },
                { name: 'Tornado', damage: 40, description: 'Spinning wind vortex' },
                { name: 'Hurricane', damage: 50, description: 'Massive wind storm' },
                { name: 'Atmospheric Collapse', damage: 68, description: 'SSS: Destroys the very air itself', sss: true }
            ],
            shadow: [
                { name: 'Dark Hole', damage: 40, description: 'Pulls enemies and damages' },
                { name: 'Shadow Void', damage: 50, description: 'Larger gravitational pull' },
                { name: 'Black Hole', damage: 60, description: 'Massive dark vortex' },
                { name: 'Reality Erasure', damage: 55, description: 'SSS: Spawns shadow knights and erases reality', sss: true }
            ],
            light: [
                { name: 'Light Beam', damage: 50, description: 'Piercing light ray' },
                { name: 'Holy Nova', damage: 60, description: 'Radial light explosion' },
                { name: 'Divine Wrath', damage: 70, description: 'Ultimate light attack' },
                { name: 'Genesis Burst', damage: 72, description: 'SSS: The light of creation itself', sss: true }
            ],
            void: [
                { name: 'Void Blast', damage: 65, description: 'Pure void energy projectile' },
                { name: 'Reality Tear', damage: 75, description: 'Tears through reality itself' },
                { name: 'Dimension Collapse', damage: 85, description: 'Collapses dimensional space' },
                { name: 'Universal Void', damage: 80, description: 'SSS: Consumes reality itself', sss: true }
            ],
            soul: [
                { name: 'Soul Drain', damage: 35, description: 'Drains life and heals caster' },
                { name: 'Spirit Army', damage: 25, description: 'Summons fighting spirits' },
                { name: 'Soul Storm', damage: 55, description: 'Devastating soul tornado' },
                { name: 'Death Incarnate', damage: 75, description: 'SSS: Summons Death itself', sss: true }
            ]
        };
        
        return spells[type] || [];
    }
    
    selectSpell(magicType, spellName) {
        if (this.currentPlayer && this.currentPlayer.playerData) {
            this.currentPlayer.playerData.selectedSpells[magicType] = spellName;
            client.socket.emit('selectSpell', { magicType, spellName });
            this.showMagicMenu(); // Refresh the menu
        }
    }
    
    updateCooldownDisplay() {
        const slots = document.querySelectorAll('.spell-slot');
        slots.forEach(slot => {
            const type = slot.dataset.type;
            const cooldownOverlay = slot.querySelector('.cooldown-overlay');
            const cooldownText = slot.querySelector('.cooldown-text');
            
            if (cooldownOverlay && cooldownText && this.magicCooldowns[type] > 0) {
                const remaining = Math.ceil(this.magicCooldowns[type] / 1000);
                cooldownOverlay.style.display = 'block';
                cooldownText.textContent = remaining;
                cooldownText.style.display = 'block';
            } else if (cooldownOverlay && cooldownText) {
                cooldownOverlay.style.display = 'none';
                cooldownText.style.display = 'none';
            }
        });
    }
    
    checkBushConcealment() {
        if (!this.currentPlayer || !this.bushes) return;
        
        let isConcealed = false;
        this.bushes.forEach(bush => {
            const dx = bush.x - this.currentPlayer.x;
            const dy = bush.y - this.currentPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < bush.radius) {
                isConcealed = true;
                // Make player semi-transparent when concealed
                this.currentPlayer.alpha = 0.5;
            }
        });
        
        if (!isConcealed) {
            this.currentPlayer.alpha = 1.0;
        }
        
        // Store concealment status
        this.currentPlayer.isConcealed = isConcealed;
    }
    
    // Server event handlers
    addPlayer(playerData) {
        const player = this.createPlayer(playerData);
        this.players.set(playerData.socketId, player);
        this.app.stage.addChild(player);
        
        if (playerData.socketId === client.socket.id) {
            this.currentPlayer = player;
        }
    }
    
    updatePlayer(playerId, data) {
        const player = this.players.get(playerId);
        if (player) {
            player.x = data.x;
            player.y = data.y;
            if (data.rotation !== undefined) {
                player.rotation = data.rotation;
            }
        }
    }
    
    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            this.app.stage.removeChild(player);
            this.players.delete(playerId);
        }
    }
    
    addScroll(scrollData) {
        const scroll = this.createScroll(scrollData);
        this.scrolls.set(scrollData.id, scroll);
        this.app.stage.addChild(scroll);
        
        // Show rarity popup
        ui.showRarityPopup(scrollData.rarity, scrollData.x, scrollData.y);
    }
    
    removeScroll(scrollId) {
        const scroll = this.scrolls.get(scrollId);
        if (scroll) {
            this.app.stage.removeChild(scroll);
            this.scrolls.delete(scrollId);
        }
    }
    
    addSpell(spellData) {
        const spell = this.createSpellEffect(spellData);
        this.spells.set(spellData.id, spell);
        this.app.stage.addChild(spell);
    }
    
    removeSpell(spellId) {
        const spell = this.spells.get(spellId);
        if (spell) {
            this.app.stage.removeChild(spell);
            this.spells.delete(spellId);
        }
    }
    
    checkScrollCollection() {
        if (!this.currentPlayer) return;
        
        this.scrolls.forEach((scroll, scrollId) => {
            const dx = this.currentPlayer.x - scroll.x;
            const dy = this.currentPlayer.y - scroll.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 50) { // Increased collection range
                // Void magic cannot be collected from scrolls - only unlocked through dungeon
                if (scroll.scrollData.type === 'void') {
                    return;
                }
                
                // Check if player already has this magic type
                if (this.currentPlayer.playerData && this.currentPlayer.playerData.magicLevels[scroll.scrollData.type] > 0) {
                    // Player already has this magic type, don't collect
                    return;
                }
                client.socket.emit('collectScroll', scrollId);
            }
        });
    }

    // Animation synchronization methods for multiplayer
    playSpellAnimation(data) {
        const player = this.players.get(data.playerId);
        if (!player) return;

        // Calculate casting position relative to the other player
        const wandX = player.x + Math.cos(player.rotation || 0) * 40;
        const wandY = player.y + Math.sin(player.rotation || 0) * 40;
        
        // Create spell effect for other players
        this.createSynchronizedSpellEffect(data.type, data.spellName, wandX, wandY, data.targetX, data.targetY, data.level);
        
        // Add visual effect at the casting player's position
        this.createSpecialMagicEffect(data.type, wandX, wandY);
    }

    playTransformationAnimation(data) {
        const player = this.players.get(data.playerId);
        if (!player) return;

        // Play transformation visual effects
        switch(data.animationType) {
            case 'transform':
                this.createTransformationEffect(player.x, player.y, data.transformationType);
                this.updatePlayerTransformation(data.playerId, data.transformationType);
                break;
            case 'skill':
                this.createTransformationSkillEffect(data);
                break;
            case 'beam':
                this.createSynchronizedDragonBeam(data);
                break;
        }
    }

    updatePlayerTransformation(playerId, transformationType) {
        const player = this.players.get(playerId);
        if (!player) return;

        // Update player appearance based on transformation
        player.currentTransformation = transformationType;
        this.updatePlayerVisualAppearance(player, transformationType);
    }

    updatePlayerVisualAppearance(player, transformationType) {
        // Remove existing transformation graphics
        if (player.transformationGraphics) {
            player.removeChild(player.transformationGraphics);
        }

        // Create new transformation appearance
        const transformationGraphics = new PIXI.Container();
        
        switch(transformationType) {
            case 'adminGod':
                this.createAdminGodAppearance(transformationGraphics);
                break;
            case 'bloodLust':
                this.createBloodLustAppearance(transformationGraphics);
                break;
            case 'shadowNinja':
                this.createShadowNinjaAppearance(transformationGraphics);
                break;
            case 'dragonLord':
                this.createDragonLordAppearance(transformationGraphics);
                break;
            case 'phoenixEmperor':
                this.createPhoenixEmperorAppearance(transformationGraphics);
                break;
            case 'voidLeviathanKing':
                this.createVoidLeviathanKingAppearance(transformationGraphics);
                break;
            case 'celestialTigerGod':
                this.createCelestialTigerGodAppearance(transformationGraphics);
                break;
        }

        player.transformationGraphics = transformationGraphics;
        player.addChild(transformationGraphics);
    }

    createAdminGodAppearance(container) {
        // Golden aura
        const aura = new PIXI.Graphics();
        aura.beginFill(0xFFD700, 0.3);
        aura.drawCircle(0, 0, 40);
        aura.endFill();
        container.addChild(aura);

        // Divine light rays
        for (let i = 0; i < 8; i++) {
            const ray = new PIXI.Graphics();
            ray.lineStyle(2, 0xFFFFFF, 0.8);
            const angle = (i / 8) * Math.PI * 2;
            ray.moveTo(0, 0);
            ray.lineTo(Math.cos(angle) * 35, Math.sin(angle) * 35);
            container.addChild(ray);
        }
    }

    createBloodLustAppearance(container) {
        // Blood red aura
        const aura = new PIXI.Graphics();
        aura.beginFill(0xFF0000, 0.4);
        aura.drawCircle(0, 0, 35);
        aura.endFill();
        container.addChild(aura);

        // Dark energy wisps
        for (let i = 0; i < 6; i++) {
            const wisp = new PIXI.Graphics();
            wisp.beginFill(0x8B0000, 0.6);
            wisp.drawCircle(0, 0, 3);
            wisp.endFill();
            
            const angle = (i / 6) * Math.PI * 2;
            wisp.x = Math.cos(angle) * 25;
            wisp.y = Math.sin(angle) * 25;
            container.addChild(wisp);
        }
    }

    createShadowNinjaAppearance(container) {
        // Shadow effect
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.5);
        shadow.drawCircle(0, 0, 30);
        shadow.endFill();
        container.addChild(shadow);

        // Purple outline
        const outline = new PIXI.Graphics();
        outline.lineStyle(2, 0x800080);
        outline.drawCircle(0, 0, 25);
        container.addChild(outline);
    }

    createDragonLordAppearance(container) {
        // Dragon scales effect
        const scales = new PIXI.Graphics();
        scales.beginFill(0x228B22, 0.6);
        scales.drawCircle(0, 0, 35);
        scales.endFill();
        container.addChild(scales);

        // Dragon head silhouette
        const head = new PIXI.Graphics();
        head.beginFill(0x32CD32);
        head.drawEllipse(20, -10, 15, 10);
        head.endFill();
        container.addChild(head);
    }

    createPhoenixEmperorAppearance(container) {
        // Fire aura
        const fireAura = new PIXI.Graphics();
        fireAura.beginFill(0xFF4500, 0.4);
        fireAura.drawCircle(0, 0, 40);
        fireAura.endFill();
        container.addChild(fireAura);

        // Flame wings
        const leftWing = new PIXI.Graphics();
        leftWing.beginFill(0xFF6347, 0.7);
        leftWing.drawEllipse(-25, 0, 15, 25);
        leftWing.endFill();
        
        const rightWing = new PIXI.Graphics();
        rightWing.beginFill(0xFF6347, 0.7);
        rightWing.drawEllipse(25, 0, 15, 25);
        rightWing.endFill();
        
        container.addChild(leftWing);
        container.addChild(rightWing);
    }

    createVoidLeviathanKingAppearance(container) {
        // Void aura
        const voidAura = new PIXI.Graphics();
        voidAura.beginFill(0x8800FF, 0.4);
        voidAura.drawCircle(0, 0, 45);
        voidAura.endFill();
        container.addChild(voidAura);

        // Void tentacles
        for (let i = 0; i < 4; i++) {
            const tentacle = new PIXI.Graphics();
            tentacle.lineStyle(4, 0x4400AA);
            const angle = (i / 4) * Math.PI * 2;
            tentacle.moveTo(0, 0);
            tentacle.lineTo(Math.cos(angle) * 40, Math.sin(angle) * 40);
            container.addChild(tentacle);
        }
    }

    createCelestialTigerGodAppearance(container) {
        // Celestial aura
        const aura = new PIXI.Graphics();
        aura.beginFill(0xFFD700, 0.3);
        aura.drawCircle(0, 0, 38);
        aura.endFill();
        container.addChild(aura);

        // Tiger stripes
        for (let i = 0; i < 6; i++) {
            const stripe = new PIXI.Graphics();
            stripe.lineStyle(3, 0xFF8C00);
            stripe.moveTo(-20, -15 + i * 5);
            stripe.lineTo(20, -15 + i * 5);
            container.addChild(stripe);
        }
    }

    createSynchronizedDragonBeam(data) {
        const player = this.players.get(data.playerId);
        if (!player) return;

        const beam = new PIXI.Graphics();
        beam.alpha = 0.9;
        
        // Main red beam
        beam.lineStyle(20, 0xFF0000, 0.9);
        beam.moveTo(player.x + 75, player.y - 5);
        beam.lineTo(data.targetX, data.targetY);
        
        // Inner bright core
        beam.lineStyle(12, 0xFF6666, 0.8);
        beam.moveTo(player.x + 75, player.y - 5);
        beam.lineTo(data.targetX, data.targetY);
        
        // Innermost white-hot core
        beam.lineStyle(6, 0xFFFFFF, 0.7);
        beam.moveTo(player.x + 75, player.y - 5);
        beam.lineTo(data.targetX, data.targetY);
        
        this.app.stage.addChild(beam);
        
        // Remove beam after short duration
        setTimeout(() => {
            if (beam.parent) {
                this.app.stage.removeChild(beam);
            }
        }, 500);
    }

    removePlayerTransformation(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;

        // Remove transformation graphics
        if (player.transformationGraphics) {
            player.removeChild(player.transformationGraphics);
            player.transformationGraphics = null;
        }
        
        player.currentTransformation = null;
    }

    playAttackAnimation(data) {
        // Play attack animation for other players to see
        switch(data.attackType) {
            case 'divine_presence':
                this.createDivinePresence(data.targetX, data.targetY, 1);
                break;
            case 'rainbow_divine_blast':
                this.createRainbowDivineBlast(data.targetX, data.targetY, 1);
                break;
            case 'mega_fireball':
                this.createMegaFireball(data.targetX, data.targetY, 1);
                break;
            case 'tsunami':
                this.createTsunami(data.targetX, data.targetY, 1);
                break;
            case 'apocalypse_fire':
                this.createApocalypseFire(data.targetX, data.targetY, 1);
                break;
            default:
                this.createSpecialMagicEffect(data.attackType, data.x, data.y);
        }
    }

    playStatueAnimation(data) {
        // Play statue interaction animations
        switch(data.animationType) {
            case 'damage':
                this.createStatueDamageEffect(data.x, data.y);
                break;
            case 'destroy':
                this.createStatueDestroyEffect(data.x, data.y);
                break;
        }
    }

    createTransformationEffect(x, y, transformationType) {
        // Create visual transformation effect
        const effect = document.createElement('div');
        effect.style.position = 'fixed';
        effect.style.left = (x - this.camera.x - 50) + 'px';
        effect.style.top = (y - this.camera.y - 50) + 'px';
        effect.style.width = '100px';
        effect.style.height = '100px';
        effect.style.background = this.getTransformationColor(transformationType);
        effect.style.borderRadius = '50%';
        effect.style.animation = 'transformationEffect 2s ease-out forwards';
        effect.style.pointerEvents = 'none';
        effect.style.zIndex = '999';
        
        document.body.appendChild(effect);
        setTimeout(() => {
            if (effect.parentNode) effect.parentNode.removeChild(effect);
        }, 2000);
    }

    createTransformationSkillEffect(data) {
        const effect = document.createElement('div');
        effect.style.position = 'fixed';
        effect.style.left = (data.x - this.camera.x - 30) + 'px';
        effect.style.top = (data.y - this.camera.y - 30) + 'px';
        effect.style.width = '60px';
        effect.style.height = '60px';
        effect.style.background = 'radial-gradient(circle, #ff0080, #8000ff)';
        effect.style.borderRadius = '50%';
        effect.style.animation = 'skillEffect 1.5s ease-out forwards';
        effect.style.pointerEvents = 'none';
        effect.style.zIndex = '999';
        
        document.body.appendChild(effect);
        setTimeout(() => {
            if (effect.parentNode) effect.parentNode.removeChild(effect);
        }, 1500);
    }

    createStatueDamageEffect(x, y) {
        const effect = document.createElement('div');
        effect.style.position = 'fixed';
        effect.style.left = (x - this.camera.x - 25) + 'px';
        effect.style.top = (y - this.camera.y - 25) + 'px';
        effect.style.width = '50px';
        effect.style.height = '50px';
        effect.style.background = 'radial-gradient(circle, #ff4444, transparent)';
        effect.style.borderRadius = '50%';
        effect.style.animation = 'damageEffect 0.8s ease-out forwards';
        effect.style.pointerEvents = 'none';
        effect.style.zIndex = '999';
        
        document.body.appendChild(effect);
        setTimeout(() => {
            if (effect.parentNode) effect.parentNode.removeChild(effect);
        }, 800);
    }

    createStatueDestroyEffect(x, y) {
        // Create multiple explosion particles
        for (let i = 0; i < 12; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'fixed';
            particle.style.width = '8px';
            particle.style.height = '8px';
            particle.style.background = '#888888';
            particle.style.borderRadius = '50%';
            particle.style.pointerEvents = 'none';
            particle.style.zIndex = '999';
            
            const angle = (i / 12) * Math.PI * 2;
            const startX = x - this.camera.x;
            const startY = y - this.camera.y;
            
            particle.style.left = startX + 'px';
            particle.style.top = startY + 'px';
            
            document.body.appendChild(particle);
            
            // Animate particle
            let radius = 0;
            const animate = () => {
                radius += 3;
                particle.style.left = (startX + Math.cos(angle) * radius) + 'px';
                particle.style.top = (startY + Math.sin(angle) * radius) + 'px';
                particle.style.opacity = Math.max(0, 1 - radius / 100);
                
                if (radius < 100 && particle.parentNode) {
                    requestAnimationFrame(animate);
                } else if (particle.parentNode) {
                    document.body.removeChild(particle);
                }
            };
            animate();
        }
    }

    getTransformationColor(transformationType) {
        const colors = {
            'angel': 'radial-gradient(circle, #ffffff, #ffdd44)',
            'demon': 'radial-gradient(circle, #8b0000, #ff0000)',
            'phoenix': 'radial-gradient(circle, #ff4500, #ff8c00)',
            'dragon': 'radial-gradient(circle, #228b22, #32cd32)',
            'vampire': 'radial-gradient(circle, #800080, #ff00ff)'
        };
        return colors[transformationType] || 'radial-gradient(circle, #ffffff, #cccccc)';
    }

    // Create synchronized spell effects for other players
    createSynchronizedSpellEffect(spellType, spellName, startX, startY, targetX, targetY, level) {
        // Create the exact same spell effects that the caster sees
        switch(spellName) {
            case 'Fireball':
                this.createSynchronizedFireball(startX, startY, targetX, targetY, level);
                break;
            case 'Flame Burst':
                this.createSynchronizedFlameBurst(startX, startY, targetX, targetY, level);
                break;
            case 'Inferno Blast':
                this.createSynchronizedInfernoBlast(startX, startY, targetX, targetY, level);
                break;
            case 'Water Bullet':
                this.createSynchronizedWaterBullet(startX, startY, targetX, targetY, level);
                break;
            case 'Ice Shard':
                this.createSynchronizedIceShard(startX, startY, targetX, targetY, level);
                break;
            case 'Frost Storm':
                this.createSynchronizedFrostStorm(startX, startY, targetX, targetY, level);
                break;
            case 'Lightning Bolt':
                this.createSynchronizedLightningBolt(startX, startY, targetX, targetY, level);
                break;
            case 'Chain Lightning':
                this.createSynchronizedChainLightning(startX, startY, targetX, targetY, level);
                break;
            case 'Thunder Storm':
                this.createSynchronizedThunderStorm(startX, startY, targetX, targetY, level);
                break;
            case 'Earth Wall':
                this.createSynchronizedEarthWall(startX, startY, targetX, targetY, level);
                break;
            case 'Stone Spikes':
                this.createSynchronizedStoneSpikes(startX, startY, targetX, targetY, level);
                break;
            case 'Earthquake':
                this.createSynchronizedEarthquake(startX, startY, targetX, targetY, level);
                break;
            case 'Wind Blast':
                this.createSynchronizedWindBlast(startX, startY, targetX, targetY, level);
                break;
            case 'Tornado':
                this.createSynchronizedTornado(startX, startY, targetX, targetY, level);
                break;
            case 'Hurricane':
                this.createSynchronizedHurricane(startX, startY, targetX, targetY, level);
                break;
            case 'Dark Hole':
                this.createSynchronizedDarkHole(startX, startY, targetX, targetY, level);
                break;
            case 'Shadow Void':
                this.createSynchronizedShadowVoid(startX, startY, targetX, targetY, level);
                break;
            case 'Black Hole':
                this.createSynchronizedBlackHole(startX, startY, targetX, targetY, level);
                break;
            case 'Light Beam':
                this.createSynchronizedLightBeam(startX, startY, targetX, targetY, level);
                break;
            case 'Holy Nova':
                this.createSynchronizedHolyNova(startX, startY, targetX, targetY, level);
                break;
            case 'Divine Wrath':
                this.createSynchronizedDivineWrath(startX, startY, targetX, targetY, level);
                break;
            case 'Void Blast':
                this.createSynchronizedVoidBlast(startX, startY, targetX, targetY, level);
                break;
            case 'Reality Tear':
                this.createSynchronizedRealityTear(startX, startY, targetX, targetY, level);
                break;
            case 'Dimension Collapse':
                this.createSynchronizedDimensionCollapse(startX, startY, targetX, targetY, level);
                break;
            case 'Soul Drain':
                this.createSynchronizedSoulDrain(startX, startY, targetX, targetY, level);
                break;
            case 'Soul Burst':
                this.createSynchronizedSoulBurst(startX, startY, targetX, targetY, level);
                break;
            case 'Soul Storm':
                this.createSynchronizedSoulStorm(startX, startY, targetX, targetY, level);
                break;
            default:
                // Fallback for any unhandled spells
                this.createGenericSynchronizedSpell(spellType, startX, startY, targetX, targetY);
        }
    }

    // Synchronized Water Bullet effect for other players
    createSynchronizedWaterBullet(startX, startY, targetX, targetY, level) {
        const waterContainer = new PIXI.Container();
        
        // Main water projectile
        const water = new PIXI.Graphics();
        water.beginFill(0x4444ff);
        water.drawCircle(0, 0, 6);
        water.endFill();
        
        // Water trail effect
        const trail = new PIXI.Graphics();
        trail.beginFill(0x6666ff, 0.6);
        trail.drawCircle(0, 0, 10);
        trail.endFill();
        
        waterContainer.addChild(trail);
        waterContainer.addChild(water);
        waterContainer.x = startX;
        waterContainer.y = startY;
        
        this.app.stage.addChild(waterContainer);
        
        // Animate projectile
        const dx = targetX - startX;
        const dy = targetY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = 400;
        const time = distance / speed * 1000;
        
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / time;
            
            if (progress < 1) {
                waterContainer.x = startX + dx * progress;
                waterContainer.y = startY + dy * progress;
                requestAnimationFrame(animate);
            } else {
                // Impact effect
                this.createWaterImpactEffect(targetX, targetY);
                if (waterContainer.parent) {
                    this.app.stage.removeChild(waterContainer);
                }
            }
        };
        animate();
    }

    // Synchronized Fireball effect for other players
    createSynchronizedFireball(startX, startY, targetX, targetY, level) {
        const fireballContainer = new PIXI.Container();
        
        // Core
        const core = new PIXI.Graphics();
        core.beginFill(0xffff44);
        core.drawCircle(0, 0, 6);
        core.endFill();
        
        // Inner flame
        const innerFlame = new PIXI.Graphics();
        innerFlame.beginFill(0xff6600, 0.8);
        innerFlame.drawCircle(0, 0, 10);
        innerFlame.endFill();
        
        // Outer flame
        const outerFlame = new PIXI.Graphics();
        outerFlame.beginFill(0xff4444, 0.6);
        outerFlame.drawCircle(0, 0, 14);
        outerFlame.endFill();
        
        fireballContainer.addChild(outerFlame);
        fireballContainer.addChild(innerFlame);
        fireballContainer.addChild(core);
        fireballContainer.x = startX;
        fireballContainer.y = startY;
        
        this.app.stage.addChild(fireballContainer);
        
        // Animate projectile
        const dx = targetX - startX;
        const dy = targetY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = 450;
        const time = distance / speed * 1000;
        
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / time;
            
            if (progress < 1) {
                fireballContainer.x = startX + dx * progress;
                fireballContainer.y = startY + dy * progress;
                fireballContainer.rotation += 0.15;
                requestAnimationFrame(animate);
            } else {
                // Explosion effect
                this.createFireExplosion(targetX, targetY, level);
                if (fireballContainer.parent) {
                    this.app.stage.removeChild(fireballContainer);
                }
            }
        };
        animate();
    }

    // Synchronized Dark Hole effect for other players
    createSynchronizedDarkHole(startX, startY, targetX, targetY, level) {
        const darkHoleContainer = new PIXI.Container();
        darkHoleContainer.x = targetX;
        darkHoleContainer.y = targetY;
        
        // Create dark hole visual
        const hole = new PIXI.Graphics();
        hole.beginFill(0x000000, 0.9);
        hole.drawCircle(0, 0, 30);
        hole.endFill();
        
        const innerRing = new PIXI.Graphics();
        innerRing.lineStyle(3, 0x800080);
        innerRing.drawCircle(0, 0, 25);
        
        const outerRing = new PIXI.Graphics();
        outerRing.lineStyle(2, 0x400040);
        outerRing.drawCircle(0, 0, 35);
        
        darkHoleContainer.addChild(hole);
        darkHoleContainer.addChild(innerRing);
        darkHoleContainer.addChild(outerRing);
        
        this.app.stage.addChild(darkHoleContainer);
        
        // Animate dark hole
        let scale = 0;
        const animateHole = () => {
            scale += 0.05;
            if (scale < 1.5) {
                darkHoleContainer.scale.set(scale);
                darkHoleContainer.rotation += 0.1;
                requestAnimationFrame(animateHole);
            } else {
                setTimeout(() => {
                    if (darkHoleContainer.parent) {
                        this.app.stage.removeChild(darkHoleContainer);
                    }
                }, 1000);
            }
        };
        animateHole();
    }

    // Generic synchronized spell effect
    createGenericSynchronizedSpell(spellType, startX, startY, targetX, targetY) {
        const color = this.getScrollColor(spellType);
        
        const spellContainer = new PIXI.Container();
        const spell = new PIXI.Graphics();
        spell.beginFill(color);
        spell.drawCircle(0, 0, 8);
        spell.endFill();
        
        spellContainer.addChild(spell);
        spellContainer.x = startX;
        spellContainer.y = startY;
        
        this.app.stage.addChild(spellContainer);
        
        // Animate projectile
        const dx = targetX - startX;
        const dy = targetY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = 300;
        const time = distance / speed * 1000;
        
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / time;
            
            if (progress < 1) {
                spellContainer.x = startX + dx * progress;
                spellContainer.y = startY + dy * progress;
                requestAnimationFrame(animate);
            } else {
                if (spellContainer.parent) {
                    this.app.stage.removeChild(spellContainer);
                }
            }
        };
        animate();
    }

    createWaterImpactEffect(x, y) {
        for (let i = 0; i < 8; i++) {
            const splash = new PIXI.Graphics();
            splash.beginFill(0x4444ff, 0.7);
            splash.drawCircle(0, 0, 3);
            splash.endFill();
            
            const angle = (i / 8) * Math.PI * 2;
            splash.x = x;
            splash.y = y;
            
            this.app.stage.addChild(splash);
            
            // Animate splash
            let distance = 0;
            const animateSplash = () => {
                distance += 2;
                splash.x = x + Math.cos(angle) * distance;
                splash.y = y + Math.sin(angle) * distance;
                splash.alpha = Math.max(0, 1 - distance / 30);
                
                if (distance < 30 && splash.parent) {
                    requestAnimationFrame(animateSplash);
                } else if (splash.parent) {
                    this.app.stage.removeChild(splash);
                }
            };
            animateSplash();
        }
    }
}

// Initialize game when DOM is loaded
let game;

document.addEventListener('DOMContentLoaded', () => {
    game = new Game();
});