import styled from 'styled-components';

const StyledWrapper = styled.div`
  height: 100%;
  min-height: 0;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: ${(props) => props.theme.bg};
  color: ${(props) => props.theme.text};
  font-size: ${(props) => props.theme.font.size.base};

  .flowwork-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .muted {
    color: ${(props) => props.theme.colors.text.muted};
  }
  .hint {
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.font.size.xs};
  }
  .ok-text {
    color: ${(props) => props.theme.colors.text.green};
  }
  .error-text {
    color: ${(props) => props.theme.colors.text.danger};
  }

  .error-banner {
    margin: 8px 0;
    padding: 8px 12px;
    border: 1px solid ${(props) => props.theme.colors.text.danger};
    border-radius: ${(props) => props.theme.border.radius.base};
    color: ${(props) => props.theme.colors.text.danger};
    font-size: ${(props) => props.theme.font.size.sm};
  }

  /* 이 화면의 맨몸 button 기본값. :where()로 감싸 우선순위를 0으로 두면
     Bruno에서 가져다 쓰는 컴포넌트(ui/Button, ModeSwitch 등)의 자기 스타일이
     그대로 살아난다 — 그러지 않으면 padding까지 지워져 글자만 남는다. */
  :where(button) {
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  button.link {
    color: ${(props) => props.theme.textLink};
    font-size: ${(props) => props.theme.font.size.sm};
    &:hover {
      text-decoration: underline;
    }
    &.small {
      font-size: ${(props) => props.theme.font.size.xs};
    }
    &.danger {
      color: ${(props) => props.theme.colors.text.danger};
    }
    &:disabled {
      color: ${(props) => props.theme.colors.text.muted};
      cursor: not-allowed;
      text-decoration: none;
    }
  }

  button.primary {
    background: ${(props) => props.theme.brand};
    color: white;
    padding: 6px 16px;
    border: 1px solid transparent; /* 비활성 시 테두리가 생겨도 크기가 튀지 않도록 */
    border-radius: ${(props) => props.theme.border.radius.base};
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 500;
    /* 반투명 처리 대신 명확한 비활성 색을 써서 밝은 배경 위에서도 라벨이 읽히게 한다 */
    &:disabled {
      background: ${(props) => props.theme.background.surface1};
      color: ${(props) => props.theme.colors.text.muted};
      border: 1px solid ${(props) => props.theme.border.border1};
      cursor: not-allowed;
    }
  }

  button.small {
    padding: 4px 10px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.base};
    background: ${(props) => props.theme.background.surface0};
    font-size: ${(props) => props.theme.font.size.xs};
    &:hover {
      border-color: ${(props) => props.theme.input.focusBorder};
    }
  }

  /* primary + small 조합 — button.small의 회색 배경이 브랜드 색을 덮지 않게 유지 */
  button.primary.small {
    background: ${(props) => props.theme.brand};
    color: white;
    border-color: transparent;
    &:hover {
      border-color: transparent;
    }
    &:disabled {
      background: ${(props) => props.theme.background.surface1};
      color: ${(props) => props.theme.colors.text.muted};
      border-color: ${(props) => props.theme.border.border1};
    }
  }

  /* 2단계 확인 버튼(ConfirmButton)이 확인 대기 상태일 때 — 위험 동작 강조 */
  button.confirm-armed {
    color: ${(props) => props.theme.colors.text.danger};
    font-weight: 600;
    &.primary {
      background: ${(props) => props.theme.colors.text.danger};
      color: white;
    }
  }

  .icon-btn {
    padding: 2px 6px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    color: ${(props) => props.theme.colors.text.muted};
    &:hover {
      background: ${(props) => props.theme.background.surface1};
      color: ${(props) => props.theme.text};
    }
    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    &.danger:hover {
      color: ${(props) => props.theme.colors.text.danger};
    }
  }

  input,
  select {
    font: inherit;
    color: ${(props) => props.theme.text};
    background: ${(props) => props.theme.input.bg};
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.base};
    padding: 5px 8px;
    font-size: ${(props) => props.theme.font.size.sm};
    outline: none;
    &:focus {
      border-color: ${(props) => props.theme.input.focusBorder};
    }
  }

  code {
    font-family: ${(props) => props.theme.font.codeFontFamily || 'monospace'};
    font-size: ${(props) => props.theme.font.size.xs};
  }

  h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }
  h3 {
    font-size: ${(props) => props.theme.font.size.base};
    font-weight: 600;
    margin: 0 0 10px;
  }
  h4 {
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
    margin: 0 0 6px;
  }
  h5 {
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 600;
    margin: 0 0 6px;
    color: ${(props) => props.theme.colors.text.muted};
  }

  /* ---------------- 레이아웃: 사이드바 + 디테일 ---------------- */
  .workspace {
    display: flex;
    height: 100%;
    min-height: 0;
  }

  .wf-sidebar-wrap {
    position: relative;
    display: flex;
    flex-shrink: 0;
  }

  /* 폭은 인라인 style로 지정 — Bruno 사이드바와 같은 leftSidebarWidth 상태를 따른다 */
  .wf-sidebar {
    flex-shrink: 0;
    border-right: 1px solid ${(props) => props.theme.border.border1};
    background: ${(props) => props.theme.sidebar.bg};
    overflow-y: auto;
  }

  .wf-sidebar-drag-handle {
    position: absolute;
    top: 0;
    right: -3px;
    width: 6px;
    height: 100%;
    display: flex;
    justify-content: center;
    cursor: col-resize;
    z-index: 1;

    .drag-border {
      width: 1px;
      height: 100%;
    }
    &:hover .drag-border {
      border-left: 1px solid ${(props) => props.theme.sidebar.dragbar.activeBorder};
    }
  }

  .sidebar-scroll {
    padding: 12px 10px;
  }

  .sidebar-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    padding: 0 4px;
  }
  /* 사이드바 글자는 Bruno 사이드바와 같은 크기·굵기로 맞춘다 —
     머리말 12px/600, 컬렉션·업무·작업 줄 13px/400, 줄 높이 1.6rem */
  .sidebar-title {
    font-size: 12px;
    font-weight: 600;
  }
  .sidebar-title-btn:hover .sidebar-title {
    text-decoration: underline;
  }

  /* 워크스페이스 = 이 화면이 읽고 쓰는 브랜치 */
  .wf-workspace {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    padding: 5px 8px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.base};
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.font.size.xs};
  }
  .wf-workspace-name {
    font-weight: 600;
    color: ${(props) => props.theme.text};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .domain-tree {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* 컬렉션(도메인)은 자기 색 테두리로 묶어 한 덩어리로 보여준다 */
  .domain-group {
    border: 1px solid;
    border-radius: ${(props) => props.theme.border.radius.md};
    overflow: hidden;

    &.open .domain-row {
      border-bottom: 1px solid;
    }
  }

  /* 도메인 줄 — 업무 줄과 마찬가지로 hover할 때만 "..."이 나타난다 */
  .domain-row {
    display: flex;
    align-items: center;

    &:hover .task-menu-trigger,
    .task-menu-trigger.open {
      opacity: 1;
    }
  }

  .domain-head {
    display: flex;
    align-items: center;
    gap: 7px;
    flex: 1;
    min-width: 0;
    height: 1.6rem;
    padding: 0 8px;
    font-size: 13px;
    &:hover {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }
  }
  .domain-caret {
    color: ${(props) => props.theme.colors.text.muted};
    font-size: 10px;
    width: 10px;
  }
  .domain-name {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .domain-count {
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.font.size.xs};
  }

  .task-menu {
    list-style: none;
    margin: 0;
    padding: 4px 4px 6px;
  }
  .task-empty {
    padding: 6px 0 8px 14px;
    font-size: ${(props) => props.theme.font.size.xs};
  }

  /* 운영 미반영 표시 — 불릿 자리를 대신한다 */
  .change-mark {
    flex-shrink: 0;
    width: 9px;
    color: ${(props) => props.theme.colors.text.yellow};
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    text-align: center;
  }
  /* Bruno 사이드바처럼 hover·활성일 때만 "..."이 나타난다 */
  .task-row {
    display: flex;
    align-items: center;
    border-radius: ${(props) => props.theme.border.radius.base};

    &:hover {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }
    &:hover .task-menu-trigger,
    .task-menu-trigger.open {
      opacity: 1;
    }
  }

  .task-menu-trigger {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding: 2px 4px;
    margin-right: 4px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    color: ${(props) => props.theme.colors.text.muted};
    opacity: 0;

    &:hover {
      color: ${(props) => props.theme.text};
      background: ${(props) => props.theme.background.surface1};
    }
  }

  .task-item {
    display: flex;
    align-items: center;
    gap: 7px;
    flex: 1;
    min-width: 0;
    height: 1.6rem;
    padding: 0 8px 0 4px;
    border-radius: ${(props) => props.theme.border.radius.base};
    font-size: 13px;
    &:hover {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }
    /* 선택 표시는 Bruno 사이드바(item-focused-in-tab)와 같다 — 테두리 없이 배경만,
       hover로도 색이 흔들리지 않게 고정한다 */
    &.active,
    &.active:hover {
      background: ${(props) => props.theme.sidebar.collection.item.bg};
    }
    &.wf-item {
      color: ${(props) => props.theme.colors.text.muted};
      &.active,
      &:hover {
        color: ${(props) => props.theme.text};
      }
    }
  }
  /* 사이드바가 스크롤되므로 메뉴는 화면 좌표로 띄운다 */
  .task-menu-popup {
    position: fixed;
    z-index: 30;
    min-width: 168px;
    padding: 4px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.md};
    background: ${(props) => props.theme.background.surface0};
    box-shadow: ${(props) => props.theme.shadow.md};
  }

  .task-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 5px 8px;
    border-radius: ${(props) => props.theme.border.radius.base};
    font-size: ${(props) => props.theme.font.size.sm};
    text-align: left;

    &:hover:not(:disabled) {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }
    &.danger {
      color: ${(props) => props.theme.colors.text.danger};
    }
    &:disabled {
      color: ${(props) => props.theme.colors.text.muted};
      cursor: not-allowed;
    }
  }

  /* 이름 입력 대화상자 (window.prompt 대체) */
  .name-prompt-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.35);
  }
  .name-prompt {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 320px;
    padding: 16px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.md};
    background: ${(props) => props.theme.background.surface0};
    box-shadow: ${(props) => props.theme.shadow.lg};

    h4 {
      margin: 0;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  }
  .name-prompt-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  /* 컬렉션·폴더 모두 같은 아이콘으로 열고 닫는다 (Bruno 사이드바와 동일) */
  .tree-chevron {
    flex-shrink: 0;
    color: ${(props) => props.theme.colors.text.muted};
    transition: transform 0.15s ease;

    &.open {
      transform: rotate(90deg);
    }
  }
  .tree-toggle {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding: 4px 1px;
    border-radius: ${(props) => props.theme.border.radius.sm};

    &:hover .tree-chevron {
      color: ${(props) => props.theme.text};
    }
  }

  .task-item-wrap {
    display: flex;
    align-items: stretch;
    flex: 1;
    min-width: 0;
  }
  /* 계층 안내선 — 깊이만큼 세로줄이 서서 어느 단계인지 보인다 */
  .depth-guide {
    flex-shrink: 0;
    width: 13px;
    border-left: 1px solid ${(props) => props.theme.border.border0};
  }
  .task-text {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .wf-detail {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: 16px 20px 40px;
  }

  .crumb {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* ---------------- 탭 줄 위 머리띠 ---------------- */
  .wf-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: -4px -4px 6px;
    padding: 0 4px 8px;
  }
  .wf-topbar-crumbs {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex-wrap: wrap;
    font-size: ${(props) => props.theme.font.size.xs};
  }
  .wf-topbar-workspace {
    padding: 1px 8px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: 999px;
    color: ${(props) => props.theme.colors.text.muted};
  }
  .wf-topbar-current {
    font-weight: 600;
  }
  .wf-topbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;

    button {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  }
  .wf-topbar-count {
    padding: 0 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.25);
  }

  /* ---------------- 폴더 화면 ---------------- */
  .folder-overview {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .folder-overview-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    h3 {
      margin: 0;
    }
  }
  .folder-overview-actions {
    display: flex;
    align-items: center;
    gap: 8px;

    button {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  }
  .folder-wf-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .folder-wf-row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.base};
    background: ${(props) => props.theme.background.surface0};
    text-align: left;
    font-size: ${(props) => props.theme.font.size.sm};

    &:hover {
      border-color: ${(props) => props.theme.input.focusBorder};
    }
  }
  .folder-wf-name {
    font-weight: 600;
  }

  /* ---------------- 파일 모드 ---------------- */
  .wf-filemode {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 12px;
  }
  .wf-filemode-body {
    height: 64vh;
    min-height: 360px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.md};
    overflow: hidden;
  }

  /* ---------------- 열린 작업 탭 줄 ----------------
     Bruno 요청 탭(components/RequestTabs)과 같은 모양: 활성 탭만 본문과 같은 색으로
     떠오르고, 아래 경계선이 그 탭에서만 끊긴다. 양옆 오목한 곡선(::before/::after)이
     탭과 본문을 한 장으로 잇는 부분이라 Bruno의 수치를 그대로 쓴다. */
  .wf-tabbar {
    position: relative;
    margin: -4px -4px 12px;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: ${(props) => props.theme.requestTabs.bottomBorder};
      z-index: 0;
    }

    ul {
      display: flex;
      align-items: flex-end;
      margin: 0;
      padding: 0 3px;
      overflow-x: auto;
      overflow-y: clip;
      list-style: none;

      &::-webkit-scrollbar {
        display: none;
      }
      scrollbar-width: none;
    }

    li {
      display: inline-flex;
      flex-shrink: 0;
      min-width: 80px;
      max-width: 180px;
      margin-right: 3px;
      margin-bottom: 3px;
      padding: 6px 0;
      border: 1px solid transparent;
      background: ${(props) => props.theme.requestTabs.bg};
      border-radius: ${(props) => props.theme.border.radius.base};
      color: ${(props) => props.theme.requestTabs.color};
      font-size: 0.8125rem;

      &:nth-last-child(1) {
        margin-right: 4px;
      }

      &.active {
        position: relative;
        z-index: 1;
        background: ${(props) => props.theme.bg};
        border-color: ${(props) => props.theme.requestTabs.bottomBorder};
        border-bottom-color: ${(props) => props.theme.bg};
        border-radius: 8px 8px 0 0;
        margin-bottom: -2px;
        padding-bottom: 12px;

        &::before {
          content: '';
          position: absolute;
          bottom: 1px;
          left: -8px;
          width: 8px;
          height: 8px;
          border-bottom-right-radius: 6px;
          box-shadow: 3px 3px 0 0 ${(props) => props.theme.bg};
          border-right: 1px solid ${(props) => props.theme.requestTabs.bottomBorder};
          border-bottom: 1px solid ${(props) => props.theme.requestTabs.bottomBorder};
        }

        &::after {
          content: '';
          position: absolute;
          bottom: 1px;
          right: -8px;
          width: 8px;
          height: 8px;
          border-bottom-left-radius: 6px;
          box-shadow: -3px 3px 0 0 ${(props) => props.theme.bg};
          border-left: 1px solid ${(props) => props.theme.requestTabs.bottomBorder};
          border-bottom: 1px solid ${(props) => props.theme.requestTabs.bottomBorder};
        }
      }
    }

    .tab-container {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      padding: 0 8px;
      overflow: hidden;
    }

    .tab-label {
      display: flex;
      align-items: center;
      gap: 5px;
      flex: 1;
      min-width: 0;
      color: inherit;
    }

    .tab-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* 닫기는 이름 위로 덮이므로, 글자가 아이콘 밑으로 사라지지 않게 배경색으로 흐린다 */
    .tab-close {
      position: absolute;
      top: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      width: 44px;
      height: 100%;
      padding-right: 4px;
      background-image: linear-gradient(
        90deg,
        transparent 0%,
        ${(props) => props.theme.requestTabs.bg} 40%
      );
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease;
    }
    li.active .tab-close {
      background-image: linear-gradient(90deg, transparent 0%, ${(props) => props.theme.bg} 40%);
    }
    li:hover .tab-close,
    .tab-close.has-changes {
      opacity: 1;
      pointer-events: auto;
    }

    /* 평소엔 변경 표시(U), 탭에 올리면 닫기 — Bruno의 draft 점과 같은 자리다 */
    .tab-changed {
      display: none;
      width: 22px;
      color: ${(props) => props.theme.colors.text.yellow};
      font-size: 11px;
      font-weight: 700;
      text-align: center;
    }
    .tab-close.has-changes .tab-changed {
      display: block;
    }
    .tab-close.has-changes .tab-close-icon {
      display: none;
    }
    li:hover .tab-close .tab-changed {
      display: none;
    }
    li:hover .tab-close .tab-close-icon {
      display: flex;
    }

    .tab-close-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: ${(props) => props.theme.border.radius.base};
      color: ${(props) => props.theme.requestTabs.icon.color};
      transition: background-color 0.12s ease, color 0.12s ease;

      &:hover {
        background-color: ${(props) => props.theme.requestTabs.icon.hoverBg};
        color: ${(props) => props.theme.requestTabs.icon.hoverColor};
      }
    }
  }

  /* ---------------- 작업 화면 (Bruno 요청 화면과 같은 구성) ---------------- */
  .wf-screen {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
  /* 컬렉션 색은 머리말 왼쪽 띠로 — 사이드바의 컬렉션 상자와 같은 색이다.
     수정·삭제는 이름과 같은 줄 오른쪽 끝에 둔다 */
  .wf-screen-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 2px 0 12px 10px;
    border-left: 3px solid transparent;
  }
  .wf-screen-title {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .wf-screen-crumb {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: ${(props) => props.theme.font.size.base};

    strong {
      font-size: ${(props) => props.theme.font.size.lg};
    }
  }
  .wf-screen-desc {
    margin: 0;
    font-size: ${(props) => props.theme.font.size.sm};
  }
  .wf-screen-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 12px;

    button {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  }

  .wf-tabs {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid ${(props) => props.theme.border.border1};
  }
  .wf-tab {
    padding: 7px 14px;
    margin-bottom: -1px;
    border-bottom: 2px solid transparent;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};

    &:hover {
      color: ${(props) => props.theme.text};
    }
    &.active {
      color: ${(props) => props.theme.text};
      border-bottom-color: ${(props) => props.theme.textLink};
      font-weight: 600;
    }
  }
  .wf-tab-body {
    flex: 1;
    min-width: 0;
    padding-top: 14px;
  }

  /* ---------------- Flowmap ----------------
     바탕과 노드가 같은 회색 톤이면 카드 경계가 뭉개진다 — 바탕을 한 단계 가라앉히고
     노드는 본문 색으로 띄워, 카드가 판 위에 놓인 것처럼 보이게 한다. */
  .flowmap {
    overflow-x: auto;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.md};
    background: ${(props) => props.theme.background.mantle};
  }
  .flowmap-node {
    display: flex;
    flex-direction: column;
    gap: 3px;
    height: 100%;
    padding: 8px 10px;
    border: 1px solid ${(props) => props.theme.border.border2};
    border-radius: ${(props) => props.theme.border.radius.md};
    background: ${(props) => props.theme.bg};
    box-shadow: ${(props) => props.theme.shadow.sm};
    font-size: ${(props) => props.theme.font.size.xs};
    overflow: hidden;

    &.source,
    &.result {
      border-style: dashed;
      background: transparent;
      box-shadow: none;
    }
    .step-type-badge {
      align-self: flex-start;
    }
  }
  .flowmap-node-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .flowmap-order {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid ${(props) => props.theme.border.border2};
    text-align: center;
    line-height: 15px;
  }
  .flowmap-node-title {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    font-size: ${(props) => props.theme.font.size.sm};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    /* Bruno 요청·연결업무로 건너뛸 수 있는 스텝 */
    &.link {
      color: ${(props) => props.theme.textLink};
      text-align: left;
      &:hover {
        text-decoration: underline;
      }
    }
  }
  .flowmap-node-sub {
    color: ${(props) => props.theme.colors.text.muted};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* 스텝을 감싸는 테두리 — 반복은 무엇을 기준으로 도는지, 분기는 언제 도는지 적는다.
     반복은 파랑, 분기는 노랑으로 갈라 두 겹이 겹쳐도 구분된다. */
  .flowmap-frame {
    rect {
      fill: none;
      stroke-width: 1.2;
      stroke-dasharray: 6 4;
    }
    text {
      font-size: 10px;
      font-weight: 600;
      stroke: ${(props) => props.theme.background.mantle};
      stroke-width: 3.5;
      paint-order: stroke fill;
    }

    &.repeat {
      rect {
        stroke: ${(props) => props.theme.textLink};
      }
      text {
        fill: ${(props) => props.theme.textLink};
      }
    }
    &.branch {
      rect {
        stroke: ${(props) => props.theme.colors.text.yellow};
      }
      text {
        fill: ${(props) => props.theme.colors.text.yellow};
      }
    }
  }
  .flowmap-chip {
    flex-shrink: 0;
    padding: 0 5px;
    border: 1px solid ${(props) => props.theme.colors.text.yellow};
    border-radius: 999px;
    color: ${(props) => props.theme.colors.text.yellow};
  }
  .flowmap-arrowhead {
    fill: ${(props) => props.theme.colors.text.muted};

    &.seq {
      fill: ${(props) => props.theme.text};
    }
    /* 비동기 요청은 속이 빈 화살표 — 응답이 돌아오지 않는 호출이라는 표시 */
    &.async {
      fill: none;
      stroke: ${(props) => props.theme.brand};
      stroke-width: 1;
    }
  }
  .flowmap-edge {
    path {
      fill: none;
      stroke: ${(props) => props.theme.colors.text.muted};
      stroke-width: 1.2;
    }
    /* 선 위에 글자가 얹혀도 읽히도록 배경색으로 테두리를 두른다 */
    text {
      fill: ${(props) => props.theme.text};
      font-size: 11px;
      stroke: ${(props) => props.theme.background.mantle};
      stroke-width: 3.5;
      paint-order: stroke fill;
    }
    /* 실행 순서선은 값이 흐르는 선보다 진하게 — 흐름을 먼저 읽게 한다 */
    &.seq path {
      stroke: ${(props) => props.theme.text};
      stroke-width: 1.6;
    }
    /* 비동기 요청 — 응답을 기다리지 않는 호출이라 순서선과 색·모양을 갈라 놓는다 */
    &.async {
      path {
        stroke: ${(props) => props.theme.brand};
        stroke-width: 1.6;
        stroke-dasharray: 2 4;
        stroke-linecap: round;
      }
      text {
        fill: ${(props) => props.theme.brand};
        font-weight: 600;
      }
    }
    &.data path {
      stroke-dasharray: 3 3;
    }
    &.branch path {
      stroke: ${(props) => props.theme.colors.text.yellow};
      stroke-dasharray: 5 3;
    }
    &.branch text {
      fill: ${(props) => props.theme.colors.text.yellow};
    }
  }

  /* ---------------- Docs / 환경변수 탭 ---------------- */
  .wf-docs {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .wf-docs-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }
  /* 저장 위치 안내는 버튼 무리와 떨어뜨려 왼쪽 끝에 둔다 */
  .wf-docs-note {
    margin-right: auto;
  }
  /* Bruno의 Docs 편집기는 h-full로 부모를 채우므로 높이가 확정돼 있어야 한다
     (min-height만 주면 마크다운 모드의 CodeEditor가 0px로 접힌다) */
  .wf-docs-body {
    height: 62vh;
    min-height: 360px;

    /* 편집 중에는 도구 줄과 입력 자리를 각각 상자로 나눠 어디에 쓰는지 드러낸다 */
    &.editing {
      .docs-tab-strip {
        gap: 8px;
        margin-bottom: 8px;
        padding: 5px 8px;
        border: 1px solid ${(props) => props.theme.border.border1};
        border-radius: ${(props) => props.theme.border.radius.md};
        background: ${(props) => props.theme.background.surface1};
      }

      .rich-text-editor-content,
      .CodeMirror {
        padding: 10px 12px;
        border: 1px solid ${(props) => props.theme.border.border1};
        border-radius: ${(props) => props.theme.border.radius.md};
        background: ${(props) => props.theme.background.surface0};
      }
      &:focus-within .rich-text-editor-content,
      &:focus-within .CodeMirror {
        border-color: ${(props) => props.theme.input.focusBorder};
      }
    }
  }
  .wf-env {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .env-used th {
      color: ${(props) => props.theme.text};
    }
  }
  .env-used-chip {
    margin-left: 6px;
    padding: 0 6px;
    border: 1px solid ${(props) => props.theme.colors.text.green};
    border-radius: 999px;
    color: ${(props) => props.theme.colors.text.green};
    font-size: ${(props) => props.theme.font.size.xs};
  }

  .exec-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .exec-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 12px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.base};
    background: ${(props) => props.theme.background.surface0};
    font-size: ${(props) => props.theme.font.size.sm};
    &:hover {
      border-color: ${(props) => props.theme.input.focusBorder};
    }
  }
  .exec-time {
    flex: 1;
    text-align: left;
    font-size: ${(props) => props.theme.font.size.xs};
  }

  .status-badge {
    padding: 2px 8px;
    border-radius: 999px;
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 600;
    &.success {
      color: ${(props) => props.theme.colors.text.green};
      border: 1px solid ${(props) => props.theme.colors.text.green};
    }
    &.failed {
      color: ${(props) => props.theme.colors.text.danger};
      border: 1px solid ${(props) => props.theme.colors.text.danger};
    }
  }

  /* ---------------- 실행 화면 ---------------- */
  .run-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .panel {
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.md};
    background: ${(props) => props.theme.background.surface0};
    padding: 14px 16px;
    margin-bottom: 14px;
  }
  /* 손댈 것이 있는 영역 — 아래 안내(.guide-panel)와 확실히 갈라 놓는다 */
  .panel.work-panel {
    border-color: ${(props) => props.theme.border.border2};
    border-left: 3px solid ${(props) => props.theme.colors.text.green};
    background: ${(props) => props.theme.background.surface1};
    box-shadow: ${(props) => props.theme.shadow.sm};
    margin-bottom: 20px;
  }
  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    h3 {
      margin: 0;
    }
    /* 아이콘이 붙은 버튼 — 글자와 세로 중앙을 맞춘다 */
    button {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  }

  .input-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* 바꿀 수 없는 값(예: 폴더 안에서 만들 때의 위치) — 입력칸과 높이를 맞춘다 */
  .field-fixed {
    padding: 5px 8px;
    border: 1px solid transparent;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }
  .field-label {
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .field-key {
    color: ${(props) => props.theme.colors.text.muted};
  }
  .input-run-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }

  .dependent-lookup {
    font-size: ${(props) => props.theme.font.size.sm};
  }
  .dependent-value code {
    background: ${(props) => props.theme.background.surface1};
    padding: 1px 5px;
    border-radius: ${(props) => props.theme.border.radius.sm};
  }
  .lookup-fail-reason {
    margin-top: 4px;
    font-size: ${(props) => props.theme.font.size.xs};
  }
  .lookup-info {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    margin-top: 6px;
    padding: 8px 10px;
    border: 1px solid ${(props) => props.theme.border.border0};
    border-radius: ${(props) => props.theme.border.radius.base};
    background: ${(props) => props.theme.background.surface1};
    font-size: ${(props) => props.theme.font.size.xs};
  }

  /* ---------------- 스텝 카드 ---------------- */
  .step-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .step-card {
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.md};
    background: ${(props) => props.theme.bg};
    overflow: hidden;
    &.running {
      border-color: ${(props) => props.theme.colors.text.yellow};
    }
    &.success {
      border-color: ${(props) => props.theme.colors.text.green};
    }
    &.failed {
      border-color: ${(props) => props.theme.colors.text.danger};
    }
  }
  .step-head {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    text-align: left;
  }
  .step-order {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: ${(props) => props.theme.border.radius.sm};
    background: ${(props) => props.theme.background.surface1};
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 600;
  }
  .step-name {
    flex: 1;
    min-width: 0;
  }
  .step-name-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .step-name-row {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
  }
  .step-type-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    &.api {
      color: ${(props) => props.theme.textLink};
      border: 1px solid ${(props) => props.theme.textLink};
    }
    &.wf {
      color: ${(props) => props.theme.colors.text.green};
      border: 1px solid ${(props) => props.theme.colors.text.green};
    }
    &.delay {
      color: ${(props) => props.theme.colors.text.muted};
      border: 1px solid ${(props) => props.theme.border.border2};
    }
    &.loop {
      color: ${(props) => props.theme.textLink};
      border: 1px solid ${(props) => props.theme.textLink};
    }
    &.cond {
      color: ${(props) => props.theme.colors.text.yellow};
      border: 1px solid ${(props) => props.theme.colors.text.yellow};
    }
  }
  /* 반복은 기준이 되는 목록으로, 분기는 조건으로 스텝을 감싼다 (흐름도의 테두리와 같은 뜻).
     반복 안의 분기처럼 겹쳐 감싸이면 상자가 한 겹 더 들어간다. */
  .step-frame {
    position: relative;
    padding: 22px 10px 10px;
    border: 1px dashed;
    border-radius: ${(props) => props.theme.border.radius.md};
    display: flex;
    flex-direction: column;
    gap: 8px;

    &.repeat {
      border-color: ${(props) => props.theme.textLink};
      > .step-frame-label {
        color: ${(props) => props.theme.textLink};
      }
    }
    &.branch {
      border-color: ${(props) => props.theme.colors.text.yellow};
      > .step-frame-label {
        color: ${(props) => props.theme.colors.text.yellow};
      }
    }
  }
  .step-frame.skipped {
    opacity: 0.55;
  }
  .step-frame-progress {
    color: ${(props) => props.theme.colors.text.muted};
    font-weight: 400;
  }
  .step-frame-label {
    position: absolute;
    top: 4px;
    left: 12px;
    padding: 0 4px;
    /* 스텝 목록이 놓인 판(.panel)과 같은 색이라 테두리를 가리고 앉는다 */
    background: ${(props) => props.theme.background.surface0};
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 600;
  }

  /* 반복·비동기처럼 "어떻게 도는지"를 알리는 표시 */
  .step-flag {
    flex-shrink: 0;
    padding: 0 6px;
    border: 1px solid ${(props) => props.theme.colors.text.yellow};
    border-radius: 999px;
    color: ${(props) => props.theme.colors.text.yellow};
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 500;
  }
  .step-iterations {
    flex-shrink: 0;
    margin-right: 10px;
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
    white-space: nowrap;
  }
  .step-category {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
  }
  .step-status {
    font-size: ${(props) => props.theme.font.size.xs};
    white-space: nowrap;
    color: ${(props) => props.theme.colors.text.muted};
    &.running {
      color: ${(props) => props.theme.colors.text.yellow};
    }
    &.success {
      color: ${(props) => props.theme.colors.text.green};
    }
    &.failed {
      color: ${(props) => props.theme.colors.text.danger};
    }
  }
  .chevron {
    color: ${(props) => props.theme.colors.text.muted};
    font-size: 10px;
  }

  .step-detail {
    border-top: 1px solid ${(props) => props.theme.border.border0};
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .json-block {
    min-width: 0;
    pre {
      margin: 6px 0 0;
      padding: 10px;
      background: ${(props) => props.theme.background.mantle};
      border: 1px solid ${(props) => props.theme.border.border0};
      border-radius: ${(props) => props.theme.border.radius.base};
      font-size: ${(props) => props.theme.font.size.xs};
      overflow-x: auto;
      max-height: 360px;
    }
  }
  .json-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 600;
    color: ${(props) => props.theme.colors.text.muted};
  }
  .step-midinput {
    border-top: 1px solid ${(props) => props.theme.border.border0};
    padding: 12px;
  }
  .midinput-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .midinput-title {
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
    color: ${(props) => props.theme.colors.text.yellow};
  }

  .result-banner {
    border: 1px solid ${(props) => props.theme.colors.text.green};
    border-radius: ${(props) => props.theme.border.radius.md};
    padding: 12px 14px;
    font-size: ${(props) => props.theme.font.size.sm};
    &.failed {
      border-color: ${(props) => props.theme.colors.text.danger};
    }
  }
  .result-banner-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .share-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin: 8px 0 12px;
    font-size: ${(props) => props.theme.font.size.xs};

    code {
      padding: 3px 8px;
      background: ${(props) => props.theme.background.surface1};
      border-radius: ${(props) => props.theme.border.radius.sm};
      color: ${(props) => props.theme.colors.text.muted};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }
  }

  .result-banner .share-row {
    margin: 8px 0 0;
  }

  /* ---------------- 결과 표 ---------------- */
  .result-scroller {
    position: relative;
    margin-top: 6px;
  }
  .result-table-wrap {
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
  .result-table {
    border-collapse: collapse;
    font-size: ${(props) => props.theme.font.size.xs};
    min-width: 100%;
    th,
    td {
      border: 1px solid ${(props) => props.theme.table.border};
      padding: 5px 9px;
      text-align: left;
      white-space: nowrap;
    }
    th {
      background: ${(props) => props.theme.background.surface1};
      font-weight: 600;
    }
    &.kv th {
      width: 200px;
    }
  }
  .result-empty {
    font-size: ${(props) => props.theme.font.size.sm};
    margin: 6px 0 0;
  }
  .hscroll {
    height: 8px;
    margin-top: 4px;
    border-radius: 4px;
    background: ${(props) => props.theme.background.surface1};
    position: relative;
    cursor: pointer;
  }
  .hscroll-thumb {
    position: absolute;
    top: 0;
    height: 100%;
    border-radius: 4px;
    background: ${(props) => props.theme.border.border2};
    cursor: grab;
  }

  /* ---------------- 실행 이력 상세 ---------------- */
  .execution-page {
    max-width: 1100px;
  }
  .exec-detail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
    padding-left: 10px;
    border-left: 3px solid transparent;
  }
  .exec-inputs {
    margin-bottom: 14px;
  }
  .exec-inputs-title {
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
    margin-bottom: 4px;
  }

  /* ---------------- 편집기 ---------------- */
  .editor {
    max-width: 1000px;
    margin: 0 auto;
    padding: 16px 20px 60px;
  }
  /* 취소·미리보기·저장은 어디까지 스크롤해도 손에 닿게 위에 붙여 둔다 */
  .editor-head {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 -20px 14px;
    padding: 10px 20px;
    background: ${(props) => props.theme.bg};
    border-bottom: 1px solid ${(props) => props.theme.border.border1};
  }

  /* 저장 전 내용을 그대로 그려 보는 흐름도 */
  .preview-modal {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(1100px, 92vw);
    max-height: 86vh;
    overflow: auto;
    padding: 16px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.md};
    background: ${(props) => props.theme.bg};
    box-shadow: ${(props) => props.theme.shadow.lg};
  }
  .preview-head {
    display: flex;
    align-items: center;
    justify-content: space-between;

    h4 {
      margin: 0;
    }
  }
  .editor-actions {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    .wide {
      grid-column: 1 / -1;
    }
  }

  .color-picker {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .color-swatch {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 2px solid transparent;
    &.active {
      border-color: ${(props) => props.theme.text};
    }
  }
  .color-custom {
    position: relative;
    width: 22px;
    height: 22px;
    input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
      padding: 0;
    }
  }
  .color-custom-face {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 6px;
    border: 1px dashed ${(props) => props.theme.border.border2};
    pointer-events: none;
  }

  .env-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
  }
  .env-row {
    display: flex;
    gap: 12px;
    font-size: ${(props) => props.theme.font.size.xs};
  }
  .env-key {
    min-width: 180px;
    color: ${(props) => props.theme.textLink};
  }
  .env-val {
    color: ${(props) => props.theme.colors.text.muted};
    word-break: break-all;
  }

  .def-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .def-row {
    border: 1px solid ${(props) => props.theme.border.border0};
    border-radius: ${(props) => props.theme.border.radius.base};
    padding: 10px;
    background: ${(props) => props.theme.bg};
  }
  .def-main {
    display: flex;
    gap: 8px;
    align-items: center;
    input {
      flex: 1;
      min-width: 0;
    }
  }
  .def-sub {
    margin-top: 8px;
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    font-size: ${(props) => props.theme.font.size.sm};
    label {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    &.def-col {
      flex-direction: column;
      align-items: stretch;
    }
  }
  .def-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .def-field-label {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .combo-opt {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
    input {
      flex: 1;
      min-width: 0;
    }
  }

  .checkbox-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .checkbox-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: 999px;
    font-size: ${(props) => props.theme.font.size.xs};
    cursor: pointer;
    color: ${(props) => props.theme.colors.text.muted};
    input {
      display: none;
    }
    &.on {
      border-color: ${(props) => props.theme.textLink};
      color: ${(props) => props.theme.textLink};
    }
  }
  .col-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border: 1px solid ${(props) => props.theme.textLink};
    border-radius: 999px;
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.textLink};
  }
  .chip-x {
    color: inherit;
    font-size: 10px;
  }
  .col-add {
    display: flex;
    gap: 8px;
    align-items: center;
    input {
      width: 280px;
      max-width: 100%;
    }
  }

  .step-editor-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .step-editor {
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.md};
    background: ${(props) => props.theme.bg};
    padding: 12px 14px;

    /* 반복·분기 블록의 머리 — 그 아래 들여쓰기된 스텝들이 이 블록 안에서 돈다 */
    &.block {
      background: ${(props) => props.theme.background.surface0};

      &.repeat {
        border-color: ${(props) => props.theme.textLink};
      }
      &.branch {
        border-color: ${(props) => props.theme.colors.text.yellow};
      }
    }
  }
  .block-name {
    width: 100%;
    max-width: 320px;
    font-weight: 600;
  }
  /* 들여쓰기는 블록 안에 든 스텝이라는 표시 — 왼쪽에 안내선을 세운다 */
  .step-editor-row {
    position: relative;

    &[style*='margin-left']::before {
      content: '';
      position: absolute;
      left: -13px;
      top: 0;
      bottom: 0;
      border-left: 1px dashed ${(props) => props.theme.border.border2};
    }
  }

  /* AI 제안 — 버튼 한 줄과, 받아 온 초안을 사람이 읽고 적용하는 카드 */
  .ai-suggest {
    margin-top: 10px;
  }
  .ai-suggest-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    button {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
  }
  /* 모델이 무엇을 되물어 확인했는지 — 기다리는 동안의 진행 상황이자, 뒤에는 근거의 자취 */
  .ai-progress {
    margin: 8px 0 0;
    padding: 0 0 0 18px;
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.font.size.sm};

    li {
      padding: 2px 0;
    }
  }
  .ai-suggest-card {
    margin-top: 8px;
    padding: 12px;
    border: 1px dashed ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.base};
    background: ${(props) => props.theme.background.surface0};

    h4 {
      margin: 12px 0 6px;
      font-size: ${(props) => props.theme.font.size.sm};
    }
    > p:last-of-type {
      margin: 10px 0 0;
    }
  }
  .ai-suggest-fields {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 0;

    dt {
      color: ${(props) => props.theme.colors.text.muted};
      font-size: ${(props) => props.theme.font.size.sm};
    }
    dd {
      margin: 0;
    }
  }
  .ai-suggest-list {
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      padding: 5px 0;
      border-top: 1px solid ${(props) => props.theme.border.border0};
    }
    li:first-child {
      border-top: none;
    }
    code {
      margin-right: 6px;
    }
    b {
      font-weight: 500;
    }
  }
  /* 종류·경고 꼬리표 — 목록 줄에서 무엇인지 한눈에 */
  .ai-tag {
    margin-right: 6px;
    padding: 1px 6px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: 10px;
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};

    &.warn {
      margin: 0 0 0 6px;
      border-color: ${(props) => props.theme.colors.text.danger};
      color: ${(props) => props.theme.colors.text.danger};
    }
  }
  .ai-suggest-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
  }

  .add-step-choices {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 10px;
    padding: 8px;
    border: 1px dashed ${(props) => props.theme.border.border2};
    border-radius: ${(props) => props.theme.border.radius.base};
  }
  .add-step-choice {
    padding: 5px 12px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.base};
    background: ${(props) => props.theme.background.surface0};
    font-size: ${(props) => props.theme.font.size.sm};

    &:hover {
      border-color: ${(props) => props.theme.input.focusBorder};
    }
  }
  .step-editor-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .step-title {
    flex: 1;
    min-width: 0;
  }
  .step-actions {
    display: flex;
    gap: 4px;
  }
  .step-section {
    border-top: 1px solid ${(props) => props.theme.border.border0};
    padding: 10px 0;
  }
  .processing-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    h4 {
      margin: 0;
    }
  }
  /* 처리 방식 줄 오른쪽의 비동기 요청 선택 */
  .async-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    margin-right: 12px;
    font-size: ${(props) => props.theme.font.size.sm};
    cursor: pointer;

    input {
      accent-color: ${(props) => props.theme.brand};
    }
    &:has(input:disabled) {
      color: ${(props) => props.theme.colors.text.muted};
      cursor: not-allowed;
    }
  }

  .mode-toggle {
    display: inline-flex;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.base};
    overflow: hidden;
    margin-bottom: 8px;
    button {
      padding: 4px 12px;
      font-size: ${(props) => props.theme.font.size.xs};
      color: ${(props) => props.theme.colors.text.muted};
      &.active {
        background: ${(props) => props.theme.background.surface1};
        color: ${(props) => props.theme.text};
        font-weight: 600;
      }
      & + button {
        border-left: 1px solid ${(props) => props.theme.border.border1};
      }
    }
  }

  /* 반복 설정 — 한 줄에 [소스][경로] 또는 [라벨][숫자][단위] */
  .repeat-editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  .repeat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    width: 100%;

    input[type='number'] {
      width: 90px;
    }
    .jsonpath-input {
      flex: 1;
    }
  }
  .repeat-add {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  .binding-block {
    margin-top: 10px;
  }
  .binding-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .binding-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .binding-var {
    min-width: 140px;
    color: ${(props) => props.theme.textLink};
  }
  .jsonpath-input {
    flex: 1;
    min-width: 220px;
  }
  .wf-link {
    display: flex;
    flex-direction: column;
    gap: 8px;
    select {
      max-width: 480px;
    }
  }

  .add-step-btn {
    margin-top: 10px;
    width: 100%;
    padding: 9px;
    border: 1px dashed ${(props) => props.theme.border.border2};
    border-radius: ${(props) => props.theme.border.radius.base};
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.font.size.sm};
    &:hover {
      border-color: ${(props) => props.theme.input.focusBorder};
      color: ${(props) => props.theme.text};
    }
  }
  .stop-toggle {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 8px;
    font-size: ${(props) => props.theme.font.size.sm};
    input {
      accent-color: ${(props) => props.theme.brand};
    }
  }
  .save-conflict {
    border-color: ${(props) => props.theme.colors.text.yellow};
  }
  .save-conflict-actions {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 10px;
  }

  /* ---------------- 카탈로그 피커 ---------------- */
  .catalog-picker {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .catalog-selected {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.base};
    background: ${(props) => props.theme.background.surface0};
    font-size: ${(props) => props.theme.font.size.sm};
    > div {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
  }
  .catalog-search {
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.base};
    padding: 8px;
  }
  .catalog-filter-row {
    display: flex;
    gap: 8px;
    input {
      flex: 1;
      min-width: 0;
    }
  }
  .catalog-results {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    max-height: 260px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .catalog-result {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    font-size: ${(props) => props.theme.font.size.sm};
    text-align: left;
    &:hover {
      background: ${(props) => props.theme.background.surface1};
    }
    &.active {
      background: ${(props) => props.theme.background.surface1};
    }
  }
  .catalog-name {
    font-weight: 500;
    white-space: nowrap;
  }
  .breadcrumb {
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.font.size.xs};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ---- 홈 안내 (Bruno API 연계 · 브랜치 전략) ----
     읽을거리라서, 손댈 것이 있는 변경 목록(.work-panel)과 섞이지 않도록
     카드 느낌을 걷어내고 한 단계 가라앉힌다. */
  .home-guide {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 880px;
  }
  .guide-heading {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};

    &::after {
      content: '';
      flex: 1;
      height: 1px;
      background: ${(props) => props.theme.border.border1};
    }
  }
  .guide-hero h2 {
    margin: 0 0 4px;
  }
  .panel.guide-panel {
    border-color: transparent;
    background: transparent;
    padding: 0 2px;
    color: ${(props) => props.theme.colors.text.muted};

    h3 {
      margin-top: 0;
      color: ${(props) => props.theme.text};
    }
  }

  .guide-pipeline {
    display: flex;
    align-items: stretch;
    gap: 8px;
    flex-wrap: wrap;
    margin: 12px 0;
  }
  .guide-step {
    flex: 1;
    min-width: 150px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.base};
    background: ${(props) => props.theme.background.surface0};
    font-size: ${(props) => props.theme.font.size.sm};
  }
  .guide-step-icon {
    font-size: 20px;
  }
  .guide-arrow {
    align-self: center;
    color: ${(props) => props.theme.colors.text.muted};
    font-size: 18px;
    flex-shrink: 0;
  }

  .guide-note {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
    font-size: ${(props) => props.theme.font.size.sm};
  }
  .guide-chips {
    display: inline-flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .guide-chip {
    padding: 1px 8px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: 999px;
    font-size: ${(props) => props.theme.font.size.xs};
    background: ${(props) => props.theme.background.surface1};
    white-space: nowrap;
  }

  /* 브랜치 전략 다이어그램 — 배지 번호·색이 아래 목록과 1:1 대응 */
  .guide-git {
    width: 100%;
    max-width: 680px;
    height: auto;
    display: block;
    margin: 10px 0 4px;
  }
  .git-label {
    fill: ${(props) => props.theme.colors.text.muted};
    font-size: 11px;
  }
  .git-step-label {
    fill: ${(props) => props.theme.colors.text.muted};
    font-size: 10px;
  }
  .git-lane {
    fill: none;
    stroke-width: 2;
  }
  /* 레인 사이를 잇는 흐름선 (카탈로그 연결 · 운영 반영) */
  .git-flow {
    fill: none;
    stroke-width: 2;
    stroke-dasharray: 5 4;
    &.flow-main {
      stroke: ${(props) => props.theme.colors.text.green};
    }
  }
  .git-node {
    rect {
      fill: ${(props) => props.theme.background.surface0};
      stroke: ${(props) => props.theme.colors.text.green};
      stroke-width: 1.5;
    }
    text {
      fill: currentColor;
      font-size: 12px;
      font-weight: 600;
    }
    .git-node-sub {
      fill: ${(props) => props.theme.colors.text.muted};
      font-size: 10px;
      font-weight: 400;
    }
  }
  .lane-main {
    stroke: ${(props) => props.theme.colors.text.green};
  }
  .lane-feature {
    stroke: ${(props) => props.theme.colors.text.yellow};
  }
  .git-badge text {
    fill: white;
    font-size: 10px;
    font-weight: 700;
  }
  .git-badge-main circle {
    fill: ${(props) => props.theme.colors.text.green};
  }
  .git-badge-feature circle {
    fill: ${(props) => props.theme.colors.text.yellow};
  }

  .guide-flow-list {
    list-style: none;
    margin: 6px 0 14px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
    font-size: ${(props) => props.theme.font.size.sm};
  }
  .guide-flow-list li {
    display: flex;
    gap: 10px;
    align-items: baseline;
  }
  .flow-num {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 700;
    flex-shrink: 0;
  }
  .flow-num-main {
    background: ${(props) => props.theme.colors.text.green};
  }
  .flow-num-feature {
    background: ${(props) => props.theme.colors.text.yellow};
  }

  /* ---- 편집 모드 (브랜치 worktree → 커밋 → develop 머지 → 운영 반영) ---- */
  .edit-area,
  .edit-shell {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }
  .edit-shell > .flowwork-content,
  .edit-shell > .workspace {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .edit-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 8px 12px;
    border-bottom: 1px solid ${(props) => props.theme.border.border1};
    background: ${(props) => props.theme.background.surface0};
  }
  .edit-bar-left,
  .edit-bar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .branch-chip {
    padding: 3px 10px;
    border-radius: 999px;
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 600;
    border: 1px solid ${(props) => props.theme.border.border1};
    &.base {
      color: ${(props) => props.theme.colors.text.muted};
    }
    &.feature {
      color: ${(props) => props.theme.colors.text.green};
      border-color: ${(props) => props.theme.colors.text.green};
    }
  }

  .notice-banner {
    margin: 8px 12px;
    padding: 8px 12px;
    border: 1px solid ${(props) => props.theme.colors.text.green};
    border-radius: ${(props) => props.theme.border.radius.base};
    color: ${(props) => props.theme.colors.text.green};
    font-size: ${(props) => props.theme.font.size.sm};
  }

  .small-text {
    font-size: ${(props) => props.theme.font.size.xs};
  }

  /* 워크플로우가 운영과 다르다는 표시 — 종류(추가/수정/삭제)는 변경 목록에서 본다 */
  .changed-badge {
    flex-shrink: 0;
    padding: 1px 7px;
    border: 1px solid ${(props) => props.theme.colors.text.yellow};
    border-radius: 999px;
    color: ${(props) => props.theme.colors.text.yellow};
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 500;
  }

  .change-badge {
    width: 34px;
    text-align: center;
    padding: 1px 0;
    border-radius: ${(props) => props.theme.border.radius.sm};
    font-size: ${(props) => props.theme.font.size.xs};
    flex-shrink: 0;
    &.change-a {
      color: ${(props) => props.theme.colors.text.green};
      border: 1px solid ${(props) => props.theme.colors.text.green};
    }
    &.change-m {
      color: ${(props) => props.theme.colors.text.yellow};
      border: 1px solid ${(props) => props.theme.colors.text.yellow};
    }
    &.change-d {
      color: ${(props) => props.theme.colors.text.danger};
      border: 1px solid ${(props) => props.theme.colors.text.danger};
    }
  }

  .domain-dot-changed {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${(props) => props.theme.colors.text.yellow};
    flex-shrink: 0;
  }

  .edit-home {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .edit-file-list {
    display: flex;
    flex-direction: column;
  }
  .edit-file-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 4px;
    border-bottom: 1px solid ${(props) => props.theme.border.border1};
    &:last-child {
      border-bottom: none;
    }
  }
  .edit-file-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .edit-file-actions {
    display: inline-flex;
    gap: 10px;
    flex-shrink: 0;

    /* 아이콘이 붙은 링크 버튼 — 글자와 세로 중앙을 맞춘다 */
    button.link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  }

  .run-actions {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .method {
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
    &.get {
      color: var(--color-method-get);
    }
    &.post {
      color: var(--color-method-post);
    }
    &.put {
      color: var(--color-method-put);
    }
    &.delete {
      color: var(--color-method-delete);
    }
    &.patch {
      color: var(--color-method-patch);
    }
    &.head,
    &.options {
      color: var(--color-method-head);
    }
  }
`;

export default StyledWrapper;
