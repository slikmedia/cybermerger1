import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import QuestPanel from './QuestPanel';
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import '../App.css'; // Import the CSS file

const GRID_WIDTH = 7;
const GRID_HEIGHT = 9;
const CELL_SIZE = 90;
const MARGIN = 1;
const EFFECTIVE_CELL_SIZE = CELL_SIZE - 2 * MARGIN;
const GEM_DROP_CHANCE = 0.05; // 5% chance to drop a gem

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.energy = 100;
        this.isGeneratorDragging = false;
        this.generatorMoved = false;
        this.claimSoundTimer = null;
    }

    preload() {
        this.load.image('generator', 'assets/generator.png');
        for (let i = 1; i <= 5; i++) {
            this.load.image(`level${i}`, `assets/level${i}.png`);
            this.load.image(`gem${i}`, `assets/gem${i}.png`);
            this.load.image(`energy${i}`, `assets/energy${i}.png`);
        }

        // Add error handling for audio loading
        this.load.audio('mergeSound', 'assets/merge.mp3').on('loaderror', this.handleAudioLoadError, this);
        this.load.audio('spawnSound', 'assets/spawn.mp3').on('loaderror', this.handleAudioLoadError, this);
        this.load.audio('backgroundMusic', 'assets/background_music.mp3').on('loaderror', this.handleAudioLoadError, this);
        this.load.audio('questCompleteSound', 'assets/quest_complete.mp3').on('loaderror', this.handleAudioLoadError, this);
        this.load.audio('claimQuestSound', 'assets/claim_quest.mp3').on('loaderror', this.handleAudioLoadError, this);
        this.load.audio('gemConsumeSound', 'assets/gem_consume.mp3').on('loaderror', this.handleAudioLoadError, this);
    }

    handleAudioLoadError(file) {
        console.error(`Error loading audio file: ${file.key}`);
        // Optionally, you can set a flag to disable sound if loading fails
        // this.soundEnabled = false;
    }

    create() {
        const startX = (this.sys.game.config.width - GRID_WIDTH * CELL_SIZE) / 2;
        const startY = (this.sys.game.config.height - GRID_HEIGHT * CELL_SIZE) / 2;

        this.gridInfo = { startX, startY, gridWidth: GRID_WIDTH, gridHeight: GRID_HEIGHT, cellSize: CELL_SIZE };
        this.gridOccupancy = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(false));
        this.gridItems = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(null));

        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const cellX = startX + x * CELL_SIZE + MARGIN;
                const cellY = startY + y * CELL_SIZE + MARGIN;
                const cell = this.add.rectangle(cellX, cellY, EFFECTIVE_CELL_SIZE, EFFECTIVE_CELL_SIZE, 0x000000);
                cell.setOrigin(0, 0);
                cell.setAlpha(0.5);
            }
        }

        const centerX = startX + Math.floor(GRID_WIDTH / 2) * CELL_SIZE + CELL_SIZE / 2;
        const centerY = startY + Math.floor(GRID_HEIGHT / 2) * CELL_SIZE + CELL_SIZE / 2;
        const generator = this.add.image(centerX, centerY, 'generator');
        generator.setDisplaySize(EFFECTIVE_CELL_SIZE, EFFECTIVE_CELL_SIZE);
        generator.setInteractive({ draggable: true });
        generator.on('pointerup', this.spawnItem, this);

        this.generator = generator;
        this.generator.gridX = Math.floor(GRID_WIDTH / 2);
        this.generator.gridY = Math.floor(GRID_HEIGHT / 2);
        this.gridItems[this.generator.gridY][this.generator.gridX] = 'generator';
        this.gridOccupancy[this.generator.gridY][this.generator.gridX] = true;

        this.input.setDraggable(generator);
        this.input.on('dragstart', this.onDragStart, this);
        this.input.on('drag', this.onDrag, this);
        this.input.on('dragend', this.onDragEnd, this);

        this.backgroundMusic = this.sound.add('backgroundMusic', { loop: true, volume: 0.5 });
        this.backgroundMusic.play();

        // Initialize haptic feedback
        this.initHapticFeedback();
    }

    spawnItem() {
        if (this.energy <= 0 || this.isGeneratorDragging || this.generatorMoved) return;

        const { startX, startY, gridWidth, gridHeight, cellSize } = this.gridInfo;
        const emptySpots = [];
        const generatorX = this.generator.gridX;
        const generatorY = this.generator.gridY;

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                if (!this.gridItems[y][x] && !this.gridOccupancy[y][x]) {
                    const distance = Math.sqrt(Math.pow(x - generatorX, 2) + Math.pow(y - generatorY, 2));
                    emptySpots.push({ x, y, distance });
                }
            }
        }

        if (emptySpots.length > 0) {
            this.sound.play('spawnSound');

            emptySpots.sort((a, b) => a.distance - b.distance);
            const closestSpots = emptySpots.slice(0, Math.min(3, emptySpots.length));
            const spot = Phaser.Math.RND.pick(closestSpots);

            this.gridOccupancy[spot.y][spot.x] = true;

            const itemX = startX + spot.x * cellSize + cellSize / 2;
            const itemY = startY + spot.y * cellSize + cellSize / 2;

            const generatorCenterX = startX + generatorX * cellSize + cellSize / 2;
            const generatorCenterY = startY + generatorY * cellSize + cellSize / 2;
            const item = this.add.image(generatorCenterX, generatorCenterY, 'level1');
            item.setDisplaySize(cellSize, cellSize);
            item.setInteractive({ draggable: true });
            item.level = 1;
            item.gridX = spot.x;
            item.gridY = spot.y;
            item.type = 'level1';

            this.tweens.add({
                targets: item,
                x: itemX,
                y: itemY,
                duration: 300,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    this.gridItems[spot.y][spot.x] = item;
                    if (this.game.react) {
                        this.game.react.updateQuestProgress(item.type, 1);
                        this.updateAllQuestProgress();
                    }
                }
            });

            this.energy--;
            if (this.game.react) {
                this.game.react.updateEnergy(this.energy);
            }
        }
        this.updateAllQuestProgress();
    }

    onDragStart(pointer, gameObject) {
        this.children.bringToTop(gameObject);
        if (gameObject === this.generator) {
            this.isGeneratorDragging = true;
            this.generatorMoved = false;
        }
    }

    onDrag(pointer, gameObject, dragX, dragY) {
        gameObject.x = dragX;
        gameObject.y = dragY;
        if (gameObject === this.generator) {
            this.generatorMoved = true;
        }
    }

    onDragEnd(pointer, gameObject) {
        const dropPos = this.getGridPosition(gameObject);
        const startPos = { x: gameObject.gridX, y: gameObject.gridY };

        if (gameObject === this.generator) {
            if (!this.gridOccupancy[dropPos.y][dropPos.x]) {
                this.moveGenerator(gameObject, dropPos);
            } else {
                this.resetPosition(gameObject);
            }
            this.isGeneratorDragging = false;
        } else {
            if (dropPos.x === startPos.x && dropPos.y === startPos.y) {
                this.resetPosition(gameObject);
            } else if (this.gridItems[dropPos.y][dropPos.x]) {
                const otherItem = this.gridItems[dropPos.y][dropPos.x];
                if (otherItem !== 'generator' && gameObject.level === otherItem.level && gameObject.type === otherItem.type) {
                    this.mergeItems(gameObject, otherItem);
                    this.updateAllQuestProgress();
                } else {
                    this.resetPosition(gameObject);
                }
            } else if (!this.gridOccupancy[dropPos.y][dropPos.x]) {
                this.moveItem(gameObject, dropPos);
            } else {
                this.resetPosition(gameObject);
            }
        }
    }

    moveGenerator(generator, newPos) {
        const { startX, startY, cellSize } = this.gridInfo;
        this.gridItems[generator.gridY][generator.gridX] = null;
        this.gridOccupancy[generator.gridY][generator.gridX] = false;
        this.gridItems[newPos.y][newPos.x] = 'generator';
        this.gridOccupancy[newPos.y][newPos.x] = true;
        generator.gridX = newPos.x;
        generator.gridY = newPos.y;
        generator.x = startX + newPos.x * cellSize + cellSize / 2;
        generator.y = startY + newPos.y * cellSize + cellSize / 2;
    }

    resetPosition(item) {
        const { startX, startY, cellSize } = this.gridInfo;
        item.x = startX + item.gridX * cellSize + cellSize / 2;
        item.y = startY + item.gridY * cellSize + cellSize / 2;
    }

    moveItem(item, newPos) {
        const { startX, startY, cellSize } = this.gridInfo;
        this.gridItems[item.gridY][item.gridX] = null;
        this.gridOccupancy[item.gridY][item.gridX] = false;
        this.gridItems[newPos.y][newPos.x] = item;
        this.gridOccupancy[newPos.y][newPos.x] = true;
        item.gridX = newPos.x;
        item.gridY = newPos.y;
        item.x = startX + newPos.x * cellSize + cellSize / 2;
        item.y = startY + newPos.y * cellSize + cellSize / 2;
        this.updateAllQuestProgress();
    }

    mergeItems(item1, item2) {
        this.sound.play('mergeSound');
        this.triggerHapticFeedback(item1, item2);

        const newLevel = item1.level + 1;
        if (newLevel <= 5) {
            const mergePos = { x: item2.gridX, y: item2.gridY };

            const { startX, startY, cellSize } = this.gridInfo;
            const newItemX = startX + mergePos.x * cellSize + cellSize / 2;
            const newItemY = startY + mergePos.y * cellSize + cellSize / 2;

            let newItemTexture = item1.type === 'gem' ? `gem${newLevel}` : `level${newLevel}`;
            const newItem = this.add.image(newItemX, newItemY, newItemTexture);
            newItem.setDisplaySize(cellSize, cellSize);
            newItem.setInteractive({ draggable: true });
            newItem.level = newLevel;
            newItem.gridX = mergePos.x;
            newItem.gridY = mergePos.y;
            newItem.type = item1.type === 'gem' ? 'gem' : `level${newLevel}`;

            // Add double-click/tap functionality for gems
            if (newItem.type === 'gem') {
                newItem.on('pointerup', () => {
                    if (newItem.clickCount === 1) {
                        this.consumeGem(newItem);
                    } else {
                        newItem.clickCount = 1;
                        this.time.delayedCall(300, () => {
                            newItem.clickCount = 0;
                        });
                    }
                });
            }

            this.gridItems[item1.gridY][item1.gridX] = null;
            this.gridOccupancy[item1.gridY][item1.gridX] = false;
            this.gridItems[mergePos.y][mergePos.x] = newItem;
            this.gridOccupancy[mergePos.y][mergePos.x] = true;
            item1.destroy();
            item2.destroy();

            if (this.game.react) {
                // Update quest progress for the new merged item
                this.game.react.updateQuestProgress(newItem.type, 1);
                // Decrease quest progress for the two merged items
                this.game.react.updateQuestProgress(item1.type, -1);
                this.game.react.updateQuestProgress(item2.type, -1);

                // Give XP based on the new level and player level
                const baseXpReward = [1, 3, 5, 7, 10][newLevel - 1];
                const playerLevel = this.game.react.getPlayerLevel();
                const scaledXpReward = Math.floor(baseXpReward * Math.sqrt(playerLevel));
                this.game.react.updateXp(scaledXpReward);

                setTimeout(() => {
                    this.updateAllQuestProgress();
                }, 0);
            }

            if (item1.type !== 'gem' && Math.random() < GEM_DROP_CHANCE) {
                this.spawnGemAround(mergePos.x, mergePos.y);
            }
        } else {
            this.resetPosition(item1);
        }
    }

    spawnGemAround(x, y) {
        const { startX, startY, cellSize } = this.gridInfo;
        const adjacentSpots = [
            { x: x - 1, y: y },
            { x: x + 1, y: y },
            { x: x, y: y - 1 },
            { x: x, y: y + 1 }
        ];

        const emptySpots = adjacentSpots.filter(spot =>
            spot.x >= 0 && spot.x < GRID_WIDTH &&
            spot.y >= 0 && spot.y < GRID_HEIGHT &&
            !this.gridOccupancy[spot.y][spot.x]
        );

        if (emptySpots.length > 0) {
            const spot = Phaser.Math.RND.pick(emptySpots);
            const gemX = startX + spot.x * cellSize + cellSize / 2;
            const gemY = startY + spot.y * cellSize + cellSize / 2;

            const gem = this.add.image(gemX, gemY, 'gem1');
            gem.setDisplaySize(cellSize, cellSize);
            gem.setInteractive({ draggable: true });
            gem.level = 1;
            gem.gridX = spot.x;
            gem.gridY = spot.y;
            gem.type = 'gem';

            // Add double-click/tap functionality
            gem.on('pointerup', () => {
                if (gem.clickCount === 1) {
                    this.consumeGem(gem);
                    this.updateAllQuestProgress();
                } else {
                    gem.clickCount = 1;
                    this.time.delayedCall(300, () => {
                        gem.clickCount = 0;
                    });
                }
            });

            this.gridItems[spot.y][spot.x] = gem;
            this.gridOccupancy[spot.y][spot.x] = true;
        }
    }

    consumeGem(gem) {
        const gemValue = [1, 3, 5, 7, 10][gem.level - 1];

        // Update player stats
        if (this.game.react) {
            this.game.react.updateGems(gemValue);
        }

        // Remove the gem from the grid
        this.gridItems[gem.gridY][gem.gridX] = null;
        this.gridOccupancy[gem.gridY][gem.gridX] = false;
        gem.destroy();

        // Update quest progress
        if (this.game.react) {
            this.game.react.updateQuestProgress(gem.type, -1);
        }

        // Play a sound effect (optional)
        this.sound.play('gemConsumeSound');
    }

    getGridPosition(item) {
        const { startX, startY, cellSize } = this.gridInfo;
        const gridX = Math.floor((item.x - startX) / cellSize);
        const gridY = Math.floor((item.y - startY) / cellSize);
        return { x: gridX, y: gridY };
    }

    clearQuestItems(requirements) {
        requirements.forEach(req => {
            let itemsToRemove = req.required;
            this.gridItems.forEach((row, y) => {
                row.forEach((item, x) => {
                    if (item && item.type === req.type && itemsToRemove > 0) {
                        item.destroy();
                        this.gridItems[y][x] = null;
                        this.gridOccupancy[y][x] = false;
                        itemsToRemove--;
                    }
                });
            });
        });
    }

    updateAllQuestProgress() {
        const itemCounts = {};
        this.gridItems.forEach(row => {
            row.forEach(item => {
                if (item && item.type) {
                    itemCounts[item.type] = (itemCounts[item.type] || 0) + 1;
                }
            });
        });

        if (this.game.react) {
            this.game.react.updateAllQuestProgress(itemCounts);
        }
    }

    playQuestCompleteSound() {
        this.sound.play('questCompleteSound');
    }

    playClaimQuestSound() {
        if (this.claimSoundTimer) {
            clearTimeout(this.claimSoundTimer);
        }

        this.claimSoundTimer = setTimeout(() => {
            this.sound.play('claimQuestSound');
            this.claimSoundTimer = null;
        }, 100);
    }

    // Updated haptic feedback methods

    initHapticFeedback() {
        // No initialization needed for this version
    }

    triggerHapticFeedback(item1, item2) {
        this.shakeScreen(item1, item2);
    }

    shakeScreen(item1, item2) {
        this.cameras.main.shake(100, 0.005); // Increase duration and intensity

        // Remove the scale up and down effect
    }
}

