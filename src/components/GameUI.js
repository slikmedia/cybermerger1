// src/components/GameUI.js
import React from 'react';

const GameUI = ({ energy }) => {
    return (
        <div className="game-ui">
            <div className="energy-display">Energy: {energy}</div>
        </div>
    );
};

export default GameUI;