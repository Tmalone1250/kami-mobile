import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';

jest.setTimeout(15000);

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
}));

jest.mock('@privy-io/expo', () => ({
  usePrivy: () => ({
    user: { id: 'did:privy:user123', linked_accounts: [] },
  }),
}));

jest.mock('../hooks/useKamiWallet', () => ({
  useKamiWallet: () => ({
    address: '0x1234567890abcdef1234567890abcdef12345678',
  }),
}));

const mockUpsert = jest.fn().mockResolvedValue({ error: null });
const mockUpload = jest.fn().mockResolvedValue({ error: null });
const mockGetPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/new_avatar.jpg' } });

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { username: 'OtakuMaster', bio: 'Living the shonen life', avatar_url: 'https://example.com/old_avatar.jpg' },
            error: null,
          }),
        }),
      }),
      upsert: (...args: any[]) => mockUpsert(...args),
    }),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: (...args: any[]) => mockUpload(...args),
        getPublicUrl: (...args: any[]) => mockGetPublicUrl(...args),
      }),
    },
  },
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('EditProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Edit Profile screen and loads initial user profile data', async () => {
    const { getByText, getByDisplayValue } = render(<EditProfileScreen />);

    expect(getByText('Edit Profile')).toBeTruthy();
    expect(getByText('Save')).toBeTruthy();
    expect(getByText('Change Avatar')).toBeTruthy();

    await waitFor(() => {
      expect(getByDisplayValue('OtakuMaster')).toBeTruthy();
      expect(getByDisplayValue('Living the shonen life')).toBeTruthy();
    });
  });

  it('updates text fields and submits profile changes to Supabase', async () => {
    const { getByText, getByPlaceholderText } = render(<EditProfileScreen />);

    await waitFor(() => {
      expect(getByPlaceholderText('e.g. OtakuGod99')).toBeTruthy();
    });

    const usernameInput = getByPlaceholderText('e.g. OtakuGod99');
    const bioInput = getByPlaceholderText('Tell the community about your anime instincts...');

    fireEvent.changeText(usernameInput, 'GokuSuper99');
    fireEvent.changeText(bioInput, 'Power level over 9000!');

    const saveButton = getByText('Save');
    await act(async () => {
      fireEvent.press(saveButton);
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'did:privy:user123',
        username: 'GokuSuper99',
        bio: 'Power level over 9000!',
      })
    );
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('handles image picker selection and uploads to Supabase storage', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///path/to/image.jpg',
          base64: 'aGVsbG8gd29ybGQ=', // base64 encoded
        },
      ],
    });

    const { getByText } = render(<EditProfileScreen />);

    const changeAvatarBtn = getByText('Change Avatar');
    await act(async () => {
      fireEvent.press(changeAvatarBtn);
    });

    expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockGetPublicUrl).toHaveBeenCalledTimes(1);
  });
});
