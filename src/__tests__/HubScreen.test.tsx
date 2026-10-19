jest.setTimeout(25000);
import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { HubScreen, checkDailySpinsReset, getTimeUntilMidnightUtc } from "../screens/HubScreen";
import { supabase } from "../lib/supabase";

// Mock navigation
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
  useIsFocused: () => true,
}));

// Mock Privy
jest.mock("@privy-io/expo", () => ({
  usePrivy: () => ({
    user: { id: "did:privy:test_curator" },
    isReady: true,
  }),
}));

// Mock Kami Wallet
jest.mock("../hooks/useKamiWallet", () => ({
  useKamiWallet: () => ({
    address: "0x1234567890abcdef1234567890abcdef12345678",
  }),
}));

// Mock Supabase
jest.mock("../lib/supabase", () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              daily_spins_used: { tier_01: 0, tier_02: 0, tier_03: 0 },
              spins_reset_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
    }),
    rpc: jest.fn().mockResolvedValue({
      data: {
        success: true,
        remaining: 9,
        daily_spins_used: { tier_01: 1, tier_02: 0, tier_03: 0 },
      },
      error: null,
    }),
  },
}));

// Mock Haptics
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Warning: "warning" },
  ImpactFeedbackStyle: { Medium: "medium" },
}));

// Mock HubHeader
jest.mock("../components/HubHeader", () => ({
  HubHeader: () => <></>,
}));

// Mock RouletteModal
let capturedOnSelectCategory: ((cat: string) => void) | null = null;
jest.mock("../components/RouletteModal", () => ({
  RouletteModal: ({ visible, onSelectCategory }: any) => {
    capturedOnSelectCategory = onSelectCategory;
    return visible ? <></> : null;
  },
}));

// Mock Ionicons
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

describe("HubScreen & Directive 15 10-Spin Daily Caps", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("checkDailySpinsReset UTC helper", () => {
    it("resets spin counts to 0 if spins_reset_at is from a previous UTC day", () => {
      const yesterdayUtc = new Date(Date.now() - 86400000 * 2).toISOString();
      const result = checkDailySpinsReset(yesterdayUtc, { tier_01: 10, tier_02: 8, tier_03: 5 });
      expect(result).toEqual({ tier_01: 0, tier_02: 0, tier_03: 0 });
    });

    it("preserves daily spins if spins_reset_at is from the same UTC day", () => {
      const todayUtc = new Date().toISOString();
      const result = checkDailySpinsReset(todayUtc, { tier_01: 4, tier_02: 2, tier_03: 1 });
      expect(result).toEqual({ tier_01: 4, tier_02: 2, tier_03: 1 });
    });

    it("calculates time until midnight UTC cleanly", () => {
      const formatted = getTimeUntilMidnightUtc();
      expect(formatted).toMatch(/^[0-9]+h [0-9]+m$/);
    });
  });

  it("renders correctly with 10 spins remaining for standard tiers and 100% Free Play for Crucible", async () => {
    const { getByText, getAllByText } = render(<HubScreen />);

    // Title checks
    expect(getByText("Pick your power level.")).toBeTruthy();

    // Forge CTA
    expect(getByText("Forge a Hot Take")).toBeTruthy();
    expect(getByText("1 FREE DAILY")).toBeTruthy();

    // Tier Titles
    expect(getByText("Tier 1: Shonen Jump")).toBeTruthy();
    expect(getByText("Tier 2: Cult Classic")).toBeTruthy();
    expect(getByText("Tier 3: Arch-Sage")).toBeTruthy();

    // Crucible Card 100% Free Play
    expect(getByText("🔥 The Crucible: Community Arena")).toBeTruthy();
    expect(getByText("100% FREE PLAY")).toBeTruthy();
    expect(getByText("[ Unlimited Free Play ]")).toBeTruthy();

    // Spins remaining tags: 10 / 10 Spins Remaining across 3 tiers
    await waitFor(() => {
      const spinsTags = getAllByText("[ 10 / 10 Spins Remaining ]");
      expect(spinsTags.length).toBe(3);
    });
  });

  it("navigates to ForgeCreate when tapping Forge a Hot Take CTA", async () => {
    const { getByTestId } = render(<HubScreen />);
    await act(async () => {});
    const forgeCta = getByTestId("hub-forge-cta");
    fireEvent.press(forgeCta);

    expect(mockNavigate).toHaveBeenCalledWith("ForgeCreate");
  });

  it("navigates to Forge with isCrucibleMode when tapping Crucible card", async () => {
    const { getByTestId } = render(<HubScreen />);
    await act(async () => {});
    const crucibleCard = getByTestId("hub-crucible-card");
    fireEvent.press(crucibleCard);

    expect(mockNavigate).toHaveBeenCalledWith("Forge", {
      tier: "tier_01",
      category: "The Crucible",
      isCrucibleMode: true,
    });
  });

  it("consumes a daily spin and calls Supabase RPC when category is selected from roulette", async () => {
    const { getByTestId } = render(<HubScreen />);
    const tierCard = getByTestId("tier-01-card");
    fireEvent.press(tierCard);

    expect(capturedOnSelectCategory).not.toBeNull();
    await act(async () => {
      capturedOnSelectCategory!("shonen_jump_classics");
    });

    expect(supabase.rpc).toHaveBeenCalledWith("consume_daily_spin", {
      p_user_id: "did:privy:test_curator",
      p_tier: "tier_01",
    });

    expect(mockNavigate).toHaveBeenCalledWith("Forge", {
      tier: "tier_01",
      category: "shonen_jump_classics",
    });
  });

  it("blocks opening roulette and displays Daily Spin Limit Reached modal when 10 spins are exhausted", async () => {
    // Mock user with 10 spins used in Tier 1
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              daily_spins_used: { tier_01: 10, tier_02: 0, tier_03: 0 },
              spins_reset_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
    });

    const { getByTestId, getByText, findByText } = render(<HubScreen />);

    // Wait for spins to load
    await findByText("[ 0 / 10 Spins Remaining ]");

    const tierCard = getByTestId("tier-01-card");
    fireEvent.press(tierCard);

    // Verify limit modal is displayed
    expect(getByText("Daily Spin Limit Reached (10/10)")).toBeTruthy();
    expect(getByText("Resets at midnight UTC!")).toBeTruthy();

    // Verify play crucible button inside modal redirects to Crucible
    const crucibleModalBtn = getByTestId("limit-play-crucible-button");
    fireEvent.press(crucibleModalBtn);

    expect(mockNavigate).toHaveBeenCalledWith("Forge", {
      tier: "tier_01",
      category: "The Crucible",
      isCrucibleMode: true,
    });
  });
});
