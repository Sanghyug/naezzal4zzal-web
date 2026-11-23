import { useState } from "react";
import { useLaunch, verifyInviteGif } from "../lib/launch";
import { LoginPrompt } from "./LaunchAccount";
export default function InviteCompletion({
  gif,
  renderId,
}: {
  gif: string;
  renderId: string;
}) {
  const { invited, account } = useLaunch();
  const [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!invited) return null;
  return (
    <aside className="nz-invite">
      <h3>초대한 친구에게 추억을 선물해요</h3>
      <p>
        완성한 GIF 파일을 서버에 보내 움직이는 GIF인지 확인해요. 확인한 파일은
        저장하지 않아요. 신규 가입 확인까지 마치면 초대한 친구가 월 한도 안에서
        2크레딧을 받아요.
      </p>
      {!done && (
        <button
          disabled={busy || !renderId}
          onClick={async () => {
            setBusy(true);
            try {
              await verifyInviteGif(gif, renderId);
              setDone(true);
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "완료 확인을 다시 시도해주세요.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          GIF 전송에 동의하고 초대 완료 확인
        </button>
      )}
      {done && (
        <>
          <p>
            GIF 완료를 확인했어요.{" "}
            {account
              ? "신규 가입과 초대 한도를 확인해 보상을 반영해요."
              : "로그인하면 초대한 친구에게 2크레딧을 선물할 수 있어요. 로그인하지 않아도 GIF를 저장할 수 있어요."}
          </p>
          {!account && <LoginPrompt />}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
