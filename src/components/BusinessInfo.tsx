import { BUSINESS, supportMailto } from "../lib/business";
import "./business.css";

export default function BusinessInfo({ compact = false }: { compact?: boolean }) {
  return (
    <address className={`nz-business-info${compact ? " nz-business-compact" : ""}`} aria-label="사업자 정보">
      <p><strong>{BUSINESS.name}</strong> · 대표 {BUSINESS.representative}</p>
      <p>사업자등록번호 {BUSINESS.registrationNumber}</p>
      <p>{BUSINESS.address}</p>
      <p>문의 <a href={supportMailto()}>{BUSINESS.supportEmail}</a></p>
    </address>
  );
}
