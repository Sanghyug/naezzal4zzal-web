// Public operator details supplied by the owner for the service notices.
// Keep private identity documents out of the bundle. The owner explicitly
// designated this phone number for public customer support on 2026-11-28.
export const BUSINESS = {
  name: "밤나무랩",
  representative: "박상혁",
  registrationNumber: "415-08-87715",
  address: "서울특별시 동작구 상도로39길 43, 102호 (상도1동, 네스트 상도)",
  supportEmail: "airtory@naver.com",
  supportPhone: "010-2208-2347",
} as const;

export function supportMailto(subject = "내짤4짤 문의") {
  return `mailto:${BUSINESS.supportEmail}?subject=${encodeURIComponent(subject)}`;
}
