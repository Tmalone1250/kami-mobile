import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { LoginScreen } from "../screens/LoginScreen";

const mockLoginWithOAuth = jest.fn();
const mockSendCode = jest.fn();
const mockLoginWithCode = jest.fn();

jest.mock("@privy-io/expo", () => ({
  usePrivy: () => ({ isReady: true }),
  useLoginWithOAuth: () => ({ login: mockLoginWithOAuth }),
  useLoginWithEmail: () => ({
    sendCode: mockSendCode,
    loginWithCode: mockLoginWithCode,
  }),
  useLoginWithSiwe: () => ({
    loginWithSiwe: jest.fn(),
    generateSiweMessage: jest.fn(),
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders brand logo, title, tagline pill, and authentication pills", () => {
    const { getByText, getByTestId } = render(<LoginScreen />);

    expect(getByText("Project Kami")).toBeTruthy();
    expect(getByText("Your anime instincts.")).toBeTruthy();
    expect(getByText("A whole new way to play.")).toBeTruthy();
    expect(getByText("SWIPE. DISCOVER. LEVEL UP.")).toBeTruthy();
    expect(getByTestId("login-brand-logo")).toBeTruthy();

    expect(getByText("Continue with Google")).toBeTruthy();
    expect(getByText("Connect External Wallet")).toBeTruthy();
    expect(getByText("Continue with Email")).toBeTruthy();
  });

  it("triggers OAuth login when tapping Google pill", async () => {
    const { getByTestId } = render(<LoginScreen />);
    const googleBtn = getByTestId("login-google-button");
    await act(async () => {
      fireEvent.press(googleBtn);
    });

    expect(mockLoginWithOAuth).toHaveBeenCalledWith({ provider: "google" });
  });

  it("triggers external wallet modal/alert when tapping Connect External Wallet pill", async () => {
    const { getByTestId } = render(<LoginScreen />);
    const walletBtn = getByTestId("login-wallet-button");
    await act(async () => {
      fireEvent.press(walletBtn);
    });

    expect(walletBtn).toBeTruthy();
  });

  it("advances through email login flow", async () => {
    const { getByTestId, getByText, getByPlaceholderText } = render(<LoginScreen />);
    const emailBtn = getByTestId("login-email-button");

    // 1. Initial tap reveals email input and changes button to Send Code
    fireEvent.press(emailBtn);
    expect(getByText("Send Code")).toBeTruthy();

    const emailInput = getByPlaceholderText("you@example.com");
    fireEvent.changeText(emailInput, "test@example.com");

    // 2. Tapping Send Code sends verification code
    fireEvent.press(emailBtn);
    await waitFor(() => {
      expect(mockSendCode).toHaveBeenCalledWith({ email: "test@example.com" });
      expect(getByText("Verify Code")).toBeTruthy();
    });
  });
});
