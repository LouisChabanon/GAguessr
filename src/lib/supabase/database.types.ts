// Mirrors supabase/migrations in the shape `supabase gen types typescript` produces.
// Regenerate with `npx supabase gen types typescript --local > src/lib/supabase/database.types.ts`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      profiles: {
        Row: { id: string; pseudo: string; created_at: string };
        Insert: { id: string; pseudo: string; created_at?: string };
        Update: { id?: string; pseudo?: string; created_at?: string };
        Relationships: [];
      };
      games: {
        Row: {
          id: string;
          user_id: string;
          mode_id: string;
          total_score: number;
          max_score: number;
          time_ms: number;
          rounds: number;
          ranking_score: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode_id: string;
          total_score: number;
          max_score: number;
          time_ms: number;
          rounds: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["games"]["Insert"]>;
        Relationships: [];
      };
      guesses: {
        Row: {
          id: number;
          game_id: string;
          mode_id: string;
          target_id: string;
          round_index: number;
          lon: number;
          lat: number;
          distance_km: number;
          score: number;
          created_at: string;
        };
        Insert: {
          game_id: string;
          mode_id: string;
          target_id: string;
          round_index: number;
          lon: number;
          lat: number;
          distance_km: number;
          score: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guesses"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      insert_game: {
        Args: { p: Json; p_min_interval: string };
        Returns: string;
      };
      leaderboard: {
        Args: { p_mode: string; p_since?: string; p_limit?: number };
        Returns: {
          rank: number;
          pseudo: string;
          ranking_score: number;
          total_score: number;
          max_score: number;
          time_ms: number;
          played_at: string;
        }[];
      };
      game_standing: {
        Args: { p_game: string };
        Returns: { percentile: number; rank: number; games: number; ranking_score: number }[];
      };
      target_stats: {
        Args: { p_mode: string; p_within_km: number };
        Returns: { target_id: string; plays: number; avg_score: number; median_km: number; within_share: number }[];
      };
      mode_guess_sample: {
        Args: { p_mode: string; p_per_target?: number };
        Returns: { target_id: string; lon: number; lat: number }[];
      };
      mode_overview: {
        Args: { p_mode: string };
        Returns: { games: number; players: number; avg_score: number | null; avg_max_score: number | null }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
