import React, { useEffect, useMemo, useState } from 'react';
import { IconPlus, IconShare } from '@tabler/icons';
import toast from 'react-hot-toast';

import api from '../api';
import { colorForDomain } from '../domainPalette';
import DocsPane from '../DocsPane';
import { taskShareUrl } from '../shareUrl';

export const FOLDER_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'docs', label: 'Docs' }
];

/**
 * 폴더(업무) 화면 — 작업 화면과 같은 탭 구성으로, 이 폴더가 무엇을 담고 있는지
 * (Overview)와 폴더 자체의 설명(Docs)을 보여준다.
 *
 * 폴더 문서는 빈 업무 표식(.folder)에 담긴다 — 서버 쪽 설명 참고.
 */
export function FolderScreen({ domain, task, source = 'prod', tab, onTabChange, refreshKey, onOpenWorkflow, onNewWorkflow }) {
  const [rows, setRows] = useState(null);
  const [colors, setColors] = useState({});
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setDocs(null);
    Promise.all([api.listWorkflows(source), api.getDomainColors(source), api.getTaskDocs(domain, task, source)])
      .then(([list, c, d]) => {
        if (!alive) return;
        setRows(list);
        setColors(c);
        setDocs(d);
        setError(null);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [domain, task, source, refreshKey]);

  const items = useMemo(() => {
    const here = task.normalize('NFC');
    return (rows ?? [])
      .filter((w) => w.domain.normalize('NFC') === domain.normalize('NFC') && w.task.normalize('NFC') === here)
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [rows, domain, task]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!rows) return <p className="muted">불러오는 중…</p>;

  const color = colorForDomain(domain.normalize('NFC'), colors);
  const editable = source === 'edit';
  const segments = task.split('/');

  return (
    <section className="wf-screen">
      <header className="wf-screen-head" style={{ borderLeftColor: color }}>
        <div className="wf-screen-crumb">
          {[domain, ...segments.slice(0, -1)].map((crumb, depth) => (
            <React.Fragment key={`${depth}-${crumb}`}>
              <span className="muted">{crumb}</span>
              <span className="muted">/</span>
            </React.Fragment>
          ))}
          <strong>{segments[segments.length - 1]}</strong>
        </div>
      </header>

      <nav className="wf-tabs">
        {FOLDER_TABS.map((t) => (
          <button key={t.id} className={`wf-tab ${tab === t.id ? 'active' : ''}`} onClick={() => onTabChange(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="wf-tab-body">
        {tab === 'docs' ? (
          <DocsPane
            docs={docs ?? ''}
            editable={editable}
            context={{ scope: 'folder', name: task, location: domain, workflows: items.map((w) => w.name) }}
            emptyLabel="이 폴더가 어떤 업무를 묶고 있는지 적어두세요."
            onSave={(next) => api.setTaskDocs(domain, task, next).then(() => setDocs(next))}
          />
        ) : (
          <div className="folder-overview">
            <div className="folder-overview-head">
              <h3>작업 목록 <span className="hint">({items.length})</span></h3>
              <div className="folder-overview-actions">
                <button
                  className="small"
                  title="이 폴더 화면 링크를 복사합니다"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(taskShareUrl(domain, task))
                      .then(() => toast.success('링크를 복사했습니다'))
                      .catch(() => setError('링크를 복사하지 못했습니다'))}
                >
                  <IconShare size={14} strokeWidth={1.5} />
                  Share
                </button>
                {editable ? (
                  <button className="primary small" onClick={onNewWorkflow}>
                    <IconPlus size={14} strokeWidth={2} />새 작업
                  </button>
                ) : null}
              </div>
            </div>

            {items.length === 0 ? (
              <p className="muted">이 폴더에는 작업이 없습니다.</p>
            ) : (
              <ul className="folder-wf-list">
                {items.map((w) => (
                  <li key={w.id}>
                    <button className="folder-wf-row" onClick={() => onOpenWorkflow(w.id)}>
                      <span className="folder-wf-name">{w.name}</span>
                      {w.description ? <span className="muted">{w.description}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default FolderScreen;
