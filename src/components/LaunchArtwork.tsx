export function LaunchIcon({ name, className = "" }: { name: "gift" | "video" | "pen" | "plane" | "chat"; className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "gift" && <><path d="M11 28h42v28H11zM7 18h50v11H7zM32 18v38"/><path d="M32 18C10 22 12-6 26 8l6 10Zm0 0C54 22 52-6 38 8l-6 10Z"/></>}
    {name === "video" && <><rect x="6" y="17" width="35" height="31" rx="5"/><path d="m41 26 16-9v31l-16-9"/></>}
    {name === "pen" && <><path d="m7 57 9-34L40 8l16 16-15 24-34 9Zm0 0 20-20M33 12l18 18"/><circle cx="31" cy="33" r="5"/></>}
    {name === "plane" && <><path d="m5 25 53-19-18 52-12-20L5 25Zm23 13L58 6M20 45l-5 6M11 56l-5 3"/></>}
    {name === "chat" && <path fill="currentColor" stroke="none" d="M32 7C16 7 4 16 4 28c0 8 6 15 15 19l-4 12 15-10h2c16 0 28-9 28-21S48 7 32 7Z"/>}
  </svg>;
}
export function FilmDecoration() {
  return <div className="nz-film-art" aria-hidden="true"><i/><i/><i/><span>♥</span><b>✧</b></div>;
}
