import styled from 'styled-components';

const StyledWrapper = styled.div`
  padding: 8px 12px 8px 44px;
  border-bottom: 1px solid ${(props) => props.theme.workspace.border};
  font-size: ${(props) => props.theme.font.size.xs};

  &.diff-loading,
  &.diff-error {
    color: ${(props) => props.theme.colors.text.muted};
  }

  &.diff-error {
    color: ${(props) => props.theme.colors.text.danger};
  }

  .diff-caption {
    display: flex;
    gap: 12px;
    margin-bottom: 4px;
    color: ${(props) => props.theme.colors.text.muted};
  }

  .diff-body {
    margin: 0;
    padding: 6px 8px;
    max-height: 320px;
    overflow: auto;
    border-radius: ${(props) => props.theme.border.radius.base};
    background: ${(props) => props.theme.codemirror.bg};
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    line-height: 1.5;
    white-space: pre;
    color: ${(props) => props.theme.text};
  }

  .added {
    color: ${(props) => props.theme.request.methods.post};
  }

  .removed {
    color: ${(props) => props.theme.request.methods.delete};
  }

  .hunk {
    color: ${(props) => props.theme.colors.text.muted};
  }
`;

export default StyledWrapper;
