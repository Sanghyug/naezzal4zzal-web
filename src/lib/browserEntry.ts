export const isKakaoBrowser = (agent: string) => /KAKAOTALK/i.test(agent);
export function externalBrowserUrl(href: string) {
  const url = new URL(href);
  for (const key of ['code','auth','access_token','refresh_token','token','paymentKey','error','error_code','error_description']) url.searchParams.delete(key);
  if (/access_token|refresh_token|error/.test(url.hash)) url.hash = '';
  return url.href;
}
