import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { ProfileScreen } from "../screens/ProfileScreen";
import * as Clipboard from "expo-clipboard";
import { Alert } from "react-native";

jest.setTimeout(15000);

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: any = {};
let mockUser: any = null;

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: mockRouteParams,
  }),
  useIsFocused: () => true,
}));

jest.mock("@privy-io/expo", () => ({
  usePrivy: () => ({ user: mockUser, isReady: true }),
}));

jest.mock("../hooks/useKamiWallet", () => ({
  useKamiWallet: () => ({
    address: "0x1234567890abcdef1234567890abcdef12345678",
    embeddedAddress: "0x1234567890abcdef1234567890abcdef12345678",
    smartWalletAddress: "0x1234567890abcdef1234567890abcdef12345678",
  }),
}));

jest.mock("../hooks/useKamiBalance", () => ({
  useKamiBalance: () => ({
    balance: 15.5,
    formatted: "15.50",
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("react-native-svg", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: View,
    Defs: View,
    LinearGradient: View,
    Stop: View,
    Rect: View,
    Svg: View,
  };
});

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

const mockUserData = {
  id: "did:privy:user1",
  username: "OtakuKing",
  bio: "Master of Shonen Anime and Kami Curating",
  avatar_url: "https://example.com/avatar.jpg",
  wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
  kami_balance: 15.5,
  lifetime_earned_kami: 15.5,
  global_rank: 1,
  curator_score: 430,
  total_swipes: 42,
  prompts_forged: 3,
  creator_swipes_received: 28,
  dominant_trait: "🔥 The Shonen Purist",
  equipped_border: "golden_kami",
  equipped_banner: "mango_gradient",
  equipped_stamp: "standard",
  current_streak: 5,
};

const todayStr = new Date().toISOString().slice(0, 10);
const d1 = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const d2 = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10);
const d3 = new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10);

const mockSwipesData = [
  { agreed_with_consensus: true, created_at: todayStr + "T10:00:00Z", prompt_id: "gc_01", swipe_direction: "right" },
  { agreed_with_consensus: true, created_at: d1 + "T10:00:00Z", prompt_id: "gc_02", swipe_direction: "left" },
  { agreed_with_consensus: false, created_at: d2 + "T10:00:00Z", prompt_id: "gc_03", swipe_direction: "right" },
  { agreed_with_consensus: true, created_at: d3 + "T10:00:00Z", prompt_id: "gc_04", swipe_direction: "left" },
];

const mockCommunityPromptsData = [
  {
    id: "cp-1",
    question: "Does Okarin suffer more than Subaru?",
    status: "crucible",
    yes_votes: 15,
    no_votes: 5,
    quality_upvotes: 8,
    trash_flags: 2,
    created_at: todayStr + "T12:00:00Z",
  },
];

jest.mock("../lib/supabase", () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === "curator_leaderboard" || table === "users") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: mockUserData,
                error: null,
              }),
            }),
            or: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: mockUserData,
                error: null,
              }),
            }),
            gt: jest.fn().mockResolvedValue({
              count: 0,
              error: null,
            }),
          }),
        };
      }
      if (table === "swipes") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockSwipesData,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "community_prompts") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: mockCommunityPromptsData,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    }),
  },
}));

