import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { TransferScreen } from "../screens/TransferScreen";
import * as Clipboard from "expo-clipboard";
import { supabase } from "../lib/supabase";

jest.setTimeout(25000);

const mockGoBack = jest.fn();
const mockSmartSendTransaction = jest.fn().mockResolvedValue("0xsmarttxhash789");
let mockCuratorScore: number | null = 1250;
let mockValidationResponse: any = { success: true, curator_score: 1250 };

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: jest.fn(),
  }),
}));

jest.mock("@privy-io/expo", () => ({
  useEmbeddedEthereumWallet: () => ({
    wallets: [
      {
        address: "0x1111111111111111111111111111111111111111",
        getProvider: jest.fn().mockResolvedValue({
          request: jest.fn().mockResolvedValue("0xtxhash123456"),
        }),
      },
    ],
  }),
  usePrivy: () => ({
    user: { id: "did:privy:user123" },
  }),
}));

jest.mock("@privy-io/expo/smart-wallets", () => ({
  useSmartWallets: () => ({
    client: {
      sendTransaction: mockSmartSendTransaction,
    },
  }),
}));

jest.mock("../hooks/useKamiWallet", () => ({
  useKamiWallet: () => ({
    address: "0x1111111111111111111111111111111111111111",
  }),
}));

jest.mock("../hooks/useKamiBalance", () => ({
  useKamiBalance: () => ({
    balance: 250.75,
    formatted: "250.75",
    refetch: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock("../lib/supabase", () => ({
  supabase: {
    from: jest.fn().mockImplementation((table: string) => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockImplementation(async () => ({
            data: { curator_score: mockCuratorScore },
            error: null,
          })),
        }),
        ilike: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockImplementation(async () => ({
            data: { curator_score: mockCuratorScore },
            error: null,
          })),
        }),
      }),
    })),
    rpc: jest.fn().mockImplementation(async (funcName: string, args: any) => {
      if (funcName === "validate_external_withdrawal") {
        return { data: mockValidationResponse, error: null };
      }
      if (funcName === "record_external_withdrawal") {
        return { data: { success: true, withdrawal_id: "mock-withdrawal-uuid" }, error: null };
      }
      return { data: null, error: null };
    }),
  },
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
  getStringAsync: jest.fn().mockResolvedValue("0x2222222222222222222222222222222222222222"),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Error: "error", Warning: "warning" },
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

