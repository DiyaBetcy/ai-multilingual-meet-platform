import "./qapanel.css";
import { useState } from "react";

const emojiList = ["😀","😂","😍","😮","😢","😡","👍","👏","🔥","🎉","❤️","🙏","❓","🌍"];

export default function QAPanel() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showPoll, setShowPoll] = useState(false);

  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  const sendMessage = () => {
    if (!message.trim()) return;
    setMessages([...messages, { type: "text", content: message }]);
    setMessage("");
  };

  const addEmoji = (emoji) => {
    setMessage((prev) => prev + emoji);
    setShowEmoji(false);
  };

  const addPollOption = () => {
    setPollOptions([...pollOptions, ""]);
  };

  const sendPoll = () => {
    if (!pollQuestion.trim()) return;
    setMessages([...messages, {
      type: "poll",
      question: pollQuestion,
      options: pollOptions
    }]);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setShowPoll(false);
  };

  return (
    <div className="qa-container">
      <div className="qa-header">Q&A Panel</div>

      <div className="qa-messages">
        {messages.map((msg, i) => (
          <div key={i} className="qa-message">
            {msg.type === "text" && msg.content}

            {msg.type === "poll" && (
              <div className="poll-box">
                <strong>{msg.question}</strong>
                {msg.options.map((op, idx) => (
                  <div key={idx} className="poll-option">
                    <input type="radio" name={`poll-${i}`} />
                    <span>{op}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Emoji Picker */}
      {showEmoji && (
        <div className="emoji-picker">
          {emojiList.map((e, i) => (
            <span key={i} onClick={() => addEmoji(e)}>{e}</span>
          ))}
        </div>
      )}

      {/* Poll Creator */}
      {showPoll && (
        <div className="poll-creator">
          <input
            placeholder="Poll question"
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
          />

          {pollOptions.map((op, i) => (
            <input
              key={i}
              placeholder={`Option ${i + 1}`}
              value={op}
              onChange={(e) => {
                const updated = [...pollOptions];
                updated[i] = e.target.value;
                setPollOptions(updated);
              }}
            />
          ))}

          <button onClick={addPollOption}>+ Add option</button>
          <button className="send-btn" onClick={sendPoll}>Send Poll</button>
        </div>
      )}

      <div className="qa-input-area">
        <button className="qa-btn" onClick={() => setShowPoll(!showPoll)}>📊</button>
        <button className="qa-btn" onClick={() => setShowEmoji(!showEmoji)}>😊</button>

        <label className="qa-btn">
          📎
          <input type="file" hidden />
        </label>

        <input
          type="text"
          placeholder="Type your question..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button className="send-btn" onClick={sendMessage}>➤</button>
      </div>
    </div>
  );
}
