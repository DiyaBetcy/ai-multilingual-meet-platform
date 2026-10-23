
import { useState } from "react";
import "./qapanel.css";

const EMOJIS = ["👍", "❤️", "😂", "🎉", "🤔"];

export default function QAPanel({
  qaQuestions = [],
  submitQuestion,
  answerQuestion,
  getQuestions,
  questionNotice = "",
  onClose,

  // Optional props for shared real-time polls.
  polls: sharedPolls,
  createPoll,
  votePoll,
  currentUserId,
}) {
  const [activeTab, setActiveTab] = useState("questions");
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState({});
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollTitle, setPollTitle] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [localPolls, setLocalPolls] = useState([]);
  const [localVotes, setLocalVotes] = useState({});

  const isSharedPollMode = Array.isArray(sharedPolls);
  const polls = isSharedPollMode ? sharedPolls : localPolls;

  const handleSubmitQuestion = (event) => {
    event.preventDefault();
    const value = question.trim();

    if (!value) return;

    submitQuestion?.(value);
    setQuestion("");
  };

  const handleAnswer = (event, item) => {
    event.preventDefault();
    const value = (answers[item.id] || "").trim();

    if (!value) return;

    answerQuestion?.(item.id, value);
    setAnswers((previous) => ({ ...previous, [item.id]: "" }));
  };

  const handleCreatePoll = (event) => {
    event.preventDefault();

    const title = pollTitle.trim();
    const options = pollOptions
      .map((option) => option.trim())
      .filter(Boolean);

    if (!title || options.length < 2) return;

    const poll = {
      id: `poll_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      question: title,
      options: options.map((text, index) => ({
        id: `option_${index}_${Math.random().toString(36).slice(2, 6)}`,
        text,
        emoji: EMOJIS[index % EMOJIS.length],
        votes: 0,
      })),
      createdAt: Date.now(),
      createdBy: currentUserId || null,
    };

    if (createPoll) {
      createPoll(poll);
    } else {
      setLocalPolls((previous) => [...previous, poll]);
    }

    setPollTitle("");
    setPollOptions(["", ""]);
    setShowPollForm(false);
  };

  const handleVote = (poll, option) => {
    const pollId = poll.id;
    const previousVote = localVotes[pollId];

    if (previousVote || poll.userVote || poll.votedByCurrentUser) return;

    if (votePoll) {
      votePoll(pollId, option.id);
    } else {
      setLocalPolls((previous) =>
        previous.map((item) =>
          item.id !== pollId
            ? item
            : {
                ...item,
                options: item.options.map((entry) =>
                  entry.id === option.id
                    ? { ...entry, votes: (entry.votes || 0) + 1 }
                    : entry
                ),
              }
        )
      );

      setLocalVotes((previous) => ({
        ...previous,
        [pollId]: option.id,
      }));
    }
  };

  const getVoteCount = (option) => {
    if (typeof option.votes === "number") return option.votes;
    if (Array.isArray(option.votes)) return option.votes.length;
    return 0;
  };

  return (
    <section className="qa-container" aria-label="Meeting Q&A and polls">
      <header className="qa-header">
        <div className="qa-title-group">
          <div className="qa-title-icon">✦</div>
          <div>
            <h2>Meeting hub</h2>
            <p>Questions, answers &amp; live polls</p>
          </div>
        </div>

        <div className="qa-header-actions">
          <button
            type="button"
            className="qa-icon-button"
            onClick={getQuestions}
            title="Refresh questions"
            aria-label="Refresh questions"
          >
            ↻
          </button>
          <button
            type="button"
            className="qa-icon-button qa-close-btn"
            onClick={onClose}
            title="Close panel"
            aria-label="Close Q&A panel"
          >
            ×
          </button>
        </div>
      </header>

      <nav className="qa-tabs" aria-label="Q&A sections">
        <button
          type="button"
          className={`qa-tab ${activeTab === "questions" ? "active" : ""}`}
          onClick={() => setActiveTab("questions")}
          aria-selected={activeTab === "questions"}
          role="tab"
        >
          <span>💬</span>
          Questions
          <span className="qa-tab-count">{qaQuestions.length}</span>
        </button>

        <button
          type="button"
          className={`qa-tab ${activeTab === "polls" ? "active" : ""}`}
          onClick={() => setActiveTab("polls")}
          aria-selected={activeTab === "polls"}
          role="tab"
        >
          <span>📊</span>
          Polls
          <span className="qa-tab-count">{polls.length}</span>
        </button>
      </nav>

      <div className="qa-scroll-area">
        {activeTab === "questions" && (
          <div className="qa-tab-content" role="tabpanel">
            <div className="qa-section-heading">
              <div>
                <h3>Ask the group</h3>
                <p>Questions and answers for everyone.</p>
              </div>
            </div>

            <form className="qa-compose" onSubmit={handleSubmitQuestion}>
              <label htmlFor="qa-question-input">Your question</label>
              <textarea
                id="qa-question-input"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="What would you like to know?"
                maxLength={2000}
                rows={3}
                required
              />
              <div className="qa-compose-footer">
                <span>{question.length}/2000</span>
                <button
                  type="submit"
                  className="qa-primary-button"
                  disabled={!question.trim()}
                >
                  Send question <span>↑</span>
                </button>
              </div>
            </form>

            {questionNotice && (
              <p className="qa-notice" role="status">
                {questionNotice}
              </p>
            )}

            <div className="qa-list-heading">
              <h3>Discussion</h3>
              <span>{qaQuestions.length} total</span>
            </div>

            {qaQuestions.length === 0 ? (
              <div className="qa-empty-state">
                <div className="qa-empty-icon">💭</div>
                <h4>Start the conversation</h4>
                <p>Be the first to ask a question.</p>
              </div>
            ) : (
              [...qaQuestions]
                .sort(
                  (a, b) =>
                    new Date(b.timestamp || 0) -
                    new Date(a.timestamp || 0)
                )
                .map((item) => (
                  <article className="qa-question-card" key={item.id}>
                    <div className="qa-question-meta">
                      <div className="qa-avatar">
                        {(item.userName || "P").trim().charAt(0).toUpperCase()}
                      </div>

                      <div className="qa-author">
                        <strong>{item.userName || "Participant"}</strong>
                        <span>
                          {item.timestamp
                            ? new Date(item.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Meeting question"}
                        </span>
                      </div>

                      <span
                        className={`qa-status ${
                          item.answered ? "answered" : ""
                        }`}
                      >
                        <span className="qa-status-dot" />
                        {item.answered ? "Answered" : "Open"}
                      </span>
                    </div>

                    <p className="qa-question-text">{item.question}</p>

                    {item.answer && (
                      <div className="qa-answer">
                        <div className="qa-answer-label">
                          <span>↳</span>
                          <strong>
                            {item.answeredBy
                              ? `Answer from ${item.answeredBy}`
                              : "Answer"}
                          </strong>
                        </div>
                        <p>{item.answer}</p>
                      </div>
                    )}

                    {!item.answered && (
                      <form
                        className="qa-answer-form"
                        onSubmit={(event) => handleAnswer(event, item)}
                      >
                        <textarea
                          value={answers[item.id] || ""}
                          onChange={(event) =>
                            setAnswers((previous) => ({
                              ...previous,
                              [item.id]: event.target.value,
                            }))
                          }
                          placeholder="Write an answer..."
                          rows={2}
                          maxLength={2000}
                          required
                        />
                        <button
                          type="submit"
                          className="qa-secondary-button"
                          disabled={!(answers[item.id] || "").trim()}
                        >
                          Reply ↗
                        </button>
                      </form>
                    )}
                  </article>
                ))
            )}
          </div>
        )}

        {activeTab === "polls" && (
          <div className="qa-tab-content" role="tabpanel">
            <div className="qa-section-heading">
              <div>
                <h3>Quick polls</h3>
                <p>Gather opinions from the meeting.</p>
              </div>

              <button
                type="button"
                className="qa-primary-button qa-create-poll-button"
                onClick={() => setShowPollForm((open) => !open)}
              >
                {showPollForm ? "Cancel" : "+ Create"}
              </button>
            </div>

            {showPollForm && (
              <form className="qa-compose qa-poll-form" onSubmit={handleCreatePoll}>
                <label htmlFor="qa-poll-title">Poll question</label>
                <input
                  id="qa-poll-title"
                  value={pollTitle}
                  onChange={(event) => setPollTitle(event.target.value)}
                  placeholder="What should the group decide?"
                  maxLength={300}
                  required
                />

                <label>Answer options</label>

                {pollOptions.map((option, index) => (
                  <div className="qa-poll-option-input" key={index}>
                    <span className="qa-option-emoji">
                      {EMOJIS[index % EMOJIS.length]}
                    </span>
                    <input
                      value={option}
                      onChange={(event) =>
                        setPollOptions((previous) =>
                          previous.map((value, i) =>
                            i === index ? event.target.value : value
                          )
                        )
                      }
                      placeholder={`Option ${index + 1}`}
                      maxLength={150}
                      required={index < 2}
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        className="qa-remove-option"
                        onClick={() =>
                          setPollOptions((previous) =>
                            previous.filter((_, i) => i !== index)
                          )
                        }
                        aria-label={`Remove option ${index + 1}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}

                {pollOptions.length < 5 && (
                  <button
                    type="button"
                    className="qa-add-option"
                    onClick={() =>
                      setPollOptions((previous) => [...previous, ""])
                    }
                  >
                    + Add another option
                  </button>
                )}

                <button
                  type="submit"
                  className="qa-primary-button qa-full-button"
                  disabled={
                    !pollTitle.trim() ||
                    pollOptions.filter((option) => option.trim()).length < 2
                  }
                >
                  Create poll
                </button>
              </form>
            )}

            {polls.length === 0 ? (
              <div className="qa-empty-state">
                <div className="qa-empty-icon">📊</div>
                <h4>No polls yet</h4>
                <p>Create a poll to get everyone's opinion.</p>
              </div>
            ) : (
              polls.map((poll) => {
                const options = poll.options || [];
                const totalVotes = options.reduce(
                  (total, option) => total + getVoteCount(option),
                  0
                );

                const alreadyVoted = Boolean(
                  localVotes[poll.id] ||
                  poll.userVote ||
                  poll.votedByCurrentUser
                );

                return (
                  <article className="qa-poll-card" key={poll.id}>
                    <div className="qa-poll-card-top">
                      <span className="qa-live-indicator" />
                      <span>{alreadyVoted ? "Vote submitted" : "Cast your vote"}</span>
                      <span className="qa-vote-count">
                        {totalVotes} vote{totalVotes === 1 ? "" : "s"}
                      </span>
                    </div>

                    <h4>{poll.question}</h4>

                    <div className="qa-poll-options">
                      {options.map((option, index) => {
                        const count = getVoteCount(option);
                        const percentage = totalVotes
                          ? Math.round((count / totalVotes) * 100)
                          : 0;

                        const isSelected =
                          localVotes[poll.id] === option.id ||
                          poll.userVote === option.id ||
                          poll.votedByCurrentUser === option.id;

                        return (
                          <button
                            type="button"
                            key={option.id || index}
                            className={`qa-poll-vote ${
                              isSelected ? "selected" : ""
                            }`}
                            onClick={() => handleVote(poll, option)}
                            disabled={alreadyVoted}
                          >
                            <span className="qa-poll-vote-row">
                              <span className="qa-poll-emoji">
                                {option.emoji || EMOJIS[index % EMOJIS.length]}
                              </span>
                              <span className="qa-poll-option-text">
                                {option.text}
                              </span>
                              {alreadyVoted && (
                                <span className="qa-poll-percentage">
                                  {percentage}%
                                </span>
                              )}
                              {isSelected && <span>✓</span>}
                            </span>

                            {alreadyVoted && (
                              <span className="qa-poll-bar">
                                <span style={{ width: `${percentage}%` }} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <p className="qa-poll-footer">
                      {alreadyVoted
                        ? "Thanks for sharing your opinion"
                        : "Select one option to vote"}
                    </p>
                  </article>
                );
              })
            )}
          </div>
        )}
      </div>

      <footer className="qa-footer">
        <span className="qa-footer-dot" />
        Meeting discussion
        <span className="qa-footer-secure">● Participants</span>
      </footer>
    </section>
  );
}
