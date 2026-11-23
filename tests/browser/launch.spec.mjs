import { test, expect } from "@playwright/test";
const unique = () =>
  "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
async function upload(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "🖼️ 불러오기" }).waitFor();
  const data = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 400;
    c.height = 1200;
    const x = c.getContext("2d");
    ["pink", "lightblue", "lightgreen", "orange"].forEach((color, i) => {
      x.fillStyle = color;
      x.fillRect(0, i * 300, 400, 300);
      x.fillStyle = "#333";
      x.font = "60px sans-serif";
      x.fillText(String(i + 1), 180, i * 300 + 160);
    });
    return c.toDataURL().split(",")[1];
  });
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: Buffer.from(data, "base64"),
    });
  await page
    .getByRole("button", { name: "사진 전송 없이 직접 맞추기" })
    .click();
  await page
    .getByRole("button", { name: "세로 네 컷으로 다시 맞추기" })
    .click();
}
async function login(page, alias) {
  await page.getByLabel("체험 계정 이름").fill(alias);
  await page.getByRole("button", { name: "모의 계정으로 로그인" }).click();
}
test("anonymous editing and GIF survive login/reload; one-credit creation and download are durable", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await upload(page);
  await page
    .getByPlaceholder("오늘의 기분이나 한 줄을 적어주세요")
    .count()
    .then(async (n) => {
      if (n)
        await page
          .getByPlaceholder("오늘의 기분이나 한 줄을 적어주세요")
          .fill("복원 검증");
    });
  await page.getByRole("button", { name: "🎬 AI 영상 만들기" }).click();
  await expect(
    page.getByText("로그인하고 무료 5크레딧 받기", { exact: true }),
  ).toBeVisible();
  // Leaving the login prompt does not discard photo geometry.
  await page.getByRole("button", { name: "🎬 AI 영상 만들기" }).click();
  await expect(
    page.getByRole("button", { name: "움짤 만들기", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "🎬 AI 영상 만들기" }).click();
  await login(page, unique());
  await expect(page.getByText(/사용 가능 5크레딧/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("편집하던 사진을 복원했어요.")).toBeVisible();
  await page.getByRole("button", { name: "🎬 AI 영상 만들기" }).click();
  await page.getByRole("checkbox", { name: /사진 속 인물의 허락/ }).check();
  await page
    .getByRole("button", { name: "1크레딧으로 실사 영상 제작" })
    .click();
  const video = page.getByLabel("완성된 AI 영상");
  await expect(video).toHaveAttribute("src", /^blob:/, { timeout: 45000 });
  await expect(
    page.getByRole("button", { name: "내 크레딧 4 · 내역" }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/launch/preview-video.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: "내 크레딧 4 · 내역" }).click();
  await expect(
    page.getByRole("button", { name: "완성본 다시 저장 · 무료" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "완성본 다시 저장 · 무료" }).click();
  await (await download).saveAs("artifacts/launch/browser-silent.mp4");
  await expect(
    page.getByRole("button", { name: "내 크레딧 4 · 내역" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("mock 3900 payment credits exactly ten; unused cancellation restores paid lot only", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "내 크레딧 · 로그인" }).click();
  await login(page, unique());
  await page
    .getByRole("button", { name: "10크레딧 충전", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "10크레딧 결제" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "결제 취소하고 돌아가기" }).click();
  await expect(
    page.getByRole("button", { name: "내 크레딧 5 · 내역" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "10크레딧 충전", exact: true })
    .click();
  await page.getByRole("button", { name: "모의 3,900원 승인" }).click();
  await expect(
    page.getByRole("button", { name: "내 크레딧 15 · 내역" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "내 크레딧 15 · 내역" }).click();
  await expect(page.getByText("충전 완료", { exact: true })).toHaveCount(1);
  await page
    .getByRole("button", { name: "미사용 구매 취소 / 환불 요청" })
    .click();
  await page.getByLabel("취소 사유").fill("미사용 테스트 취소");
  await page
    .getByRole("button", { name: "미사용 구매 취소 요청", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "내 크레딧 5 · 내역" }),
  ).toBeVisible();
  await expect(page.getByText("취소 완료", { exact: true })).toHaveCount(1);
  await page.screenshot({
    path: "artifacts/launch/preview-wallet.png",
    fullPage: true,
  });
});
test("anonymous invited GIF completion then signup rewards inviter once; GIF remains downloadable without login", async ({
  browser,
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "내 크레딧 · 로그인" }).click();
  await login(page, unique());
  const ownerToken = await page.evaluate(() =>
    sessionStorage.getItem("nz-demo-token"),
  );
  const account = await page.evaluate(
    async (token) =>
      await (
        await fetch("/api/launch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({ action: "account" }),
        })
      ).json(),
    ownerToken,
  );
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    friend = await context.newPage();
  await friend.goto("http://127.0.0.1:5173/?ref=" + account.invite.code);
  await friend.getByRole("button", { name: "🖼️ 불러오기" }).waitFor();
  const data = await friend.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 400;
    c.height = 1200;
    const x = c.getContext("2d");
    ["#fa7777", "#66bbcc", "#ddcc66", "#88bb99"].forEach((color, i) => {
      x.fillStyle = color;
      x.fillRect(0, i * 300, 400, 300);
      x.font = "30px sans-serif";
      x.fillStyle = "black";
      x.fillText(String(Math.random()), 10, i * 300 + 100);
    });
    return c.toDataURL().split(",")[1];
  });
  await friend
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: Buffer.from(data, "base64"),
    });
  await friend
    .getByRole("button", { name: "사진 전송 없이 직접 맞추기" })
    .click();
  await friend
    .getByRole("button", { name: "세로 네 컷으로 다시 맞추기" })
    .click();
  await friend
    .getByRole("button", { name: "움짤 만들기", exact: true })
    .click();
  await friend
    .getByRole("button", { name: "헐레벌떡 GIF", exact: true })
    .click();
  await friend.getByRole("button", { name: /기본 핑크 프레임/ }).click();
  await expect(
    friend.getByRole("button", { name: "기기에 저장하기", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  await friend
    .getByRole("button", { name: "GIF 전송에 동의하고 초대 완료 확인" })
    .click();
  await expect(friend.getByText(/GIF 완료를 확인했어요/)).toBeVisible();
  await friend.screenshot({
    path: "artifacts/launch/preview-invite.png",
    fullPage: true,
  });
  await login(friend, unique());
  await page.reload();
  await expect(
    page.getByRole("button", { name: "내 크레딧 7 · 내역" }),
  ).toBeVisible();
  await context.close();
});
test("mobile layout does not overflow; forged amount and unauthenticated generation are rejected", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "내 크레딧 · 로그인" }).click();
  await login(page, unique());
  const result = await page.evaluate(async () => {
    const t = sessionStorage.getItem("nz-demo-token");
    const r = await fetch("/api/launch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + t,
      },
      body: JSON.stringify({
        action: "confirm",
        orderId: "forged",
        paymentKey: "fake",
        amount: 1,
      }),
    });
    const unauth = await fetch("/api/launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate" }),
    });
    return {
      tamper: r.status,
      unauth: unauth.status,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(result).toEqual({ tamper: 400, unauth: 401, overflow: false });
});

test("expired local photo draft is deleted when the app is opened again", async ({
  page,
}) => {
  await upload(page);
  await page.reload();
  await expect(page.getByText("편집하던 사진을 복원했어요.")).toBeVisible();
  await page.evaluate(async () => {
    const d = await new Promise((resolve, reject) => {
      const r = indexedDB.open("naezzal-launch-draft", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = reject;
    });
    await new Promise((resolve, reject) => {
      const tx = d.transaction("drafts", "readwrite"),
        store = tx.objectStore("drafts"),
        r = store.get("current");
      r.onsuccess = () =>
        store.put({ ...r.result, at: Date.now() - 86400001 }, "current");
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    d.close();
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "🖼️ 불러오기" })).toBeVisible();
  const count = await page.evaluate(async () => {
    const d = await new Promise((resolve) => {
      const r = indexedDB.open("naezzal-launch-draft", 1);
      r.onsuccess = () => resolve(r.result);
    });
    const count = await new Promise((resolve) => {
      const r = d.transaction("drafts").objectStore("drafts").count();
      r.onsuccess = () => resolve(r.result);
    });
    d.close();
    return count;
  });
  expect(count).toBe(0);
});
