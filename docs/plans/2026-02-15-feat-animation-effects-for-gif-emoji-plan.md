---
title: "feat: Add Animation Effects for GIF Emoji"
type: feat
date: 2026-02-15
---

# feat: Add Animation Effects for GIF Emoji

## Overview

Quick Emoji 메뉴바 앱에 애니메이션 효과를 추가하여, 텍스트 기반 정적 이모지를 움직이는 GIF 이모지로 만들 수 있게 한다. gif.js 라이브러리를 사용하여 Canvas 프레임을 캡처하고 GIF로 인코딩하며, Slack 128KB 제한을 준수한다.

## Problem Statement / Motivation

현재 Quick Emoji는 정적 PNG 이모지만 생성할 수 있다. Slack에서 애니메이션 이모지는 시각적으로 눈에 띄고 팀 커뮤니케이션을 활발하게 만드는 인기 요소지만, 별도의 외부 도구(MakeEmoji 등)를 사용해야 한다. 앱 내에서 텍스트 입력 → 애니메이션 선택 → GIF 다운로드까지 한 번에 처리할 수 있으면 워크플로우가 크게 개선된다.

## Proposed Solution

기존 Canvas 기반 렌더링 구조(`renderer.js`)를 확장하여:

1. **애니메이션 선택 UI** — 그리드 형태의 효과 선택 버튼을 preview 영역 아래에 추가
2. **실시간 미리보기** — `requestAnimationFrame` 루프로 Canvas에 선택한 애니메이션 재생
3. **GIF 인코딩** — gif.js Web Worker로 프레임 캡처 → GIF Blob 생성
4. **자동 최적화** — 128KB 초과 시 프레임 수/품질 자동 조절

### 파일 구조 변경

```
slack-emoji-mac-app/
├── renderer.js          # 기존 파일 수정 (애니메이션 루프, GIF 다운로드 분기)
├── animations.js        # NEW: 24개 애니메이션 효과 정의 (transform 함수들)
├── gif-encoder.js       # NEW: gif.js 래퍼 (프레임 캡처, 최적화, Blob 생성)
├── index.html           # 수정 (애니메이션 선택 UI, 윈도우 높이 조정)
├── main.js              # 수정 (윈도우 높이 변경, GIF 저장 지원)
└── package.json         # 수정 (gif.js 의존성 추가)
```

## Technical Considerations

### Architecture

- **애니메이션 시스템:** 각 효과는 `(ctx, t, options) => void` 형태의 순수 함수로 정의. `t`는 0~1 정규화 시간값. Canvas `save()/restore()`로 transform을 적용한 후 기존 `updateCanvas()` 텍스트 렌더링을 호출하는 구조.
- **미리보기 루프:** `requestAnimationFrame` 기반. 애니메이션 선택 시 루프 시작, "없음" 선택 또는 텍스트 변경 시 정지 후 정적 렌더링 복귀.
- **GIF 인코딩 흐름:**
  1. gif.js 인스턴스 생성 (`width: 128, height: 128, workers: 2, quality: 10`)
  2. 애니메이션 1사이클을 15~20프레임으로 Canvas에 렌더링
  3. 각 프레임을 `gif.addFrame(ctx, {copy: true, delay: 50})` 으로 추가
  4. `gif.render()` 호출 → `finished` 이벤트에서 Blob 수신
  5. Blob → base64 → IPC로 main process에 전달 → 파일 저장

### gif.js 통합

```javascript
// gif-encoder.js 핵심 구조
const GIF = require('gif.js');

function encodeGIF(canvas, animationFn, options) {
  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: 128,
      height: 128,
      workerScript: 'node_modules/gif.js/dist/gif.worker.js'
    });

    const ctx = canvas.getContext('2d');
    const frames = options.frames || 15;
    const delay = options.delay || 50;

    for (let i = 0; i < frames; i++) {
      const t = i / frames;
      animationFn(ctx, t);
      gif.addFrame(ctx, { copy: true, delay });
    }

    gif.on('finished', (blob) => resolve(blob));
    gif.on('error', reject);
    gif.render();
  });
}
```

### GIF 크기 최적화 전략

Slack 128KB 제한 준수를 위한 단계적 축소:

1. **1차 시도:** 15프레임, quality=10, delay=50ms → 대부분 128KB 이하
2. **초과 시:** 프레임 수를 10으로 줄이고 quality=20으로 올림 (낮은 품질)
3. **여전히 초과 시:** 프레임 수 8, quality=30
4. **최종 폴백:** 64x64로 축소 후 재시도

