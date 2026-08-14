# A Few Days, Six Boards: Building King's Gambit

![Cover: the vehicular xiangqi army, red and black sides with faction auras](xq_v3_full.png)
*The vehicular xiangqi lineup. Red in gold helms and crimson banners, black in dark armor with blue flame. You can tell the sides apart by silhouette alone.*

## The beginning

There is no dramatic origin story. I was playing xiangqi in a browser, and the pieces were stickers on a grid. Capturing a piece just made an image disappear. The whole thing looked like a spreadsheet that had learned to move. Web 3D has been around forever, I thought. So why are decent 3D board games so hard to find?

So I made a folder called chess. At first I really only meant to build one game: chess. Vite 5, React 18, TypeScript, Three.js 0.166, chess.js for the rules. The night the first version ran, I watched a rook slide from e1 to e4 trailing a little dust, and I figured this could go further. I could probably do a bit more.

Then I did a bit more, and a bit more after that. It ended up as six games: chess, xiangqi, Go, shogi, checkers, and reversi. Roughly 12,900 lines of source, 58 famous games in the library, twenty-some verification scripts, and two videos recorded from inside the game itself. Where is the plan I supposedly had? There wasn't one. I just kept adding things.

## Write it myself

Early on I set a rule: if I can write it myself, I don't take it off the shelf.

The engines show it best. Of the six games, only chess uses chess.js. That wheel is too well made to rebuild. The other five are all hand-written: xiangqi.ts, 277 lines, handles the palace and the river; go.ts, 223 lines, handles captures, ko, suicide moves, and territory counting; shogi.ts, 336 lines, handles promotion, drops, the double-pawn rule, and the drop-pawn-mate prohibition. Checkers and reversi each have their own file. Every engine is exactly big enough for its game. Not one extra line of abstraction.

The AI is hand-written too. Same skeleton everywhere: evaluation function, alpha-beta, opening book, time-boxed fallback. Go gets heuristic scoring with a Monte Carlo backstop. It is weak, sparring-partner level. I'll admit that. But I can explain why every line is there.

![Go endgame scoring](go_final_check.png)
*The homegrown Go engine at the end of a game: 19-road board, star points, last-stone marker. Captures, ko, and suicide rules all live in 223 lines.*

Art goes even further. No external models, no textures. Every piece is procedural: shogi pieces are extruded pentagons, the kanji faces drawn live on a Canvas, promoted pieces in red ink. Sound too, all synthesized with WebAudio. There isn't a single audio file in the project.

The cost is speed. The payoff is peace of mind: nothing in the repo has a sketchy license, and when I pushed it to GitHub as open source, I didn't hesitate for a second.

## Rebuilding the xiangqi pieces

The part I most like talking about is the 3D rebuild of the xiangqi pieces.

At first they were discs with characters on them. Usable, but dull. I decided to tear it down and start over, and I set a hard rule: xiangqi pieces must be Chinese in design, and not one element from chess is allowed in. I refuse to model the chariot as a castle tower.

The final approach was vehicular. The horse became cavalry, a mounted knight with a weapon. The chariot became a Qin-style war chariot, two wheels, drawn by a horse, a warrior with a halberd aboard. The cannon became a field gun on a wheeled carriage, with a gunner holding a firing rod beside it.

![Close-up of the vehicular xiangqi pieces](xq_new_pieces_close.png)
*Close-up: red halberdiers, a cannon crewman in a straw hat, the two-wheeled chariot. Black lines up across the river.*

Red and black got real thought too. Not a palette swap. The helmets differ, the banners differ, the weapon poses differ, the vehicle details differ. You should be able to name the side from the silhouette alone.

That standard ended up governing the whole project. The pentagonal shogi pieces, the double-deck checkers discs with their crowns, the biconvex reversi discs, all of it follows the same rule. Faction auras got unified too: gold for the ivory side, blue for obsidian, and the aura switches when a piece flips or promotes. Six games feeling like one product comes down to that.

## One cannon shell

fx.ts is only 202 lines, and it was the most fun part to build.

