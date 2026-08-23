import React, { useState } from 'react';
import { IconCornerDownLeft } from '@tabler/icons';

import Flowmap from '../../../WorkflowScreen/Flowmap';
import ApiFinder from '../ApiFinder';

/**
 * 한 판의 초안 — 흐름도 하나로 보여 준다. 값이 어디서 와서 어디로 가는지가 한눈에
 * 보이면, 목록을 읽는 것보다 무엇이 틀렸는지 빨리 눈에 띈다.
 *
 * 고칠 것을 적어 보내면 다음 판이 된다. 보낸 뒤에도 적은 글은 지우지 않는다 — 무엇을
 * 부탁했는지 보이는 채로 다음 판과 견줄 수 있어야 하고, 조금 고쳐 다시 보내기도 쉽다.
 */
export function DraftView({
  version,
  askedFor,
  workflows,
  entries,
  envKeys,
  picked,
  onPick,
  domainColors,
  request,
  onRequestChange,
  onSend,
  onConfirm,
  busy
}) {
  const [finding, setFinding] = useState(false);
  const send = () => onSend(request.trim());
  const canSend = !busy && request.trim().length > 0;

  // 엔터로 보내고 Shift+엔터로 줄을 바꾼다. 한글은 조합을 끝내는 엔터가 먼저 오므로
  // isComposing일 때는 보내지 않는다 — 안 그러면 글자를 확정하다 말고 날아간다.
  const onKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (canSend) send();
  };

  return (
    <div className="ai-wizard-draft">
      {askedFor ? (
        <p className="draft-asked">
          <span className="muted hint">고쳐 달라고 한 것</span> {askedFor}
        </p>
      ) : null}

      <dl className="ai-suggest-fields">
        <dt>이름</dt>
        <dd>{version.draft.name || '—'}</dd>
        <dt>설명</dt>
        <dd>{version.draft.description || '—'}</dd>
      </dl>

      {version.preview.steps.length === 0 ? (
        <p className="muted">그릴 스텝이 없습니다.</p>
      ) : (
        <div className="draft-flowmap">
          <Flowmap workflow={version.preview} workflows={workflows} />
        </div>
      )}

      {version.draft.reason ? <p className="muted hint">{version.draft.reason}</p> : null}

      <div className="draft-revise">
        <span className="field-label">더 고칠 것이 있나요?</span>
        <div className="draft-ask">
          <textarea
            rows={2}
            value={request}
            placeholder="예: 잔액이 0인 계좌는 건너뛰게 해 주세요 (Enter로 보내기 · Shift+Enter 줄바꿈)"
            onChange={(e) => onRequestChange(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button className="draft-send" disabled={!canSend} onClick={send} title="보내기 (Enter)">
            <IconCornerDownLeft size={16} strokeWidth={1.5} />
          </button>
        </div>

        <button className="link small" onClick={() => setFinding((v) => !v)}>
          {finding ? '재료 추가하기 접기' : '재료 추가하기'}
        </button>
        {finding ? (
          <ApiFinder
            entries={entries}
            workflows={workflows}
            envKeys={envKeys}
            picked={picked}
            onChange={onPick}
            domainColors={domainColors}
          />
        ) : null}

        <div className="ai-suggest-actions">
          <button className="primary small" disabled={busy} onClick={onConfirm}>
            확정하고 편집기에 넣기
          </button>
        </div>
      </div>
    </div>
  );
}

export default DraftView;
