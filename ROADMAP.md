# Git Branch Panel Roadmap

## 프로젝트 방향

`Git Branch Panel`은 VS Code 안에서 GitHub 브랜치 관리의 기본 흐름을 빠르게 처리하는 extension을 목표로 합니다.

현재는 브랜치 조회와 기본 조작에 집중하고 있고, 앞으로는 검색성, 상태 가시성, GitHub 연동성, 배포 완성도를 단계적으로 높이는 방향으로 확장합니다.

## 현재 상태 요약

이미 구현된 범위:

- `Source Control` 안의 `Branch picker` 뷰
- local / remote 브랜치 통합 조회
- branch 검색 / 빠른 필터
- `List` / `Grouped` 뷰
- `Updated` / `Name` 정렬
- `Disconnected First` 토글
- 로컬 브랜치 checkout / create / push / delete
- remote branch에서 tracking local branch 생성
- remote branch에서 independent local branch 생성
- remote branch fetch
- GitHub 저장소 링크 열기

현재 한계:

- 첫 번째 workspace folder 기준으로만 동작
- remote 업데이트 시간 기반 정렬 미지원
- 여러 remote에 대한 선택 경험 부족

## 다음 단계

### v0.1

기본 브랜치 관리 경험 정리 완료.

완료:

- branch 검색과 빠른 필터 추가
- 현재 `view mode`, `sort`, `disconnected first`, `branch filter` 설정 저장
- `fetch`와 `sync` 동작 분리
- 빈 상태와 에러 상태 메시지 개선
- README와 명령 설명을 실제 동작 기준으로 정리

### v0.2

브랜치 작업 자체를 더 폭넓게 지원하는 단계입니다.

- commit list 보여주기
- cherry pick (commit 별, commit 내부 파일별)
- merge 진입점 추가
- default branch로 빠르게 이동하는 액션 추가
- upstream / ahead / behind 상태를 더 명확하게 시각화

완료:

- branch rename

### v1.0

실사용과 배포 완성도를 높이는 단계입니다.

- 여러 remote를 선택하거나 전환하는 흐름 개선
- GitHub PR 브랜치 흐름 보조
- 아이콘, 배지, 뷰 상태 표현 정리
- Marketplace 공개를 위한 메타데이터 정비
- changelog, screenshots, versioning 체계 정리

## 기능 후보

우선순위는 아직 확정하지 않았지만, 다음 기능은 후보로 유지합니다.

- branch 보호 규칙이 있는 브랜치에 대한 주의 표시
- 최근 체크아웃 브랜치 섹션
- 브랜치별 마지막 커밋 메시지 표시
- remote별 필터링
- GitHub 기본 브랜치와 비교해서 정리되지 않은 브랜치 찾기
- 브랜치 삭제 전 영향 안내 강화

## 품질 / 배포 준비

- extension icon 추가
- gallery banner와 Marketplace용 소개 문구 정리
- `publisher`를 현재 임시값 `local-dev`에서 실제 배포용 값으로 변경
- `CHANGELOG.md` 추가
- 버전 정책 정리
- 대표 사용 화면 스크린샷 준비
- `.vsix` 테스트 배포 흐름 정리
