import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ForgeCreateScreen, CATEGORIES } from '../screens/ForgeCreateScreen';
import { Alert } from 'react-native';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockSubmitRpc = jest.fn();

let mockUser: any = { id: 'did:privy:creator1' };
let mockUserData: any = {
  username: 'AnimeArchitect',
  kami_balance: 100.0,
  last_free_forge_at: null,
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
  }),
}));

jest.mock('@privy-io/expo', () => ({
  usePrivy: () => ({ user: mockUser, isReady: true }),
}));

jest.mock('../hooks/useKamiWallet', () => ({
  useKamiWallet: () => ({
    address: '0x1234567890abcdef1234567890abcdef12345678',
  }),
}));

jest.mock('../hooks/useKamiBalance', () => ({
  useKamiBalance: () => ({
    balance: 100.0,
    formatted: '100.00',
    isLoading: false,
  }),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockImplementation(() =>
            Promise.resolve({ data: mockUserData, error: null })
          ),
        }),
      }),
    }),
    rpc: (...args: any[]) => mockSubmitRpc(...args),
  },
}));

jest.mock('../lib/anilist', () => ({
  ...jest.requireActual('../lib/anilist'),
  searchAnime: jest.fn().mockImplementation(async (query: string) => {
    if (query.toLowerCase().includes('titan')) {
      return [
        {
          id: 16498,
          title: 'Attack on Titan',
          bannerImage: 'https://example.com/titan_banner.jpg',
          coverImage: 'https://example.com/titan_cover.jpg',
          popularity: 780000,
        },
      ];
    }
    if (query.toLowerCase().includes('geass')) {
      return [
        {
          id: 1575,
          title: 'Code Geass',
          bannerImage: 'https://example.com/geass_banner.jpg',
          coverImage: 'https://example.com/geass_cover.jpg',
          popularity: 512000,
        },
      ];
    }
    return [];
  }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('ForgeCreateScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserData = {
      username: 'AnimeArchitect',
      kami_balance: 100.0,
      last_free_forge_at: null, // Free daily available
    };
    mockSubmitRpc.mockResolvedValue({
      data: { id: 'comm-new-123', used_free_forge: true, kami_charged: 0, tier: 'tier_01' },
      error: null,
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders initial state with free daily forge indicator', async () => {
    const { getByText, getByTestId, findByTestId } = render(<ForgeCreateScreen />);
    await act(async () => { jest.runAllTimers(); });

    expect(getByText('The Creator Forge')).toBeTruthy();
    expect(getByText('🔥 FREE')).toBeTruthy();
    expect(getByTestId('forge-submit-button')).toBeTruthy();
  });

  it('renders all 8 official categories and allows category switching', async () => {
    const { getByText, getByTestId, findByTestId } = render(<ForgeCreateScreen />);
    await act(async () => { jest.runAllTimers(); });

    expect(CATEGORIES).toHaveLength(8);

    // All 8 categories should be present
    expect(getByText(/Genre Clash/)).toBeTruthy();
    expect(getByText(/OST & Sound Design/)).toBeTruthy();
    expect(getByText(/Plot Armor/)).toBeTruthy();
    expect(getByText(/Studio vs\. Studio/)).toBeTruthy();
    expect(getByText(/The Adaptation Test/)).toBeTruthy();
    expect(getByText(/Verse vs Verse/)).toBeTruthy();
    expect(getByText(/Villain Justification/)).toBeTruthy();
    expect(getByText(/Waifu Wars/)).toBeTruthy();

    // Select Waifu Wars
    const waifuPill = getByTestId('category-waifu_husbando_wars');
    fireEvent.press(waifuPill);

    // Select Anime A & B
    fireEvent.changeText(getByTestId('anime-a-input'), 'Titan');
    act(() => { jest.advanceTimersByTime(350); });
    fireEvent.press(await findByTestId('select-anime-a-16498'));

    fireEvent.changeText(getByTestId('anime-b-input'), 'Geass');
    act(() => { jest.advanceTimersByTime(350); });
    fireEvent.press(await findByTestId('select-anime-b-1575'));

    // Question
    fireEvent.changeText(getByTestId('question-input'), "Is Mikasa Ackerman a more devoted partner than C.C.?");

    // Submit
    await act(async () => {
      fireEvent.press(getByTestId('forge-submit-button'));
    });

    expect(mockSubmitRpc).toHaveBeenCalledWith('submit_community_prompt', expect.objectContaining({
      p_category: 'waifu_husbando_wars',
    }));
  });

  it('validates guardrails in real time and keeps button disabled until all 4 are met', async () => {
    const { getByTestId, findByTestId, getByText } = render(<ForgeCreateScreen />);
    await act(async () => { jest.runAllTimers(); });

    // 1. Search and select Anime A
    const inputA = getByTestId('anime-a-input');
    fireEvent.changeText(inputA, 'Titan');

    act(() => {
      jest.advanceTimersByTime(350); // Pass debounce
    });

    const selectA = await findByTestId('select-anime-a-16498');
    fireEvent.press(selectA);

    // 2. Search and select Anime B
    const inputB = getByTestId('anime-b-input');
    fireEvent.changeText(inputB, 'Geass');

    act(() => {
      jest.advanceTimersByTime(350); // Pass debounce
    });

    const selectB = await findByTestId('select-anime-b-1575');
    fireEvent.press(selectB);

    // Dynamic Tier Banner should now appear (mean > 300k -> Tier 1)
    expect(getByText('Tier 1: Shonen Jump')).toBeTruthy();

    const questionInput = getByTestId('question-input');

    // Rule failure: Too short (< 25 chars)
    fireEvent.changeText(questionInput, 'Is Eren cool?');

    // Rule failure: Starts with "Which"
    fireEvent.changeText(questionInput, 'Which anime has better writing and characters overall?');

    // Rule failure: Starts with "Who"
    fireEvent.changeText(questionInput, 'Who would win in an all out war between Marley and Britannia?');

    // Rule failure: Contains " or "
    fireEvent.changeText(questionInput, 'Is Eren smarter or is Lelouch vastly more strategic?');

    // Rule failure: Missing "?" at the end
    fireEvent.changeText(questionInput, 'Is Eren global genocide less justified than Lelouch Zero Requiem');

    // Valid question meeting all 4 criteria
    const validQuestion = "Is Eren's global genocide less justified than Lelouch's Zero Requiem?";
    fireEvent.changeText(questionInput, validQuestion);

    // Counter check
    expect(getByTestId('char-counter')).toBeTruthy();

    // Now submit button should be enabled and show free daily CTA
    expect(getByText('🔥 FORGE CARD INTO THE CRUCIBLE (FREE TODAY)')).toBeTruthy();
  });

  it('detects 24h cooldown and shows Overclock Mode', async () => {
    // 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    mockUserData = {
      username: 'AnimeArchitect',
      kami_balance: 100.0,
      last_free_forge_at: twoHoursAgo,
    };

    const { getByText } = render(<ForgeCreateScreen />);

    await waitFor(() => {
      expect(getByText('⚙️ 50 $KAMI')).toBeTruthy();
      expect(getByText('Free Daily Used')).toBeTruthy();
      expect(getByText('50 $KAMI')).toBeTruthy();
    });
  });

  it('submits community prompt to Supabase RPC when valid', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId, findByTestId } = render(<ForgeCreateScreen />);
    await act(async () => { jest.runAllTimers(); });

    // Select Anime A
    fireEvent.changeText(getByTestId('anime-a-input'), 'Titan');
    act(() => {
      jest.advanceTimersByTime(350);
    });
    fireEvent.press(await findByTestId('select-anime-a-16498'));

    // Select Anime B
    fireEvent.changeText(getByTestId('anime-b-input'), 'Geass');
    act(() => {
      jest.advanceTimersByTime(350);
    });
    fireEvent.press(await findByTestId('select-anime-b-1575'));

    // Input valid question
    const validQuestion = "Is Eren's global genocide less justified than Lelouch's Zero Requiem?";
    fireEvent.changeText(getByTestId('question-input'), validQuestion);

    // Press Submit
    const submitBtn = getByTestId('forge-submit-button');
    await act(async () => {
      fireEvent.press(submitBtn);
    });

    expect(mockSubmitRpc).toHaveBeenCalledWith('submit_community_prompt', {
      p_author_id: 'did:privy:creator1',
      p_author_username: 'AnimeArchitect',
      p_tier: 'tier_01',
      p_category: 'genre_clash',
      p_anime_a: 'Attack on Titan',
      p_anime_b: 'Code Geass',
      p_popularity_a: 780000,
      p_popularity_b: 512000,
      p_mean_popularity: 646000,
      p_image_a_url: 'https://example.com/titan_cover.jpg',
      p_image_b_url: 'https://example.com/geass_cover.jpg',
      p_question: validQuestion,
      p_trait_right: 'HELL YES',
      p_trait_left: 'NOPE',
    });

    expect(alertSpy).toHaveBeenCalledWith(
      '🔥 Card Forged!',
      expect.stringContaining('Your hot take has entered The Crucible arena'),
      expect.any(Array)
    );
  });
});