const generateRandomQuest = (playerLevel, existingQuests) => {
    const levels = [1, 2, 3, 4, 5];
    const randomLevel = () => levels[Math.floor(Math.random() * levels.length)];
    const randomAmount = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    // Create a pool of all available characters
    const allCharacters = Array.from({ length: 61 }, (_, i) => `assets/characters/character${i + 1}.png`);

    // Filter out characters already in use
    const usedCharacters = existingQuests.map(quest => quest.characterIcon);
    const availableCharacters = allCharacters.filter(char => !usedCharacters.includes(char));

    const generateUniqueQuest = () => {
        const numRequirements = randomAmount(1, 3);
        const requirements = [];
        const usedTypes = new Set();

        for (let i = 0; i < numRequirements; i++) {
            let level;
            let type;
            // Ensure unique requirement types within the quest
            do {
                level = randomLevel();
                type = `level${level}`;
            } while (usedTypes.has(type));

            usedTypes.add(type);

            const requiredAmount = Math.floor(Math.random() * 2) + 1; // 1 or 2
            requirements.push({
                icon: `assets/level${level}.png`,
                type: `level${level}`,
                collected: 0,
                required: requiredAmount
            });
        }

        // Select a random character from the available characters
        const characterIcon = availableCharacters[Math.floor(Math.random() * availableCharacters.length)];

        return {
            characterIcon,
            rewards: [
                { type: 'coin', amount: 10 * playerLevel * requirements.reduce((acc, req) => acc + parseInt(req.type.replace('level', ''), 10), 0) },
                { type: 'xp', amount: 5 * playerLevel * requirements.reduce((acc, req) => acc + parseInt(req.type.replace('level', ''), 10), 0) }
            ],
            requirements,
        };
    };

    let newQuest;
    do {
        newQuest = generateUniqueQuest();
    } while (existingQuests.some(quest =>
        quest.requirements.length === newQuest.requirements.length &&
        quest.requirements.every((req, idx) =>
            req.type === newQuest.requirements[idx].type &&
            req.required === newQuest.requirements[idx].required
        )
    ));

    return newQuest;
};

