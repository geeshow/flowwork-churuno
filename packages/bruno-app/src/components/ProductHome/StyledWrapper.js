import styled from 'styled-components';

const StyledWrapper = styled.div`
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  background: ${(props) => props.theme.bg};
  color: ${(props) => props.theme.text};

  .page {
    max-width: 960px;
    margin: 0 auto;
    padding: 40px 32px 56px;
    display: flex;
    flex-direction: column;
    gap: 40px;
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    padding-top: 16px;

    .hero-icon {
      color: ${(props) => props.theme.text};
    }
    h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .tagline {
      margin: 0;
      font-size: ${(props) => props.theme.font.size.lg};
      color: ${(props) => props.theme.colors.text.muted};
    }
    .lead {
      max-width: 640px;
      margin: 8px 0 0;
      font-size: ${(props) => props.theme.font.size.md};
      line-height: 1.7;
      color: ${(props) => props.theme.colors.text.muted};

      strong {
        color: ${(props) => props.theme.text};
      }
    }
    .hero-actions {
      display: flex;
      gap: 10px;
      margin-top: 16px;

      button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    }
  }

  .product {
    display: flex;
    flex-direction: column;
    gap: 16px;

    header {
      display: flex;
      align-items: center;
      gap: 12px;

      h2 {
        margin: 0;
        font-size: ${(props) => props.theme.font.size.xl};
        font-weight: 600;
      }
      p {
        margin: 2px 0 0;
        font-size: ${(props) => props.theme.font.size.base};
        color: ${(props) => props.theme.colors.text.muted};
      }
    }
    .product-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: ${(props) => props.theme.border.radius.base};
      background: ${(props) => props.theme.background.surface1};
      color: ${(props) => props.theme.brand};
      flex-shrink: 0;
    }
    h4 {
      margin: 4px 0 0;
      font-size: ${(props) => props.theme.font.size.xs};
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: ${(props) => props.theme.colors.text.muted};
    }
  }

  .feature-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;

    &.two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    @media (max-width: 760px) {
      grid-template-columns: 1fr;
      &.two {
        grid-template-columns: 1fr;
      }
    }
  }
  .feature-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.base};
    background: ${(props) => props.theme.background.surface0};

    .feature-icon {
      display: inline-flex;
      color: ${(props) => props.theme.brand};
    }
    strong {
      font-size: ${(props) => props.theme.font.size.md};
    }
    p {
      margin: 0;
      font-size: ${(props) => props.theme.font.size.sm};
      line-height: 1.65;
      color: ${(props) => props.theme.colors.text.muted};
    }
  }

  .extra-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 16px;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};

    li {
      display: flex;
      align-items: center;
      gap: 8px;

      svg {
        flex-shrink: 0;
        color: ${(props) => props.theme.text};
      }
    }
    @media (max-width: 760px) {
      grid-template-columns: 1fr;
    }
  }

  .pipeline-steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;

    @media (max-width: 900px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .step {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 14px 16px 14px 16px;
      border: 1px solid ${(props) => props.theme.border.border1};
      border-radius: ${(props) => props.theme.border.radius.base};
      background: ${(props) => props.theme.background.surface0};
      font-size: ${(props) => props.theme.font.size.sm};
    }
    .step-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 999px;
      font-size: ${(props) => props.theme.font.size.xs};
      font-weight: 600;
      color: ${(props) => props.theme.bg};
      background: ${(props) => props.theme.brand};
    }
    .step-chain .step-num {
      background: ${(props) => props.theme.colors.text.green};
    }
    .step-app {
      font-size: ${(props) => props.theme.font.size.xs};
      font-weight: 600;
      letter-spacing: 0.4px;
      color: ${(props) => props.theme.colors.text.muted};
    }
    .step-text {
      line-height: 1.55;
    }
    .step-arrow {
      position: absolute;
      right: -14px;
      top: 50%;
      transform: translateY(-50%);
      color: ${(props) => props.theme.colors.text.muted};
      background: ${(props) => props.theme.bg};
    }
    @media (max-width: 900px) {
      .step-arrow {
        display: none;
      }
    }
  }

  .share-note {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }
`;

export default StyledWrapper;
