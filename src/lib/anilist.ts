import { TierKey } from '../types/forge';

export interface AniListSearchResult {
  id: number;
  title: string;
  bannerImage: string | null;
  coverImage: string;
  popularity: number;
}

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

const SEARCH_QUERY = `
  query ($search: String) {
    Page(page: 1, perPage: 5) {
      media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
        id
        title {
          english
          romaji
        }
        bannerImage
        coverImage {
          extraLarge
          large
        }
        popularity
      }
    }
  }
`;

/**
 * Searches AniList for anime by query string.
 * Returns up to 5 matching anime sorted by popularity.
 * Requires minimum 2 characters; otherwise returns empty array.
 */
export async function searchAnime(query: string): Promise<AniListSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  try {
    const response = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: SEARCH_QUERY,
        variables: { search: trimmed },
      }),
    });

    if (!response.ok) {
      console.warn('AniList API error status:', response.status);
      return [];
    }

    const data = await response.json();
    const mediaList = data?.data?.Page?.media || [];

    return mediaList.map((m: any) => ({
      id: m.id,
      title: m.title?.english || m.title?.romaji || 'Unknown Anime',
      bannerImage: m.bannerImage || null,
      coverImage: m.coverImage?.extraLarge || m.coverImage?.large || '',
      popularity: m.popularity || 0,
    }));
  } catch (error) {
    console.warn('Failed to query AniList API:', error);
    return [];
  }
}

/**
 * Calculates the prompt tier based on the arithmetic mean popularity of Anime A and Anime B:
 * - Mean > 300,000 -> 'tier_01' (Shonen Jump / Mainstream)
 * - 50,000 <= Mean <= 300,000 -> 'tier_02' (Seasonal Hits)
 * - Mean < 50,000 -> 'tier_03' (Deep Cuts)
 */
export function calculatePromptTier(popA: number, popB: number): TierKey {
  const mean = (popA + popB) / 2;
  if (mean > 300000) {
    return 'tier_01';
  }
  if (mean >= 50000) {
    return 'tier_02';
  }
  return 'tier_03';
}

export function getTierMetadata(tier: TierKey): { title: string; subtitle: string; multiplier: number } {
  switch (tier) {
    case 'tier_01':
      return { title: 'Tier 1: Shonen Jump', subtitle: 'Mainstream Titans', multiplier: 1.0 };
    case 'tier_02':
      return { title: 'Tier 2: Seasonal Hits', subtitle: 'Modern Fan Favorites', multiplier: 1.5 };
    case 'tier_03':
      return { title: 'Tier 3: Deep Cuts', subtitle: 'Niche & Cult Classics', multiplier: 2.0 };
  }
}
