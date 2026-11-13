/*
 * questions.js - OCEAN QUESTION BANK
 * ----------------------------------
 * HIGH COHESION: this file only stores and serves ocean / aqua general-knowledge
 * questions, sorted by difficulty (easy -> medium -> hard). Levels 1-2 use "easy",
 * levels 3-4 use "medium", levels 5-6 use "hard" (see GameRules.CONFIG.levels).
 *
 * Each question is written as: the correct answer plus three wrong ones. The
 * options are shuffled every time, and we work out which position the correct
 * answer ended up in. Questions do not repeat until the whole pool has been used.
 *
 * Design note (for the video): I wrote a curated local bank instead of calling a
 * general trivia web service, because general services have no "ocean" category
 * and I wanted the questions to really be about the ocean.
 *
 * Code origin: generated with Claude (Anthropic), then read, checked and adapted
 * by me. (Student: add some questions of your own and say so here.)
 */
const QuestionBank = {
  data: {
    easy: [
      { text: 'Which is the largest ocean on Earth?', correct: 'Pacific Ocean', wrong: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'] },
      { text: 'Which animal is the largest on Earth?', correct: 'Blue whale', wrong: ['Great white shark', 'African elephant', 'Giant squid'] },
      { text: 'Which of these sea animals is a mammal?', correct: 'Dolphin', wrong: ['Shark', 'Tuna', 'Seahorse'] },
      { text: 'How many arms does an octopus have?', correct: '8', wrong: ['6', '10', '12'] },
      { text: 'Which sea creature has a hard shell and walks sideways?', correct: 'Crab', wrong: ['Starfish', 'Jellyfish', 'Eel'] },
      { text: 'Ocean water tastes...', correct: 'Salty', wrong: ['Sweet', 'Sour', 'Bitter like lemon'] },
      { text: 'Which of these is NOT a fish?', correct: 'Jellyfish', wrong: ['Clownfish', 'Salmon', 'Tuna'] },
      { text: 'What do fish use to breathe underwater?', correct: 'Gills', wrong: ['Lungs', 'A nose', 'Hair'] },
      { text: 'A large group of fish swimming together is called a...', correct: 'School', wrong: ['Herd', 'Flock', 'Pack'] },
      { text: 'Where do sea turtles lay their eggs?', correct: 'On sandy beaches', wrong: ['In seaweed', 'Inside coral', 'On the sea floor'] },
      { text: 'About how much of the Earth\'s surface is covered by water?', correct: '70%', wrong: ['30%', '50%', '90%'] },
      { text: 'Clownfish live safely among the tentacles of which animal?', correct: 'Sea anemone', wrong: ['Octopus', 'Sea urchin', 'Starfish'] }
    ],
    medium: [
      { text: 'Which is the smallest ocean?', correct: 'Arctic Ocean', wrong: ['Indian Ocean', 'Atlantic Ocean', 'Southern Ocean'] },
      { text: 'The deepest point in the world\'s oceans is in which trench?', correct: 'Mariana Trench', wrong: ['Puerto Rico Trench', 'Java Trench', 'Peru-Chile Trench'] },
      { text: 'Coral reefs are built by tiny animals called...', correct: 'Polyps', wrong: ['Plankton', 'Barnacles', 'Sponges'] },
      { text: 'Which warm ocean current helps keep Western Europe mild?', correct: 'Gulf Stream', wrong: ['Humboldt Current', 'Benguela Current', 'Labrador Current'] },
      { text: 'What is the main cause of ocean tides?', correct: 'The Moon\'s gravity', wrong: ['Strong winds', 'Whales swimming', 'River water flowing in'] },
      { text: 'How many hearts does an octopus have?', correct: '3', wrong: ['1', '2', '4'] },
      { text: 'What is the sunlit upper layer of the ocean, where most sea life lives, called?', correct: 'Epipelagic zone', wrong: ['Bathypelagic zone', 'Abyssopelagic zone', 'Hadal zone'] },
      { text: 'Tiny ocean plants called phytoplankton produce which gas that we breathe?', correct: 'Oxygen', wrong: ['Nitrogen', 'Methane', 'Helium'] },
      { text: 'What do we call the place where a river meets the sea?', correct: 'Estuary', wrong: ['Lagoon', 'Delta ridge', 'Fjord wall'] },
      { text: 'Which is the largest fish in the ocean?', correct: 'Whale shark', wrong: ['Great white shark', 'Blue marlin', 'Manta ray'] },
      { text: 'Which sea lies between Europe and Africa?', correct: 'Mediterranean Sea', wrong: ['Baltic Sea', 'Caribbean Sea', 'Arabian Sea'] },
      { text: 'Where is the Great Barrier Reef, the world\'s largest coral reef system?', correct: 'Off the coast of Australia', wrong: ['Off the coast of Brazil', 'Off the coast of Japan', 'Off the coast of South Africa'] }
    ],
    hard: [
      { text: 'Roughly how deep is the Challenger Deep, the deepest known point of the ocean?', correct: 'About 11,000 metres', wrong: ['About 3,000 metres', 'About 6,000 metres', 'About 16,000 metres'] },
      { text: 'What was the huge ancient ocean that surrounded the supercontinent Pangaea called?', correct: 'Panthalassa', wrong: ['Tethys', 'Iapetus', 'Pontus'] },
      { text: 'What do we call the lowering of the sea\'s pH as it absorbs extra carbon dioxide?', correct: 'Ocean acidification', wrong: ['Eutrophication', 'Salinisation', 'Upwelling'] },
      { text: 'Which zone of the ocean, about 1,000 to 4,000 m deep, is called the "midnight zone"?', correct: 'Bathypelagic zone', wrong: ['Epipelagic zone', 'Mesopelagic zone', 'Littoral zone'] },
      { text: 'Corals lose their colour (bleach) when they expel which algae living inside them?', correct: 'Zooxanthellae', wrong: ['Diatoms', 'Kelp spores', 'Dinoflagellate blooms'] },
      { text: 'Deep ocean circulation (thermohaline circulation) is driven by differences in what?', correct: 'Temperature and salinity', wrong: ['Wind and rainfall', 'Tides and waves', 'Depth and pressure'] },
      { text: 'The Sargasso Sea is unique because it has no what?', correct: 'Coastline', wrong: ['Fish', 'Salt', 'Waves'] },
      { text: 'What is the rising of cold, nutrient-rich deep water to the surface called?', correct: 'Upwelling', wrong: ['Downwelling', 'Stratification', 'Convection tide'] },
      { text: 'The El Nino climate pattern is a warming of surface water in which ocean?', correct: 'Tropical Pacific Ocean', wrong: ['North Atlantic Ocean', 'Southern Ocean', 'Arctic Ocean'] },
      { text: 'Hydrothermal vents on the sea floor are mostly found along which features?', correct: 'Mid-ocean ridges', wrong: ['Continental shelves', 'Coral atolls', 'River deltas'] },
      { text: 'What is a ring-shaped coral reef surrounding a lagoon called?', correct: 'Atoll', wrong: ['Fjord', 'Seamount', 'Barrier spit'] }
    ]
  },

  unused: {},   // difficulty -> questions not yet asked in this round

  shuffle(list) {
    // Fisher-Yates shuffle: a fair way to mix up a list.
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  },

  // Returns { type, text, options, answerIndex } for the given difficulty.
  next(difficulty) {
    if (!this.unused[difficulty] || this.unused[difficulty].length === 0) {
      this.unused[difficulty] = this.shuffle(this.data[difficulty]);
    }
    const q = this.unused[difficulty].pop();
    const options = this.shuffle([q.correct].concat(q.wrong));
    return {
      type: 'choice',
      text: q.text,
      options: options,
      answerIndex: options.indexOf(q.correct)
    };
  }
};