The base layer is standard stuff: capture sparks, shock rings, dust, squash and stretch on jumps, a red alert ring on check, camera shake. The piece I'm proud of is the cannon's dedicated effect. In xiangqi, the cannon captures by firing over a screen piece, and that mechanic has built-in drama. So I made the whole sequence: the barrel recoils, a dark shell with a lit fuse arcs out for 0.34 seconds, and on landing you get a hard flash, a two-color burst, a big gold ring expanding to radius 2.2, the captured piece shattering into 12 fragments that scatter at speed, the camera shaking, the wreckage dissolving away.

![Cannon capture effect](_cannon_demo/cannon_capture.gif)
*Cannon capture: recoil, shell, fuse, ground burst, flying fragments. 0.34 seconds plus the aftermath.*

Ordinary captures aren't phoned in either: sparks, rings, dust, all of it.

![Xiangqi capture effect](_fx_demo/xq_capture.gif)
*A normal capture under the shared effects system: hit reaction, knockback, burst particles.*

The first time it ran clean, I made the cannon capture pieces over and over, maybe ten times in a row. Pretty childish. But that's the joy of solo development.

## Feeding old game records to the engine

The famous-game system was the densest engineering in the project.

The xiangqi data comes from three old manuals: the *Juzhong Mi*, the *Meihua Pu*, and *Zi Chu Dong Lai Wu Di Shou*. Old manuals use traditional notation, "cannon two traverses five" and so on. I wrote _classic_gen.ts to parse that into coordinate moves, then ran every move through the engine for legality, backtracking to resolve ambiguity. Old manuals often stop at a winning position rather than mate, so I let the AI finish the kill: the attacking side at level 3, the weak side at level 1 with random jitter, so the completed moves still taste like the old book. The output was 45 games, all replayed end to end by the engine. 45 out of 45 passed.

Go went through an SGF pipeline: _build_go_sgf.mjs parses the SGF, verifies every move in the browser with the project's own GoGame engine, then emits the data. Five games came in, spanning 170 years: Shusaku's Ear-Reddening Game of 1846, Go Seigen against Honinbo Shusai in 1933 with the 3-3, star, and tengen opening, the first game of the 1939 Kamakura Jubango, and games two and four of AlphaGo versus Lee Sedol in 2016. Chess got eight classics, every PGN verified.

![Go study mode: the 3-3, star, tengen game](gf_step2_script_panel.png)
*Studying the 3-3, star, tengen game. Move browser on the right: click to jump, current move highlighted, export available.*

The feature grew into a study tool: move browser, autoplay, and most importantly free-move variations. At any point in a famous game you can branch off and try your own move; the system records the branch and you can cut back to the mainline whenever you like. Add notation import and export plus board setup, and it's roughly a Go institute study room.

This is where I took the biggest fall of the whole project. At first I hung the engine's move execution on the animation tween's callback: the engine only moved after the animation finished. In a headless browser, rendering gets throttled, the animation timed out, autoplay double-applied moves, and the board fell apart. I dug for a long time. The conclusion was simple: script playback must apply moves synchronously. The engine executes immediately; the animation is just for show. Then I added a safety net: every tick, a fresh engine instance replays the game, and on any mismatch it force-resyncs. Both rules now sit in the handoff doc, marked "must follow."

## A game a day

On August 8 and 9, 2026, I shipped three new games: shogi and checkers on the 8th, reversi on the 9th. Each one is a full set: engine, renderer, AI, UI, verification. The reason it could go that fast is that the architecture had turned "add a game" into a fill-in-the-blanks exercise: the engine owns the rules, Xxx3D.ts owns rendering, the AI reuses the skeleton, the main menu gets a tab.

![Shogi match](shogi_ui_game.png)
*Shogi: pentagonal pieces, kanji faces, the komadai for captured pieces, a promote-or-not popup on promotion.*

Fast, but not sloppy. Shogi was the hardest. Pentagonal pieces extruded with ExtrudeGeometry, kanji faces on Canvas, captured pieces stacked on the komadai, drops flying in on a parabola, a promote-or-decline popup. The rules miss nothing: double pawn, last-rank drop bans for lance, knight, and pawn, drop-pawn-mate. isAttacked uses reverse directional scanning. On a random 200-move position, legalMoves takes about 9 milliseconds. That implementation exists for performance.

Checkers' forced-capture multi-jump chains are enumerated with DFS. On the 3D side it's a hop animation segment by segment, captures along the way exiting one at a time, and when a man kings, the crown pops on right there.

