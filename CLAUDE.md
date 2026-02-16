# MOJI — Slack Emoji Generator

## Tidy First? 원칙 (Kent Beck)

- 구조적 변경(S)과 행동적 변경(B)은 반드시 별도 커밋으로 분리
- Tidying 타이밍: First(다음 변경이 쉬워질 때) > After > Later > Never
- Guard Clauses: 중첩 조건문 대신 early return
- Explaining Constants: 매직 넘버는 명명된 상수로 추출
- Normalize Symmetries: 동일 로직은 동일 형태로 표현
- Extract Helper: 함수는 최대 15줄 유지
- cost(software) ≈ coupling — 커플링을 최소화

## Project Structure

- `src/main/` — Electron main process (tray, IPC, png-utils)
- `src/renderer/` — Canvas rendering, animations, GIF encoding, UI
- `src/types/` — TypeScript type definitions
- `index.html` — UI (inline styles, pixel art theme)

## Commands

- `npm start` — Build & run
- `npm test` — Run tests (vitest)
- `npm run lint` — ESLint
- `npm run build` — Build DMG

## Key Constants

- Canvas: 128×128px
- Slack limit: 128KB
- GIF transparency: chroma key 0x00FF00
