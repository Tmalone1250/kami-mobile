export type CosmeticCategory = "border" | "banner" | "stamp";
export type CosmeticRarity = "Common" | "Rare" | "Legendary";

export interface CosmeticItem {
  id: string;
  name: string;
  category: CosmeticCategory;
  rarity: CosmeticRarity;
  price: number; // in $KAMI
  description: string;
  // Border specific
  borderColor?: string;
  borderClass?: string;
  // Banner specific
  bannerColors?: [string, string];
  // Stamp specific
  stampLeftText?: string;
  stampRightText?: string;
}

export const AVATAR_BORDERS: Record<string, CosmeticItem> = {
  default: {
    id: "default",
    name: "Default Ring",
    category: "border",
    rarity: "Common",
    price: 0,
    description: "Clean, baseline minimalist curator border.",
    borderColor: "#E2E8F0",
    borderClass: "border-2 border-slate-200 bg-white",
  },
  bronze: {
    id: "bronze",
    name: "Bronze Instinct",
    category: "border",
    rarity: "Common",
    price: 5,
    description: "Awarded to determined curating apprentices.",
    borderColor: "#D97706",
    borderClass: "border-4 border-amber-600 shadow-md",
  },
  neon_glitch: {
    id: "neon_glitch",
    name: "Neon Glitch",
    category: "border",
    rarity: "Rare",
    price: 15,
    description: "High-octane neon cyber pulse from Neo-Tokyo.",
    borderColor: "#22D3EE",
    borderClass: "border-4 border-cyan-400 shadow-lg shadow-cyan-400/40",
  },
  golden_kami: {
    id: "golden_kami",
    name: "Golden Kami",
    category: "border",
    rarity: "Legendary",
    price: 50,
    description: "A radiant aura forged for elite master curators.",
    borderColor: "#F59E0B",
    borderClass: "border-4 border-amber-400 shadow-xl shadow-amber-400/50",
  },
};

export const PROFILE_BANNERS: Record<string, CosmeticItem> = {
  mango_gradient: {
    id: "mango_gradient",
    name: "Mango Sunset",
    category: "banner",
    rarity: "Common",
    price: 0,
    description: "The signature Kami twilight sunset gradient.",
    bannerColors: ["#FF9A44", "#FFD8B5"],
  },
  cyber_tokyo: {
    id: "cyber_tokyo",
    name: "Cyber Tokyo",
    category: "banner",
    rarity: "Rare",
    price: 20,
    description: "Neon-lit skyscraper skyline soaked in midnight violet.",
    bannerColors: ["#1E1B4B", "#7C3AED"],
  },
  zen_forest: {
    id: "zen_forest",
    name: "Zen Bamboo",
    category: "banner",
    rarity: "Rare",
    price: 20,
    description: "Tranquil mist and emerald leaves from sacred shrines.",
    bannerColors: ["#064E3B", "#34D399"],
  },
  supernova_kami: {
    id: "supernova_kami",
    name: "Kami Supernova",
    category: "banner",
    rarity: "Legendary",
    price: 75,
    description: "Blinding celestial energy pulsing across space-time.",
    bannerColors: ["#831843", "#F43F5E"],
  },
};

export const SWIPE_STAMPS: Record<string, CosmeticItem> = {
  standard: {
    id: "standard",
    name: "Standard Stamp",
    category: "stamp",
    rarity: "Common",
    price: 0,
    description: "The iconic HELL YES and NOPE swipe stamps.",
    stampLeftText: "NOPE",
    stampRightText: "HELL YES",
  },
  sugoi_trash: {
    id: "sugoi_trash",
    name: "Sugoi / Trash",
    category: "stamp",
    rarity: "Rare",
    price: 10,
    description: "Express maximum hype or unfiltered disappointment.",
    stampLeftText: "TRASH",
    stampRightText: "SUGOI!",
  },
  based_cringe: {
    id: "based_cringe",
    name: "Based / Cringe",
    category: "stamp",
    rarity: "Rare",
    price: 10,
    description: "Internet culture dual arbitration.",
    stampLeftText: "CRINGE",
    stampRightText: "BASED",
  },
  god_tier_mid: {
    id: "god_tier_mid",
    name: "God Tier / Mid",
    category: "stamp",
    rarity: "Legendary",
    price: 35,
    description: "For anime critics with transcendent standards.",
    stampLeftText: "MID",
    stampRightText: "GOD TIER",
  },
};

export const getBorderCosmetic = (id?: string | null): CosmeticItem => {
  if (!id || !AVATAR_BORDERS[id]) return AVATAR_BORDERS.default;
  return AVATAR_BORDERS[id];
};

export const getBannerCosmetic = (id?: string | null): CosmeticItem => {
  if (!id || !PROFILE_BANNERS[id]) return PROFILE_BANNERS.mango_gradient;
  return PROFILE_BANNERS[id];
};

export const getStampCosmetic = (id?: string | null): CosmeticItem => {
  if (!id || !SWIPE_STAMPS[id]) return SWIPE_STAMPS.standard;
  return SWIPE_STAMPS[id];
};

export const getBorderById = getBorderCosmetic;
