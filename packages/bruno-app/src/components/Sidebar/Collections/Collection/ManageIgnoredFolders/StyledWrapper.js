import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  .hint {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
    line-height: 1.5;
  }

  .folder-tree {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 320px;
    overflow-y: auto;
  }

  .folder-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 4px;
    border-radius: ${(props) => props.theme.border.radius.base};
    cursor: pointer;

    &:hover {
      background: ${(props) => props.theme.background.surface1};
    }

    svg {
      flex-shrink: 0;
      color: ${(props) => props.theme.colors.text.muted};
    }

    .folder-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &.hidden-folder {
      .folder-name {
        color: ${(props) => props.theme.colors.text.muted};
        text-decoration: line-through;
      }
    }

    input[type='checkbox']:disabled {
      cursor: not-allowed;
    }
  }
`;

export default StyledWrapper;
