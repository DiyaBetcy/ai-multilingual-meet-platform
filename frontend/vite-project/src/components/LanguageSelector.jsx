import { useState, useEffect } from 'react';
import './LanguageSelector.css';

const LanguageSelector = ({
  currentLanguage,
  speakingLanguage,
  availableLanguages,
  onChangeLanguage,
  onChangeSpeakingLanguage,
  isListening,
  translationEnabled,
  onToggleTranslation,
  onToggleListening,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const speaking = speakingLanguage || currentLanguage;

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

  const handleSpeakingSelect = (event) => {
    onChangeSpeakingLanguage?.(event.target.value);
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

        {/* Microphone / speech recognition toggle. Receiving translations is
            controlled separately in the dropdown below. */}
        <button
          className={`translation-toggle ${isListening ? 'active' : ''}`}
          onClick={onToggleListening}
          title={isListening ? 'Stop sending your speech' : 'Start sending your speech'}
        >
          <span className="mic-icon">{isListening ? '🔴' : '🎤'}</span>
          <span className="toggle-text">{isListening ? 'Stop' : 'Translate'}</span>
        </button>
      </div>

      {/* Language Dropdown Menu */}
      {isOpen && (
        <div className="language-dropdown-menu">
          <div className="dropdown-header">
            <span>I want to hear</span>
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

          <div className="language-speaking">
            <label htmlFor="speaking-language">I speak</label>
            <select
              id="speaking-language"
              className="speaking-language-select"
              value={speaking}
              onChange={handleSpeakingSelect}
            >
              {Object.entries(availableLanguages).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={translationEnabled}
            className={`translation-mode-option ${translationEnabled ? 'enabled' : ''}`}
            onClick={onToggleTranslation}
            title={
              translationEnabled
                ? 'You hear translated audio. Click to hear the original voices instead.'
                : 'You hear original voices. Click to hear the translated audio.'
            }
          >
            <span className="translation-mode-copy">
              <span className="translation-mode-title">Translated audio</span>
              <span className="translation-mode-hint">
                {translationEnabled ? 'Original voices muted' : 'Original voices audible'}
              </span>
            </span>
            <span className="switch-track" aria-hidden="true">
              <span className="switch-thumb" />
            </span>
          </button>
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
