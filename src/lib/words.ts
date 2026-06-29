// Common English words for word/time modes
export const COMMON_WORDS = [
  "the","be","to","of","and","a","in","that","have","I","it","for","not","on","with","he","as","you","do","at",
  "this","but","his","by","from","they","we","say","her","she","or","an","will","my","one","all","would","there",
  "their","what","so","up","out","if","about","who","get","which","go","me","when","make","can","like","time","no",
  "just","him","know","take","people","into","year","your","good","some","could","them","see","other","than",
  "then","now","look","only","come","its","over","think","also","back","after","use","two","how","our","work",
  "first","well","way","even","new","want","because","any","these","give","day","most","us","is","are","was",
  "were","been","has","had","said","made","find","place","where","much","through","before","right","while",
  "great","little","still","should","such","under","never","same","another","again","off","without","being",
  "those","might","each","might","between","both","life","world","hand","part","child","eye","woman","man",
  "thing","name","story","number","point","home","water","room","mother","area","money","fact","month","lot",
  "book","line","car","city","family","night","head","side","door","health","problem","year","game","question",
  "school","state","group","country","system","program","week","company","power","minute","kind","study","since",
  "must","try","need","feel","leave","call","keep","let","begin","seem","help","talk","turn","start","show",
];

export const QUOTES = [
  "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle.",
  "Be yourself; everyone else is already taken. The world is a book and those who do not travel read only one page.",
  "In three words I can sum up everything I've learned about life: it goes on. Live as if you were to die tomorrow.",
  "The future belongs to those who believe in the beauty of their dreams. Do not go where the path may lead.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts. Stay hungry, stay foolish.",
  "Two roads diverged in a wood, and I took the one less traveled by, and that has made all the difference.",
  "The greatest glory in living lies not in never falling, but in rising every time we fall. Hope is the thing with feathers.",
];

export function randomWords(count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)]);
  }
  return out;
}

export function randomQuote(): string {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

// Generate words emphasizing chosen letters
export function drillWords(letters: string[], count: number): string[] {
  const set = new Set(letters.map((l) => l.toLowerCase()));
  if (set.size === 0) return randomWords(count);

  const candidates = COMMON_WORDS.filter((w) =>
    [...w.toLowerCase()].some((ch) => set.has(ch)),
  );
  const heavy = candidates.filter(
    (w) => [...w.toLowerCase()].filter((ch) => set.has(ch)).length >= 2,
  );
  const pool = heavy.length > 20 ? heavy : candidates.length > 0 ? candidates : COMMON_WORDS;

  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return out;
}
