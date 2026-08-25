import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { IconLoader2 } from '@tabler/icons';
import { setActiveApp } from 'providers/ReduxStore/slices/app';
import FlowworkLogo from 'components/Icons/FlowworkLogo';
import ApiChainIcon from 'components/Icons/ApiChainIcon';
import Button from 'ui/Button';

/**
 * What the tab panel shows when no tab is focused. Boot and workspace restore
 * legitimately pass through this state, so a spinner shows first; if no tab
 * has appeared after the grace period this is not a load in progress — offer
 * the product home and the API Chain start screen instead of spinning forever.
 */
const GRACE_MS = 2000;

const NoTabsOpen = () => {
  const dispatch = useDispatch();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!settled) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
        <IconLoader2 className="animate-spin" size={24} strokeWidth={1.5} />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" data-testid="no-tabs-open">
      <FlowworkLogo size={40} stroke={1.5} />
      <div className="text-sm opacity-70">열린 탭이 없습니다. 사이드바에서 요청을 열거나, 아래에서 시작하세요.</div>
      <div className="flex items-center gap-2 mt-1">
        <Button onClick={() => dispatch(setActiveApp('home'))} data-testid="no-tabs-open-home">
          홈 화면 열기
        </Button>
        <Button variant="outline" onClick={() => dispatch(setActiveApp('flowwork'))} data-testid="no-tabs-open-flowwork">
          <ApiChainIcon size={16} />
          API Chain 열기
        </Button>
      </div>
    </div>
  );
};

export default NoTabsOpen;
