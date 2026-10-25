import { useEffect, useState } from 'react';
import './TranslatedCaption.css';

const TranslatedCaption = ({ caption, isVisible }) => {
  const [displayText, setDisplayText] = useState('');
  const [isShowing, setIsShowing] = useState(false);

  const isFallback =
    !caption.translatedText && Boolean(caption.translationError);

  useEffect(() => {
    const nextText =
      caption.translatedText ||
      (caption.translationError ? caption.originalText : '');

    if (nextText) {
      setDisplayText(nextText);
      setIsShowing(true);

      // Auto-hide after 6 seconds
      const timer = setTimeout(() => {
        setIsShowing(false);
      }, 6000);

      return () => clearTimeout(timer);
    }
  }, [
    caption.translatedText,
    caption.translationError,
    caption.originalText,
  ]);

  if (!isVisible || !displayText || !isShowing) return null;

  return (
    <div className="translated-caption-overlay">
      <div className="caption-container">
        <div className="caption-header">
          <span className="speaker-name">{caption.speaker}</span>
          {isFallback ? (
            <span className="translation-indicator">
              {caption.translationError}
            </span>
          ) : (
            !caption.isOriginal && (
              <span className="translation-indicator">
                Translated from {caption.originalText}
              </span>
            )
          )}
        </div>
        <div className="caption-text">
          {displayText}
        </div>
        <div className="caption-footer">
          <span className="language-tag">
            {isFallback
              ? 'Original'
              : caption.isOriginal
                ? 'Original'
                : caption.targetLanguage?.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TranslatedCaption;
