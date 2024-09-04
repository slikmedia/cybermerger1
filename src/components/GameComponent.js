// src/components/GameComponent.js
import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
// Remove the GameUI import as it's not used here

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.energy = 100; // Initialize energy
    }

    preload() {
        // Remove background loading
        this.load.image('generator', 'assets/generator.png');
        for (let i = 1; i <= 5; i++) {
            this.load.image(`level${i}`, `assets/level${i}.png`);
        }
        this.load.audio('mergeSound', 'assets/merge.mp3');
        this.load.audio('spawnSound', 'assets/spawn.mp3'); // Add this line
        this.load.audio('backgroundMusic', 'assets/background_music.mp3'); // Add this line
    }

    create() {
        // Remove background image creation
        const gridWidth = 9;  // Increased from 7
        const gridHeight = 11;  // Increased from 9
        const cellSize = 70;  // Increased from 60
        const margin = 1;
        const effectiveCellSize = cellSize - 2 * margin;
        const startX = (this.sys.game.config.width - gridWidth * cellSize) / 2;
        const startY = (this.sys.game.config.height - gridHeight * cellSize) / 2;

        this.gridInfo = { startX, startY, gridWidth, gridHeight, cellSize, margin };
        this.gridOccupancy = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(false));
        this.gridItems = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(null));

        // Create black cells with 30% opacity and 1px margin
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const cellX = startX + x * cellSize + margin;
                const cellY = startY + y * cellSize + margin;
                const cell = this.add.rectangle(cellX, cellY, effectiveCellSize, effectiveCellSize, 0x000000);
                cell.setOrigin(0, 0);
                cell.setAlpha(0.3);
            }
        }

        const centerX = startX + Math.floor(gridWidth / 2) * cellSize + cellSize / 2;
        const centerY = startY + Math.floor(gridHeight / 2) * cellSize + cellSize / 2;
        const generator = this.add.image(centerX, centerY, 'generator');
        generator.setDisplaySize(effectiveCellSize, effectiveCellSize); // Removed 0.95 scaling
        generator.setInteractive();
        generator.on('pointerup', this.spawnItem, this); // Changed from 'pointerdown' to 'pointerup'

        // Mark the generator's position as occupied
        const generatorGridX = Math.floor(gridWidth / 2);
        const generatorGridY = Math.floor(gridHeight / 2);
        this.gridItems[generatorGridY][generatorGridX] = 'generator';
        this.gridOccupancy[generatorGridY][generatorGridX] = true;

        this.input.on('dragstart', this.onDragStart, this);
        this.input.on('drag', this.onDrag, this);
        this.input.on('dragend', this.onDragEnd, this);

        // Add background music
        this.backgroundMusic = this.sound.add('backgroundMusic', { loop: true, volume: 0.5 });
        this.backgroundMusic.play();
    }

    spawnItem() {
        if (this.energy <= 0) return; // Prevent spawning if no energy

        const { startX, startY, gridWidth, gridHeight, cellSize, margin } = this.gridInfo;
        const emptySpots = [];
        const generatorX = Math.floor(gridWidth / 2);
        const generatorY = Math.floor(gridHeight / 2);

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                if (!this.gridItems[y][x] && !this.gridOccupancy[y][x]) {
                    const distance = Math.sqrt(Math.pow(x - generatorX, 2) + Math.pow(y - generatorY, 2));
                    emptySpots.push({x, y, distance});
                }
            }
        }

        if (emptySpots.length > 0) {
            // Play spawn sound
            this.sound.play('spawnSound');

            emptySpots.sort((a, b) => a.distance - b.distance);
            const closestSpots = emptySpots.slice(0, Math.min(3, emptySpots.length));
            const spot = Phaser.Math.RND.pick(closestSpots);

            // Mark the spot as occupied immediately
            this.gridOccupancy[spot.y][spot.x] = true;

            const itemX = startX + spot.x * (cellSize + margin) + cellSize / 2;
            const itemY = startY + spot.y * (cellSize + margin) + cellSize / 2;

            // Create the item at the generator's position
            const generatorCenterX = startX + generatorX * (cellSize + margin) + cellSize / 2;
            const generatorCenterY = startY + generatorY * (cellSize + margin) + cellSize / 2;
            const item = this.add.image(generatorCenterX, generatorCenterY, 'level1');

            item.setDisplaySize(cellSize, cellSize);
            item.setInteractive({ draggable: true });
            item.level = 1;
            item.gridX = spot.x;
            item.gridY = spot.y;

            // Create motion animation tween
            this.tweens.add({
                targets: item,
                x: itemX,
                y: itemY,
                duration: 300,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    this.gridItems[spot.y][spot.x] = item;
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
    }

    onDrag(pointer, gameObject, dragX, dragY) {
        gameObject.x = dragX;
        gameObject.y = dragY;
    }

    onDragEnd(pointer, gameObject) {
        const dropPos = this.getGridPosition(gameObject);
        const startPos = { x: gameObject.gridX, y: gameObject.gridY };

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

    resetPosition(item) {
        const { startX, startY, cellSize, margin } = this.gridInfo;
        item.x = startX + item.gridX * (cellSize + margin) + cellSize / 2;
        item.y = startY + item.gridY * (cellSize + margin) + cellSize / 2;
    }

    moveItem(item, newPos) {
        const { startX, startY, cellSize, margin } = this.gridInfo;
        this.gridItems[item.gridY][item.gridX] = null;
        this.gridOccupancy[item.gridY][item.gridX] = false;
        this.gridItems[newPos.y][newPos.x] = item;
        this.gridOccupancy[newPos.y][newPos.x] = true;
        item.gridX = newPos.x;
        item.gridY = newPos.y;
        item.x = startX + newPos.x * (cellSize + margin) + cellSize / 2;
        item.y = startY + newPos.y * (cellSize + margin) + cellSize / 2;
    }

    mergeItems(item1, item2) {
        // Play merge sound
        this.sound.play('mergeSound');

        const newLevel = item1.level + 1;
        if (newLevel <= 5) {
            // Use the position of item2 (the stationary item) for merging
            const mergePos = { x: item2.gridX, y: item2.gridY };
            
            // Calculate the centered position for the new item
            const { startX, startY, cellSize, margin } = this.gridInfo;
            const newItemX = startX + mergePos.x * (cellSize + margin) + cellSize / 2;
            const newItemY = startY + mergePos.y * (cellSize + margin) + cellSize / 2;

            // Create new item at the calculated centered position
            const newItem = this.add.image(newItemX, newItemY, `level${newLevel}`);
            newItem.setDisplaySize(cellSize, cellSize); // Removed 0.95 scaling
            newItem.setInteractive({ draggable: true });
            newItem.level = newLevel;
            newItem.gridX = mergePos.x;
            newItem.gridY = mergePos.y;

            // Update grid and destroy old items
            this.gridItems[item1.gridY][item1.gridX] = null;
            this.gridOccupancy[item1.gridY][item1.gridX] = false;
            this.gridItems[mergePos.y][mergePos.x] = newItem;
            this.gridOccupancy[mergePos.y][mergePos.x] = true;
            item1.destroy();
            item2.destroy();
        } else {
            // If max level reached, just reset the position of item1
            this.resetPosition(item1);
        }
    }

    getGridPosition(item) {
        const { startX, startY, cellSize, margin } = this.gridInfo;
        const gridX = Math.floor((item.x - startX) / (cellSize + margin));
        const gridY = Math.floor((item.y - startY) / (cellSize + margin));
        return { x: gridX, y: gridY };
    }
}

const GameComponent = ({ onEnergyChange }) => {
    const gameRef = useRef(null);

    useEffect(() => {
        const config = {
            type: Phaser.AUTO,
            width: 700,
            height: 800,
            scene: GameScene,
            parent: 'phaser-game',
            transparent: true,
        };

        try {
            const game = new Phaser.Game(config);
            gameRef.current = game;
            game.react = {
                updateEnergy: (newEnergy) => onEnergyChange(newEnergy)
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
    }, [onEnergyChange]);

    return (
        <div id="phaser-game"></div>
    );
};

export default GameComponent;