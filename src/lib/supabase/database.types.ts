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
      duels: {
        Row: {
          id: string;
          code: string;
          mode_id: string;
          target_ids: string[];
          host_id: string;
          max_players: number;
          status: "lobby" | "playing" | "finished" | "cancelled";
          round_index: number;
          round_s: number;
          grace_s: number;
          round_started_at: string | null;
          round_deadline: string | null;
          version: number;
          rematch_id: string | null;
          created_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          mode_id: string;
          target_ids: string[];
          host_id: string;
          max_players?: number;
          status?: "lobby" | "playing" | "finished" | "cancelled";
          round_index?: number;
          round_s?: number;
          grace_s?: number;
          round_started_at?: string | null;
          round_deadline?: string | null;
          version?: number;
          rematch_id?: string | null;
          created_at?: string;
          finished_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["duels"]["Insert"]>;
        Relationships: [];
      };
      duel_players: {
        Row: { duel_id: string; user_id: string; seat: number; joined_at: string };
        Insert: { duel_id: string; user_id: string; seat: number; joined_at?: string };
        Update: Partial<Database["public"]["Tables"]["duel_players"]["Insert"]>;
        Relationships: [];
      };
      duel_guesses: {
        Row: {
          duel_id: string;
          round_index: number;
          user_id: string;
          lon: number | null;
          lat: number | null;
          distance_km: number | null;
          score: number;
          locked_at: string | null;
        };
        Insert: {
          duel_id: string;
          round_index: number;
          user_id: string;
          lon?: number | null;
          lat?: number | null;
          distance_km?: number | null;
          score: number;
          locked_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["duel_guesses"]["Insert"]>;
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
      create_duel: {
        Args: { p_host: string; p_mode: string; p_targets: string[]; p_round_s: number; p_grace_s: number; p_max_players: number };
        Returns: string;
      };
      configure_duel: {
        Args: { p_duel: string; p_user: string; p_targets: string[]; p_round_s: number; p_grace_s: number; p_max_players: number };
        Returns: undefined;
      };
      join_duel: {
        Args: { p_code: string; p_user: string };
        Returns: undefined;
      };
      start_duel: {
        Args: { p_duel: string; p_user: string };
        Returns: undefined;
      };
      leave_duel: {
        Args: { p_duel: string; p_user: string };
        Returns: undefined;
      };
      duel_tick: {
        Args: { p_duel: string };
        /** The database's clock. */
        Returns: string;
      };
      duel_lock: {
        Args: {
          p_duel: string;
          p_user: string;
          p_round: number;
          p_lon: number;
          p_lat: number;
          p_distance_km: number;
          p_score: number;
        };
        Returns: undefined;
      };
      duel_rematch: {
        Args: { p_duel: string; p_user: string; p_targets: string[] };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
