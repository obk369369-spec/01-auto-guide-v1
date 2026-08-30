# WIC RULE SOURCE

도구번호: 1

운영 규칙은 두 층으로 사용한다.
1. WIC 공통 운영원본: `obk369369-spec/20-operational-manual-viewer/WIC_GLOBAL_OPERATING_RULES.md`
2. TOOL001 전용 원본: `TOOL001_MASTER.md`

고객업무 공통 규칙은 `WIC_CUSTOMER_RULE_SOURCE.md`가 가리키는 중앙 고객업무 마스터를 함께 사용한다.

공통 규칙을 TOOL001_MASTER에 중복 복제하지 않는다. TOOL001_MASTER에는 1번 도구 고유 규칙만 유지한다.
충돌 시 같은 범위에 대해 더 최신의 명시적 사용자 지시를 우선한다.
로컬 V2/V3/패치형 규칙 파일을 새로 만들지 않는다.
