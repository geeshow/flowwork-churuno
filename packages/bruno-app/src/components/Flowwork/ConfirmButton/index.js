import React, { useEffect, useRef, useState } from 'react';

/**
 * 네이티브 confirm() 대신 쓰는 2단계 확인 버튼.
 *
 * 웹뷰/임베드 환경에서는 브라우저 다이얼로그가 차단되어 confirm()이 항상
 * 취소로 처리되므로, 첫 클릭에 확인 문구(confirmLabel)로 바뀌고 한 번 더
 * 클릭해야 실행한다. 잠시 두면 원래 상태로 돌아간다.
 */
const ARM_RESET_MS = 6000;

export function ConfirmButton({ className = '', confirmLabel, onConfirm, disabled, title, children }) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleClick = () => {
    if (!armed) {
      setArmed(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setArmed(false), ARM_RESET_MS);
      return;
    }
    clearTimeout(timerRef.current);
    setArmed(false);
    onConfirm();
  };

  return (
    <button
      className={`${className} ${armed ? 'confirm-armed' : ''}`}
      disabled={disabled}
      title={armed ? '한 번 더 누르면 실행됩니다' : title}
      onClick={handleClick}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

export default ConfirmButton;
