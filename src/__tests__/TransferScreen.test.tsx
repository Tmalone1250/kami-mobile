import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TransferScreen } from '../screens/TransferScreen';
import * as Clipboard from 'expo-clipboard';

jest.setTimeout(15000);

const mockGoBack = jest.fn();
const mockSmartSendTransaction = jest.fn().mockResolvedValue('0xsmarttxhash789');

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: jest.fn(),
  }),
}));

jest.mock('@privy-io/expo', () => ({
  useEmbeddedEthereumWallet: () => ({
    wallets: [
      {
        address: '0x1111111111111111111111111111111111111111',
        getProvider: jest.fn().mockResolvedValue({
          request: jest.fn().mockResolvedValue('0xtxhash123456'),
        }),
      },
    ],
  }),
  usePrivy: () => ({
    user: { id: 'did:privy:user123' },
  }),
}));

jest.mock('@privy-io/expo/smart-wallets', () => ({
  useSmartWallets: () => ({
    client: {
      sendTransaction: mockSmartSendTransaction,
    },
  }),
}));

jest.mock('../hooks/useKamiWallet', () => ({
  useKamiWallet: () => ({
    address: '0x1111111111111111111111111111111111111111',
  }),
}));

jest.mock('../hooks/useKamiBalance', () => ({
  useKamiBalance: () => ({
    balance: 250.75,
    formatted: '250.75',
    refetch: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
  getStringAsync: jest.fn().mockResolvedValue('0x2222222222222222222222222222222222222222'),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('TransferScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header, deposit section, gasless badge, and allows copying wallet address', async () => {
    const { getByText } = render(<TransferScreen />);

    expect(getByText('Back to The Hub')).toBeTruthy();
    expect(getByText('Transfer $KAMI')).toBeTruthy();
    expect(getByText('Receive $KAMI')).toBeTruthy();
    expect(getByText('0x1111111111111111111111111111111111111111')).toBeTruthy();
    expect(getByText('Gasless • Sponsored by Kami Paymaster')).toBeTruthy();

    const copyBtn = getByText('Copy Wallet Address');
    fireEvent.press(copyBtn);

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
        '0x1111111111111111111111111111111111111111'
      );
      expect(getByText('Address Copied!')).toBeTruthy();
    });
  });

  it('navigates back when Back to The Hub is tapped', () => {
    const { getByText } = render(<TransferScreen />);

    const backBtn = getByText('Back to The Hub');
    fireEvent.press(backBtn);

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('displays available balance and populates with Max button', () => {
    const { getAllByText, getByText, getByPlaceholderText } = render(<TransferScreen />);

    expect(getAllByText('Send $KAMI').length).toBeGreaterThanOrEqual(1);
    expect(getByText('250.75 $KAMI')).toBeTruthy();

    const maxBtn = getByText('Max');
    fireEvent.press(maxBtn);

    const amountInput = getByPlaceholderText('0.00');
    expect(amountInput.props.value).toBe('250.75');
  });

  it('pastes recipient address from clipboard', async () => {
    const { getByText, getByPlaceholderText } = render(<TransferScreen />);

    const pasteBtn = getByText('Paste');
    fireEvent.press(pasteBtn);

    await waitFor(() => {
      const recipientInput = getByPlaceholderText('0x...');
      expect(recipientInput.props.value).toBe(
        '0x2222222222222222222222222222222222222222'
      );
    });
  });

  it('validates invalid recipient address', async () => {
    const { getByText, getByTestId, getByPlaceholderText } = render(<TransferScreen />);

    const recipientInput = getByPlaceholderText('0x...');
    fireEvent.changeText(recipientInput, 'invalid-address');

    const amountInput = getByPlaceholderText('0.00');
    fireEvent.changeText(amountInput, '10');

    const sendBtn = getByTestId('send-kami-button');
    fireEvent.press(sendBtn);

    await waitFor(() => {
      expect(getByText('Please enter a valid EVM address (0x...)')).toBeTruthy();
    });
    expect(mockSmartSendTransaction).not.toHaveBeenCalled();
  });

  it('broadcasts gasless transfer transaction through Paymaster smart wallet client', async () => {
    const validRecipient = '0x2222222222222222222222222222222222222222';
    const { getByTestId, getByPlaceholderText } = render(<TransferScreen />);

    const recipientInput = getByPlaceholderText('0x...');
    fireEvent.changeText(recipientInput, validRecipient);

    const amountInput = getByPlaceholderText('0.00');
    fireEvent.changeText(amountInput, '50');

    const sendBtn = getByTestId('send-kami-button');
    fireEvent.press(sendBtn);

    await waitFor(() => {
      expect(mockSmartSendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '0xb7dE9b14742C3dbf3d4e3af83aF026Bf4CB6A9c6',
          value: 0n,
        })
      );
    });
  });
});
