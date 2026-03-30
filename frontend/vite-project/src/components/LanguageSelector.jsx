import { useState, useEffect } from 'react';
import './LanguageSelector.css';

const LanguageSelector = ({ 
  currentLanguage, 
  availableLanguages, 
  onChangeLanguage, 
  isListening,
  onToggleListening 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && !event.target.closest('.language-selector')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  const handleLanguageSelect = (langCode) => {
    onChangeLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div className="language-selector">
      <div className="translation-controls">
        {/* Language Dropdown */}
        <button 
          className="language-dropdown-btn"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="globe-icon">🌐</span>
          <span className="current-lang">{availableLanguages[currentLanguage] || 'English'}</span>
          <span className="dropdown-arrow">▼</span>
        </button>

        {/* Translation Toggle */}
        <button 
          className={`translation-toggle ${isListening ? 'active' : ''}`}
          onClick={onToggleListening}
          title={isListening ? 'Stop Translation' : 'Start Translation'}
        >
          <span className="mic-icon">{isListening ? '🔴' : '🎤'}</span>
          <span className="toggle-text">{isListening ? 'Stop' : 'Translate'}</span>
        </button>
      </div>

      {/* Language Dropdown Menu */}
      {isOpen && (
        <div className="language-dropdown-menu">
          <div className="dropdown-header">
            <span>Select Your Language</span>
          </div>
          <div className="language-list">
            {Object.entries(availableLanguages).map(([code, name]) => (
              <button
                key={code}
                className={`language-option ${currentLanguage === code ? 'selected' : ''}`}
                onClick={() => handleLanguageSelect(code)}
              >
                <span className="lang-flag">{getFlagEmoji(code)}</span>
                <span className="lang-name">{name}</span>
                {currentLanguage === code && <span className="check-mark">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to get flag emoji for language
const getFlagEmoji = (langCode) => {
  const flags = {
    'en': '🇬🇧',
    'ml': '🇮🇳',
    'hi': '🇮🇳',
    'ta': '🇮🇳',
    'te': '🇮🇳',
    'kn': '🇮🇳',
    'bn': '🇧🇩',
    'gu': '🇮🇳',
    'mr': '🇮🇳',
    'od': '🇮🇳',
    'pa': '🇮🇳',
    'as': '🇮🇳',
    'ur': '🇵🇰'
  };
  return flags[langCode] || '🏳️';
};

export default LanguageSelector;
