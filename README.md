# Don't Cheat · The Midnight Trial

A two-seat browser game about trivia, trust, and betrayal. Play privately with a friend or take on the arena's solo rivals.

**[Play the game](https://jermsam.github.io/dont-cheat/)**

## Invite a friend

1. Tap **Duel a friend** or **Team up** and wait for the link.
2. Tap **Share to WhatsApp** and pick WhatsApp in your device's share sheet. You can also copy the link into a chat.
3. Return to the open host tab. Your friend taps the WhatsApp card or link, then taps **Join game**. If WhatsApp opens the card without the private seal, your friend will see a six-digit code. Check that it matches the code on the host screen and tap **Let them in**. The trial then starts for both players.

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

**Tournament** seats two to six players. Open a room, share the same WhatsApp invite, and start when all your friends are in. The mixed season has two randomly selected games and one **Majority Verdict** round, in shuffled order. Or pick a playlist to play three variations of one challenge. Available challenges include Chess Jump, Draughts Capture, Poker Read, Mweso Seed Relay, Ludo Finish, Card Draft, Signal Code, and Dare or Draw. Several boards and number puzzles change on each draw. These are short, self-contained challenges inspired by their format. Dare or Draw uses game points only.

Everyone gets a private first guess, then can share it, send a decoy, or keep it private. You see all shared clues and their masks before choosing a final answer. Tapping **Copy clue** credits the seat whose clue you followed. **Trust** awards 2 points if another player trusts. **Betray** awards 3 when someone copies your decoy. **Call bluff** awards 3 for correctly identifying a decoy and costs 1 for a wrong accusation. A regular correct answer earns 2 points. In Dare or Draw, a correct answer earns 4, a wrong answer costs 1, and passing costs zero.

In Majority Verdict, the table decides what earns points. A choice must get more than half of the submitted votes to earn 2 points for each voter who picked it. A tie or split with no majority awards zero answer points. Passing does not count as a vote. The reveal shows the vote count and offers an optional discussion prompt.

Masks identify seats in Tournament. Mask gifts apply in duels and heists. You can send preset statuses to the room in the lobby and on result screens, or share your own status outside the room. **Share result** opens the system share sheet or copies your score and the public game URL.

## Destinations

The game draws one of thirteen locations for each round, giving 39 locations and 2,197 possible routes. To guarantee one stop, open **Pick a destination** before starting. The other two remain a surprise. Briefings explain each location’s timer and scoring twists, and the verdict records the stops and bonuses that applied.

## Masks

Choose a mask in the lobby or on the invite screen. Each mask can award +2 points once per match. Tap an in-game mask portrait to see the gift and whether it has been used. When a gift scores, both players see it in the round record. Masks are optional in every mode.

## Team Heist

Tap **Team up** to play on the same side. Both players earn crew points for correct answers. The briefing shows how many. Then one player must **Distract** the host while the other chooses **Grab**. Picking different jobs earns 4 crew points, doubled in Round 2. Picking the same job or leaving a job unfilled earns zero loot points. Reach 16 crew points after three rounds to escape together.

## Motion and sound

The briefing and verdict show a rendered 3D relic. Scene art shifts with the pointer on desktop, and cards turn over together at the reveal. Player portraits animate at the start of each phase. Tap **Sound off** to enable the synthesized door, countdown, and reveal cues. Reduced-motion settings keep the relic still and skip scene and card animations.

## Development

Run `python3 -m http.server 8000 --directory web` from the repository root, then open http://localhost:8000. The committed browser build is ready to serve. GitHub Pages serves the `web` contents through the `gh-pages` branch.

To rebuild the Iroh browser module, install Rust, the `wasm32-unknown-unknown` Rust target, LLVM/Clang, and wasm-pack. Run the build from the repository root.

```sh
wasm-pack build --release --target web --out-dir web/link --no-opt --locked
```

If the macOS system Clang fails while linking ring, set `CC_wasm32_unknown_unknown` to the path to your LLVM Clang binary. To publish updates, commit the changes and run `git subtree push --prefix web origin gh-pages`.

## How rooms work

[Iroh](https://docs.iroh.computer/languages/wasm-browser) connects the two browser endpoints over its shared relays. The invite carries the host endpoint ID and relay hostname in the query string and a random admission seal in the fragment. The endpoint ID and relay hostname can be read by link preview services. If the fragment is missing, the host must approve the guest after confirming a matching code. The host accepts one guest and runs the timers and scoring. The relay carries encrypted traffic. The host can inspect match data on their own device, so this model assumes both players trust each other to run the game as supplied. Match state is in browser memory. The game uses no account, camera, microphone, or device monitoring.
