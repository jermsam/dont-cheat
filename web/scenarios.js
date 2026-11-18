const secret = (name, hint, correct, incorrect) => ({ name, hint, correct, incorrect });

const passages = (advantage, curse) => [
  secret(advantage, 'A correct answer earns 2 extra points.', 2, 0),
  secret(curse, 'A wrong answer or timeout costs 1 point.', 0, -1),
];

const place = (id, name, seconds, line, extras = {}) => ({
  id, name, seconds, line, art: id, ...extras,
});

export const routes = [
  [
    {
      id: 'front-door', name: 'The Front Door', seconds: 20, art: 'front-door',
      line: 'The doorman is a brass knocker with an attitude. Answer correctly and it might let you in.',
    },
    {
      id: 'flooded-archive', name: 'The Flooded Archive', seconds: 16, trivia: 3, art: 'archive',
      line: 'Cold water is creeping up the shelves. The exit will wait sixteen seconds. The water was not consulted.',
    },
    {
      id: 'velvet-casino', name: 'The Velvet Casino', seconds: 24, art: 'velvet-casino',
      line: 'The last table is still lit. The dealer has given you extra time, which feels suspiciously generous.',
    },
    place('village', 'The Village Beyond the Map', 24,
      'Every house has a candle in the window. Even the one that’s been empty for thirty years.',
      { cardBonus: 'support' }),
    place('mountains', 'The Mountain Pass', 15,
      'The pass closes when the wind changes. Your guide is a goat with very strong opinions.',
      { trivia: 3 }),
    place('underwater', 'The Drowned Kingdom', 18,
      'Beneath the water, the palace clocks are still ticking. The bubbles are giving nothing away.',
      { trivia: 3 }),
    place('palace', 'The Moon Palace', 20,
      'The marble floor is cold, the chandeliers are warm, and the royal steward is absolutely judging you.',
      { harmony: true }),
    place('forest', 'The Forest of Listening Trees', 16,
      'Something in the trees keeps repeating your whispers. At least it isn’t correcting your grammar.',
      { cardBonus: 'risk' }),
    place('home', 'The House with One Light On', 26,
      'Someone left tea out for you. It’s still warm. There are no footprints leading in.',
      { cardBonus: 'support' }),
  ],
  [
    {
      id: 'vault', name: 'The Vault', seconds: 20, art: 'vault',
      line: 'The lock just clicked twice. So did the host’s calculator.',
    },
    {
      id: 'black-chapel', name: 'The Black Chapel', seconds: 20, harmony: true, art: 'chapel',
      line: 'Two candles burn beside the altar. Keep both alive by getting the answer right together.',
      rooms: [
        secret('The Choir Loft', 'A correct answer earns 2 extra points.', 2, 0),
        secret('The Quiet Crypt', 'A wrong answer or timeout costs 2 points.', 0, -2),
        secret('The Unlit Shrine', 'Get it right for +3. Get it wrong or time out for −1.', 3, -1),
      ],
    },
    {
      id: 'glass-market', name: 'The Glass Market', seconds: 22, trivia: 3, art: 'glass-market',
      line: 'The stalls are empty. Every reflection is still trying to sell you something.',
      rooms: [
        secret('The Silver Cabinet', 'A correct answer earns 2 extra points.', 2, 0),
        secret('The Broken Mirror', 'A wrong answer or timeout costs 1 point.', 0, -1),
        secret('The Looking Glass', 'Get it right for +3. Get it wrong or time out for −1.', 3, -1),
      ],
    },
    place('snow-caves', 'The Snow Caves', 18,
      'Every footstep cracks like thunder. The host insists the ice is perfectly safe, which is new information.',
      { trivia: 3, rooms: passages('The Blue Gallery', 'The Thin-Ice Tunnel') }),
    place('shrine', 'The Shrine of Borrowed Wishes', 22,
      'The shrine grants one wish per visitor. Someone already wished for more wishes. It did not go well.',
      { cardBonus: 'support', rooms: passages('The Incense Garden', 'The Room of Unpaid Wishes') }),
    place('rooftops', 'The City Above the City', 17,
      'Nobody looks up from the street. Which is helpful, because the host brought a very conspicuous umbrella.',
      { cardBonus: 'risk', rooms: passages('The Rooftop Greenhouse', 'The Empty Elevator') }),
    place('game-park', 'The Moonlit Game Park', 22,
      'Stay near the waterhole and listen. The hyenas are laughing at something you haven’t done yet.',
      { harmony: true, rooms: passages('The Ranger’s Hide', 'The Whispering Salt Pan') }),
    place('station', 'The Silent Space Station', 19,
      'The airlock recognizes one password. You’re hoping it isn’t the name of the captain’s cat.',
      { trivia: 3, rooms: passages('The Observation Dome', 'The Sealed Cargo Bay') }),
    place('planet', 'The Planet of Two Moons', 20,
      'The first moon is rising. The second is doing something oddly sideways.',
      { cardBonus: 'risk', rooms: passages('The Crystal Reef', 'The Glass Crater') }),
  ],
  [
    {
      id: 'escape', name: 'The Escape', seconds: 12, art: 'escape',
      line: 'The getaway car is double-parked. The host is, regrettably, friends with the meter maid.',
    },
    {
      id: 'bell-bridge', name: 'The Bell Bridge', seconds: 10, trivia: 4, art: 'bell-bridge',
      line: 'One bridge. One bell. Ten seconds. Whoever designed this place had no interest in pedestrian safety.',
      rooms: [
        secret('The Ringer’s Stair', 'A correct answer earns 2 extra points.', 2, 0),
        secret('The Cracked Belfry', 'A wrong answer or timeout costs 2 points.', 0, -2),
        secret('The Lantern Alcove', 'Get it right for +2. Get it wrong or time out for −1.', 2, -1),
      ],
    },
    {
      id: 'last-train', name: 'The Last Train', seconds: 16, art: 'train',
      line: 'The train has one carriage and no conductor. At least it’s on time.',
      rooms: [
        secret('The Baggage Car', 'A correct answer earns 2 extra points.', 2, 0),
        secret('The Empty Compartment', 'A wrong answer or timeout costs 2 points.', 0, -2),
        secret('The Sleeper Cabin', 'Get it right for +3. Get it wrong or time out for −1.', 3, -1),
      ],
    },
    place('yacht', 'The Yacht Without a Flag', 15,
      'The yacht is drifting away from the city lights. The captain left two life jackets and a very pointed note.',
      { cardBonus: 'support', rooms: passages('The Captain’s Chest', 'The Locked Tender') }),
    place('airstrip', 'The Airport After Midnight', 12,
      'The board says your flight is boarding. The gate number is a question mark.',
      { trivia: 3, rooms: passages('The Pilot’s Lounge', 'The Unclaimed Baggage Room') }),
    place('wilderness', 'The Last Campfire', 16,
      'There’s one last spark in the wilderness. The host packed marshmallows, but only for himself.',
      { harmony: true, rooms: passages('The Ranger’s Cache', 'The Hollow Ravine') }),
    place('portal', 'The Island Between Worlds', 12,
      'The next island is floating. So is the bridge. The railing, for some reason, is strictly theoretical.',
      { trivia: 4, rooms: passages('The Starwell', 'The Door That Faces Itself') }),
    place('observatory', 'The Desert Observatory', 15,
      'The telescope is pointed at a star that isn’t on the chart. Something in the lens just winked.',
      { cardBonus: 'risk', rooms: passages('The Star Map Room', 'The Empty Dome') }),
    place('cathedral', 'The Cathedral Crossing', 14,
      'The last bell is about to ring. Even the gargoyles are holding their breath.',
      { harmony: true, rooms: passages('The Reliquary', 'The Stair with No Echo') }),
  ],
];

export function scenarioFor(round, id) {
  return routes[round]?.find(scenario => scenario.id === id);
}
