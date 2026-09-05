import { useRef, useState } from 'react';
import { IconSearch, IconX } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

// 트리 필터링은 비용이 크므로(수천 개 항목) 입력값은 즉시 반영하되
// 상위로의 검색어 전파는 디바운스해서 타이핑이 버벅이지 않게 한다.
const SEARCH_DEBOUNCE_MS = 300;

const CollectionSearch = ({ searchText, setSearchText }) => {
  const [inputValue, setInputValue] = useState(searchText);
  const debounceTimerRef = useRef(null);

  const handleChange = (e) => {
    const value = e.target.value.toLowerCase();
    setInputValue(value);
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => setSearchText(value), SEARCH_DEBOUNCE_MS);
  };

  const handleClear = () => {
    clearTimeout(debounceTimerRef.current);
    setInputValue('');
    setSearchText('');
  };

  return (
    <StyledWrapper>
      <IconSearch size={14} strokeWidth={1.5} className="search-icon" />
      <input
        type="text"
        name="search"
        data-testid="sidebar-search-input"
        placeholder="Search requests..."
        id="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        value={inputValue}
        onChange={handleChange}
      />
      {inputValue !== '' && (
        <div className="clear-icon" onClick={handleClear}>
          <IconX size={14} strokeWidth={1.5} />
        </div>
      )}
    </StyledWrapper>
  );
};

export default CollectionSearch;