const GameComponent = () => {
    const gameRef = useRef(null);
    const [coins, setCoins] = useState(0);
    const [energy, setEnergy] = useState(100);
    const [xp, setXp] = useState(0);
    const [level, setLevel] = useState(1);
    const [gems, setGems] = useState(0);
    const [quests, setQuests] = useState(() => {
        const initialQuests = [];
        for (let i = 0; i < 6; i++) {
            initialQuests.push(generateRandomQuest(level, initialQuests));
        }
        return initialQuests;
    });

    const handleQuestClick = (quest) => {
        console.log('Quest clicked:', quest);
    };

    const handleQuestClaim = (claimedQuest) => {
        setQuests((prevQuests) => {
            const updatedQuests = prevQuests.map(q => q === claimedQuest ? generateRandomQuest(level, prevQuests) : q);
            return updatedQuests;
        });

        setCoins((prevCoins) => prevCoins + claimedQuest.rewards.find(r => r.type === 'coin').amount);
        setXp((prevXp) => prevXp + claimedQuest.rewards.find(r => r.type === 'xp').amount);

        if (gameRef.current && gameRef.current.scene.scenes[0]) {
            const gameScene = gameRef.current.scene.scenes[0];
            gameScene.clearQuestItems(claimedQuest.requirements);
            gameScene.playQuestCompleteSound();

            setTimeout(() => {
                gameScene.updateAllQuestProgress();
            }, 0);
        }
    };

    const updateQuestProgress = (itemType, change) => {
        setQuests((prevQuests) => {
            return prevQuests.map((quest) => {
                const updatedRequirements = quest.requirements.map((req) => {
                    if (req.type === itemType) {
                        const newCollected = Math.max(0, req.collected + change);
                        return {
                            ...req,
                            collected: newCollected,
                        };
                    }
                    return req;
                });
                return {
                    ...quest,
                    requirements: updatedRequirements,
                };
            });
        });
    };

    const updateAllQuestProgress = (itemCounts) => {
        setQuests((prevQuests) => {
            return prevQuests.map((quest) => {
                const updatedRequirements = quest.requirements.map((req) => {
                    const count = itemCounts[req.type] || 0;
                    return {
                        ...req,
                        collected: Math.min(req.required, count),
                    };
                });
                return {
                    ...quest,
                    requirements: updatedRequirements,
                };
            });
        });
    };

    const updateEnergy = (newEnergy) => {
        setEnergy(newEnergy);
    };

    const updateGems = (newGems) => {
        setGems(newGems);
    };

    const updateXp = (xpGained) => {
        setXp(prevXp => prevXp + xpGained);
    };

    const getPlayerLevel = () => {
        return level;
    };

    useEffect(() => {
        const config = {
            type: Phaser.AUTO,
            width: 640,
            height: 800,
            parent: 'phaser-game',
            scene: GameScene,
            transparent: true,
            render: {
                pixelArt: false,
                antialias: true,
                antialiasGL: true,
                roundPixels: true,
            },
        };

        try {
            const game = new Phaser.Game(config);
            gameRef.current = game;
            game.react = {
                updateEnergy,
                updateQuestProgress,
                updateAllQuestProgress,
                updateGems,
                updateXp,
                getPlayerLevel,
            };
            console.log('Phaser game initialized');
        } catch (error) {
            console.error('Error initializing Phaser game:', error);
        }

        return () => {
            if (gameRef.current) {
                gameRef.current.destroy(true);
                console.log('Phaser game destroyed');
            }
        };
    }, []);

    useEffect(() => {
        const xpNeeded = Math.floor(50 * Math.pow(level, 1.5));
        if (xp >= xpNeeded) {
            setLevel(prevLevel => prevLevel + 1);
            setXp(prevXp => prevXp - xpNeeded);
        }
    }, [xp, level]);

    const xpNeeded = Math.floor(50 * Math.pow(level, 1.5));
    const xpPercentage = (xp / xpNeeded) * 100;

    return (
        <div className="board">
            <div className='statsUI'>
                <div className="circular-progressbar-container">
                    <CircularProgressbar
                        value={xpPercentage}
                        text={`${level}`}
                        className="circular-progressbar"
                    />
                </div>
                🪙 {coins} ⚡ {energy} 💎 {gems}
            </div>
            <QuestPanel quests={quests} onQuestClick={handleQuestClick} onQuestClaim={handleQuestClaim} />
            <div id="phaser-game"></div>
        </div>
    );
};

export default GameComponent;