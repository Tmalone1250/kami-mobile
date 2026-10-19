import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { HubHeader } from '../components/HubHeader';
import * as Clipboard from 'expo-clipboard';

jest.setTimeout(30000);

const mockCreate = jest.fn();
const mockLogout = jest.fn();
const mockNavigate = jest.fn();
let mockUser: any = null;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
  useIsFocused: () => true,
}));

jest.mock('@privy-io/expo', () => ({
  usePrivy: () => ({ user: mockUser, isReady: true, logout: mockLogout }),
  useEmbeddedEthereumWallet: () => ({ wallets: [], create: mockCreate }),
}));

jest.mock('../hooks/useKamiBalance', () => ({
  useKamiBalance: () => ({
    balance: 250.0,
    rawBalance: 250000000000000000000n,
    formatted: '250.00',
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
  getStringAsync: jest.fn().mockResolvedValue(''),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { username: 'KamiPro', avatar_url: 'https://example.com/avatar.jpg', kami_balance: 250.0 },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

describe('HubHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({ user: {} });
    mockLogout.mockResolvedValue(undefined);
    mockUser = {
      id: 'did:privy:1',
      linked_accounts: [
        { type: 'wallet', chain_type: 'ethereum', connector_type: 'embedded', wallet_client_type: 'privy', address: ADDRESS },
      ],
    };
  });

  it('renders header, shows wallet address and on-chain balance', async () => {
    const { getByText } = render(<HubHeader />);
    await waitFor(() => {
      expect(getByText('@KamiPro')).toBeTruthy();
      expect(getByText('250.00 $KAMI')).toBeTruthy();
    });
  });

  it('opens dropdown menu on avatar press and navigates to EditProfile', async () => {
    const { getByText, queryByText, UNSAFE_getAllByType } = render(<HubHeader />);
    await waitFor(() => expect(getByText('@KamiPro')).toBeTruthy());

    const { TouchableOpacity } = require('react-native');
    const touchables = UNSAFE_getAllByType(TouchableOpacity);

    // Initial state: menu not open
    expect(queryByText('Edit Profile')).toBeNull();

    // Tap avatar trigger
    fireEvent.press(touchables[0]);

    // Menu is open
    expect(getByText('View Profile')).toBeTruthy();
    expect(getByText('Edit Profile')).toBeTruthy();
    expect(getByText('Transfer $KAMI')).toBeTruthy();
    expect(getByText('Copy Wallet Address')).toBeTruthy();
    expect(getByText('Disconnect')).toBeTruthy();

    // Tap Edit Profile
    fireEvent.press(getByText('Edit Profile'));
    expect(mockNavigate).toHaveBeenCalledWith('EditProfile');
  });

  it('navigates to Profile screen when View Profile menu item is pressed', async () => {
    const { getByText, UNSAFE_getAllByType } = render(<HubHeader />);
    await waitFor(() => expect(getByText('@KamiPro')).toBeTruthy());

    const { TouchableOpacity } = require('react-native');
    const touchables = UNSAFE_getAllByType(TouchableOpacity);

    // Tap avatar trigger
    fireEvent.press(touchables[0]);

    // Tap View Profile
    fireEvent.press(getByText('View Profile'));

    expect(mockNavigate).toHaveBeenCalledWith('Profile');
  });

  it('navigates to Transfer screen when Transfer $KAMI menu item is pressed', async () => {
    const { getByText, UNSAFE_getAllByType } = render(<HubHeader />);
    await waitFor(() => expect(getByText('@KamiPro')).toBeTruthy());

    const { TouchableOpacity } = require('react-native');
    const touchables = UNSAFE_getAllByType(TouchableOpacity);

    // Tap avatar trigger
    fireEvent.press(touchables[0]);

    // Tap Transfer $KAMI
    fireEvent.press(getByText('Transfer $KAMI'));

    expect(mockNavigate).toHaveBeenCalledWith('Transfer');
  });

  it('navigates to Transfer screen when balance pill is pressed', async () => {
    const { getByText } = render(<HubHeader />);
    await waitFor(() => expect(getByText('250.00 $KAMI')).toBeTruthy());

    fireEvent.press(getByText('250.00 $KAMI'));

    expect(mockNavigate).toHaveBeenCalledWith('Transfer');
  });

  it('copies wallet address to clipboard on Copy Wallet Address press', async () => {
    const { getByText, UNSAFE_getAllByType } = render(<HubHeader />);
    await waitFor(() => expect(getByText('@KamiPro')).toBeTruthy());

    const { TouchableOpacity } = require('react-native');
    const touchables = UNSAFE_getAllByType(TouchableOpacity);

    // Tap avatar trigger
    fireEvent.press(touchables[0]);

    // Tap Copy Wallet Address
    await act(async () => {
      fireEvent.press(getByText('Copy Wallet Address'));
    });

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(ADDRESS);
    expect(getByText('Address copied!')).toBeTruthy();
  });

  it('calls logout on Disconnect press', async () => {
    const { getByText, UNSAFE_getAllByType } = render(<HubHeader />);
    await waitFor(() => expect(getByText('@KamiPro')).toBeTruthy());

    const { TouchableOpacity } = require('react-native');
    const touchables = UNSAFE_getAllByType(TouchableOpacity);

    // Tap avatar trigger
    fireEvent.press(touchables[0]);

    // Tap Disconnect
    await act(async () => {
      fireEvent.press(getByText('Disconnect'));
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
