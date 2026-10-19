import { TierKey } from '../types/forge';

export type ForgeTier = TierKey;

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Forge: { tier: TierKey; category: string; isCrucibleMode?: boolean };
  ForgeCreate: undefined;
  Results: {
    tier: TierKey;
    category: string;
    answersCount: number;
    agreedCount?: number;
    baseReward: number;
    consensusBonus: number;
    tierMultiplier: number;
    totalEarned: number;
    isCrucibleMode?: boolean;
  };
  EditProfile: undefined;
  Transfer: undefined;
  Profile: { userId?: string } | undefined;
};
