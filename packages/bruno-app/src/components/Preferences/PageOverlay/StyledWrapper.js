import styled from 'styled-components';

const StyledWrapper = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  background: ${(props) => props.theme.bg};
  color: ${(props) => props.theme.text};

  .preferences-page-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid ${(props) => props.theme.border.border1};

    h2 {
      font-size: ${(props) => props.theme.font.size.md};
      font-weight: 600;
    }
  }

  .preferences-page-close {
    display: flex;
    align-items: center;
    padding: 4px;
    border-radius: ${(props) => props.theme.border.radius.base};
    color: ${(props) => props.theme.colors.text.muted};

    &:hover {
      color: ${(props) => props.theme.text};
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }
  }

  .preferences-page-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px 16px 16px;
  }
`;

export default StyledWrapper;