```javascript
async function encodeWithSizeLimit(canvas, animationFn, maxBytes = 128 * 1024) {
  const configs = [
    { frames: 15, quality: 10, delay: 50 },
    { frames: 10, quality: 20, delay: 70 },
    { frames: 8,  quality: 30, delay: 80 },
  ];

  for (const config of configs) {
    const blob = await encodeGIF(canvas, animationFn, config);
    if (blob.size <= maxBytes) return blob;
  }
  // 최종 폴백: 크기 축소
  return await encodeGIF(scaledCanvas, animationFn, configs[0]);
}
```

### 애니메이션 효과 구현 패턴

```javascript
// animations.js - 각 효과는 transform 함수
const animations = {
  shake: (ctx, t) => {
    const offset = Math.sin(t * Math.PI * 4) * 8;
    ctx.translate(offset, 0);
  },
  bounce: (ctx, t) => {
    const y = -Math.abs(Math.sin(t * Math.PI * 2)) * 20;
    ctx.translate(0, y);
  },
  spin: (ctx, t) => {
    ctx.translate(64, 64);
    ctx.rotate(t * Math.PI * 2);
    ctx.translate(-64, -64);
  },
  pulse: (ctx, t) => {
    const scale = 1 + Math.sin(t * Math.PI * 2) * 0.15;
    ctx.translate(64, 64);
    ctx.scale(scale, scale);
    ctx.translate(-64, -64);
  },
  party: (ctx, t) => {
    // hue rotation via globalCompositeOperation or fillStyle override
    // 텍스트 색상을 HSL로 변환하여 hue를 t에 따라 회전
  },
  // ... 나머지 20개+ 효과
};
```

### Performance

- `requestAnimationFrame` 미리보기는 CPU 사용이 적음 (128x128 Canvas는 매우 작은 영역)
- gif.js Web Worker가 인코딩을 백그라운드에서 처리하므로 UI 블로킹 없음
- GIF 인코딩은 0.5~2초 소요 예상 → 프로그레스 인디케이터 필요

### Security

- gif.js worker 스크립트 경로를 로컬 `node_modules`로 고정 (외부 URL 사용 안 함)
- `nodeIntegration: true` 이미 사용 중이므로 추가 보안 고려 불필요

## UI Specification

### 애니메이션 그리드 레이아웃

- **그리드:** 6열, 스크롤 가능한 영역 (max-height: 120px)
- **버튼 크기:** 46x32px, 효과 이름 텍스트 (영문, 10px)
- **첫 번째 버튼:** "None" (기본 선택, 정적 PNG)
- **선택 상태:** 선택된 버튼은 `#007AFF` 배경 + 흰색 텍스트
- **위치:** Canvas 미리보기와 Download 버튼 사이
- **팝업 높이:** 400px → 520px로 변경

### 다운로드 버튼 상태

| 상태 | 라벨 | 스타일 |
|---|---|---|
| 정적 (None 선택) | Download PNG | 기존 초록색 |
| 애니메이션 선택 | Download GIF | 기존 초록색 |
| 인코딩 중 | Encoding... | 비활성화 + 스피너 |
| 인코딩 실패 | 에러 메시지 표시 | status 영역에 빨간색 |

### 상태 관리

- 텍스트 없이 애니메이션 선택 시: 버튼 선택 상태만 저장, 미리보기 없음
- 텍스트 입력 후 선택된 애니메이션 자동 재생
- 팝업 닫고 다시 열면: 상태 초기화 (텍스트/설정/애니메이션 모두 리셋)
- 인코딩 중 텍스트/애니메이션 변경 시: 진행 중인 인코딩 취소, 미리보기만 업데이트

### 애니메이션 타이밍

- 모든 효과 1루프 = 1000ms (통일)
- 미리보기: 60fps `requestAnimationFrame`
- GIF 출력: 15프레임, 각 66ms delay (≈15fps)
- 미리보기와 GIF의 재생 속도가 동일하도록 타이밍 동기화

## Acceptance Criteria

### 기능 요구사항

- [ ] 24가지 애니메이션 효과 중 하나를 선택할 수 있다
- [ ] "None" 선택 시 기존처럼 정적 PNG를 다운로드한다
- [ ] 애니메이션 선택 시 Canvas에서 실시간 미리보기가 재생된다
- [ ] 다운로드 버튼 클릭 시 GIF 파일이 데스크톱에 저장된다 (`emoji_TIMESTAMP.gif`)
- [ ] 생성된 GIF가 128KB 이하이다 (Slack 호환)
- [ ] GIF가 무한 루프로 재생된다
- [ ] 128x128px 크기가 유지된다
- [ ] 텍스트, 배경색, 글자색, 폰트 변경이 애니메이션 미리보기에 실시간 반영된다
- [ ] 다운로드 버튼이 선택 상태에 따라 "Download PNG" / "Download GIF" 로 바뀐다

