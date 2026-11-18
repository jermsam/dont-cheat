# Don't Cheat · The Midnight Trial

A two-seat browser game about trivia, trust, and betrayal. Play privately with a friend or take on the arena's solo rivals.

**[Play the game](https://jermsam.github.io/dont-cheat/)**

## Invite a friend

1. Tap **Set up your game**. Choose **Tournament**, **Duel a friend**, **Team up**, or **Play solo**. Tournament has a dedicated game selection step. Continue to the optional mask and destination steps, then launch. Use **Back** to change either choice.
2. Tap **Share to WhatsApp** and pick WhatsApp in your device's share sheet. You can also copy the link into a chat.
3. Return to the open host tab. Your friend taps the WhatsApp card or link, then taps **Continue**. They can pick a mask or go straight to **Join game**. If WhatsApp opens the card without the private seal, your friend will see a six-digit code. Check that it matches the code on the host screen and tap **Let them in**. The trial then starts for both players.

The invite grants access to one open seat. A refresh, closed tab, or disrupted connection requires a fresh room. WhatsApp decides whether to render the rich link preview. The full invite link works independently of the preview.

## Rules

Each of three rounds begins with a location briefing. Trivia time and points vary by location. The briefing shows the clock and bonuses. Each card turn gives you 30 seconds. In duels, you get 22 seconds to decide whether to share a clue. Both players then make a secret choice before the clock runs out.

| Your card | Opponent's card | Your points |
| --- | --- | --- |
| Trust | Trust | 2 |
| Betray | Trust | 3 |
| Trust | Betray | 0 |
| Betray | Betray | 0 |
| Betray | No card | 1 |
| Call bluff | They sent a decoy or peeked | 3 |
| Call bluff | They did neither | −1 |

After choosing an answer, show it, send a different option as a decoy, or keep it private. Your opponent sees the clue without knowing whether it’s real. Before playing a card, they can copy it or keep their own answer. Each player can also peek at one answer per duel. If your opponent calls your peek, you lose any points earned from that question. During the second and third rounds, each player can visit a hidden room for a private advantage or curse that affects their trivia score. The round record reveals who shared, copied, sent a decoy, peeked, or took a detour.

Other card combinations yield zero pact points. Round two doubles pact points. The final verdict opens all three records. All stakes are in-game points.

## Tournament

**Tournament** seats two to six players. Share one room invite for the entire nine-event season. The draw includes chess, English draughts, Texas Hold’em, Omweso, Ludo, two additional games, one brain challenge, and Majority Verdict. Pick the opening event or let the game draw it. The remaining event order is randomized.

The live tables also support five-card draw, Matatu, Card Draft, Go Fish, Blackjack, Pig, Liar’s Dice, Ship, Captain, Crew, Farkle, Five Dice, Cee-Lo, Cheat, Craps, and Snakes and Ladders. Hold’em is heads-up fixed-limit with 1/2 blinds. Blackjack is a hit-or-stand comparison against the same dealer. Matatu uses its 52-card Classic rules. Liar’s Dice uses wild ones and ascending bids. Craps uses pass-line outcomes. Chips, coins and time tokens exist inside the game.

After a round, a losing player gets first choice of the next table for one coin. The offer rotates among eligible players, and a free pass or an expired timer hands it off. If everyone passes, the suggested table stays. Other players can back a game for free, and a unanimous pick can reserve an encore when a later table is available. Each player gains two coins per event and one time token every third event. During an active table turn, a time token adds 30 seconds, once per table.

Matches use head-to-head tables. An odd seat faces an arena opponent. The host validates moves and clocks, and each result adds season points. Chess uses chess.js for move legality. Chess and draughts offer a playable Three.js board and a keyboard-accessible flat board. Card and dice tables open in 3D when WebGL is available. Public cards sit apart from your hand, and a gold corner marks cards you can tap. Flat view restores the standard controls. The shared renderer animates cards, dice, Ludo tokens, and Omweso seeds from synchronized game state. Keep the host tab open throughout; leaving during a match forfeits that table. The host device runs the rules and can inspect hidden state, so use trusted hosts.

Everyone gets a private first guess, then can share it, send a decoy, or keep it private. You see all shared clues and their masks before choosing a final answer. Tapping **Copy clue** credits the seat whose clue you followed. **Trust** awards 2 points if another player trusts. **Betray** awards 3 when someone copies your decoy. **Call bluff** awards 3 for correctly identifying a decoy and costs 1 for a wrong accusation. A regular correct answer earns 2 points. In Dare or Draw, a correct answer earns 4, a wrong answer costs 1, and passing costs zero.

In Majority Verdict, the table decides what earns points. A choice must get more than half of the submitted votes to earn 2 points for each voter who picked it. A tie or split with no majority awards zero answer points. Passing does not count as a vote. The reveal shows the vote count and offers an optional discussion prompt.

Masks identify seats in Tournament. Mask gifts apply in duels and heists. You can send preset statuses to the room in the lobby and on result screens, or share your own status outside the room. **Share result** opens the system share sheet or copies your score and the public game URL.

## Destinations

The game draws one of thirteen locations for each round, giving 39 locations and 2,197 possible routes. To guarantee one stop, open **Pick a destination** before starting. The other two remain a surprise. Briefings explain each location’s timer and scoring twists, and the verdict records the stops and bonuses that applied.

## Masks

Choose a mask in the lobby or on the invite screen. Tap **Befriend**, **Play the villain**, or **Read the room** for a quick pick, or open the full wardrobe. Each mask can award +2 points once per match. Tap an in-game mask portrait to see the gift and whether it has been used. When a gift scores, both players see it in the round record. Masks are optional in every mode.

## Team Heist

Tap **Team up** to play on the same side. Both players earn crew points for correct answers. The briefing shows how many. Then one player must **Distract** the host while the other chooses **Grab**. Picking different jobs earns 4 crew points, doubled in Round 2. Picking the same job or leaving a job unfilled earns zero loot points. Reach 16 crew points after three rounds to escape together.

Each player starts with 5 coins and 1 time token and earns 2 coins after each round. Team trivia gives at least 75 seconds and the job choice gives 45 seconds. Spend a token to add 20 seconds to both clocks, up to two boosts per step. Buy a token for 5 coins, give one to your teammate, or offer 3 coins to hire one. Your teammate chooses whether to accept the trade. Crew points still decide the verdict.

## Motion and sound

Scene art shifts with the pointer on desktop, and cards turn over together at the reveal. Player portraits animate at the start of each phase. Tap **Sound off** to enable the synthesized door, countdown, and reveal cues. Reduced-motion settings skip scene and card animations.

## Development

Run `python3 -m http.server 8000 --directory web` from the repository root, then open http://localhost:8000. The committed browser build is ready to serve. GitHub Pages serves the `web` contents through the `gh-pages` branch.

To rebuild the Iroh browser module, install Rust, the `wasm32-unknown-unknown` Rust target, LLVM/Clang, and wasm-pack. Run the build from the repository root.

```sh
wasm-pack build --release --target web --out-dir web/link --no-opt --locked
```

If the macOS system Clang fails while linking ring, set `CC_wasm32_unknown_unknown` to the path to your LLVM Clang binary. To publish updates, commit the changes and run `git subtree push --prefix web origin gh-pages`.

## How rooms work

[Iroh](https://docs.iroh.computer/languages/wasm-browser) connects the two browser endpoints over its shared relays. The invite carries the host endpoint ID and relay hostname in the query string and a random admission seal in the fragment. The endpoint ID and relay hostname can be read by link preview services. If the fragment is missing, the host must approve the guest after confirming a matching code. The host accepts one guest and runs the timers and scoring. The relay carries encrypted traffic. The host can inspect match data on their own device, so this model assumes both players trust each other to run the game as supplied. Match state is in browser memory. The game uses no account, camera, microphone, or device monitoring.

Setup and in-game artifacts use a locally hosted Three.js r169 build. Motion 14.14.0 animates screen changes. Both licenses are in `web/vendor`. The controls work with or without WebGL and both libraries respect the game’s reduced-motion behavior.

## Music credits

Victory music is [“The Curtain Rises” by Kevin MacLeod](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500011), licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). The track is used unedited.

## Round recaps and sound

After each round, the recap counts down to the next round. The host can start immediately or use **Keep reading** to pause. Tap **Sound off** to turn sound on and hear a short fanfare preview. The choice is remembered for that browser when storage is available.

Snakes and Ladders is available under **Boards** and can be drawn into a bonus event. Roll a six-sided die, climb or slide only on landing, and reach square 100 by exact count. The original board is available in flat and animated 3D views.

### Additional season tables

Spades, Hearts, Euchre, President, Kings, and Left Center Right use four-seat tables. Arena players fill empty seats. Spades uses partnerships, nil, and bags to 200. Hearts uses passing, queen-of-spades penalties, and shooting the moon to 100. Euchre uses the 24-card pack, bowers and partnerships to ten with a forced dealer call after seven passes. Gin Rummy is head-to-head to 100 with knock, gin and undercut scoring. President plays three ranked deals with automatic exchanges. Kings uses original non-drinking prompts and ends with the fourth King. Speed, Tenzi and Egyptian Ratscrew accept actions from both players during play. Mexicali uses private rolls, rising claims and three lives.

In Matatu, if you have no match, draw from the stock. Play the drawn card immediately if it fits, or pass. An unusable draw passes the turn automatically. Tap the face-down stock in 3D or use the Draw button above the table. When a 2 is played, the button shows the number of penalty cards. Taking the penalty ends the turn.

### Destinations and portraits

Season lobbies show the live seat roster and player portraits. The selected destination opens the season and is shared by the lobby and the first event. Destination art accompanies the relevant screens.

Card tables show opponents’ card backs when the rules expose their hand size. **Cover my hand** hides your cards on your screen. The table shows game-required reveals, and the season recap keeps private hands out of the record. The host browser runs the deck and rules.

Ludo rolls animate in flat and 3D views, including consecutive identical results. The host resolves the die under the same rules.
