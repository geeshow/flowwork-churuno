import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;

  .chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px;
    border: 1px solid ${(props) => props.theme.workspace.border};
    border-radius: 999px;
    background: transparent;
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.font.size.xs};
    cursor: pointer;
    white-space: nowrap;

    &:hover:not(:disabled) {
      color: ${(props) => props.theme.text};
    }

    &.active {
      border-color: ${(props) => props.theme.brand};
      color: ${(props) => props.theme.brand};
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }

  .chip-count {
    font-variant-numeric: tabular-nums;
    opacity: 0.7;
  }
`;

export default StyledWrapper;