### 인코딩 UX

- [ ] GIF 인코딩 중 다운로드 버튼이 비활성화되고 "Encoding..." 표시
- [ ] 인코딩 중 다시 클릭해도 중복 인코딩이 시작되지 않는다
- [ ] 인코딩 중 텍스트/애니메이션 변경 시 인코딩이 취소된다
- [ ] 인코딩 실패 시 status 영역에 에러 메시지가 표시된다
- [ ] 128KB 초과 시 자동으로 프레임/품질을 줄여 재시도한다

### UI 요구사항

- [ ] 메뉴바 팝업 UI에 애니메이션 선택 그리드가 자연스럽게 통합된다
- [ ] 선택된 애니메이션 버튼이 시각적으로 구분된다 (파란색 배경)
- [ ] 텍스트가 없을 때 애니메이션 선택은 가능하나 미리보기는 표시되지 않는다
- [ ] 다중 라인 텍스트는 전체가 하나의 단위로 애니메이션된다

## Success Metrics

- 모든 24가지 애니메이션이 부드럽게 재생된다 (15fps 이상)
- GIF 인코딩이 3초 이내에 완료된다
- 생성된 GIF가 Slack에 커스텀 이모지로 업로드 가능하다 (128KB 이하, 128x128px)

## Dependencies & Risks

### Dependencies

- **gif.js** npm 패키지 추가 필요 (`npm install gif.js`)
- gif.js의 `gif.worker.js` 파일이 Electron 렌더러에서 Web Worker로 정상 로드되어야 함

### Risks

| 리스크 | 영향 | 완화 방안 |
|---|---|---|
| gif.js worker 경로가 Electron 패키징 시 깨질 수 있음 | GIF 생성 불가 | `workerScript` 경로를 `__dirname` 기반으로 설정, 패키징 전 테스트 |
| 일부 복잡한 애니메이션이 128KB를 초과할 수 있음 | 품질 저하 | 단계적 최적화 전략으로 프레임/품질 자동 조절 |
| 팝업 높이 증가로 화면 하단에서 잘릴 수 있음 | UI 사용성 저하 | 그리드를 스크롤 가능하게 (max-height: 120px) |
| `party` 등 색상 변환 효과는 Canvas composite 조작이 복잡 | 구현 지연 | Phase 1에서는 transform 기반 효과만, 색상 효과는 Phase 3 |
| 인코딩 중 사용자 입력 변경으로 레이스 컨디션 | 잘못된 GIF 저장 | 인코딩 시작 시 상태 스냅샷, 변경 시 진행 중 인코딩 취소 |
| 모든 최적화 후에도 128KB 초과 | 사용자 블로킹 | 경고 메시지와 함께 저장 ("Slack 업로드 시 초과될 수 있음") |

## References & Research

### Internal References

- 현재 Canvas 렌더링 로직: `renderer.js:51-90` (`updateCanvas()`)
- 폰트 크기 자동 조절: `renderer.js:27-49` (`calcFontSize()`)
- 다운로드 로직: `renderer.js:92-110` (`download()`)
- IPC 저장 핸들러: `main.js:139-150` (`save-image`)
- 메뉴바 윈도우 설정: `main.js:15-23` (320x400)

### External References

- gif.js API: `new GIF({workers, quality, width, height})`, `addFrame(ctx, {copy, delay})`, `render()`
- gif.js GitHub: github.com/jnordberg/gif.js
- Slack 커스텀 이모지 제한: 128KB, 128x128px 권장

### Brainstorm

- `docs/brainstorms/2026-02-15-animation-effects-brainstorm.md`

## Implementation Outline

### Phase 1: 기반 구조 (animations.js, gif-encoder.js)

1. [x] `npm install gif.js`
2. [x] `animations.js` 생성 — 모든 24개 효과 (움직임 6 + 회전 5 + 크기 5 + 색상 4 + 특수 4)
3. [x] `gif-encoder.js` 생성 — gif.js 래퍼, 크기 최적화 로직

### Phase 2: UI 통합 (index.html, renderer.js, main.js)

4. [x] `index.html` — 애니메이션 선택 그리드 UI (6열, 스크롤 영역), 팝업 높이 520px
5. [x] `renderer.js` — 애니메이션 미리보기 루프 (`requestAnimationFrame`), GIF/PNG 분기 다운로드, 인코딩 상태 관리
6. [x] `main.js` — 윈도우 높이 320x520

### Phase 3: 폴리싱

7. [ ] 실제 앱에서 모든 24개 애니메이션 수동 테스트
8. [ ] GIF 인코딩 및 파일 크기 확인
9. [ ] 최종 QA: 다양한 텍스트 길이/효과 조합 확인
