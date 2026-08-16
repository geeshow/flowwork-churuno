import React from 'react';

/**
 * 워크플로우 홈(사용 모드 첫 화면) 안내 — 초급 개발자 눈높이로
 * ① Bruno API(.bru)와 워크플로우가 연결되는 과정, ② 수정이 운영(main)에
 * 반영되기까지의 브랜치 전략을 그림과 함께 설명한다.
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

// 브랜치 전략 단계 — 번호·색이 아래 SVG의 배지와 1:1로 대응한다
const BRANCH_STEPS = [
  { lane: 'feature', text: '편집 모드에서 feature 브랜치를 만들어 수정 모드로 들어갑니다 (내 전용 작업 공간)' },
  { lane: 'feature', text: '저장하면 그 브랜치에만 임시 저장됩니다 — 다른 사람과 운영 화면에는 영향 없음' },
  { lane: 'feature', text: '변경이 확정되면 커밋(+푸시)합니다' },
  { lane: 'develop', text: 'develop에 머지합니다 — 충돌이 나면 화면에서 비교하며 해결' },
  { lane: 'main', text: '운영 반영(develop → main)을 누르면 비로소 이 화면에 나타납니다' }
];

function GitGraph() {
  const badge = (n, x, y, lane) => (
    <g key={n} className={`git-badge git-badge-${lane}`}>
      <circle cx={x} cy={y} r="10" />
      <text x={x} y={y + 3.5} textAnchor="middle">{n}</text>
    </g>
  );

  return (
    <svg className="guide-git" viewBox="0 0 680 200" role="img" aria-label="feature 브랜치에서 develop을 거쳐 main으로 반영되는 과정">
      <text className="git-label" x="8" y="39">main (운영)</text>
      <text className="git-label" x="8" y="99">develop (통합)</text>
      <text className="git-label" x="8" y="159">feature/* (내 작업)</text>

      <path className="git-lane lane-main" d="M115 35 H668" />
      <path className="git-lane lane-develop" d="M115 95 H668" />
      {/* develop에서 갈라져 나왔다가(1) 작업 후 다시 develop으로 합쳐지는(4) feature 브랜치 */}
      <path className="git-lane lane-feature" d="M150 95 C175 95 175 155 200 155 H430 C455 155 455 95 480 95" />
      {/* develop → main 운영 반영(5) */}
      <path className="git-lane lane-main" d="M560 95 C585 95 585 35 610 35" />

      <text className="git-label" x="668" y="18" textAnchor="end">지금 이 화면이 읽는 브랜치</text>

      {badge(1, 200, 155, 'feature')}
      {badge(2, 280, 155, 'feature')}
      {badge(3, 360, 155, 'feature')}
      {badge(4, 480, 95, 'develop')}
      {badge(5, 610, 35, 'main')}
    </svg>
  );
}

export function HomeGuide({ onOpenEdit }) {
  return (
    <section className="home-guide">
      <div className="guide-hero">
        <h2>워크플로우</h2>
        <p className="muted">
          Bruno에 저장된 API들을 순서대로 엮어 여러 단계 업무를 한 번에 실행하는 도구입니다. 왼쪽에서 업무를
          선택하면 실행할 수 있습니다.
        </p>
      </div>

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
        <h3>수정한 워크플로우는 언제 여기에 보이나요? (브랜치 전략)</h3>
        <p className="muted">
          이 화면은 운영(main) 데이터를 읽기 전용으로 보여줍니다. 수정은 내 전용 브랜치에서 시작해 아래 다섯
          단계를 거쳐야 운영에 반영됩니다 — 검토 없이 바로 바뀌는 일이 없도록 하기 위해서입니다.
        </p>
        <GitGraph />
        <ol className="guide-flow-list">
          {BRANCH_STEPS.map((s, i) => (
            <li key={i}>
              <span className={`flow-num flow-num-${s.lane}`}>{i + 1}</span>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
        <button className="primary" onClick={onOpenEdit}>
          편집 모드 열기 →
        </button>
      </div>
    </section>
  );
}

export default HomeGuide;
