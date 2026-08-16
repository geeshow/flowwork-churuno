import React, { useEffect, useState } from 'react';
import serverApi from '../../../../web-ipc/server-api';
import StyledWrapper from './StyledWrapper';

// diff 헤더(---/+++/diff/index/@@)는 파일 경로·해시라 화면에서는 군더더기다
const isNoiseLine = (line) =>
  line.startsWith('diff --git')
  || line.startsWith('index ')
  || line.startsWith('--- ')
  || line.startsWith('+++ ')
  || line.startsWith('new file mode')
  || line.startsWith('deleted file mode')
  || line.startsWith('similarity index');

const lineClass = (line) => {
  if (line.startsWith('@@')) return 'hunk';
  if (line.startsWith('+')) return 'added';
  if (line.startsWith('-')) return 'removed';
  return '';
};

/** 한 API의 main 대비 차이 — 목록 행 아래에 펼쳐 보여준다. */
const ApiDiff = ({ workspaceName, path, mainBranch }) => {
  const [diff, setDiff] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    serverApi
      .workspaceApiDiff(workspaceName, path)
      .then((result) => alive && setDiff(result.diff))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [workspaceName, path]);

  if (error) return <StyledWrapper className="diff-error">{error}</StyledWrapper>;
  if (diff === null) return <StyledWrapper className="diff-loading">차이를 불러오는 중…</StyledWrapper>;

  const lines = diff.split('\n').filter((line) => line && !isNoiseLine(line));
  if (!lines.length) {
    return <StyledWrapper className="diff-loading">표시할 차이가 없습니다.</StyledWrapper>;
  }

  return (
    <StyledWrapper>
      <div className="diff-caption">
        <span className="removed">− {mainBranch}</span>
        <span className="added">+ 이 워크스페이스</span>
      </div>
      <pre className="diff-body">
        {lines.map((line, index) => (
          <div key={index} className={lineClass(line)}>
            {line}
          </div>
        ))}
      </pre>
    </StyledWrapper>
  );
};

export default ApiDiff;
