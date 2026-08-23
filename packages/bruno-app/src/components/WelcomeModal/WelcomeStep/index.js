import React from 'react';
import { IconGitBranch, IconGitFork, IconWorld, IconLink } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

// 웹 모드 기준 소개 — 저장은 git 저장소(워크스페이스 브랜치)로 이뤄지고,
// 저장 위치를 따로 고르는 단계는 없다.
const highlights = [
  {
    icon: IconGitBranch,
    title: 'Stored in Git',
    desc: 'Collections live in a Git repository. Your workspace is a branch and every save becomes a commit — nothing to configure.'
  },
  {
    icon: IconGitFork,
    title: 'Git-friendly',
    desc: 'Every request is a readable file. Review changes and promote the ones you trust to main.'
  },
  {
    icon: IconWorld,
    title: 'Runs in the browser',
    desc: 'Nothing to install. Open a link and your team sees the same workspace.'
  },
  {
    icon: IconLink,
    title: 'Ready for API Chain',
    desc: 'Requests promoted to main become the catalog that API Chain strings into multi-step tasks.'
  }
];

const WelcomeStep = () => (
  <StyledWrapper className="step-body">
    <div className="highlights">
      {highlights.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.title} className="highlight-item">
            <div className="highlight-icon">
              <Icon size={18} stroke={1.5} />
            </div>
            <div>
              <div className="highlight-title">{item.title}</div>
              <div className="highlight-desc">{item.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  </StyledWrapper>
);

export default WelcomeStep;
