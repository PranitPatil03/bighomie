"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import AuthGate from "@/components/AuthGate";
import BigHomieApp from "@/legacy/BigHomieApp";
import { supabase } from "@/lib/supabaseClient";

type ProfileRecord = {
  id: string;
  full_name?: string;
  goal?: string;
  is_vet?: boolean;
  referral_code?: string;
  stripe_connect_account_id?: string;
  onboarding_completed_at?: string;
  pro_status?: string;
  subscription_tier?: string;
  checkin_credits?: number;
  income?: number;
};

const loadingStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0A0806",
  color: "#F5ECD7",
  fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
};

export default function Home() {
  const [session, setSession] = useState<Session>();
  const [profile, setProfile] = useState<ProfileRecord>();
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState("");

  const loadProfile = useCallback(async (userId: string): Promise<void> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle<ProfileRecord>();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    setProfile(data ?? undefined);
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        setSession(currentSession ?? undefined);

        if (currentSession?.user?.id) {
          await loadProfile(currentSession.user.id);
        }
      } catch (caughtError: unknown) {
        if (!mounted) return;
        setSession(undefined);
        setProfile(undefined);
        const text = caughtError instanceof Error ? caughtError.message : "Failed to initialize app session.";
        setInitError(text);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession ?? undefined);
      setInitError("");

      if (!nextSession?.user?.id) {
        setProfile(undefined);
        return;
      }

      try {
        await loadProfile(nextSession.user.id);
      } catch (caughtError: unknown) {
        setProfile(undefined);
        const text = caughtError instanceof Error ? caughtError.message : "Failed to load user profile.";
        setInitError(text);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback((): Promise<void> | undefined => {
    if (!session?.user?.id) return undefined;
    return loadProfile(session.user.id);
  }, [loadProfile, session?.user?.id]);

  const accessToken = useMemo(() => session?.access_token ?? "", [session]);

  if (loading) {
    return <div style={loadingStyle}>Loading Big Homie...</div>;
  }

  if (!session?.user) {
    return (
      <>
        <AuthGate />
        {initError ? (
          <div
            style={{
              position: "fixed",
              left: "20px",
              right: "20px",
              bottom: "20px",
              margin: "0 auto",
              maxWidth: "760px",
              borderRadius: "12px",
              border: "1px solid rgba(224,82,82,0.35)",
              background: "rgba(20,8,8,0.92)",
              color: "#F5ECD7",
              padding: "12px 14px",
              fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
              fontSize: "13px",
              lineHeight: "1.6",
            }}
          >
            Session bootstrap warning: {initError}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <BigHomieApp
      authUser={session.user}
      profile={profile}
      accessToken={accessToken}
      onProfileRefresh={refreshProfile}
      onSignOut={() => supabase.auth.signOut()}
    />
  );
}
