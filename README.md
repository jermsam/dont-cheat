# Don't Cheat · The Midnight Trial

A two-seat browser game about trivia, trust, and betrayal. Play privately with a friend or take on the arena's solo rivals.

**[Play the game](https://jermsam.github.io/dont-cheat/)**

## Invite a friend

1. Tap **Invite a friend** and wait for the link.
2. Tap **Share to WhatsApp** and pick WhatsApp in your device's share sheet. You can also copy the link into a chat.
3. Return to the open host tab. Your friend opens the summons and taps **Accept summons**. The trial starts when they join.

The invite grants access to one open seat. A refresh, closed tab, or disrupted connection requires a fresh room. WhatsApp decides whether to render the rich link preview. The full invite link works independently of the preview.

## Rules

Each of three rounds opens with a 20-second trivia question. Correct answers earn 2 points. Both players then make a secret choice within 20 seconds.

| Your card | Opponent's card | Your points |
| --- | --- | --- |
| Trust | Trust | 2 |
| Betray | Trust | 3 |
| Trust | Betray | 0 |
| Betray | Betray | 0 |
| Betray | No card | 1 |

Other timeout combinations yield zero pact points. Round two doubles pact points. The final verdict opens all three records. All stakes are in-game points.

## Development

Run `python3 -m http.server 8000 --directory web` from the repository root, then open http://localhost:8000. The committed browser build is ready to serve. GitHub Pages serves the `web` contents through the `gh-pages` branch.

To rebuild the Iroh browser module, install Rust, the `wasm32-unknown-unknown` Rust target, LLVM/Clang, and wasm-pack. Run the build from the repository root.

```sh
wasm-pack build --release --target web --out-dir web/link --no-opt --locked
```

If the macOS system Clang fails while linking ring, set `CC_wasm32_unknown_unknown` to the path to your LLVM Clang binary. To publish updates, commit the changes and run `git subtree push --prefix web origin gh-pages`.

## How rooms work

[Iroh](https://docs.iroh.computer/languages/wasm-browser) connects the two browser endpoints over its shared relays. The client carries the host endpoint ID and a random admission seal in the invite's URL fragment. The host accepts one guest and runs the timers and scoring. The relay carries encrypted traffic. The host can inspect match data on their own device, so this model assumes both players trust each other to run the game as supplied. Match state is in browser memory. The game uses no account, camera, microphone, or device monitoring.