describe("TransferScreen & Directive 16 Sybil Resistance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCuratorScore = 1250;
    mockValidationResponse = { success: true, curator_score: 1250 };
  });

  it("renders header, deposit section, gasless badge, and allows copying wallet address", async () => {
    const { getByText } = render(<TransferScreen />);

    expect(getByText("Back to The Hub")).toBeTruthy();
    expect(getByText("Transfer $KAMI")).toBeTruthy();
    expect(getByText("Receive $KAMI")).toBeTruthy();
    expect(getByText("0x1111111111111111111111111111111111111111")).toBeTruthy();
    expect(getByText("Gasless • Sponsored by Kami Paymaster")).toBeTruthy();

    const copyBtn = getByText("Copy Wallet Address");
    fireEvent.press(copyBtn);

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
        "0x1111111111111111111111111111111111111111"
      );
      expect(getByText("Address Copied!")).toBeTruthy();
    });
  });

  it("navigates back when Back to The Hub is tapped", () => {
    const { getByText } = render(<TransferScreen />);

    const backBtn = getByText("Back to The Hub");
    fireEvent.press(backBtn);

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it("displays available balance and populates with Max button when unlocked", async () => {
    const { getAllByText, getByText, getByPlaceholderText } = render(<TransferScreen />);

    await waitFor(() => {
      expect(getAllByText("Send $KAMI").length).toBeGreaterThanOrEqual(1);
    });
    expect(getByText("250.75 $KAMI")).toBeTruthy();

    const maxBtn = getByText("Max");
    fireEvent.press(maxBtn);

    const amountInput = getByPlaceholderText("0.00");
    expect(amountInput.props.value).toBe("250.75");
  });

  it("pastes recipient address from clipboard when unlocked", async () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(<TransferScreen />);

    await waitFor(() => {
      expect(getByTestId("send-kami-button")).toBeTruthy();
    });

    const pasteBtn = getByText("Paste");
    fireEvent.press(pasteBtn);

    await waitFor(() => {
      const recipientInput = getByPlaceholderText("0x...");
      expect(recipientInput.props.value).toBe(
        "0x2222222222222222222222222222222222222222"
      );
    });
  });

  it("locks transfer UI and disables button when curator_score < 500", async () => {
    mockCuratorScore = 200;

    const { getByText, getByTestId, queryByText } = render(<TransferScreen />);

    await waitFor(() => {
      expect(getByText("Proof of Curation Required")).toBeTruthy();
      expect(getByText("Reach 500 Curator Points to unlock external transfers.")).toBeTruthy();
      expect(getByText("Current Score: 200 PTS")).toBeTruthy();
      expect(getByText("LOCKED • REACH 500 PTS")).toBeTruthy();
    });

    const sendBtn = getByTestId("send-kami-button");
    fireEvent.press(sendBtn);

    // Verify smart wallet sendTransaction was blocked
    expect(mockSmartSendTransaction).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("validates invalid recipient address", async () => {
    const { getByText, getByTestId, getByPlaceholderText } = render(<TransferScreen />);

    await waitFor(() => {
      expect(getByTestId("send-kami-button")).toBeTruthy();
    });

    const recipientInput = getByPlaceholderText("0x...");
    fireEvent.changeText(recipientInput, "invalid-address");

    const amountInput = getByPlaceholderText("0.00");
    fireEvent.changeText(amountInput, "10");

    const sendBtn = getByTestId("send-kami-button");
    fireEvent.press(sendBtn);

    await waitFor(() => {
      expect(getByText("Please enter a valid EVM address (0x...)")).toBeTruthy();
    });
    expect(mockSmartSendTransaction).not.toHaveBeenCalled();
  });

  it("rejects transfer and displays error when destination address is already linked to another Curator", async () => {
    const collisionRecipient = "0x2222222222222222222222222222222222222222";
    mockValidationResponse = {
      success: false,
      error: "WALLET_ALREADY_LINKED",
      message:
        "Error: This external wallet is already linked to another Kami Curator. To prevent farming, you can only withdraw to your own dedicated wallet.",
    };

    const { getByTestId, getByPlaceholderText, getByText } = render(<TransferScreen />);

    await waitFor(() => {
      expect(getByTestId("send-kami-button")).toBeTruthy();
    });

    const recipientInput = getByPlaceholderText("0x...");
    fireEvent.changeText(recipientInput, collisionRecipient);

    const amountInput = getByPlaceholderText("0.00");
    fireEvent.changeText(amountInput, "50");

    const sendBtn = getByTestId("send-kami-button");
    fireEvent.press(sendBtn);

    await waitFor(() => {
      expect(
        getByText(
          "Error: This external wallet is already linked to another Kami Curator. To prevent farming, you can only withdraw to your own dedicated wallet."
        )
      ).toBeTruthy();
    });

    expect(mockSmartSendTransaction).not.toHaveBeenCalled();
  });

  it("broadcasts gasless transfer transaction and records withdrawal atomically upon success", async () => {
    const validRecipient = "0x2222222222222222222222222222222222222222";
    const { getByTestId, getByPlaceholderText, getByText } = render(<TransferScreen />);

    await waitFor(() => {
      expect(getByTestId("send-kami-button")).toBeTruthy();
    });

    const recipientInput = getByPlaceholderText("0x...");
    fireEvent.changeText(recipientInput, validRecipient);

    const amountInput = getByPlaceholderText("0.00");
    fireEvent.changeText(amountInput, "50");

    const sendBtn = getByTestId("send-kami-button");
    fireEvent.press(sendBtn);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith("validate_external_withdrawal", {
        p_user_id: "did:privy:user123",
        p_destination_address: validRecipient.toLowerCase(),
        p_amount: 50,
      });

      expect(mockSmartSendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "0xb7dE9b14742C3dbf3d4e3af83aF026Bf4CB6A9c6",
          value: 0n,
        })
      );

      expect(supabase.rpc).toHaveBeenCalledWith("record_external_withdrawal", {
        p_user_id: "did:privy:user123",
        p_destination_address: validRecipient.toLowerCase(),
        p_amount: 50,
        p_tx_hash: "0xsmarttxhash789",
      });
    });
  });
});