Reversi looked the easiest and broke the most. While testing the pass chain, the position refused to enter the pass branch. It took me a while to see why: the position has to satisfy "the opponent has no move AND I still have a stone to place," otherwise the game-over check fires first. And undo restored the wrong color on flipped discs; a disc flipped back should return to the enemy color. Bugs like this are invisible while you write them. Tests catch them every time.

## I don't believe it until I click it

The least toy-like thing about this project is the verification.

The root directory holds twenty-some _verify scripts in two layers. Layer one is pure logic unit tests, no browser: move generation, special rules, undo restoration, AI legality and timing per difficulty. Reversi alone has 27 assertions. Layer two is Playwright in a real browser, real pointer clicks performing moves, captures, promotions, undo, AI replies. Around 16 items per game.

![Checkers match](ck_ui_game.png)
*Checkers: double-deck discs, multi-jump hop by hop, crowning on promotion. The click tests once got their rays blocked here by proxy cylinders.*

Why insist on real clicks instead of calling internal APIs? Because 3D picking itself can fail, and it eventually did. The checkers test couldn't hit the right square no matter what. I dug for a long time and found it was the aim point: the script projected a world coordinate at y=0.3, floating above the square, and at a low camera angle the ray hit the invisible pickup proxy cylinder of a nearer piece first. The fix was to lower the aim to the board surface at y=0.14. Product code didn't change by a single line. What changed was the test's understanding of 3D space.

Similar lessons: in headless environments rAF gets throttled, so animation assertions must poll engine state instead of sleeping; the tween dt clamp went from 0.05 to 0.25, or animations freeze at low frame rates. All written down.

Every new game goes green on all three layers, unit, AI, browser clicks, before I take the archive screenshots. People say slow work makes fine goods. My verification suite is the reason I could move fast.

## I accidentally made a movie too

Once autoplay existed, recording a video was a short step. The first one was a xiangqi famous game, 114 seconds. The serious one is the first Kamakura Jubango game: 276 moves, 6 minutes 16 seconds, 44 MB. Playwright records webm, ffmpeg stitches. I hit a macOS pothole on the way: homebrew's ffmpeg ships without the drawtext filter, so subtitles wouldn't burn in. The workaround was crude but effective: render the subtitle cards to PNG with Playwright and composite them in as footage.

Later I upgraded the film to multi-camera: nine shots. A slow push from high overhead for the opening, a medium side shot for each player during the opening phase, a low close-up when the midgame fight starts, a slow pull-back at the end. 0.3-second fades between segments, move pacing following the flow of the fight.

![One of the multi-camera shots](_ref_frames/frame_04.jpg)
*One shot from the multi-camera cut. The recording script and shot script live in the repo, ready for the next famous game.*

The finished film sits in the repo root. Six-plus minutes. Make some tea:

<video controls width="800" src="go_kamakura_final.mp4">Your player can't embed the video; open go_kamakura_final.mp4 directly.</video>

*The complete first game of the Kamakura Jubango, 1280×720, 276 moves on autoplay.*

I also learned one thing: during autoplay the camera must stay still. No swaying. A swaying board looks like an earthquake.

## Wrapping up

The last jobs were boring but necessary: git init, .gitignore, deleting the 66 debug screenshots piled in the root, persisting settings to localStorage, fixing the menu layout that the 45-game list had broken, adding a home button and a rules modal to all six games.

And HANDOFF.md, 200 lines: project overview, code structure, design rules, verification commands, every pothole. The intended reader is the next person to take this over, though so far that person has always been me in the next conversation. Every new conversation starts by reading it.

## Now

Six games, 58 famous games, import and export for three notation systems, the study toolchain, three AI levels, MIT licensed.

The gaps are on the table too: the AI is still sparring level, shogi and reversi have no famous-game library, mobile and deployment aren't done. If I keep going: Monte Carlo for Go first, opening books and transposition tables for the rest, then deployment and a tsumego bank.

But looking back, what I remember isn't the feature list. It's the shell flying out on its arc for the first time. It's 45 old games replaying 45 for 45. It's move 276 of the Kamakura Jubango landing while the camera slowly pulls back.

Next up: making the AI a little stronger. At least strong enough to stop losing to me every game.
