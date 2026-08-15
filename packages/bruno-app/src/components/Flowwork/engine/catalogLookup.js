/** 카탈로그 참조를 유일 키 문자열로 정규화. */
export function refKey(ref) {
  return [ref.department, ref.collectionFile, ...ref.itemPath, ref.name].join(' ');
}

/**
 * 카탈로그 엔트리 목록으로 "스텝 → 요청 템플릿" 조회 함수를 만든다.
 * inlineRequest(직접 입력 예외 경로)가 있으면 그것을 우선한다.
 */
export function makeTemplateResolver(entries) {
  const byKey = new Map();
  for (const e of entries) byKey.set(refKey(e), e.requestTemplate);

  return (step) => {
    const binding = step.apiBinding;
    if (!binding) throw new Error('처리 API가 설정되지 않았습니다.');
    if (binding.inlineRequest) return binding.inlineRequest;
    const template = byKey.get(refKey(binding.catalogEntry));
    if (!template) {
      throw new Error(`API 카탈로그에서 API를 찾을 수 없습니다: ${binding.catalogEntry.name}`);
    }
    return template;
  };
}
