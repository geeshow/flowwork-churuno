import React from 'react';

/**
 * 편집 모드 홈의 안내 — 초급 개발자 눈높이로
 * ① Bruno API(.bru)와 워크플로우가 연결되는 과정, ② 편집 공간의 변경이
 * 운영(main)에 반영되는 과정(작업 단위)을 그림과 함께 설명한다.
 * 변경 목록(운영 반영 대상) 아래에 렌더된다.
 */

const PIPELINE_STEPS = [
  {
    icon: '🗂️',
    title: 'Bruno 컬렉션',
    desc: 'Bruno에서 저장한 API 요청이 .bru 파일로 main 브랜치에 쌓입니다'
  },
  {
    icon: '📚',
    title: 'API 카탈로그',
    desc: '서버가 .bru를 읽어 검색 가능한 API 목록으로 만듭니다 (별도 등록 불필요)'
  },
  {
    icon: '🧩',
    title: '워크플로우 스텝',
    desc: '카탈로그에서 API를 골라 스텝으로 쌓고, 요청의 {{변수}}에 값을 매핑합니다'
  },
  {
    icon: '▶️',
    title: '실행',
    desc: '스텝을 순서대로 호출하고 단계별 성공/실패와 이력을 남깁니다'
  }
];

const VALUE_SOURCES = ['기본 입력값 (사용자 입력)', '이전 스텝 응답', '환경변수', '고정값'];

// 반영 단계 — 번호·색이 아래 SVG의 배지와 1:1로 대응한다
const BRANCH_STEPS = [
  { lane: 'main', text: 'Bruno main 브랜치의 API 목록(.bru 컬렉션)이 자동으로 카탈로그로 연결됩니다' },
  { lane: 'feature', text: '편집 공간에서 카탈로그의 API를 연결해 워크플로우를 추가/수정합니다 — 저장하면 바로 기록됩니다' },
  { lane: 'feature', text: '위 변경 목록에서 작업 단위로 확인하고, 필요 없으면 작업 삭제합니다 (작업 내용을 지우고 운영 버전으로 복원)' },
  { lane: 'main', text: '운영 반영은 작업 단위 — 준비된 작업만 골라 반영하면 사용 모드(운영 화면)에 나타납니다' }
];

// Bruno API 연결 → 편집 공간에서 추가/수정 → 변경 목록 → 작업 단위 운영 반영 전체 흐름
function ProcessGraph() {
  const badge = (n, x, y, lane) => (
    <g key={n} className={`git-badge git-badge-${lane}`}>
      <circle cx={x} cy={y} r="10" />
      <text x={x} y={y + 3.5} textAnchor="middle">{n}</text>
    </g>
  );

  return (
    <svg
      className="guide-git"
      viewBox="0 0 680 240"
      role="img"
      aria-label="Bruno main의 API 목록을 연결해 편집 공간에서 워크플로우를 추가/수정하고, 변경 목록에서 작업 단위로 운영에 반영하는 과정"
    >
      <text className="git-label" x="8" y="49">운영 (main)</text>
      <text className="git-label" x="8" y="194">편집 공간</text>

      <path className="git-lane lane-main" d="M115 45 H668" />
      <path className="git-lane lane-feature" d="M115 190 H668" />

      {/* ① main의 .bru API 목록이 편집 공간의 카탈로그로 내려온다 */}
      <path className="git-flow flow-main" d="M200 68 C200 120 240 140 240 186" />
      {/* ④ 준비된 작업만 골라 운영으로 반영 — 작업 단위 */}
      <path className="git-flow flow-main" d="M530 190 C560 190 560 45 590 45" />

      <g className="git-node">
        <rect x="125" y="22" width="150" height="46" rx="8" />
        <text x="200" y="41" textAnchor="middle">Bruno API 목록</text>
        <text className="git-node-sub" x="200" y="57" textAnchor="middle">(main 브랜치 .bru 컬렉션)</text>
      </g>

      <text className="git-label" x="668" y="23" textAnchor="end">사용 모드(운영 화면)가 읽는 데이터</text>

      {badge(1, 216, 126, 'main')}
      <text className="git-step-label" x="234" y="130">API 카탈로그로 연결</text>

      {badge(2, 330, 190, 'feature')}
      <text className="git-step-label" x="330" y="218" textAnchor="middle">API 연결해 추가/수정 (저장=기록)</text>

      {badge(3, 470, 190, 'feature')}
      <text className="git-step-label" x="482" y="218" textAnchor="middle">변경 목록 · 작업 삭제</text>

      {badge(4, 600, 45, 'main')}
      <text className="git-step-label" x="600" y="78" textAnchor="middle">작업 단위 운영 반영</text>
    </svg>
  );
}

export function HomeGuide() {
  return (
    <>
      <div className="panel guide-panel">
        <h3>Bruno API와 어떻게 연결되나요?</h3>
        <p className="muted">
          Bruno 컬렉션의 요청이 곧 워크플로우가 쓸 수 있는 API 재료입니다 — 따로 등록하지 않아도 됩니다.
        </p>
        <div className="guide-pipeline">
          {PIPELINE_STEPS.map((s, i) => (
            <React.Fragment key={s.title}>
              {i > 0 ? <span className="guide-arrow">→</span> : null}
              <div className="guide-step">
                <span className="guide-step-icon">{s.icon}</span>
                <strong>{s.title}</strong>
                <span className="muted">{s.desc}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
        <div className="guide-note">
          <span className="muted">
            스텝이 참조하는 요청의 <code>{'{{변수}}'}</code> 자리는 네 가지 값으로 채울 수 있습니다:
          </span>
          <span className="guide-chips">
            {VALUE_SOURCES.map((v) => (
              <span key={v} className="guide-chip">{v}</span>
            ))}
          </span>
        </div>
      </div>

      <div className="panel guide-panel">
        <h3>전체 흐름 — Bruno API 연결부터 운영 반영까지</h3>
        <p className="muted">
          편집 모드의 저장은 즉시 기록되지만 운영(main)에는 반영되지 않습니다. 사용 모드 화면은 운영 데이터를
          읽기 전용으로 보여주고, 위 변경 목록에서 <strong>운영 반영</strong>을 누른 작업만 거기에 나타납니다 —
          검토 없이 운영이 바뀌는 일이 없도록 하기 위해서입니다. 운영 반영은 <strong>작업 단위</strong>로
          가능해서, 여러 변경이 쌓여 있어도 준비된 것만 골라 내보낼 수 있습니다.
        </p>
        <ProcessGraph />
        <ol className="guide-flow-list">
          {BRANCH_STEPS.map((s, i) => (
            <li key={i}>
              <span className={`flow-num flow-num-${s.lane}`}>{i + 1}</span>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
        <p className="muted">
          <strong>작업 삭제는 어떻게 되나요?</strong> 변경 목록의 작업 삭제는{' '}
          <strong>편집 공간에서 작업한 내용을 삭제하고 운영(main) 버전으로 복원</strong>합니다. 운영에 있던
          워크플로우를 수정한 경우에는 수정 내용이 삭제되어 운영과 같은 내용으로 돌아가고, 새로 추가한
          워크플로우는 운영에 없으므로 통째로 삭제됩니다.{' '}
          <strong className="error-text">삭제된 작업 내용은 복구할 수 없으니</strong> 누르기 전에 확인하세요.
          운영 데이터에는 아무 영향이 없습니다.
        </p>
      </div>
    </>
  );
}

export default HomeGuide;
