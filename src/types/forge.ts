export type TierKey = 'tier_01' | 'tier_02' | 'tier_03';

export type Prompt = {
  id: string;
  anime_a: string;
  anime_b: string;
  question: string;
  image_a_url: string;
  image_b_url: string;
  category?: string;
  tier?: TierKey;
  traits?: {
    swipe_right?: string;
    swipe_left?: string;
  };
  author_id?: string;
  author_username?: string;
  status?: "crucible" | "canon" | "archived";
  quality_upvotes?: number;
  trash_flags?: number;
  isCommunityPrompt?: boolean;
};

export type SwipeDirection = 'left' | 'right';

export type SwipeAnswer = {
  promptId: string;
  direction: SwipeDirection;
};

export type CategoryMeta = {
  slug: string;
  title: string;
  icon: string;
  description: string;
};
