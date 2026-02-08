# Star Trek CCG 2E - Solitaire

> The STAR TREK Customizable Card Game provides two or more players with adventures set in the rich universe of STAR TREK. This allows you to explore strange new worlds, to seek out new life and new civilizations – to boldly go where no one has gone before.™
>
> Each player's cards include a number of personnel, each represented by a different card. Other cards represent the equipment, events, and interrupts that help support them, the ships that will take them out into the galaxy, and the missions they will attempt to complete.
>
> Each time a player's personnel attempt to complete a mission, they may face dilemmas – obstacles selected by an opponent. These dangerous twists must be overcome before the mission is completed and its points are scored.
>
> If you reach 100 points, and your personnel have completed missions both on a planet and in space, you are the winner

## About

This is my solitaire version of the Star Trek Collectible Card Game, Second Edition, that plays in a web browser.

**Try it out here**: https://eskimo.com/~home/star-trek-ccg/

## Tech Stack

- **React 18** - UI framework
- **TypeScript 5** - Type safety
- **Vite** - Build tool and dev server
- **Node.js + WebSocket** - Game server
- **Zustand** - Client state management
- **Vitest** - Unit testing
- **Prettier** - Code formatting
- **ESLint** - Linting

## Getting Started

```bash
# Install dependencies
npm install

# Start client + server
npm run dev

# Run tests
npm run test

# Build all packages
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

## How to Play

- The game is played using a mouse
- Click on individual cards to view full size
- Click buttons as they appear to take relevant game actions (*Deploy*, *Draw Card*, *List Orders*, *Close*, *Next Phase*, *Discard*, *New Turn*, etc)
- Dialogs that pop-up can be dragged around the board
- Hover over partially covered dialogs to bring back into focus

## Notable Differences from the Actual CCG

- One player (solitaire mode)
- Uses a preconfigured Borg deck
  - Missions: 5, Personnel: 22, Ships: 4, Events: 3, Interrupts: 3, Dilemmas: 20 (space: 4, planet: 6, dual: 10)
- To win, complete the missions before the deck runs out

## Project Structure

```
packages/
├── shared/              # Types, card database, game logic
├── server/              # WebSocket game server
└── client/              # Vite + React client
    └── src/
        ├── components/  # GameBoard, Hand, Modals, UI
        ├── hooks/       # Custom React hooks
        ├── store/       # Zustand state management
        └── utils/       # Utility functions
```

## Resources

- [Official Rulebook (PDF)](https://www.trekcc.org/op/rulebook.pdf)
- [Trek CC 2E Website](https://www.trekcc.org/2e/)

## Screenshots

![Gameplay Screenshot 1](https://user-images.githubusercontent.com/2509012/224824548-ab04c3ea-5ebc-48d0-9a58-9e9674881444.png)

![Gameplay Screenshot 2](https://user-images.githubusercontent.com/2509012/224823161-48266afb-c747-43bb-aa93-79a9eafb6444.png)

![Gameplay Screenshot 3](https://user-images.githubusercontent.com/2509012/224821860-ed0b2e0f-330f-4479-b454-f0aa256ace73.png)

## Mission Mechanics Reference

- **START Mission**
  - "When . . . begins a mission attempt" triggers process. `missionBeginAttempt = true`
  - "When . . . about to draw dilemmas" triggers process. `missionAboutDrawDilemmas = true`
  - **START Draw Dilemmas**
    - `missionAboutDrawDilemmas = false`
    - "When . . . drawn dilemmas" triggers process. `missionDrawnDilemmas = true`
    - "When . . . (choose/chosen) dilemmas" triggers process. `missionChooseDilemmas = true`
  - **END Draw Dilemmas**
  - **START Facing Dilemmas** (loop)
    - "When . . . dilemma . . . about to (be) reveal(ed)" triggers process. `missionDilemmaAboutReveal`
    - "When . . . reveal" triggers process. `missionDilemmaReveal`
    - "When . . . about to face . . . dilemma" triggers process. `missionDilemmaAboutFace`
    - "(When/While) . . . (face/facing) . . . dilemma" triggers. `missionDilemmaFace`
    - "(When/While) . . . is attempting a mission" triggers process and may be used at any time until dilemma is overcome or placed somewhere. `missionAttempt`
  - **END Facing Dilemmas**
  - "(When/While) . . . is attempting a mission" triggers process and may be used until the end of the mission attempt. `missionAttempt`
  - "(When/While) . . . checking . . . mission requirements" triggers process and may be used until the end of the mission attempt. `missionAttempt`
  - "When . . . fail a mission attempt" triggers. `missionAttemptFail`
  - "When . . . mission attempt fails" triggers process. `missionAttemptFail`
  - "When . . . about to complete" triggers process. `missionAboutComplete`
  - "When . . . complete" triggers process. `missionComplete`
- **END Mission**
