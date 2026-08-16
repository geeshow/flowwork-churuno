import { useMemo } from 'react';
import { useSelector } from 'react-redux';

/**
 * Devtools Network 탭에 표시할 모든 요청 엔트리.
 * 컬렉션 timeline의 request 엔트리와 워크플로우(flowwork) 실행 호출을
 * 합쳐 시간순으로 반환한다.
 */
export const useNetworkRequests = () => {
  const collections = useSelector((state) => state.collections.collections);
  const flowworkRequests = useSelector((state) => state.logs.flowworkRequests);

  return useMemo(() => {
    const requests = [];

    collections.forEach((collection) => {
      if (collection.timeline) {
        collection.timeline
          .filter((entry) => entry.type === 'request')
          .forEach((entry) => {
            requests.push({
              ...entry,
              collectionName: collection.name,
              collectionUid: collection.uid
            });
          });
      }
    });

    return [...requests, ...flowworkRequests].sort((a, b) => a.timestamp - b.timestamp);
  }, [collections, flowworkRequests]);
};
