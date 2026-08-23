import React, { useState } from 'react';

const OTHER = '__other__';

/**
 * 모델이 카탈로그만 봐서는 정할 수 없다고 한 것들 — 답에 따라 스텝 구성이 갈리는
 * 물음만 여기로 온다.
 *
 * 고를 것을 먼저 주고 마지막에 "기타"를 둔다. 무엇을 물었는지 알아야 답할 수 있는데,
 * 빈 칸만 주면 무엇을 적어야 하는지부터 짐작해야 한다.
 */
export function QuestionForm({ questions, onSubmit }) {
  const [choice, setChoice] = useState({});
  const [other, setOther] = useState({});

  const answerOf = (q) => (choice[q.id] === OTHER ? (other[q.id] ?? '').trim() : (choice[q.id] ?? ''));
  const ready = questions.every((q) => answerOf(q).length > 0);

  return (
    <div className="ai-wizard-questions">
      <p className="muted hint">초안을 내기 전에 확인할 것이 있습니다.</p>
      {questions.map((q) => (
        <div key={q.id} className="field wide">
          <span className="field-label">{q.question}</span>
          {q.choices.map((option) => (
            <label key={option} className="purpose-row">
              <input
                type="radio"
                checked={choice[q.id] === option}
                onChange={() => setChoice({ ...choice, [q.id]: option })}
              />
              {option}
            </label>
          ))}
          <label className="purpose-row">
            <input
              type="radio"
              checked={choice[q.id] === OTHER}
              onChange={() => setChoice({ ...choice, [q.id]: OTHER })}
            />
            기타
          </label>
          {choice[q.id] === OTHER ? (
            <input
              value={other[q.id] ?? ''}
              placeholder="답을 적으세요"
              onChange={(e) => setOther({ ...other, [q.id]: e.target.value })}
            />
          ) : null}
        </div>
      ))}

      <div className="ai-suggest-actions">
        <button
          className="primary small"
          disabled={!ready}
          onClick={() => onSubmit(questions.map((q) => ({ question: q.question, answer: answerOf(q) })))}
        >
          답하고 이어 가기
        </button>
      </div>
    </div>
  );
}

export default QuestionForm;
