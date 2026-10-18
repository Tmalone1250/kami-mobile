import { Prompt, TierKey, CategoryMeta } from '../types/forge';

// Explicit static imports for Metro bundler compatibility
import genreClash from '../../assets/categories/tier_01/genre_clash.json';
import ostSoundDesign from '../../assets/categories/tier_01/ost_sound_design.json';
import plotArmor from '../../assets/categories/tier_01/plot_armor.json';
import studioVsStudio from '../../assets/categories/tier_01/studio_vs_studio.json';
import theAdaptationTest from '../../assets/categories/tier_01/the_adaptation_test.json';
import verseVsVerse from '../../assets/categories/tier_01/verse_vs_verse.json';
import villainJustification from '../../assets/categories/tier_01/villain_justification.json';
import waifuHusbandoWars from '../../assets/categories/tier_01/waifu_husbando_wars.json';

export const CATEGORY_METADATA: Record<string, CategoryMeta> = {
  genre_clash: {
    slug: 'genre_clash',
    title: 'Genre Clash',
    icon: 'swap-horizontal',
    description: 'Pits opposing genres and storytelling tones against each other',
  },
  ost_sound_design: {
    slug: 'ost_sound_design',
    title: 'OST & Sound Design',
    icon: 'musical-notes',
    description: 'Battle of legendary soundtracks and immersive soundscapes',
  },
  plot_armor: {
    slug: 'plot_armor',
    title: 'Plot Armor',
    icon: 'shield-checkmark',
    description: 'Who survived purely through narrative convenience?',
  },
  studio_vs_studio: {
    slug: 'studio_vs_studio',
    title: 'Studio vs. Studio',
    icon: 'business',
    description: 'Production giants and legendary animation face-offs',
  },
  the_adaptation_test: {
    slug: 'the_adaptation_test',
    title: 'The Adaptation Test',
    icon: 'book',
    description: 'Manga vs. Anime fidelity, direction, and pacing showdowns',
  },
  verse_vs_verse: {
    slug: 'verse_vs_verse',
    title: 'Verse vs. Verse',
    icon: 'globe',
    description: 'Cross-universe power-scaling and squad warfare',
  },
  villain_justification: {
    slug: 'villain_justification',
    title: 'Villain Justification',
    icon: 'skull',
    description: 'Were they truly evil, or did they have a point?',
  },
  waifu_husbando_wars: {
    slug: 'waifu_husbando_wars',
    title: 'Waifu Wars',
    icon: 'heart',
    description: 'The supreme character loyalty and appeal debates',
  },
};

export const PromptRegistry: Record<TierKey, Record<string, Prompt[]>> = {
  tier_01: {
    genre_clash: genreClash as Prompt[],
    ost_sound_design: ostSoundDesign as Prompt[],
    plot_armor: plotArmor as Prompt[],
    studio_vs_studio: studioVsStudio as Prompt[],
    the_adaptation_test: theAdaptationTest as Prompt[],
    verse_vs_verse: verseVsVerse as Prompt[],
    villain_justification: villainJustification as Prompt[],
    waifu_husbando_wars: waifuHusbandoWars as Prompt[],
  },
  // Future tiers can be dropped into assets/categories/tier_02 & tier_03
  tier_02: {},
  tier_03: {},
};

/**
 * Returns available category metadata for a given tier.
 * Falls back to tier_01 if tier_02 or tier_03 have not been populated yet.
 */
export const getCategoriesForTier = (tier: TierKey): CategoryMeta[] => {
  const tierCategories = PromptRegistry[tier];
  const keys = Object.keys(tierCategories).length > 0 ? Object.keys(tierCategories) : Object.keys(PromptRegistry.tier_01);

  return keys.map((key) => {
    return (
      CATEGORY_METADATA[key] || {
        slug: key,
        title: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        icon: 'flash',
        description: 'Anime Instincts Challenge',
      }
    );
  });
};

/**
 * Pure Fisher-Yates shuffle implementation.
 */
export const shufflePrompts = <T>(array: T[]): T[] => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Fetches prompts for a tier and category, shuffles them, and returns the top `count` (default 10).
 * Falls back to tier_01 if the selected tier is not yet populated.
 */
export const getShuffledPrompts = (
  tier: TierKey,
  categorySlug: string,
  count: number = 10
): Prompt[] => {
  const tierPool = PromptRegistry[tier] && Object.keys(PromptRegistry[tier]).length > 0
    ? PromptRegistry[tier]
    : PromptRegistry.tier_01;

  const categoryPrompts = tierPool[categorySlug] || tierPool.genre_clash || Object.values(tierPool)[0] || [];

  return shufflePrompts(categoryPrompts).slice(0, count);
};
