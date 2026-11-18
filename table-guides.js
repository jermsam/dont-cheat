const guides = {
  chess: ['Checkmate the king.', 'The online table applies repetition and the fifty-move draw automatically.'],
  draughts: ['Capture or immobilize the other side.', 'English draughts: jumps are compulsory, and crowning ends that turn.'],
  ludo: ['Crown four pieces on the center diamond.', 'Exact finish. An opposing wall takes one consecutive six per piece.'],
  mweso: ['Relay-sow and capture the facing pits.', 'Fixed opening setup. A player can also win by capturing on two turns before the rival’s first capture.'],
  snakes: ['Reach square 100 with an exact roll.', 'Land at the foot of a ladder to climb or on a snake’s head to slide.'],
  holdem: ['Make the best five-card hand or force a fold.', 'Heads-up fixed limit, 1/2 blinds, one hand, virtual chips.'],
  poker: ['Make the best five-card hand after one draw.', 'Heads-up showdown, up to three replacements, no betting.'],
  matatu: ['Empty your hand or cut with the opening-suit seven.', 'Match the suit or rank. Twos stack draw penalties. Draw once and pass if the card cannot play.'],
  carddraft: ['Draft five cards for the best poker hand.', 'An original season event with a shared pool.'],
  spades: ['Bid and make your partnership’s contract.', '200 points, Nil and bags. Spades are always trump.'],
  hearts: ['Finish with the fewest penalty points.', 'Pass three except every fourth hand. Hearts and the queen of spades score penalties.'],
  euchre: ['Win three tricks after naming trump.', '24-card partnerships to 10. Dealer must name trump if everyone passes twice. Sweep alone to earn four points.'],
  gin: ['Meld sets and runs, then knock with at most 10 deadwood.', 'Draw then discard. Gin and undercuts earn bonuses.'],
  gofish: ['Collect the most four-card books.', 'Ask for a rank in your hand. A match lets you ask again.'],
  blackjack: ['Beat the same dealer without going over 21.', 'One hand each, hit or stand. Dealer stands on 17. No split, double or betting.'],
  cheat: ['Empty your hand by playing face down.', 'Claims advance by rank. A challenge sends the pile to the player who was wrong.'],
  president: ['Empty your hand before the other seats.', 'Match the set size and raise the rank, or pass. Finishing order affects the next hand.'],
  speed: ['Empty your hand and reserve first.', 'Both players act at once. Play one rank higher or lower on either pile. Ace wraps.'],
  ratscrew: ['Collect the entire deck.', 'Slap doubles or sandwiches. Face cards give the other player a limited number of flips.'],
  kings: ['Draw cards to reveal group prompts.', 'An alcohol-free party round with playable social prompts.'],
  pig: ['Bank 100 points.', 'Roll again or bank. A one wipes out the unbanked turn total.'],
  perudo: ['Keep your last die while others lose theirs.', 'Raise the table’s bid or challenge it. Ones count wild for other faces.'],
  ship: ['Roll ship, captain and crew, then bank cargo.', 'Lock 6, 5, 4 in order within three rolls. The other dice are cargo.'],
  farkle: ['Bank points and give the rival one final turn after 10,000.', 'First bank: 500 or more. A roll without scoring dice loses the turn’s points.'],
  yahtzee: ['Fill all 13 categories for the highest score.', 'Up to three rolls a turn, including upper-section and repeat-five bonuses.'],
  ceelo: ['Win three rolls.', '4–5–6 wins, 1–2–3 loses, and a pair makes the remaining die your point.'],
  craps: ['Outscore your rival across five pass-line turns each.', 'Make the point before a seven. Scored turns use virtual points.'],
  tenzi: ['Race to ten matching dice.', 'Hold matching faces and reroll the rest at your own pace.'],
  lcr: ['Be the last player with chips.', 'Left, center and right move chips. Dots keep them.'],
  mexicali: ['Outlast your rival by calling bluffs.', 'Roll in secret, then raise the claim or challenge the previous one.'],
};

export function tableGuide(key) {
  const guide=guides[key];
  return guide ? `<details class="table-guide"><summary>How to win</summary><p><strong>${guide[0]}</strong></p><p>${guide[1]}</p></details>` : '';
}
