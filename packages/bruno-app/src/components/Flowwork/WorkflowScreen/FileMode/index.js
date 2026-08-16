import React, { useState } from 'react';
import get from 'lodash/get';
import { useSelector } from 'react-redux';
import CodeEditor from 'components/CodeEditor';
import { useTheme } from 'providers/Theme';

import api from '../../api';

/**
 * 파일 모드 — 작업을 화면(폼) 대신 저장된 파일 그대로 편집한다.
 * Bruno 컬렉션의 "Switch to File Mode"와 같은 개념이고, flowwork의 작업은
 * 워크플로우 JSON 한 파일이므로 그 내용을 그대로 열어준다.
 */
export function FileMode({ workflow, editable, onSaved }) {
  const { displayedTheme } = useTheme();
  const preferences = useSelector((state) => state.app.preferences);
  // version은 낙관적 잠금 값이라 파일에 저장되지 않는다 — 편집 대상에서 뺀다
  const { version, ...file } = workflow;
  const [draft, setDraft] = useState(() => JSON.stringify(file, null, 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = () => {
    let parsed;
    try {
      parsed = JSON.parse(draft);
    } catch (e) {
      setError(`JSON을 읽을 수 없습니다: ${e.message}`);
      return;
    }
    if (parsed.id !== workflow.id) {
      setError('id는 바꿀 수 없습니다 — 이름이나 위치를 바꾸려면 도메인/업무/이름 항목을 고치세요.');
      return;
    }
    setSaving(true);
    setError(null);
    api
      .saveWorkflow({ ...parsed, version })
      .then(onSaved)
      .catch((e) => setError(e.message))
      .finally(() => setSaving(false));
  };

  return (
    <div className="wf-filemode">
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="wf-docs-bar">
        <span className="muted hint">저장된 파일 그대로입니다. 형식이 깨지면 저장되지 않습니다.</span>
        {editable ? (
          <button className="primary small" onClick={save} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        ) : null}
      </div>
      <div className="wf-filemode-body">
        <CodeEditor
          theme={displayedTheme}
          font={get(preferences, 'font.codeFont', 'default')}
          fontSize={get(preferences, 'font.codeFontSize')}
          value={draft}
          onEdit={setDraft}
          onSave={save}
          mode="application/ld+json"
          readOnly={!editable}
        />
      </div>
    </div>
  );
}

export default FileMode;
