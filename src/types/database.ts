export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      community_prompt_votes: {
        Row: {
          id: string;
          prompt_id: string;
          user_id: string;
          swipe_direction: "left" | "right";
          quality_vote: "up" | "trash" | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          prompt_id: string;
          user_id: string;
          swipe_direction: "left" | "right";
          quality_vote?: "up" | "trash" | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          prompt_id?: string;
          user_id?: string;
          swipe_direction?: "left" | "right";
          quality_vote?: "up" | "trash" | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_prompt_votes_prompt_id_fkey";
            columns: ["prompt_id"];
            isOneToOne: false;
            referencedRelation: "community_prompts";
            referencedColumns: ["id"];
          }
        ];
      };
      community_prompts: {
        Row: {
          id: string;
          author_id: string;
          author_username: string;
          tier: string;
          category: string;
          anime_a: string;
          anime_b: string;
          popularity_a: number;
          popularity_b: number;
          mean_popularity: number;
          image_a_url: string;
          image_b_url: string;
          question: string;
          trait_right: string;
          trait_left: string;
          yes_votes: number;
          no_votes: number;
          total_swipes: number;
          quality_upvotes: number;
          trash_flags: number;
          status: "crucible" | "canon" | "archived";
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          author_username: string;
          tier?: string;
          category: string;
          anime_a: string;
          anime_b: string;
          popularity_a?: number;
          popularity_b?: number;
          mean_popularity?: number;
          image_a_url: string;
          image_b_url: string;
          question: string;
          trait_right?: string;
          trait_left?: string;
          yes_votes?: number;
          no_votes?: number;
          quality_upvotes?: number;
          trash_flags?: number;
          status?: "crucible" | "canon" | "archived";
          created_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          author_username?: string;
          tier?: string;
          category?: string;
          anime_a?: string;
          anime_b?: string;
          popularity_a?: number;
          popularity_b?: number;
          mean_popularity?: number;
          image_a_url?: string;
          image_b_url?: string;
          question?: string;
          trait_right?: string;
          trait_left?: string;
          yes_votes?: number;
          no_votes?: number;
          quality_upvotes?: number;
          trash_flags?: number;
          status?: "crucible" | "canon" | "archived";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_prompts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      users: {
        Row: {
          id: string;
          wallet_address: string | null;
          kami_balance: number;
          lifetime_earned_kami: number;
          total_swipes: number;
          username: string | null;
          avatar_url: string | null;
          bio: string | null;
          dominant_trait: string | null;
          equipped_border: string | null;
          equipped_banner: string | null;
          equipped_stamp: string | null;
          current_streak: number | null;
          prompts_forged: number;
          creator_swipes_received: number;
          last_free_forge_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          wallet_address?: string | null;
          kami_balance?: number;
          lifetime_earned_kami?: number;
          total_swipes?: number;
          username?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          dominant_trait?: string | null;
          equipped_border?: string | null;
          equipped_banner?: string | null;
          equipped_stamp?: string | null;
          current_streak?: number | null;
          prompts_forged?: number;
          creator_swipes_received?: number;
          last_free_forge_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          wallet_address?: string | null;
          kami_balance?: number;
          lifetime_earned_kami?: number;
          total_swipes?: number;
          username?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          dominant_trait?: string | null;
          equipped_border?: string | null;
          equipped_banner?: string | null;
          equipped_stamp?: string | null;
          current_streak?: number | null;
          prompts_forged?: number;
          creator_swipes_received?: number;
          last_free_forge_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      prompt_stats: {
        Row: {
          prompt_id: string;
          total_swipes: number;
          left_swipes: number;
          right_swipes: number;
          consensus_direction: 'left' | 'right' | 'tie' | null;
          consensus_percentage: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          prompt_id: string;
          total_swipes?: number;
          left_swipes?: number;
          right_swipes?: number;
          consensus_direction?: 'left' | 'right' | 'tie' | null;
          consensus_percentage?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          prompt_id?: string;
          total_swipes?: number;
          left_swipes?: number;
          right_swipes?: number;
          consensus_direction?: 'left' | 'right' | 'tie' | null;
          consensus_percentage?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      swipes: {
        Row: {
          id: string;
          user_id: string;
          prompt_id: string;
          swipe_direction: 'left' | 'right';
          agreed_with_consensus: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          prompt_id: string;
          swipe_direction: 'left' | 'right';
          agreed_with_consensus?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          prompt_id?: string;
          swipe_direction?: 'left' | 'right';
          agreed_with_consensus?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'swipes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      curator_leaderboard: {
        Row: {
          id: string;
          wallet_address: string | null;
          username: string;
          avatar_url: string | null;
          dominant_trait: string;
          equipped_border: string;
          equipped_banner: string;
          equipped_stamp: string;
          kami_balance: number;
          lifetime_earned_kami: number;
          total_swipes: number;
          current_streak: number;
          prompts_forged: number;
          creator_swipes_received: number;
          curator_score: number;
          architect_score: number;
          global_rank: number;
          architect_rank: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      submit_community_prompt: {
        Args: {
          p_author_id: string;
          p_author_username: string;
          p_tier: string;
          p_category: string;
          p_anime_a: string;
          p_anime_b: string;
          p_popularity_a: number;
          p_popularity_b: number;
          p_mean_popularity: number;
          p_image_a_url: string;
          p_image_b_url: string;
          p_question: string;
          p_trait_right?: string;
          p_trait_left?: string;
        };
        Returns: {
          id: string;
          used_free_forge: boolean;
          kami_charged: number;
          tier: string;
        };
      };
      record_community_swipe_and_quality: {
        Args: {
          p_user_id: string;
          p_prompt_id: string;
          p_swipe_direction: string;
          p_quality_vote?: string | null;
        };
        Returns: {
          consensus_percentage: number;
          total_swipes: number;
          status: string;
        };
      };
      record_swipe_and_get_consensus: {
        Args: {
          p_user_id: string;
          p_prompt_id: string;
          p_swipe_direction: string;
        };
        Returns: {
          consensus_percentage: number;
          agreed_with_majority: boolean;
          majority_direction: 'left' | 'right' | 'tie';
          total_swipes: number;
        };
      };
      claim_kami_rewards: {
        Args: {
          p_user_id: string;
          p_reward_amount: number;
        };
        Returns: {
          success: boolean;
          new_balance: number;
        };
      };
    };
  };
}
