import React from 'react';
import StyledWrapper from './StyledWrapper';

const StorageStep = ({ collectionLocation, onLocationChange }) => (
  <StyledWrapper className="step-body">
    <div className="step-label">Storage</div>
    <div className="step-title">Where should we store your collections?</div>
    <div className="step-description">
      Bruno saves collections as plain files on your filesystem, perfect for version control with Git.
    </div>

    <div className="location-input-group">
      <div className="location-path-display">
        <input
          type="text"
          className="path-text w-full bg-transparent outline-none"
          placeholder="Enter a folder path..."
          value={collectionLocation || ''}
          onChange={(e) => onLocationChange(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
      </div>
    </div>
    <div className="location-hint">
      Each collection and workspace gets its own folder inside this directory. You can change this later.
    </div>
  </StyledWrapper>
);

export default StorageStep;
