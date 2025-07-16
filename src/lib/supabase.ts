import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

// Client-side Supabase client
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key'
)

// Client component Supabase client
export const createSupabaseClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key'
  )
}

// Server component Supabase client
export const createSupabaseServerClient = () => {
  // For demo mode or when Supabase isn't configured, use the basic client
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
    return createClient(
      'https://placeholder.supabase.co',
      'placeholder_key'
    )
  }

  try {
    const { cookies } = require('next/headers')
    const cookieStore = cookies()
    return createServerComponentClient({ cookies: () => cookieStore })
  } catch (error) {
    // Fallback when cookies aren't available
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key'
    )
  }
}

// Server-side Supabase client with service role (for admin operations)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_service_key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Database types (you can generate these from Supabase CLI)
export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          domain: string | null
          plan: string
          settings: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          domain?: string | null
          plan?: string
          settings?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          domain?: string | null
          plan?: string
          settings?: any
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: string
          invited_by: string | null
          invited_at: string
          joined_at: string | null
          status: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: string
          invited_by?: string | null
          invited_at?: string
          joined_at?: string | null
          status?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: string
          invited_by?: string | null
          invited_at?: string
          joined_at?: string | null
          status?: string
        }
      }
      leads: {
        Row: {
          id: string
          workspace_id: string
          email: string
          name: string | null
          phone: string | null
          company: string | null
          position: string | null
          source: string | null
          status: string
          tags: string[]
          custom_fields: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          email: string
          name?: string | null
          phone?: string | null
          company?: string | null
          position?: string | null
          source?: string | null
          status?: string
          tags?: string[]
          custom_fields?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          email?: string
          name?: string | null
          phone?: string | null
          company?: string | null
          position?: string | null
          source?: string | null
          status?: string
          tags?: string[]
          custom_fields?: any
          created_at?: string
          updated_at?: string
        }
      }
      campaigns: {
        Row: {
          id: string
          workspace_id: string
          name: string
          subject: string
          template_id: string | null
          segment_id: string | null
          status: string
          send_at: string | null
          sent_at: string | null
          total_recipients: number
          delivered: number
          opened: number
          clicked: number
          bounced: number
          unsubscribed: number
          complained: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          subject: string
          template_id?: string | null
          segment_id?: string | null
          status?: string
          send_at?: string | null
          sent_at?: string | null
          total_recipients?: number
          delivered?: number
          opened?: number
          clicked?: number
          bounced?: number
          unsubscribed?: number
          complained?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          subject?: string
          template_id?: string | null
          segment_id?: string | null
          status?: string
          send_at?: string | null
          sent_at?: string | null
          total_recipients?: number
          delivered?: number
          opened?: number
          clicked?: number
          bounced?: number
          unsubscribed?: number
          complained?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      email_templates: {
        Row: {
          id: string
          workspace_id: string
          name: string
          subject: string
          html_content: string
          text_content: string | null
          variables: any
          template_type: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          subject: string
          html_content: string
          text_content?: string | null
          variables?: any
          template_type?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          subject?: string
          html_content?: string
          text_content?: string | null
          variables?: any
          template_type?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
