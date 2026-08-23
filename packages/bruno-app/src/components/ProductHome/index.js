import React from 'react';
import { useDispatch } from 'react-redux';
import {
  IconArrowRight,
  IconExternalLink,
  IconFileCode,
  IconFileImport,
  IconFileText,
  IconFolders,
  IconGitBranch,
  IconGitMerge,
  IconHistory,
  IconMessageChatbot,
  IconRepeat,
  IconShare,
  IconTerminal2,
  IconWorld
} from '@tabler/icons';

import { setActiveApp } from 'providers/ReduxStore/slices/app';
import Bruno from 'components/Bruno';
import IconSparkles from 'components/Icons/IconSparkles';
import FlowworkLogo from 'components/Icons/FlowworkLogo';
import ApiChainIcon from 'components/Icons/ApiChainIcon';
import Button from 'ui/Button';
import StyledWrapper from './StyledWrapper';

/**
 * 제품 소개 홈 — 타이틀바의 Flowwork 제품명을 누르면 열린다.
 * Flowwork = API Chain(워크플로우) + Bruno(API 호출)가 한 Git 저장소 위에서 도는 구성을 설명한다.
 */

const API_CHAIN_FEATURES = [
  {
    icon: IconFolders,
    title: 'API 컬렉션 기반 호출 관계',
    desc: 'Bruno 컬렉션(.bru)에 저장된 요청이 그대로 API 카탈로그가 됩니다. 카탈로그에서 API를 골라 스텝으로 쌓고, '
      + '이전 스텝 응답·환경변수·사용자 입력을 다음 요청의 {{변수}}에 매핑합니다. 흐름도에서 값이 어디서 와서 어디로 가는지 한눈에 봅니다.'
  },
  {
    // 프로젝트 자체 아이콘 — tabler와 달리 strokeWidth prop을 받는다
    icon: ({ size }) => <IconSparkles size={size} strokeWidth={1.5} />,
    title: 'AI로 자동 API Chain 생성',
    desc: '하고 싶은 업무를 말로 설명하면 AI가 카탈로그의 API를 골라 스텝 초안과 입력값을 제안합니다. '
      + '부족한 정보는 되물어 채우고, 제안은 편집기에서 바로 고쳐 쓸 수 있습니다.'
  },
  {
    icon: IconGitBranch,
    title: 'Git을 이용한 코드 기반 작업 관리',
    desc: 'API Chain은 파일로 저장되고 모든 변경이 Git에 기록됩니다. 편집 공간(브랜치)에서 고치고, 변경 목록에서 작업 단위로 골라 운영(main)에 반영합니다. '
      + '검토 없이 운영이 바뀌지 않고, 언제든 운영 버전으로 되돌릴 수 있습니다.'
  }
];

const API_CHAIN_EXTRAS = [
  { icon: IconRepeat, text: '반복 블록 — 목록의 항목마다 같은 스텝을 실행' },
  { icon: IconHistory, text: '실행 이력 — 단계별 성공/실패와 응답을 남기고 링크로 공유' },
  { icon: IconFileText, text: '업무별 Docs — 마크다운 문서를 운영 화면에서도 바로 편집' },
  { icon: IconExternalLink, text: '스텝에서 원본 Bruno 요청으로 바로 이동' }
];

const BRUNO_FEATURES = [
  {
    icon: IconWorld,
    title: 'Web 기반 API 호출',
    desc: '설치 없이 브라우저에서 요청을 보내고 응답을 확인합니다. 인증(OAuth2 등)·파라미터·헤더·바디·환경변수·스크립트·테스트까지 '
      + '데스크톱 Bruno의 기능을 그대로 씁니다.'
  },
  {
    icon: IconGitMerge,
    title: 'Git branch 전략으로 환경 분리·작업 공유',
    desc: '워크스페이스가 곧 브랜치입니다. main은 읽기 전용 운영본, 각자의 작업 브랜치에서 요청·문서·환경을 고친 뒤 골라서 main에 반영합니다. '
      + '요청·폴더·컬렉션마다 공유 링크가 있어 주소만 보내면 같은 화면이 열립니다.'
  }
];

const BRUNO_EXTRAS = [
  { icon: IconMessageChatbot, text: 'AI 채팅 — 문서·스크립트 작성과 요청 수정 도움' },
  { icon: IconFileCode, text: 'API Spec 패널 — OpenAPI/Swagger 문서를 보며 바로 호출' },
  { icon: IconFileImport, text: 'Postman · Insomnia · OpenAPI 컬렉션 가져오기' },
  { icon: IconTerminal2, text: 'Devtools — 콘솔·네트워크 로그로 요청 추적' }
];

