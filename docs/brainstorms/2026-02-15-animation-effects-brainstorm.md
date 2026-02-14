# Animation Effects for Quick Emoji

**Date:** 2026-02-15
**Status:** Ready for planning

## What We're Building

Quick Emoji macOS 메뉴바 앱에 애니메이션 효과를 추가하여, 텍스트 기반 이모지를 움직이는 GIF 이모지로 만들 수 있게 한다. MakeEmoji.com의 애니메이션 기능을 참고하되, 텍스트 이모지에 최적화된 형태로 구현한다.

### 핵심 요구사항

- **출력 포맷:** GIF (Slack 호환, 128KB 이하)
- **애니메이션 수:** 20가지 이상 풀 세트
- **미리보기:** 실시간 Canvas 애니메이션 재생
- **크기:** 128x128px 유지

## Why This Approach

### 선택: gif.js + Canvas 프레임 렌더링

현재 Canvas 기반 렌더링 구조(`renderer.js`)를 그대로 활용할 수 있어 자연스러운 확장이 가능하다.

**구현 방식:**
1. `requestAnimationFrame`으로 Canvas에 실시간 애니메이션 미리보기 렌더링
2. 다운로드 시 gif.js의 Web Worker 기반 인코더로 프레임을 캡처하여 GIF 생성
3. Slack 128KB 제한에 맞게 프레임 수/색상 수 자동 최적화

**기각한 대안:**
- **gifenc:** 더 가볍지만 커뮤니티가 작음
- **FFmpeg:** 고품질이지만 바이너리 번들링으로 앱 크기가 크게 증가

## Key Decisions

### 1. 애니메이션 효과 풀 세트 (20가지+)

| 카테고리 | 효과 | 설명 |
|---|---|---|
| **움직임** | Shake | 좌우 흔들기 |
| | Bounce | 위아래 튀기 |
| | Slide | 좌→우 슬라이드 |
| | Float | 위아래 부드럽게 떠다니기 |
| | Swing | 좌우 흔들리기 (진자) |
| | Jump | 위로 점프 |
| **회전** | Spin | 360도 회전 |
| | Flip H | 수평 뒤집기 |
| | Flip V | 수직 뒤집기 |
| | Wobble | 비틀거리며 흔들리기 |
| | Roll | 굴러가기 |
| **크기** | Pulse | 커졌다 작아졌다 |
| | Zoom In | 점점 커지기 |
| | Zoom Out | 점점 작아지기 |
| | Heartbeat | 심장 박동처럼 |
| | Pop | 톡 튀어나오기 |
| **색상** | Party | 무지개색 플래시 |
| | Flash | 깜빡이기 |
| | Glow | 빛나기 |
| | Fade | 페이드 인/아웃 |
| **특수** | Jello | 젤리처럼 물렁물렁 |
| | Rubber Band | 고무줄처럼 늘어나기 |
| | Tada | 짜잔! (커지면서 회전) |
| | Wave | 글자가 물결치기 |

### 2. UI 구성

- 현재 320px 메뉴바 팝업 내에 애니메이션 선택 UI 추가
- 효과 선택은 그리드 형태의 아이콘/썸네일 버튼으로
- 선택하면 Canvas에서 바로 실시간 미리보기 재생
- "없음" 옵션으로 기존 정적 PNG 내보내기도 유지

### 3. GIF 최적화 전략

- Slack 128KB 제한 준수 필수
- 프레임 수 조절 (10-20 프레임)
- 색상 팔레트 축소 (최대 256색)
- 루프 설정 (무한 반복)
- 필요 시 자동으로 품질/프레임 수 조절하여 크기 제한 맞추기

### 4. 기술 스택 추가

- **gif.js:** GIF 인코딩 (npm 패키지)
- 기존 Electron + Canvas 구조 유지
- 새로운 의존성 최소화

## Open Questions

- [ ] 메뉴바 팝업 높이를 늘려야 할 수 있음 (현재 400px → 500-600px?)
- [ ] 애니메이션 속도 조절 기능이 필요한지? (1차에서는 기본 속도로 고정 가능)
- [ ] 글자별 개별 애니메이션 (Wave 등)의 구현 복잡도 확인 필요

## Next Step

`/workflows:plan`으로 구현 계획 수립
