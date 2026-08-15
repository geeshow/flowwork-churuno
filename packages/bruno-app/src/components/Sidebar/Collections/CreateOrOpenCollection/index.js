import { useTheme } from '../../../../providers/Theme';

import styled from 'styled-components';
import StyledWrapper from './StyledWrapper';

const LinkStyle = styled.span`
  color: ${(props) => props.theme['text-link']};
`;

const CreateOrOpenCollection = ({ onCreateClick }) => {
  const { theme } = useTheme();

  const CreateLink = () => (
    <LinkStyle
      className="underline text-link cursor-pointer"
      theme={theme}
      onClick={onCreateClick}
    >
      Create
    </LinkStyle>
  );

  return (
    <StyledWrapper className="px-2 mt-4">
      <div className="text-xs text-center">
        <div>No collections found.</div>
        <div className="mt-2">
          <CreateLink /> a Collection.
        </div>
      </div>
    </StyledWrapper>
  );
};

export default CreateOrOpenCollection;
