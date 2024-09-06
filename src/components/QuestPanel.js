import React, { useRef, useEffect } from 'react';
import './QuestPanel.css'; // Create a CSS file for styling

const QuestPanel = ({ quests, onQuestClick, onQuestClaim }) => {
    const panelRef = useRef(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);
    const completedQuestRef = useRef(null);

    const isQuestComplete = (quest) => {
        return quest.requirements.every(req => req.collected >= req.required);
    };

    const handleClaimClick = (e, quest) => {
        e.stopPropagation(); // Prevent the quest click event from firing
        onQuestClaim(quest);
    };

    const handleMouseDown = (e) => {
        isDragging.current = true;
        startX.current = e.pageX - panelRef.current.offsetLeft;
        scrollLeft.current = panelRef.current.scrollLeft;
        panelRef.current.classList.add('dragging');
    };

    const handleMouseLeave = () => {
        isDragging.current = false;
        panelRef.current.classList.remove('dragging');
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        panelRef.current.classList.remove('dragging');
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;
        e.preventDefault();
        const x = e.pageX - panelRef.current.offsetLeft;
        const walk = (x - startX.current) * 2; // Adjust scroll speed
        panelRef.current.scrollLeft = scrollLeft.current - walk;
    };

    useEffect(() => {
        if (completedQuestRef.current) {
            completedQuestRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [quests]);

    return (
        <div
            className="quest-panel"
            ref={panelRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
        >
            {quests.map((quest, index) => (
                <div 
                    key={index} 
                    className="quest" 
                    onClick={() => onQuestClick(quest)}
                    ref={isQuestComplete(quest) ? completedQuestRef : null}
                >
                    <img src={quest.characterIcon} alt="Character" className="character-icon" />
                    <div className="quest-info">
                        <div className="rewards">
                            {quest.rewards.map((reward, idx) => (
                                <div key={idx} className="reward">
                                    {reward.type === 'coin' && <span className="coin-reward">{reward.amount}</span>}
                                    {reward.type === 'xp' && <span className="xp-reward">{reward.amount}xp</span>}
                                </div>
                            ))}
                        </div>
                        <div className="requirements">
                            {quest.requirements.map((item, idx) => (
                                <div key={idx} className={`requirement ${item.collected >= item.required ? 'fulfilled' : ''}`}>
                                    <img src={item.icon} alt={item.type} />
                                    <span>{item.collected}/{item.required}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    {isQuestComplete(quest) && (
                        <button 
                            className="claim-button" 
                            onClick={(e) => handleClaimClick(e, quest)}
                        >
                            CLAIM
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};

export default QuestPanel;