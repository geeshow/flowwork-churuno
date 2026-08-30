import RequestMethod from '../RequestMethod';
import { IconLoader2, IconAlertTriangle, IconAlertCircle } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

const CollectionItemIcon = ({ item }) => {
  if (item?.error) {
    return <StyledWrapper><IconAlertCircle className="w-fit mr-2 error" size={18} strokeWidth={1.5} /></StyledWrapper>;
  }

  if (item?.loading) {
    return <IconLoader2 className="animate-spin w-fit mr-2" size={18} strokeWidth={1.5} />;
  }

  // partialCached = 지연 파싱 항목(웹 모드) — 내용이 캐시에 있어 탭을 열면 바로
  // 로드되므로, 크기 때문에 안 읽은 partial과 달리 경고가 아니라 메서드를 보여준다
  if (item?.partial && !item?.partialCached) {
    return <StyledWrapper><IconAlertTriangle size={18} className="w-fit mr-2 partial" strokeWidth={1.5} /></StyledWrapper>;
  }

  return <RequestMethod item={item} />;
};

export default CollectionItemIcon;
