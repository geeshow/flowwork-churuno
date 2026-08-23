import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { IconX } from '@tabler/icons';
import { hidePreferencesPage } from 'providers/ReduxStore/slices/app';
import Preferences from 'components/Preferences';
import StyledWrapper from './StyledWrapper';

/**
 * Preferences as a full-page overlay. It floats above whichever app is active
 * (bruno request tabs or flowwork), so opening settings never navigates away
 * from — or loses — what the user was working on.
 */
const PreferencesPageOverlay = () => {
  const dispatch = useDispatch();
  const close = () => dispatch(hidePreferencesPage());

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  return (
    <StyledWrapper>
      <div className="preferences-page-head">
        <h2>Preferences</h2>
        <button className="preferences-page-close" onClick={close} title="Close (Esc)" aria-label="Close Preferences">
          <IconX size={18} strokeWidth={1.5} />
        </button>
      </div>
      <div className="preferences-page-body">
        <Preferences />
      </div>
    </StyledWrapper>
  );
};

export default PreferencesPageOverlay;
