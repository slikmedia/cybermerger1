import React from 'react';
import './QuestPanel.css'; // Create a CSS file for styling

const QuestPanel = ({ quests, onQuestClick, onQuestClaim }) => {
    const isQuestComplete = (quest) => {
        return quest.requirements.every(req => req.collected >= req.required);
    };

    const handleClaimClick = (e, quest) => {
        e.stopPropagation(); // Prevent the quest click event from firing
        onQuestClaim(quest);
    };

    return (
        <div className="quest-panel">
            {quests.map((quest, index) => (
                <div key={index} className="quest" onClick={() => onQuestClick(quest)}>
                    <img src={quest.characterIcon} alt="Character" className="character-icon" />
                    <div className="rewards">
                        {quest.rewards.map((reward, idx) => (
                            <div key={idx} className="reward">
                                <span className="coin-reward">$ {reward.amount}</span>
                            </div>
                        ))}
                    </div>
                    <div className="requirements">
                        {quest.requirements.map((item, idx) => (
                            <div key={idx} className="requirement">
                                <img src={item.icon} alt={item.type} />
                                <span>{item.collected}/{item.required}</span>
                            </div>
                        ))}
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