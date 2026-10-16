export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      board_strokes: {
        Row: {
          board_id: string;
          color: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          household_id: string;
          id: string;
          points: NonNullable<Json>;
          width: number;
        };
        ComputedFields: never;
        Insert: {
          board_id: string;
          color: string;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          household_id: string;
          id?: string;
          points: NonNullable<Json>;
          width: number;
        };
        Update: {
          board_id?: string;
          color?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          household_id?: string;
          id?: string;
          points?: NonNullable<Json>;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: "board_strokes_board_fkey";
            columns: ["board_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      boards: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          household_id: string;
          id?: string;
          name?: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "boards_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: true;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      household_children: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          household_id: string;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          household_id: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          household_id?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_children_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      household_invites: {
        Row: {
          code: string;
          created_at: string;
          created_by: string;
          expires_at: string;
          household_id: string;
          id: string;
          max_uses: number;
          use_count: number;
        };
        ComputedFields: never;
        Insert: {
          code?: string;
          created_at?: string;
          created_by: string;
          expires_at?: string;
          household_id: string;
          id?: string;
          max_uses?: number;
          use_count?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          household_id?: string;
          id?: string;
          max_uses?: number;
          use_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      household_members: {
        Row: {
          household_id: string;
          joined_at: string;
          role: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          household_id: string;
          joined_at?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          household_id?: string;
          joined_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      households: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      meal_plan_entries: {
        Row: {
          created_at: string;
          created_by: string;
          date: string;
          deleted_at: string | null;
          household_id: string;
          id: string;
          on_shopping_list_at: string | null;
          position: number;
          recipe_id: string | null;
          skipped_at: string | null;
          slot: string;
          title: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          date: string;
          deleted_at?: string | null;
          household_id: string;
          id?: string;
          on_shopping_list_at?: string | null;
          position?: number;
          recipe_id?: string | null;
          skipped_at?: string | null;
          slot: string;
          title?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          date?: string;
          deleted_at?: string | null;
          household_id?: string;
          id?: string;
          on_shopping_list_at?: string | null;
          position?: number;
          recipe_id?: string | null;
          skipped_at?: string | null;
          slot?: string;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "meal_plan_entries_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_plan_entries_recipe_fkey";
            columns: ["recipe_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      meal_reactions: {
        Row: {
          child_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          entry_id: string;
          household_id: string;
          id: string;
          reaction: string;
        };
        ComputedFields: never;
        Insert: {
          child_id: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          entry_id: string;
          household_id: string;
          id?: string;
          reaction: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          entry_id?: string;
          household_id?: string;
          id?: string;
          reaction?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meal_reactions_child_fkey";
            columns: ["child_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_children";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "meal_reactions_entry_fkey";
            columns: ["entry_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "meal_plan_entries";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      recipes: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          household_id: string;
          id: string;
          ingredients: NonNullable<Json>;
          instructions: string;
          kids_version: string | null;
          servings: string | null;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          household_id: string;
          id?: string;
          ingredients?: NonNullable<Json>;
          instructions?: string;
          kids_version?: string | null;
          servings?: string | null;
          title: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          household_id?: string;
          id?: string;
          ingredients?: NonNullable<Json>;
          instructions?: string;
          kids_version?: string | null;
          servings?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipes_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      shopping_items: {
        Row: {
          checked: boolean;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          household_id: string;
          id: string;
          list_id: string;
          position: number;
          quantity: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          checked?: boolean;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          household_id: string;
          id?: string;
          list_id: string;
          position?: number;
          quantity?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          checked?: boolean;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          household_id?: string;
          id?: string;
          list_id?: string;
          position?: number;
          quantity?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shopping_items_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shopping_items_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "shopping_lists";
            referencedColumns: ["id"];
          },
        ];
      };
      shopping_lists: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          household_id: string;
          id?: string;
          name?: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shopping_lists_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: true;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      todo_items: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          done: boolean;
          household_id: string;
          id: string;
          list_id: string;
          position: number;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          done?: boolean;
          household_id: string;
          id?: string;
          list_id: string;
          position?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          done?: boolean;
          household_id?: string;
          id?: string;
          list_id?: string;
          position?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "todo_items_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "todo_items_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "todo_lists";
            referencedColumns: ["id"];
          },
        ];
      };
      todo_lists: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          household_id: string;
          id?: string;
          name?: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "todo_lists_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: true;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      vacation_people: {
        Row: {
          child_id: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          household_id: string;
          id: string;
          name: string;
          user_id: string | null;
          vacation_id: string;
        };
        ComputedFields: never;
        Insert: {
          child_id?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          household_id: string;
          id?: string;
          name: string;
          user_id?: string | null;
          vacation_id: string;
        };
        Update: {
          child_id?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          household_id?: string;
          id?: string;
          name?: string;
          user_id?: string | null;
          vacation_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vacation_people_child_fkey";
            columns: ["child_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "household_children";
            referencedColumns: ["id", "household_id"];
          },
          {
            foreignKeyName: "vacation_people_member_fkey";
            columns: ["household_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["household_id", "user_id"];
          },
          {
            foreignKeyName: "vacation_people_vacation_fkey";
            columns: ["vacation_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "vacations";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      vacation_tasks: {
        Row: {
          assignee_id: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          done: boolean;
          household_id: string;
          id: string;
          phase: string;
          position: number;
          rejected_by: string | null;
          rejection_reason: string | null;
          title: string;
          vacation_id: string;
        };
        ComputedFields: never;
        Insert: {
          assignee_id?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          done?: boolean;
          household_id: string;
          id?: string;
          phase: string;
          position?: number;
          rejected_by?: string | null;
          rejection_reason?: string | null;
          title: string;
          vacation_id: string;
        };
        Update: {
          assignee_id?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          done?: boolean;
          household_id?: string;
          id?: string;
          phase?: string;
          position?: number;
          rejected_by?: string | null;
          rejection_reason?: string | null;
          title?: string;
          vacation_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vacation_tasks_assignee_fkey";
            columns: ["assignee_id", "vacation_id"];
            isOneToOne: false;
            referencedRelation: "vacation_people";
            referencedColumns: ["id", "vacation_id"];
          },
          {
            foreignKeyName: "vacation_tasks_rejected_by_fkey";
            columns: ["rejected_by", "vacation_id"];
            isOneToOne: false;
            referencedRelation: "vacation_people";
            referencedColumns: ["id", "vacation_id"];
          },
          {
            foreignKeyName: "vacation_tasks_vacation_fkey";
            columns: ["vacation_id", "household_id"];
            isOneToOne: false;
            referencedRelation: "vacations";
            referencedColumns: ["id", "household_id"];
          },
        ];
      };
      vacations: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          ends_on: string;
          household_id: string;
          id: string;
          kind: string;
          starts_on: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          ends_on: string;
          household_id: string;
          id?: string;
          kind: string;
          starts_on: string;
          title: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          ends_on?: string;
          household_id?: string;
          id?: string;
          kind?: string;
          starts_on?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vacations_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      count_planned_dinner_days: {
        Args: { p_household_id: string; p_time_zone: string };
        Returns: number;
      };
      create_household: {
        Args: { p_name: string };
        Returns: {
          created_at: string;
          id: string;
          name: string;
        };
        SetofOptions: {
          from: "*";
          to: "households";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_invite: { Args: { p_household_id: string }; Returns: string };
      create_vacation: {
        Args: { p_people?: Json; p_tasks: Json; p_vacation: Json };
        Returns: Json;
      };
      is_household_member: { Args: { hid: string }; Returns: boolean };
      list_household_members: {
        Args: { p_household_id: string };
        Returns: {
          email: string;
          joined_at: string;
          user_id: string;
        }[];
      };
      redeem_invite: { Args: { p_code: string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