describe("ProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
    mockUser = { id: "did:privy:user1" };
  });

  it("renders own profile with username, trait, bento grid and equipped loadout", async () => {
    const { getByTestId, getByText } = render(<ProfileScreen />);

    await waitFor(() => {
      expect(getByTestId("profile-username")).toBeTruthy();
      expect(getByText("@OtakuKing")).toBeTruthy();
      expect(getByText("🔥 The Shonen Purist")).toBeTruthy();
      expect(getByText("Master of Shonen Anime and Kami Curating")).toBeTruthy();
    });

    // Curation Stats Bento Grid
    expect(getByText("75%")).toBeTruthy(); // 3 out of 4 agreed = 75%
    expect(getByText("42")).toBeTruthy(); // total swipes
    expect(getByText("4 Days")).toBeTruthy(); // streak
    expect(getByText("#1")).toBeTruthy(); // global rank
    expect(getByText("430 Pts • 15.50 $KAMI")).toBeTruthy(); // curator score & lifetime earned

    // Equipped loadout slots
    expect(getByText("Golden Kami")).toBeTruthy();
    expect(getByText("Mango Sunset")).toBeTruthy();
    expect(getByText("Standard Stamp")).toBeTruthy();
    expect(getByTestId("profile-edit-button")).toBeTruthy();
  });

  it("renders Architect Studio with stats and navigates to ForgeCreate when forge button is tapped", async () => {
    const { getByTestId, getByText } = render(<ProfileScreen />);

    await waitFor(() => {
      expect(getByText("Architect Studio")).toBeTruthy();
    });

    // Architect stats
    expect(getByText("3")).toBeTruthy(); // Prompts Forged
    expect(getByText("Cards Created")).toBeTruthy();
    expect(getByText("28")).toBeTruthy(); // Swipes Received
    expect(getByText("Swipes Received")).toBeTruthy();

    // User forged card
    expect(getByText("Does Okarin suffer more than Subaru?")).toBeTruthy();
    expect(getByText("🔥 IN CRUCIBLE")).toBeTruthy();
    expect(getByText(/YES 75%/)).toBeTruthy(); // 15 / 20 = 75%
    expect(getByText(/NO 25%/)).toBeTruthy();
    expect(getByText("20 swipes")).toBeTruthy();

    // Tap Forge New Prompt
    const forgeBtn = getByTestId("architect-forge-button");
    fireEvent.press(forgeBtn);
    expect(mockNavigate).toHaveBeenCalledWith("ForgeCreate");
  });

  it("copies wallet address to clipboard on tap", async () => {
    const { getByTestId, getByText } = render(<ProfileScreen />);
    await waitFor(() => expect(getByText("@OtakuKing")).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId("profile-wallet-pill"));
    });

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      "0x1234567890abcdef1234567890abcdef12345678"
    );
    expect(getByText("Address copied to clipboard!")).toBeTruthy();
  });

  it("navigates to EditProfile when Edit button is tapped", async () => {
    const { getByTestId, getByText } = render(<ProfileScreen />);
    await waitFor(() => expect(getByText("@OtakuKing")).toBeTruthy());

    fireEvent.press(getByTestId("profile-edit-button"));
    expect(mockNavigate).toHaveBeenCalledWith("EditProfile");
  });

  it("navigates to Shop tab when loadout slots are pressed", async () => {
    const { getByTestId, getByText } = render(<ProfileScreen />);
    await waitFor(() => expect(getByText("@OtakuKing")).toBeTruthy());

    fireEvent.press(getByTestId("slot-border"));
    expect(mockNavigate).toHaveBeenCalledWith("Main", { screen: "Shop" });

    fireEvent.press(getByTestId("slot-banner"));
    expect(mockNavigate).toHaveBeenCalledWith("Main", { screen: "Shop" });

    fireEvent.press(getByTestId("slot-stamp"));
    expect(mockNavigate).toHaveBeenCalledWith("Main", { screen: "Shop" });
  });

  it("renders another user profile and shows Challenge button", async () => {
    mockRouteParams = { userId: "did:privy:rival99" };
    const alertSpy = jest.spyOn(Alert, "alert");

    const { getByTestId, queryByTestId, getByText } = render(<ProfileScreen />);
    await waitFor(() => expect(getByText("@OtakuKing")).toBeTruthy());

    expect(queryByTestId("profile-edit-button")).toBeNull();
    expect(getByTestId("profile-challenge-button")).toBeTruthy();

    fireEvent.press(getByTestId("profile-challenge-button"));
    expect(alertSpy).toHaveBeenCalledWith(
      "Async Social Challenge",
      expect.stringContaining("Challenge invitation sent to @OtakuKing"),
      expect.any(Array)
    );
  });

  it("navigates back when back button is pressed", async () => {
    const { getByTestId, getByText } = render(<ProfileScreen />);
    await waitFor(() => expect(getByText("@OtakuKing")).toBeTruthy());

    fireEvent.press(getByTestId("profile-back-button"));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
