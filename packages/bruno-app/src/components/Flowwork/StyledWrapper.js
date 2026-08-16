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

  button {
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
  .sidebar-title {
    font-size: 15px;
  }
  .sidebar-title-btn:hover .sidebar-title {
    text-decoration: underline;
  }

  .domain-tree {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .domain-head {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 6px 8px;
    border-radius: ${(props) => props.theme.border.radius.base};
    font-size: ${(props) => props.theme.font.size.sm};
    &:hover {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }
  }
  .domain-caret {
    color: ${(props) => props.theme.colors.text.muted};
    font-size: 10px;
    width: 10px;
  }
  .domain-swatch {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .domain-name {
    font-weight: 600;
    flex: 1;
    text-align: left;
  }
  .domain-count {
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.font.size.xs};
  }

  .task-menu {
    list-style: none;
    margin: 2px 0 6px;
    padding: 0 0 0 20px;
  }
  .task-empty {
    padding: 4px 0 8px 26px;
    font-size: ${(props) => props.theme.font.size.xs};
  }
  .task-item {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 5px 8px;
    border-radius: ${(props) => props.theme.border.radius.base};
    font-size: ${(props) => props.theme.font.size.sm};
    border: 1px solid transparent;
    &:hover {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }
    &.active {
      border-color: ${(props) => props.theme.input.focusBorder};
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }
  }
  .task-bullet {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    &.lg {
      width: 10px;
      height: 10px;
    }
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

  .detail-empty {
    border: 1px dashed ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.md};
    padding: 60px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 24px;
    margin-top: 8px;
    font-size: ${(props) => props.theme.font.size.sm};
  }

  /* ---------------- 업무 화면 (워크플로우 카드) ---------------- */
  .task-detail-head {
    margin-bottom: 14px;
  }
  .crumb {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .wf-card-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .wf-card {
    display: flex;
    align-items: stretch;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-left: 3px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.md};
    background: ${(props) => props.theme.background.surface0};
    &:hover {
      border-color: ${(props) => props.theme.input.focusBorder};
    }
  }
  .wf-card-open {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 12px 14px;
    text-align: left;
    font-size: ${(props) => props.theme.font.size.sm};
  }
  .wf-card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }
  .wf-card-actions {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    padding: 0 12px;
    border-left: 1px solid ${(props) => props.theme.border.border0};
  }

  /* ---------------- 최근 이력 ---------------- */
  .task-history {
    margin-top: 26px;
  }
  .task-history-head {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 10px;
    h3 {
      margin: 0;
    }
  }
  .task-history-filter {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .filter-chip {
    padding: 3px 10px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: 999px;
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
    &.active {
      border-color: ${(props) => props.theme.textLink};
      color: ${(props) => props.theme.textLink};
    }
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
  .exec-crumb {
    flex: 1;
    min-width: 0;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .exec-wf {
    font-weight: 600;
  }
  .exec-time {
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

  .runner-head {
    margin-bottom: 14px;
    h2 {
      margin-top: 6px;
    }
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    margin-right: 6px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: 999px;
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .panel {
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.md};
    background: ${(props) => props.theme.background.surface0};
    padding: 14px 16px;
    margin-bottom: 14px;
  }
  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    h3 {
      margin: 0;
    }
  }

  .input-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
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
  .editor-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
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

  /* ---- 홈 안내 (Bruno API 연계 · 브랜치 전략) ---- */
  .home-guide {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 880px;
  }
  .guide-hero h2 {
    margin: 0 0 4px;
  }
  .guide-panel h3 {
    margin-top: 0;
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
  .git-lane {
    fill: none;
    stroke-width: 2;
  }
  .lane-main {
    stroke: ${(props) => props.theme.colors.text.green};
  }
  .lane-develop {
    stroke: ${(props) => props.theme.textLink};
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
  .git-badge-develop circle {
    fill: ${(props) => props.theme.textLink};
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
  .flow-num-develop {
    background: ${(props) => props.theme.textLink};
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

  .edit-newbranch,
  .edit-commit-form {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .merge-warn {
    color: ${(props) => props.theme.colors.text.yellow};
    font-size: ${(props) => props.theme.font.size.sm};
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

  /* 파일 상태 배지: develop 대비 수정됨 → 스테이지 → 커밋됨 → 푸시됨 */
  .state-badge {
    padding: 1px 8px;
    border-radius: 999px;
    font-size: ${(props) => props.theme.font.size.xs};
    border: 1px solid ${(props) => props.theme.border.border1};
    white-space: nowrap;
    &.sm {
      padding: 0 6px;
      margin-left: 6px;
    }
    &.st-unstaged {
      color: ${(props) => props.theme.colors.text.yellow};
      border-color: ${(props) => props.theme.colors.text.yellow};
    }
    &.st-staged {
      color: ${(props) => props.theme.textLink};
      border-color: ${(props) => props.theme.textLink};
    }
    &.st-committed {
      color: ${(props) => props.theme.colors.text.green};
      border-color: ${(props) => props.theme.colors.text.green};
    }
    &.st-pushed {
      color: ${(props) => props.theme.colors.text.muted};
    }
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
  }

  .run-actions {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  /* ---- 머지 충돌 해결 ---- */
  .merge-view {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }
  .merge-head {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    h2 {
      margin: 0;
    }
  }
  .merge-head-actions {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 12px;
  }

  .conflict-card {
    &.resolved {
      opacity: 0.75;
      border-color: ${(props) => props.theme.colors.text.green};
    }
  }
  .conflict-card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    h3 {
      margin: 0 0 2px;
    }
  }
  .conflict-resolved-mark {
    color: ${(props) => props.theme.colors.text.green};
    white-space: nowrap;
  }
  .conflict-tabs {
    display: flex;
    gap: 4px;
    margin: 10px 0;
    button {
      padding: 4px 12px;
      border: 1px solid ${(props) => props.theme.border.border1};
      border-radius: ${(props) => props.theme.border.radius.base};
      font-size: ${(props) => props.theme.font.size.xs};
      color: ${(props) => props.theme.colors.text.muted};
      &.active {
        color: ${(props) => props.theme.text};
        border-color: ${(props) => props.theme.input.focusBorder};
        background: ${(props) => props.theme.background.surface1};
      }
    }
  }
  .conflict-resolver {
    margin-top: 10px;
  }
  .conflict-resolver-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    h4 {
      margin: 0;
    }
  }
  .conflict-pick {
    display: inline-flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .conflict-editor {
    width: 100%;
    min-height: 200px;
    margin-top: 8px;
    font-family: ${(props) => props.theme.font.codeFontFamily || 'monospace'};
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.text};
    background: ${(props) => props.theme.input.bg};
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.base};
    padding: 8px;
  }
  .conflict-resolver-actions {
    margin-top: 8px;
    display: flex;
    justify-content: flex-end;
  }

  /* 워크플로우 좌우 시각 비교 */
  .wf-compare {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .wf-compare-col {
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.base};
    padding: 8px 10px;
    min-width: 0;
  }
  .wf-compare-col-head {
    font-weight: 600;
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
    margin-bottom: 6px;
  }
  .wf-compare-meta {
    font-size: ${(props) => props.theme.font.size.sm};
    padding: 2px 4px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    .muted {
      margin-right: 6px;
    }
    &.changed {
      background: ${(props) => props.theme.background.surface1};
      outline: 1px solid ${(props) => props.theme.colors.text.yellow};
    }
  }
  .wf-compare-steps {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .wf-compare-step {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.sm};
    font-size: ${(props) => props.theme.font.size.sm};
    &.only {
      border-color: ${(props) => props.theme.colors.text.green};
    }
    &.changed {
      border-color: ${(props) => props.theme.colors.text.yellow};
    }
    .step-order {
      color: ${(props) => props.theme.colors.text.muted};
      font-size: ${(props) => props.theme.font.size.xs};
      flex-shrink: 0;
    }
    .step-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .step-kind,
    .step-mark {
      font-size: ${(props) => props.theme.font.size.xs};
      color: ${(props) => props.theme.colors.text.muted};
      flex-shrink: 0;
    }
    .step-mark {
      color: ${(props) => props.theme.colors.text.yellow};
    }
  }

  /* JSON 라인 diff (좌/우 비교) */
  .diff-table-wrap {
    overflow-x: auto;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.base};
  }
  .diff-table {
    display: grid;
    grid-template-columns: 1fr 1fr;
    font-family: ${(props) => props.theme.font.codeFontFamily || 'monospace'};
    font-size: ${(props) => props.theme.font.size.xs};
  }
  .diff-col-head {
    padding: 4px 8px;
    font-weight: 600;
    color: ${(props) => props.theme.colors.text.muted};
    border-bottom: 1px solid ${(props) => props.theme.border.border1};
    background: ${(props) => props.theme.background.surface0};
  }
  .diff-row {
    display: contents;
  }
  .diff-cell {
    display: flex;
    gap: 8px;
    padding: 1px 8px;
    min-width: 0;
    code {
      white-space: pre;
    }
    .diff-no {
      color: ${(props) => props.theme.colors.text.muted};
      width: 3ch;
      text-align: right;
      flex-shrink: 0;
      user-select: none;
    }
    &.left {
      border-right: 1px solid ${(props) => props.theme.border.border1};
    }
    &.del,
    &.left.mod {
      background: color-mix(in srgb, ${(props) => props.theme.colors.text.danger} 12%, transparent);
    }
    &.add,
    &.right.mod {
      background: color-mix(in srgb, ${(props) => props.theme.colors.text.green} 12%, transparent);
    }
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
