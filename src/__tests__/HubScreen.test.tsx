import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HubScreen } from '../screens/HubScreen';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
}));

// Mock the HubHeader
jest.mock('../components/HubHeader', () => ({
  HubHeader: () => <></>,
}));

// Mock the RouletteModal to isolate HubScreen
jest.mock('../components/RouletteModal', () => ({
  RouletteModal: () => <></>,
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('HubScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly and displays all three tiers plus crucible card and forge CTA', () => {
    const { getByText, getAllByText, getByTestId } = render(<HubScreen />);

    // Title checks
    expect(getByText('Pick your power level.')).toBeTruthy();
    expect(getByText('A new challenge. A little more legendary.')).toBeTruthy();

    // Forge a Hot Take CTA
    expect(getByText('Forge a Hot Take')).toBeTruthy();
    expect(getByText('1 Free Daily • Earn Architect Rank')).toBeTruthy();

    // Tier titles
    expect(getByText('Tier 1: Shonen Jump')).toBeTruthy();
    expect(getByText('Tier 2: Cult Classic')).toBeTruthy();
    expect(getByText('Tier 3: Arch-Sage')).toBeTruthy();

    // Crucible Card
    expect(getByText('🔥 The Crucible: Community Arena')).toBeTruthy();
    expect(getByText('1.2x MULTIPLIER')).toBeTruthy();

    // Spins remaining tags
    const spinsTags = getAllByText('[ 5 / 5 Spins Remaining ]');
    expect(spinsTags.length).toBe(3); // Standard 3 tiers
  });

  it('navigates to ForgeCreate when tapping Forge a Hot Take CTA', () => {
    const { getByTestId } = render(<HubScreen />);
    const forgeCta = getByTestId('hub-forge-cta');
    fireEvent.press(forgeCta);

    expect(mockNavigate).toHaveBeenCalledWith('ForgeCreate');
  });

  it('navigates to Forge with isCrucibleMode when tapping Crucible card', () => {
    const { getByTestId } = render(<HubScreen />);
    const crucibleCard = getByTestId('hub-crucible-card');
    fireEvent.press(crucibleCard);

    expect(mockNavigate).toHaveBeenCalledWith('Forge', {
      tier: 'tier_01',
      category: 'The Crucible',
      isCrucibleMode: true,
    });
  });
});
