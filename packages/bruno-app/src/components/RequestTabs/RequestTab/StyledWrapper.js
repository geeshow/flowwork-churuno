import styled from 'styled-components';

const StyledWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;

  .tab-label {
    overflow: hidden;
    align-items: center;
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .tab-method {
    font-size: 0.6875rem;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }

  .tab-name {
    position: relative;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 0.8125rem;

    // so that the name does not cutoff when italicized
    padding-right: 2px;
  }

  .tab-name-input {
    width: 10ch;
    min-width: 0;
    padding: 0 2px;
    font-size: 0.8125rem;
    background: ${(props) => props.theme.input.bg};
    border: 1px solid ${(props) => props.theme.input.focusBorder};
    border-radius: ${(props) => props.theme.border.radius.base};
    color: ${(props) => props.theme.text};
    outline: none;
  }

  .example-icon {
    color: ${(props) => props.theme.requestTabs.example.iconColor};
  }
`;

export default StyledWrapper;
