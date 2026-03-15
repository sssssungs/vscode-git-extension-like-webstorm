# Git Branch Panel

VS Code `Source Control` 안에 `Branch picker` 뷰를 추가해서 로컬/리모트 브랜치를 함께 다루는 확장입니다.

## 기능

- `Source Control` 안에 `Branch picker` 뷰 표시
- `Local` / `Remote` 브랜치 분리 표시
- `List` / `Grouped` 뷰 토글
- `Sort` 토글
  로컬 브랜치는 최근 커밋 시간 기준 정렬
  리모트 브랜치는 이름순 fallback
- `Disconnected First` 토글
  upstream이 없는 로컬 브랜치를 위로 우선 정렬
- 현재 checkout된 로컬 브랜치 최상단 고정
- 로컬 브랜치 hover 액션
  `Checkout`
  `Push Branch`
- 로컬 브랜치 우클릭 액션
  `Checkout`
  `New Branch from Selected Branch`
- 리모트 브랜치 우클릭 액션
  `Checkout as Local Branch`
  `New Branch from Selected Branch`
- 리모트 그룹 우측 sync 액션
- Git 저장소 URL 바로가기 버튼

## 시작 방법

1. 의존성 설치
   ```bash
   npm install
   ```
2. 빌드
   ```bash
   npm run compile
   ```
3. VS Code에서 이 폴더 열기
4. `F5`를 눌러 Extension Development Host 실행
5. 새 창에서 Git 저장소 폴더 열기
6. `Source Control` 패널 열기
7. `Branch picker` 뷰 확인

## 주요 동작

- 로컬 브랜치 checkout
  브랜치 hover 시 오른쪽 `play` 아이콘 클릭
  또는 우클릭 후 `Checkout`
- 로컬 브랜치 생성
  원하는 로컬 브랜치에서 우클릭 후 `New Branch from Selected Branch`
- 리모트 브랜치에서 tracking 브랜치 생성
  우클릭 후 `Checkout as Local Branch`
- 리모트 브랜치에서 독립 로컬 브랜치 생성
  우클릭 후 `New Branch from Selected Branch`
- push가 필요한 로컬 브랜치 표시
  오른쪽에 `☝️` 표시
  hover 시 `Push Branch` 아이콘 노출
- grouped 뷰
  `feature/a`, `feature/b`처럼 path가 있는 브랜치를 폴더처럼 묶어서 표시

## 구조

- `src/extension.ts`: 확장 진입점
- `src/branchesView.ts`: 브랜치 트리 뷰 로직
- `src/git.ts`: git 명령 실행 및 브랜치 조회
- `package.json`: 명령어 등록, 메타데이터, 스크립트
- `.vscode/launch.json`: 디버깅 설정
- `.vscode/tasks.json`: TypeScript 빌드 작업
