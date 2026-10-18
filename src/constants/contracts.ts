import { parseAbi } from 'viem';

export const KAMI_TOKEN_ADDRESS = (process.env.EXPO_PUBLIC_KAMI_TOKEN_ADDRESS ||
  '0xb7dE9b14742C3dbf3d4e3af83aF026Bf4CB6A9c6') as `0x${string}`;

export const BASE_SEPOLIA_RPC =
  process.env.EXPO_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org';

export const KAMI_TOKEN_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function distributeReward(address player, uint256 amount) external',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);
