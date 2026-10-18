import { searchAnime, calculatePromptTier, getTierMetadata } from '../lib/anilist';

describe('AniList Autocomplete & Tier Calculation', () => {
  describe('calculatePromptTier', () => {
    it('assigns tier_01 for mean popularity > 300,000', () => {
      expect(calculatePromptTier(780000, 512000)).toBe('tier_01');
      expect(calculatePromptTier(300001, 300001)).toBe('tier_01');
      expect(calculatePromptTier(600000, 10000)).toBe('tier_01'); // (600k + 10k) / 2 = 305k > 300k
    });

    it('assigns tier_02 for 50,000 <= mean <= 300,000', () => {
      expect(calculatePromptTier(300000, 300000)).toBe('tier_02');
      expect(calculatePromptTier(200000, 100000)).toBe('tier_02');
      expect(calculatePromptTier(50000, 50000)).toBe('tier_02');
      expect(calculatePromptTier(70000, 30000)).toBe('tier_02'); // (70k + 30k) / 2 = 50k
    });

    it('assigns tier_03 for mean popularity < 50,000', () => {
      expect(calculatePromptTier(49999, 49999)).toBe('tier_03');
      expect(calculatePromptTier(25000, 15000)).toBe('tier_03');
      expect(calculatePromptTier(0, 0)).toBe('tier_03');
    });

    it('returns proper metadata for each tier', () => {
      expect(getTierMetadata('tier_01').title).toBe('Tier 1: Shonen Jump');
      expect(getTierMetadata('tier_02').title).toBe('Tier 2: Seasonal Hits');
      expect(getTierMetadata('tier_03').title).toBe('Tier 3: Deep Cuts');
    });
  });

  describe('searchAnime', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      jest.clearAllMocks();
    });

    it('returns empty array if query has less than 2 characters without calling fetch', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      const resultEmpty = await searchAnime('');
      const resultOneChar = await searchAnime('A');
      const resultSpaces = await searchAnime('   ');

      expect(resultEmpty).toEqual([]);
      expect(resultOneChar).toEqual([]);
      expect(resultSpaces).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('successfully queries GraphQL and maps media objects', async () => {
      const mockApiResponse = {
        data: {
          Page: {
            media: [
              {
                id: 16498,
                title: { english: 'Attack on Titan', romaji: 'Shingeki no Kyojin' },
                bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498.jpg',
                coverImage: {
                  extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498.png',
                },
                popularity: 780412,
              },
              {
                id: 1575,
                title: { english: null, romaji: 'Code Geass' },
                bannerImage: null,
                coverImage: {
                  extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1575.png',
                },
                popularity: 512900,
              },
            ],
          },
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      });

      const results = await searchAnime('Titan');
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: 16498,
        title: 'Attack on Titan',
        bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498.jpg',
        coverImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498.png',
        popularity: 780412,
      });
      // Fallback to romaji title if english title is null
      expect(results[1].title).toBe('Code Geass');
      expect(results[1].bannerImage).toBeNull();
    });

    it('handles network failure gracefully and returns empty array', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const results = await searchAnime('Attack');
      expect(results).toEqual([]);
    });
  });
});
