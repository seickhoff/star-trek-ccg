# star-trek-ccg

This my solitaire version of the Star Trek Collectible Card Game, Second Edition, that plays in a web browser. 

Try it out: https://eskimo.com/~home/star-trek-ccg/

- Click on cards to view full size
- The dialogs that pop-up can be dragged around to see the board better
- Click the buttons as they appear for game actions (Deploy, Draw Card, List Orders, Close, Next Phase, Discard, New Turn, etc) 

> The STAR TREK Customizable Card Game provides two or more players with adventures set in the rich universe of STAR TREK. This allows you to explore strange new worlds, to seek out new life and new civilizations – to boldly go where no one has gone before.™
>
> Each player’s cards include a number of personnel, each represented by a different card. Other cards represent the equipment, events, and interrupts that help support them, the ships that will take them out into the galaxy, and the missions they will attempt to complete.
>
> Each time a player’s personnel attempt to complete a mission, they may face dilemmas – obstacles selected by an opponent. These dangerous twists must be overcome before the mission is completed and its points are scored.
>
> If you reach 100 points, and your personnel have completed missions both on a planet and in space, you are the winner

- More about the game in general: https://www.trekcc.org/2e/
- Rulebook: https://www.trekcc.org/op/rulebook.pdf

## Notable differences from the actual CCG

- One player
- Equipment, events, and interrupts are not yet implemented
- Uses a preconfigured Borg deck
- To win, complete the missions before the deck runs out

### Types of cards used

- missions: 5
- personnel: 22
- ships: 4
- dilemmas: 20 (space: 4, planet: 6, dual: 10)

## Images of gameplay

![image](https://user-images.githubusercontent.com/2509012/224824548-ab04c3ea-5ebc-48d0-9a58-9e9674881444.png)

![image](https://user-images.githubusercontent.com/2509012/224823161-48266afb-c747-43bb-aa93-79a9eafb6444.png)

![image](https://user-images.githubusercontent.com/2509012/224821860-ed0b2e0f-330f-4479-b454-f0aa256ace73.png)


## Mission Mechanics

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

