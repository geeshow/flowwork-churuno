import styled from 'styled-components';

const StyledWrapper = styled.div`
  border: 1px solid ${(props) => props.theme.workspace.border};
  border-radius: ${(props) => props.theme.border.radius.base};

  .release-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid ${(props) => props.theme.workspace.border};
  }

  .release-desc {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
    flex: 1;
  }

  .release-empty,
  .release-loading {
    padding: 12px;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .release-error {
    padding: 12px;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.danger};
  }

  .release-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid ${(props) => props.theme.workspace.border};
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text};
  }

  button.link-btn {
    flex-shrink: 0;
    background: transparent;
    border: none;
    padding: 0;
    color: ${(props) => props.theme.brand};
    font-size: ${(props) => props.theme.font.size.xs};
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  .release-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text};

    &:not(:last-child) {
      border-bottom: 1px solid ${(props) => props.theme.workspace.border};
    }

    input[type='checkbox'] {
      cursor: pointer;
    }

    &.duplicate {
      .api-name,
      .api-directory {
        opacity: 0.6;
      }
    }
  }

  .change-badge {
    flex-shrink: 0;
    width: 34px;
    text-align: center;
    font-size: ${(props) => props.theme.font.size.xs};
    border-radius: ${(props) => props.theme.border.radius.base};
    border: 1px solid ${(props) => props.theme.workspace.border};
    color: ${(props) => props.theme.colors.text.muted};

    &.change-a {
      color: ${(props) => props.theme.request.methods.post};
      border-color: ${(props) => props.theme.request.methods.post};
    }
    &.change-m {
      color: ${(props) => props.theme.request.methods.patch};
      border-color: ${(props) => props.theme.request.methods.patch};
    }
    &.change-d {
      color: ${(props) => props.theme.request.methods.delete};
      border-color: ${(props) => props.theme.request.methods.delete};
    }
  }

  .api-method {
    flex-shrink: 0;
    min-width: 40px;
    font-size: ${(props) => props.theme.font.size.xs};
    text-transform: uppercase;

    &.method-get {
      color: ${(props) => props.theme.request.methods.get};
    }
    &.method-post {
      color: ${(props) => props.theme.request.methods.post};
    }
    &.method-put {
      color: ${(props) => props.theme.request.methods.put};
    }
    &.method-delete {
      color: ${(props) => props.theme.request.methods.delete};
    }
    &.method-patch {
      color: ${(props) => props.theme.request.methods.patch};
    }

    /* 요청이 아닌 항목(폴더·컬렉션·환경)의 종류 라벨 */
    &.kind-label {
      color: ${(props) => props.theme.colors.text.muted};
      text-transform: none;
    }
  }

  .release-filters {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 6px 12px;
    border-bottom: 1px solid ${(props) => props.theme.workspace.border};
  }

  .filter-divider {
    width: 1px;
    height: 14px;
    background: ${(props) => props.theme.workspace.border};
  }

  /* 이름·경로를 누르면 그 위치로 이동한다 */
  button.row-open {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex: 1 1 auto;
    min-width: 0;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    font-size: inherit;
    text-align: left;
    cursor: pointer;

    &:hover .api-name {
      text-decoration: underline;
    }
  }

  /* 긴 이름·경로가 줄을 접지 않고 말줄임되도록 (min-width: 0 이 없으면 flex가 안 줄어든다) */
  .api-name,
  .api-directory {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .api-name {
    flex: 0 1 auto;
  }

  .api-directory {
    flex: 1 1 auto;
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.font.size.xs};
  }

  .duplicate-hint {
    margin-left: auto;
    flex-shrink: 0;
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.danger};
  }

  button.diff-btn {
    margin-left: auto;
    flex-shrink: 0;
    padding: 1px 6px;
    border: 1px solid transparent;
    border-radius: ${(props) => props.theme.border.radius.base};
    background: transparent;
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.font.size.xs};
    cursor: pointer;

    &:hover,
    &.open {
      border-color: ${(props) => props.theme.workspace.border};
      color: ${(props) => props.theme.text};
    }
  }

  /* 중복 안내가 있으면 그쪽이 오른쪽 정렬을 맡는다 */
  .duplicate-hint + button.diff-btn {
    margin-left: 8px;
  }

  .release-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid ${(props) => props.theme.workspace.border};

    .selected-count {
      font-size: ${(props) => props.theme.font.size.xs};
      color: ${(props) => props.theme.colors.text.muted};
      flex: 1;
    }
  }

  button.release-submit,
  button.secondary-btn {
    flex-shrink: 0;
    padding: 4px 10px;
    border-radius: ${(props) => props.theme.border.radius.base};
    background: transparent;
    font-size: ${(props) => props.theme.font.size.sm};
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  button.release-submit {
    border: 1px solid ${(props) => props.theme.brand};
    color: ${(props) => props.theme.brand};

    &:hover:not(:disabled) {
      background: ${(props) => props.theme.brand}10;
    }
    &.confirm-armed {
      background: ${(props) => props.theme.brand};
      color: white;
    }
  }

  button.secondary-btn {
    border: 1px solid ${(props) => props.theme.workspace.border};
    color: ${(props) => props.theme.colors.text.muted};

    &:hover:not(:disabled) {
      color: ${(props) => props.theme.text};
    }

    &.danger {
      color: ${(props) => props.theme.colors.text.danger};
      border-color: ${(props) => props.theme.colors.text.danger};
    }
    &.confirm-armed {
      background: ${(props) => props.theme.colors.text.danger};
      border-color: ${(props) => props.theme.colors.text.danger};
      color: white;
    }
  }

  button.refresh {
    display: flex;
    align-items: center;
    background: transparent;
    border: none;
    color: ${(props) => props.theme.colors.text.muted};
    cursor: pointer;

    &:hover {
      color: ${(props) => props.theme.text};
    }
  }
`;

export default StyledWrapper;
