import React, { useRef, useEffect, useState } from 'react';

const Canvas = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState({
    player: { x: 0, y: 0, size: 0 },
    enemies: [],
    projectiles: []
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      updateGameState(canvas.width, canvas.height);
    };

    const updateGameState = (width, height) => {
      setGameState(prevState => ({
        player: {
          x: width / 2,
          y: height - 50,
          size: Math.min(width, height) * 0.05
        },
        enemies: prevState.enemies.map(enemy => ({
          ...enemy,
          size: Math.min(width, height) * 0.03
        })),
        projectiles: prevState.projectiles.map(proj => ({
          ...proj,
          size: Math.min(width, height) * 0.01
        }))
      }));
    };

    const drawScene = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw player
      ctx.fillStyle = 'blue';
      ctx.beginPath();
      ctx.arc(gameState.player.x, gameState.player.y, gameState.player.size, 0, Math.PI * 2);
      ctx.fill();

      // Draw enemies
      ctx.fillStyle = 'red';
      gameState.enemies.forEach(enemy => {
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw projectiles
      ctx.fillStyle = 'green';
      gameState.projectiles.forEach(proj => {
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const gameLoop = () => {
      drawScene();
      // Add game logic here (e.g., move enemies, check collisions)
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    gameLoop();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />;
};

export default Canvas;