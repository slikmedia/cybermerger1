import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import QuestPanel from './QuestPanel';

const GRID_WIDTH = 7;
const GRID_HEIGHT = 19;
const CELL_SIZE = 90;
const MARGIN = 1;
const EFFECTIVE_CELL_SIZE = CELL_SIZE - 2 * MARGIN;

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.energy = 100;
        this.isGeneratorDragging = false;
        this.generatorMoved = false;
    }

    preload() {
        this.load.image('generator', 'assets/generator.png');
        for (let i = 1; i <= 5; i++) {
            this.load.image(`level${i}`, `assets/level${i}.png`);
        }
        this.load.audio('mergeSound', 'assets/merge.mp3');
        this.load.audio('spawnSound', 'assets/spawn.mp3');
        this.load.audio('backgroundMusic', 'assets/background_music.mp3');
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
                cell.setAlpha(0.3);
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
                        this.game.react.updateQuestProgress(1);
                    }
                }
            });

            this.energy--;
            if (this.game.react) {
                this.game.react.updateEnergy(this.energy);
            }
        }
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
                if (otherItem !== 'generator' && gameObject.level === otherItem.level) {
                    this.mergeItems(gameObject, otherItem);
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
    }

    mergeItems(item1, item2) {
        this.sound.play('mergeSound');

        const newLevel = item1.level + 1;
        if (newLevel <= 5) {
            const mergePos = { x: item2.gridX, y: item2.gridY };

            const { startX, startY, cellSize } = this.gridInfo;
            const newItemX = startX + mergePos.x * cellSize + cellSize / 2;
            const newItemY = startY + mergePos.y * cellSize + cellSize / 2;

            const newItem = this.add.image(newItemX, newItemY, `level${newLevel}`);
            newItem.setDisplaySize(cellSize, cellSize);
            newItem.setInteractive({ draggable: true });
            newItem.level = newLevel;
            newItem.gridX = mergePos.x;
            newItem.gridY = mergePos.y;
            newItem.type = `level${newLevel}`;

            this.gridItems[item1.gridY][item1.gridX] = null;
            this.gridOccupancy[item1.gridY][item1.gridX] = false;
            this.gridItems[mergePos.y][mergePos.x] = newItem;
            this.gridOccupancy[mergePos.y][mergePos.x] = true;
            item1.destroy();
            item2.destroy();

            if (this.game.react) {
                this.game.react.updateQuestProgress(newLevel);
                setTimeout(() => {
                    this.updateAllQuestProgress();
                }, 0);
            }
        } else {
            this.resetPosition(item1);
        }
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
}

const generateRandomQuest = () => {
    const levels = [1, 2, 3, 4, 5];
    const randomLevel = () => levels[Math.floor(Math.random() * levels.length)];
    const randomAmount = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const level1 = randomLevel();
    let level2 = randomLevel();
    while (level2 === level1) {
        level2 = randomLevel();
    }

    return {
        characterIcon: `assets/character${randomAmount(1, 3)}.png`,
        rewards: [
            { type: 'coin', amount: randomAmount(50, 100) },
        ],
        requirements: [
            { icon: `assets/level${level1}.png`, type: `level${level1}`, collected: 0, required: randomAmount(1, 5) },
            { icon: `assets/level${level2}.png`, type: `level${level2}`, collected: 0, required: randomAmount(1, 5) },
        ],
    };
};

const GameComponent = () => {
    const gameRef = useRef(null);
    const [coins, setCoins] = useState(0);
    const [energy, setEnergy] = useState(100);
    const [quests, setQuests] = useState([
        generateRandomQuest(),
        generateRandomQuest(),
        generateRandomQuest(),
        generateRandomQuest(),
        generateRandomQuest(),
        generateRandomQuest(),
    ]);

    const handleQuestClick = (quest) => {
        console.log('Quest clicked:', quest);
    };

    const handleQuestClaim = (claimedQuest) => {
        setQuests((prevQuests) => {
            const updatedQuests = prevQuests.map(q => q === claimedQuest ? generateRandomQuest() : q);
            return updatedQuests;
        });

        setCoins((prevCoins) => prevCoins + claimedQuest.rewards[0].amount);

        if (gameRef.current && gameRef.current.scene.scenes[0]) {
            const gameScene = gameRef.current.scene.scenes[0];
            gameScene.clearQuestItems(claimedQuest.requirements);

            setTimeout(() => {
                gameScene.updateAllQuestProgress();
            }, 0);
        }
    };

    const updateQuestProgress = (level) => {
        setQuests((prevQuests) => {
            return prevQuests.map((quest) => {
                const updatedRequirements = quest.requirements.map((req) => {
                    if (req.type === `level${level}`) {
                        return {
                            ...req,
                            collected: Math.min(req.collected + 1, req.required),
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

    const updateAllQuestProgress = (itemCounts = {}) => {
        setQuests(prevQuests => prevQuests.map(quest => ({
            ...quest,
            requirements: quest.requirements.map(req => ({
                ...req,
                collected: Math.min(itemCounts[req.type] || 0, req.required)
            }))
        })));
    };

    const updateEnergy = (newEnergy) => {
        setEnergy(newEnergy);
    };

    useEffect(() => {
        const config = {
            type: Phaser.AUTO,
            width: 650,
            height: 800,
            scene: GameScene,
            parent: 'phaser-game',
            transparent: true,
        };

        try {
            const game = new Phaser.Game(config);
            gameRef.current = game;
            game.react = {
                updateEnergy,
                updateQuestProgress,
                updateAllQuestProgress,
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

    return (
        <div className="board">
            <div className='statsUI'>
                Coins: {coins} | Energy: {energy} 
            </div>
            <QuestPanel quests={quests} onQuestClick={handleQuestClick} onQuestClaim={handleQuestClaim} />
            <div id="phaser-game"></div>
        </div>
    );
};

export default GameComponent;