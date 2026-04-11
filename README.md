# Git Branch Panel

`Git Branch Panel`은 VS Code `Source Control` 영역에 `Branch picker` 뷰를 추가해서 GitHub 저장소의 브랜치를 더 쉽게 관리할 수 있게 도와주는 확장입니다.

현재 버전은 브랜치 조회, 체크아웃, 생성, 푸시, 삭제, 원격 브랜치 fetch처럼 브랜치 관리에 필요한 기본 기능에 집중하고 있습니다.

## 현재 구현된 기능

- `Source Control` 안에 `Branch picker` 뷰를 추가합니다.
- 현재 워크스페이스의 첫 번째 폴더를 기준으로 Git 저장소를 탐색합니다.
- 로컬 브랜치와 리모트 브랜치를 한 화면에서 함께 보여줍니다.
- 브랜치 이름 기준 검색/필터를 지원합니다.
- `List` 뷰와 `Grouped` 뷰를 전환할 수 있습니다.
- 브랜치 정렬 기준을 `Updated` 또는 `Name`으로 바꿀 수 있습니다.
- upstream이 없는 로컬 브랜치를 위로 올리는 `Disconnected First` 토글을 제공합니다.
- 현재 `view mode`, `sort`, `disconnected first`, `branch filter` 상태를 워크스페이스에 저장합니다.
- 현재 checkout된 로컬 브랜치를 강조해서 표시합니다.
- 푸시가 필요한 로컬 브랜치를 표시합니다.
- upstream 기준 `ahead / behind` 상태를 로컬 브랜치에 표시합니다.
- 로컬 브랜치에서 다음 작업을 지원합니다.
  - `Checkout`
  - `New Branch from Selected Branch`
  - `Push Branch`
  - `Delete Branch`
- 리모트 브랜치에서 다음 작업을 지원합니다.
  - `Checkout as Local Branch`
  - `New Branch from Selected Branch`
- 로컬/리모트 그룹에서 `Fetch Remote Branches` 액션을 실행할 수 있습니다.
- GitHub remote가 연결된 경우 저장소 URL을 브라우저로 열 수 있습니다.

## 뷰와 동작 방식

### Branch picker

- 최상단에 현재 저장소 이름이 표시됩니다.
- 그 아래에 `Local`과 `Remote (<remote>)` 그룹이 나뉘어 표시됩니다.
- Git 저장소가 아니면 안내 메시지를 보여줍니다.

### List / Grouped 뷰

- `List` 뷰는 브랜치를 평면 목록으로 보여줍니다.
- `Grouped` 뷰는 `feature/login`, `feature/signup` 같은 브랜치를 경로 기준으로 묶어서 보여줍니다.
- 현재 브랜치는 grouped 모드에서도 최상단에 고정해서 보여줍니다.

### 정렬

- `Updated`: 로컬 브랜치를 최근 커밋 시간 기준으로 정렬합니다.
- `Name`: 브랜치 이름 기준으로 정렬합니다.
- 리모트 브랜치는 현재 최근 업데이트 시간을 가져오지 않기 때문에 사실상 이름 기준 정렬에 가깝습니다.

### 표시 규칙

- 현재 checkout된 로컬 브랜치에는 강조 마커가 붙습니다.
- upstream이 있는 로컬 브랜치는 설명 영역에 upstream 이름을 표시합니다.
- upstream이 있는 로컬 브랜치는 `↑2`, `↓1` 같은 ahead / behind 상태를 함께 표시합니다.
- 푸시가 필요한 로컬 브랜치에는 별도 마커가 붙습니다.
- upstream이 없는 로컬 브랜치는 일반 브랜치와 다르게 보이도록 표시됩니다.

## 지원하는 명령

### 로컬 브랜치

- `Checkout`
- `New Branch from Selected Branch`
- `Push Branch`
- `Delete Branch`

로컬 브랜치 삭제 시:

- upstream이 없으면 로컬 브랜치만 삭제합니다.
- upstream이 있으면 `Local Only` 또는 `Local + Remote`를 선택할 수 있습니다.

로컬 브랜치 이름 변경 시:

- upstream이 없는 로컬 브랜치에서만 우클릭 메뉴 `Rename Branch`를 실행할 수 있습니다.
- 현재 checkout된 브랜치여도 upstream이 없으면 rename할 수 있습니다.

### 리모트 브랜치

- `Checkout Remote as Local Branch`
  - 선택한 리모트 브랜치를 tracking local branch로 만듭니다.
- `Create Local Branch from Remote`
  - 선택한 리모트 브랜치를 기준으로 independent local branch를 만듭니다.

### 뷰 상단 액션

- `Refresh`
- `Sort Branches`
- `Search Branches`
- `Clear Branch Search`
- `Disconnected First` on/off
- `Switch to Grouped View`
- `Switch to List View`
- `Open GitHub Repository`
- `Fetch Remote Branches`

### 그룹 액션

- `Fetch Remote Branches`

동작:

- `Fetch Remote Branches`: `git fetch --prune`로 로컬의 remote-tracking 상태를 갱신하고 패널을 새로고침합니다.

## 시작 방법

1. 의존성을 설치합니다.

```bash
npm install
```

2. TypeScript를 빌드합니다.

```bash
npm run compile
```

3. VS Code에서 이 폴더를 엽니다.
4. `F5`를 눌러 `Extension Development Host`를 실행합니다.
5. 새 창에서 Git 저장소 폴더를 엽니다.
6. `Source Control` 패널에서 `Branch picker` 뷰를 확인합니다.

## 현재 제한사항

- 첫 번째 workspace folder만 기준으로 동작합니다.
- 리모트 브랜치의 최근 업데이트 시간은 현재 수집하지 않아서 정렬 품질이 제한됩니다.
- 여러 remote가 있을 때는 `origin`을 우선 사용하고, 없으면 첫 번째 remote를 사용합니다.
- `Open GitHub Repository`는 GitHub URL 형식의 remote일 때만 동작합니다.
- 브랜치 검색, 필터, rename, merge, rebase 같은 고급 작업은 아직 제공하지 않습니다.

## 빠르게 써보기

- 원격 브랜치를 로컬 tracking branch로 가져오려면 remote 브랜치에서 `Checkout Remote as Local Branch`
- 원격 브랜치를 기반으로 독립 브랜치를 만들려면 remote 브랜치에서 `Create Local Branch from Remote`
- 푸시 전 상태를 정리하려면 `Fetch Remote Branches`
- 브랜치가 많다면 `Search Branches`로 먼저 좁힌 뒤 작업

## 파일 구조

- `src/extension.ts`: 명령 등록과 확장 진입점
- `src/branchesView.ts`: 트리 뷰 구성과 브랜치 표시 로직
- `src/git.ts`: Git 명령 실행과 브랜치 데이터 수집
- `package.json`: 뷰, 명령, 메뉴, 메타데이터 정의
- `ROADMAP.md`: 다음 구현 단계와 제품화 계획

## 앞으로의 계획

이 확장은 GitHub 브랜치 관리를 더 빠르게 만드는 기본 도구를 목표로 하고 있습니다. 다음 단계 계획은 [ROADMAP.md](/Users/randywon/Desktop/extension/ROADMAP.md)에서 정리합니다.

test
