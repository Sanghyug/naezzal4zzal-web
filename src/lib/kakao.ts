// Supabase's Kakao provider appends `options.scopes` to hard-coded defaults.
// A provider query parameter overrides the final OAuth scope instead. No
// profile/email data is needed: credits use the verified Supabase member UUID.
export function kakaoOAuthOptions(origin: string) {
  return {
    provider: "kakao" as const,
    options: {
      redirectTo: origin + "/?auth=return",
      queryParams: { scope: "" },
    },
  };
}
