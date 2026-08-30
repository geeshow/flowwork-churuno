import styled from 'styled-components';

const StyledWrapper = styled.div`
  width: 100%;
  max-width: 640px;
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;

  /* 입력창과 같은 흰 바탕 — 회색 화면 위에서 라운드 박스가 떠 보이지 않는다 */
  .command-form {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 6px 6px 12px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.md};
    background: ${(props) => props.theme.input.bg};

    &:focus-within {
      border-color: ${(props) => props.theme.brand};
    }

    .command-icon {
      display: inline-flex;
      color: ${(props) => props.theme.brand};
      flex-shrink: 0;
    }

    input {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      color: ${(props) => props.theme.text};
      font-size: ${(props) => props.theme.font.size.base};

      &::placeholder {
        color: ${(props) => props.theme.colors.text.muted};
      }
    }

    button {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      flex-shrink: 0;
      padding: 6px 14px;
      border: none;
      border-radius: ${(props) => props.theme.border.radius.base};
      background: ${(props) => props.theme.brand};
      color: ${(props) => props.theme.bg};
      font-size: ${(props) => props.theme.font.size.sm};
      font-weight: 600;
      cursor: pointer;

      &:disabled {
        opacity: 0.5;
        cursor: default;
      }
    }
  }

  .command-status {
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .command-result {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .analysis-note {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 14px;
  }
  .keyword-note {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
  }
  .value-chips {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
  }
  .value-chip {
    padding: 1px 8px;
    border: 1px solid ${(props) => props.theme.brand};
    border-radius: 999px;
    color: ${(props) => props.theme.text};

    strong {
      color: ${(props) => props.theme.brand};
    }

    /* 실행에서 거둔 값 — 사람이 적은 값과 구분되게 초록 계열 */
    &.produced {
      border-color: ${(props) => props.theme.colors.text.green};

      strong {
        color: ${(props) => props.theme.colors.text.green};
      }
    }
  }
  .combo-reason {
    color: ${(props) => props.theme.colors.text.muted};
  }

  .fallback-note {
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text};

    &.muted {
      color: ${(props) => props.theme.colors.text.muted};
    }
  }

  .match-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.base};
    background: ${(props) => props.theme.input.bg};
    overflow: hidden;
  }

  .match-row {
    display: flex;
    align-items: center;
    gap: 8px;

    & + .match-row {
      border-top: 1px solid ${(props) => props.theme.border.border1};
    }

    /* 제목 줄 + 설명 줄 — 줄임(…) 없이 그대로 다 보여준다 */
    .match-open {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
      padding: 9px 12px;
      border: none;
      background: transparent;
      color: ${(props) => props.theme.text};
      font-size: ${(props) => props.theme.font.size.sm};
      text-align: left;
      cursor: pointer;

      &:hover {
        background: ${(props) => props.theme.background.surface1};
      }

      svg {
        flex-shrink: 0;
        color: ${(props) => props.theme.colors.text.muted};
      }
    }

    .match-title {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .combo-order {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: ${(props) => props.theme.brand};
      color: ${(props) => props.theme.bg};
      font-size: ${(props) => props.theme.font.size.xs};
      font-weight: 600;
      flex-shrink: 0;
    }
    .match-directory {
      color: ${(props) => props.theme.colors.text.muted};
    }
    .match-name {
      font-weight: 600;
    }
    .match-desc {
      color: ${(props) => props.theme.colors.text.muted};
      font-size: ${(props) => props.theme.font.size.xs};
      line-height: 1.5;
    }

    .api-method {
      flex-shrink: 0;
      min-width: 40px;
      font-size: ${(props) => props.theme.font.size.xs};
      font-weight: 600;
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
    }

    .flowmap-btn {
      flex-shrink: 0;
      margin-right: 8px;
      padding: 4px 10px;
      border: 1px solid ${(props) => props.theme.border.border1};
      border-radius: ${(props) => props.theme.border.radius.base};
      background: transparent;
      color: ${(props) => props.theme.colors.text.muted};
      font-size: ${(props) => props.theme.font.size.xs};
      cursor: pointer;

      &:hover {
        color: ${(props) => props.theme.text};
        border-color: ${(props) => props.theme.brand};
      }
      &.open {
        color: ${(props) => props.theme.brand};
        border-color: ${(props) => props.theme.brand};
      }
    }

    &.more .match-open {
      flex-direction: row;
      justify-content: center;
      color: ${(props) => props.theme.colors.text.muted};
      font-weight: 600;

      &:hover {
        color: ${(props) => props.theme.text};
      }
    }
  }

  /* 징검다리 조합 — 명령의 값으로 입력을 못 채우는 작업에, 값을 만들어 줄 앞 단계를 묶어 보여준다 */
  .bridge-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px 10px;
    border-top: 1px dashed ${(props) => props.theme.border.border1};

    & + .match-row {
      border-top: 1px solid ${(props) => props.theme.border.border1};
    }
  }
  .bridge-note {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};

    strong {
      color: ${(props) => props.theme.brand};
    }
    .bridge-ready {
      color: ${(props) => props.theme.colors.text.green};
    }
  }
  .bridge-steps {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }
  .bridge-step {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: 999px;
    background: transparent;
    color: ${(props) => props.theme.text};
    font-size: ${(props) => props.theme.font.size.xs};
    cursor: pointer;

    &:hover,
    &.open {
      border-color: ${(props) => props.theme.brand};
    }
    &.open {
      color: ${(props) => props.theme.brand};
    }

    .bridge-provides {
      color: ${(props) => props.theme.colors.text.muted};
    }
  }

  /* 펼쳐진 패널(실행 폼 / flowmap) — 목록 안의 한 줄로, 흐름도는 제 안에서 가로 스크롤된다.
     안에 든 라운드 패널(.panel)이 회색 바탕 위에 떠 보이지 않게 바탕색을 목록과 같게 둔다 */
  .inline-panel {
    padding: 4px 12px 12px;
    border-top: 1px solid ${(props) => props.theme.border.border1};

    & + .match-row {
      border-top: 1px solid ${(props) => props.theme.border.border1};
    }
  }

  .inline-panel-head {
    display: flex;
    justify-content: flex-end;
    padding: 4px 0;

    .link-btn {
      border: none;
      background: transparent;
      padding: 0;
      color: ${(props) => props.theme.colors.text.muted};
      font-size: ${(props) => props.theme.font.size.xs};
      text-decoration: underline;
      cursor: pointer;

      &:hover {
        color: ${(props) => props.theme.text};
      }
    }
  }
`;

export default StyledWrapper;
