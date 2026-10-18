import {
  PromptRegistry,
  getCategoriesForTier,
  getShuffledPrompts,
  shufflePrompts,
} from '../data/PromptRegistry';

describe('PromptRegistry', () => {
  it('contains all 8 categories for tier_01 with 20 prompts each', () => {
    const tier1 = PromptRegistry.tier_01;
    const categories = Object.keys(tier1);
    expect(categories.length).toBe(8);

    expect(categories).toContain('genre_clash');
    expect(categories).toContain('ost_sound_design');
    expect(categories).toContain('plot_armor');
    expect(categories).toContain('studio_vs_studio');
    expect(categories).toContain('the_adaptation_test');
    expect(categories).toContain('verse_vs_verse');
    expect(categories).toContain('villain_justification');
    expect(categories).toContain('waifu_husbando_wars');

    for (const cat of categories) {
      expect(tier1[cat].length).toBe(20);
      for (const prompt of tier1[cat]) {
        expect(prompt.id).toBeDefined();
        expect(prompt.anime_a).toBeDefined();
        expect(prompt.anime_b).toBeDefined();
        expect(prompt.question).toBeDefined();
        expect(prompt.tier).toBe('tier_01');
      }
    }
  });

  it('dynamically retrieves category metadata for tier_01', () => {
    const categories = getCategoriesForTier('tier_01');
    expect(categories.length).toBe(8);
    expect(categories[0].slug).toBeDefined();
    expect(categories[0].title).toBeDefined();
    expect(categories[0].icon).toBeDefined();
  });

  it('falls back gracefully to tier_01 when tier_02 or tier_03 are queried before populated', () => {
    const tier2Categories = getCategoriesForTier('tier_02');
    expect(tier2Categories.length).toBe(8);

    const tier3Categories = getCategoriesForTier('tier_03');
    expect(tier3Categories.length).toBe(8);
  });

  it('shuffles and returns exactly the requested number of prompts', () => {
    const deck = getShuffledPrompts('tier_01', 'genre_clash', 10);
    expect(deck.length).toBe(10);
    // ensure prompts belong to genre_clash
    expect(deck[0].category).toBe('Genre Clash');
  });

  it('shufflePrompts preserves array length and elements', () => {
    const sample = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = shufflePrompts(sample);
    expect(shuffled.length).toBe(sample.length);
    for (const item of sample) {
      expect(shuffled).toContain(item);
    }
  });

  it('enforces strict Yes/No comparative questions without "Which" or "Who" and ending with "?"', () => {
    const tier1 = PromptRegistry.tier_01;
    const categories = Object.keys(tier1);

    for (const cat of categories) {
      for (const prompt of tier1[cat]) {
        const question = prompt.question.trim();
        expect(question.startsWith("Which ")).toBe(false);
        expect(question.startsWith("Who ")).toBe(false);
        expect(question.endsWith("?")).toBe(true);
      }
    }
  });
});
