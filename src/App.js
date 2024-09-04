import React, { useState } from 'react';
import GameComponent from './components/GameComponent';
import GameUI from './components/GameUI';
import './App.css';

function App() {
  const [energy, setEnergy] = useState(100);

  return (
    <div className="App">
      <GameUI energy={energy} />
      <GameComponent onEnergyChange={setEnergy} />
    </div>
  );
}

export default App;