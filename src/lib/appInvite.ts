import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import type { Account } from './launch';
export const officialAppUrl = 'https://4zzal.com';
export const appInviteText = '네 컷 사진을 짤과 영상으로!\n친구와의 추억을 공유하는 새로운 방법, 내짤4짤';
export function appInviteData(account: Account | null, appOrigin = officialAppUrl) {
  const invite = account?.invite;
  const valid = invite?.enabled && invite.code && invite.expires > Date.now();
  return { title: '내짤4짤', text: appInviteText, url: valid ? appOrigin.replace(/\/$/, '') + '/?ref=' + encodeURIComponent(invite.code) : officialAppUrl };
}
export async function shareAppInvite(account: Account | null, appOrigin = officialAppUrl): Promise<string> {
  const data = appInviteData(account, appOrigin);
  const guidance = !account ? ' 로그인 후 친구를 초대하면 새 친구의 첫 GIF 또는 AI 영상 완성 시 2크레딧을 받을 수 있어요.' : data.url === officialAppUrl ? ' 지금은 유효한 초대 보상 링크가 없어 일반 앱 주소를 공유해요.' : '';
  try {
    if (Capacitor.isNativePlatform()) await Share.share(data);
    else if (navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(data.text + '\n\n' + data.url); return '초대 링크와 소개를 복사했어요.' + guidance; }
    return '초대 링크를 공유했어요.' + guidance;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return '공유를 취소했어요. 초대 보상은 아직 지급되지 않았어요.';
    return '공유하지 못했어요. 잠시 후 다시 시도해주세요.';
  }
}
