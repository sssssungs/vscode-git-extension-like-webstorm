# Git Branch Panel

로컬 브랜치와 리모트 브랜치를 한 화면에 보여주는 가장 기본적인 VS Code extension 예제입니다.

## 기능

- Activity Bar에 `Branches` 패널 추가
- `Local Branches`와 `Remote Branches`를 분리해서 표시
- 제목 바에서 새로고침 가능

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
6. 왼쪽 Activity Bar에서 `Branches` 아이콘 클릭
7. 필요하면 Command Palette에서 `Git Branch Panel: Refresh` 실행

## 구조

- `src/extension.ts`: 확장 진입점
- `src/branchesView.ts`: 브랜치 트리 뷰 로직
- `src/git.ts`: git 명령 실행 및 브랜치 조회
- `package.json`: 명령어 등록, 메타데이터, 스크립트
- `.vscode/launch.json`: 디버깅 설정
- `.vscode/tasks.json`: TypeScript 빌드 작업