const PIPELINE = [
  { app: 'bruno', text: 'Bruno에서 API 요청을 만들고 작업 브랜치에 저장' },
  { app: 'bruno', text: '검토한 요청만 골라 main에 반영' },
  { app: 'chain', text: 'main의 컬렉션을 카탈로그로 읽어 API Chain 작성' },
  { app: 'chain', text: '작업 단위로 운영 반영 → 실무자가 실행하고 결과를 공유' }
];

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div className="feature-card">
      <span className="feature-icon"><Icon size={20} stroke={1.5} /></span>
      <strong>{title}</strong>
      <p>{desc}</p>
    </div>
  );
}

function ExtraList({ items }) {
  return (
    <ul className="extra-list">
      {items.map(({ icon: Icon, text }) => (
        <li key={text}>
          <Icon size={15} stroke={1.5} />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ProductHome() {
  const dispatch = useDispatch();
  const openApiChain = () => dispatch(setActiveApp('flowwork'));
  const openBruno = () => dispatch(setActiveApp('bruno'));

  return (
    <StyledWrapper data-testid="product-home">
      <div className="page">
        <section className="hero">
          <span className="hero-icon"><FlowworkLogo size={40} stroke={1.5} /></span>
          <h1>Flowwork</h1>
          <p className="tagline">API 컬렉션을 엮어 업무 흐름으로</p>
          <p className="lead">
            개발자는 <strong>Bruno</strong>에서 API를 만들고, 실무자는 <strong>API Chain</strong>에서 그 API들을
            순서대로 엮어 실행합니다. 둘 다 하나의 Git 저장소 위에서 돌아가서, 모든 변경이 기록되고 검토를 거쳐 운영에 반영됩니다.
          </p>
          <div className="hero-actions">
            <Button onClick={openApiChain} data-testid="product-home-open-api-chain">
              <ApiChainIcon size={16} stroke={1.5} />
              API Chain 열기
            </Button>
            <Button variant="outline" onClick={openBruno} data-testid="product-home-open-bruno">
              <Bruno width={16} />
              Bruno 열기
            </Button>
          </div>
        </section>

        <section className="product">
          <header>
            <span className="product-icon"><ApiChainIcon size={22} stroke={1.5} /></span>
            <div>
              <h2>API Chain</h2>
              <p>여러 API 호출을 순서대로 엮어 한 번에 실행합니다</p>
            </div>
          </header>
          <div className="feature-grid">
            {API_CHAIN_FEATURES.map((f) => <FeatureCard key={f.title} {...f} />)}
          </div>
          <h4>그 밖에</h4>
          <ExtraList items={API_CHAIN_EXTRAS} />
        </section>

        <section className="product">
          <header>
            <span className="product-icon"><Bruno width={24} /></span>
            <div>
              <h2>Bruno</h2>
              <p>브라우저에서 쓰는 Git 친화적 API 클라이언트</p>
            </div>
          </header>
          <div className="feature-grid two">
            {BRUNO_FEATURES.map((f) => <FeatureCard key={f.title} {...f} />)}
          </div>
          <h4>그 밖에</h4>
          <ExtraList items={BRUNO_EXTRAS} />
        </section>

        <section className="product pipeline">
          <header>
            <span className="product-icon"><IconGitBranch size={22} stroke={1.5} /></span>
            <div>
              <h2>함께 쓰면 이렇게 흐릅니다</h2>
              <p>Bruno의 main 브랜치가 API Chain의 카탈로그 — 따로 등록할 것이 없습니다</p>
            </div>
          </header>
          <ol className="pipeline-steps">
            {PIPELINE.map((s, i) => (
              <li key={s.text} className={`step step-${s.app}`}>
                <span className="step-num">{i + 1}</span>
                <span className="step-app">{s.app === 'bruno' ? 'Bruno' : 'API Chain'}</span>
                <span className="step-text">{s.text}</span>
                {i < PIPELINE.length - 1 ? <IconArrowRight className="step-arrow" size={16} stroke={1.5} /> : null}
              </li>
            ))}
          </ol>
        </section>

        <footer className="share-note">
          <IconShare size={14} stroke={1.5} />
          <span>모든 화면에는 주소가 있습니다 — 워크스페이스·요청·API Chain·실행 결과를 링크로 바로 공유하세요.</span>
        </footer>
      </div>
    </StyledWrapper>
  );
}
