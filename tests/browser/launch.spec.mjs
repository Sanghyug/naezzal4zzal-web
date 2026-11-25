import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
// This is an OAuth transport simulation, not a real Kakao account/device test.
async function simulatedKakao(page, alias, cancel, failExchange = false) {
  await page.route("**/api/launch**", async (route) => {
    if (route.request().method() === "GET" && route.request().url().includes("action=config")) {
      const response = await route.fetch();
      const config = await response.json();
      return route.fulfill({ json: { ...config, demo: false, auth: { url: "http://127.0.0.1:5173", anon: "public-test-key" } } });
    }
    const headers = route.request().headers();
    if (headers.authorization) headers.authorization = "Bearer demo-" + alias;
    await route.continue({ headers });
  });
  await page.route("**/auth/v1/authorize?**", async (route) => {
    const u = new URL(route.request().url());
    expect(u.searchParams.get("provider")).toBe("kakao");
    expect(u.searchParams.has("scopes")).toBe(false);
    expect(u.searchParams.has("scope")).toBe(true);
    expect(u.searchParams.get("scope")).toBe("");
    expect(u.searchParams.get("code_challenge")).toBeTruthy();
    await route.fulfill({ status: 302, headers: { location: "http://127.0.0.1:5173/?auth=return&" + (cancel ? "error=access_denied&error_description=cancelled" : "code=test-code") } });
  });
  await page.route("**/auth/v1/token?**", (route) => failExchange ? route.fulfill({ status: 400, json: { error: "invalid_grant" } }) : route.fulfill({ json: {
    access_token: "test-access-token-for-kakao", refresh_token: "test-refresh-token", token_type: "bearer", expires_in: 3600,
    user: { id: "member-without-email", aud: "authenticated", created_at: new Date().toISOString(), app_metadata: { provider: "kakao" }, user_metadata: {}, identities: [{ provider: "kakao", id: alias }] },
  } }));
}
const unique = () =>
  "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

test("home credit pill and footer text menus retain policy navigation and focus", async ({page}) => {
  await page.goto('/');
  const entry=page.getByRole('button',{name:'내 크레딧',exact:true});
  await entry.waitFor();
  expect(await entry.evaluate(e=>parseFloat(getComputedStyle(e).borderRadius))).toBeGreaterThan(20);
  const menus=page.getByRole('navigation',{name:'상품·이용약관·개인정보·환불 안내'});
  for(const [label,heading] of [['상품·이용약관','상품과 제공 방식'],['개인정보','어떤 정보가 어디로 가나요?'],['환불 안내','제작 실패·취소·환불']]) {
    const button=menus.getByRole('button',{name:label,exact:true});
    expect(await button.evaluate(e=>getComputedStyle(e).borderTopWidth)).toBe('0px');
    await button.click();
    await expect(page.getByRole('heading',{name:heading,exact:true})).toBeInViewport();
    await page.getByRole('button',{name:'안내 닫기',exact:true}).click();
    await expect(button).toBeFocused();
  }
  for(const width of [360,390,430,1280]) {
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await entry.click(); await login(page,unique());
  await page.getByRole('button',{name:'크레딧 닫기'}).click();
  expect(await page.getByRole('button',{name:'내 크레딧 5 · 내역',exact:true}).evaluate(e=>parseFloat(getComputedStyle(e).borderRadius))).toBeGreaterThan(20);
});

test("redesigned account adapts to four widths, restores focus and supports tabs and invite copying", async ({ page, context }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', {name:'내 크레딧'});
  await trigger.click();
  for (const width of [360,390,430,1280]) {
    await page.setViewportSize({width,height:900});
    expect(await page.locator('.nz-redesign').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('button',{name:'지금은 둘러볼게요'}).click();
  await expect(page.getByRole('dialog',{name:'내 크레딧'})).toHaveCount(0);
  await trigger.click();
  await login(page,unique());
  await expect(page.getByRole('tab',{name:'크레딧 내역',exact:true})).toHaveAttribute('aria-selected','true');
  for(const width of [360,390,430,1280]) {
    await page.setViewportSize({width,height:900});
    expect(await page.locator('.nz-redesign').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  }
  await page.getByRole('tab',{name:'크레딧 내역',exact:true}).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab',{name:'구매 내역',exact:true})).toBeFocused();
  await expect(page.getByText('아직 구매 내역이 없어요.')).toBeVisible();
  await page.keyboard.press('Home');
  await expect(page.getByText('아직 만든 영상이 없어요.')).toBeVisible();
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:undefined}));
  await page.getByRole('dialog',{name:'내 크레딧'}).getByRole('button',{name:'친구 초대하기',exact:true}).click();
  await expect(page.getByText('초대 링크와 소개를 복사했어요.')).toBeVisible();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toMatch(/http:\/\/127\.0\.0\.1:5173\/\?ref=/);
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Cancelled','AbortError')}}));
  await page.getByRole('dialog',{name:'내 크레딧'}).getByRole('button',{name:'친구 초대하기',exact:true}).click();
  await expect(page.getByText('공유를 취소했어요. 초대 보상은 아직 지급되지 않았어요.')).toBeVisible();
  await page.getByText('계정 관리',{exact:true}).click();
  await expect(page.getByText('계정 탈퇴와 서버 자료 삭제',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'크레딧 닫기'}).click();
  await expect(page.getByRole('button',{name:'내 크레딧 5 · 내역'})).toBeFocused();
});
async function upload(page, navigate = true) {
  if (navigate) await page.goto("/");
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
  await page.getByRole("button", { name: "AI 영상 만들기" }).click();
  await expect(
    page.getByText("첫 로그인 시 무료 5크레딧", { exact: true }),
  ).toBeVisible();
  // Leaving the login prompt does not discard photo geometry.
  await page.getByRole("button", { name: "AI 영상 만들기" }).click();
  await expect(
    page.getByRole("button", { name: "움짤 만들기", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "AI 영상 만들기" }).click();
  await login(page, unique());
  await expect(page.getByText(/사용 가능 5크레딧/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("편집하던 사진을 복원했어요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 영상 만들기" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "움짤 만들기", exact: true }).click();
  await page.getByRole("button", { name: "헐레벌떡 GIF", exact: true }).click();
  await page.getByRole("button", { name: /기본 핑크 프레임/ }).click();
  const gif = page.getByAltText("완성된 움짤");
  await expect(gif).toBeVisible({ timeout: 30000 });
  const gifSource = await gif.getAttribute("src");
  const order = await gif.evaluate(node => Boolean(node.compareDocumentPosition(document.querySelector('.nz-video-editor')) & Node.DOCUMENT_POSITION_FOLLOWING));
  expect(order).toBe(true);
  await page.evaluate(() => { window.capturedShares = []; Object.defineProperties(navigator, { canShare: { configurable: true, value: () => true }, share: { configurable: true, value: async (data) => { capturedShares.push({ text: data.text, names: data.files?.map(file => file.name) }); } } }); });
  await page.getByRole("region", { name: "움짤 제작" }).getByRole("button", { name: "공유하기", exact: true }).click();
  expect((await page.evaluate(() => capturedShares[0])).names).toEqual(["naezzal4zzal.gif"]);
  expect((await page.evaluate(() => capturedShares[0])).text).toBeUndefined();
  await page.route("**/api/launch", async route => {
    const body = route.request().postDataJSON();
    if (body?.action === "work") await new Promise(resolve => setTimeout(resolve, 3000));
    return route.continue();
  });
  await page.getByRole("checkbox", { name: /사진 속 인물의 허락/ }).check();
  await page
    .getByRole("button", { name: /영상 만들기.*1 크레딧/ })
    .click();
  const progress = page.getByRole("list", { name: "영상 제작 단계" });
  await expect(progress.getByRole("listitem")).toHaveCount(4);
  await expect(page.getByText("사진 속 인물들이 움직이고 있어요!")).toBeVisible();
  await progress.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/launch/phase3-stage-390.png" });
  const video = page.getByLabel("완성된 AI 영상");
  await expect(video).toHaveAttribute("src", /^blob:/, { timeout: 45000 });
  await expect(page.getByText("영상이 완성됐어요!", {exact:true})).toBeVisible({timeout:45000});
  await expect(
    page.getByRole("button", { name: "내 크레딧 4 · 내역" }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/launch/phase3-completed-390.png",
  });
  await expect(gif).toHaveAttribute("src", gifSource);
  const studio = page.getByRole("region", { name: "AI 영상 제작" });
  await expect(studio.getByRole('button',{name:'앱 주소 복사하기'})).toHaveCount(0);
  await expect(studio.getByText('https://4zzal.com',{exact:true})).toHaveCount(0);
  await studio.getByRole("button", { name: "다른 스타일로 영상 만들기" }).click();
  await expect(studio.getByRole("button", { name: /애니메이션.*3 크레딧/ })).toBeVisible();
  await expect(studio.getByRole("button", { name: /영상 만들기.*1 크레딧/ })).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "내 크레딧 4 · 내역" }).click();
  await page.getByRole("tab", { name: "내 영상", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "완성본 다시 저장 · 무료" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "내 영상", exact: true }).click();
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
  await page.getByRole("button", { name: "내 크레딧" }).click();
  await login(page, unique());
  await page
    .getByRole("button", { name: "10크레딧 충전하기", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "10크레딧 결제" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "결제 취소하고 돌아가기" }).click();
  await expect(
    page.getByRole("button", { name: "내 크레딧 5 · 내역" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "10크레딧 충전하기", exact: true })
    .click();
  await page.getByRole("button", { name: "모의 3,900원 승인" }).click();
  await expect(
    page.getByRole("button", { name: "내 크레딧 15 · 내역" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "내 크레딧 15 · 내역" }).click();
  await page.getByRole("tab", { name: "구매 내역", exact: true }).click();
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
test("simulated KakaoTalk invite GIF then email-less Kakao OAuth rewards inviter once and restores GIF", async ({
  browser,
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "내 크레딧" }).click();
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
      userAgent: "Mozilla/5.0 Android KAKAOTALK/26.1.0",
      viewport: { width: 390, height: 844 },
    }),
    friend = await context.newPage();
  await simulatedKakao(friend, unique(), false);
  await friend.goto("http://127.0.0.1:5173/?ref=" + account.invite.code);
  await friend.getByRole("button", { name: "카카오톡에서 계속 이용하기" }).click();
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
  const savedGif = await friend.evaluate(async () => {
    const { flushDraft, getDraft } = await import('/src/lib/launch.ts');
    await flushDraft();
    return (await getDraft()).gif;
  });
  await friend.screenshot({
    path: "artifacts/launch/preview-invite.png",
    fullPage: true,
  });
  await friend.getByRole("button", { name: "카카오로 시작하기" }).click();
  await expect(friend.getByText("편집하던 사진을 복원했어요.")).toBeVisible();
  await expect(friend.getByRole("button", { name: "내 크레딧 5 · 내역" })).toBeVisible();
  expect(await friend.evaluate(async () => (await (await import('/src/lib/launch.ts')).getDraft()).gif)).toBe(savedGif);
  await friend.reload();
  await expect(friend.getByRole("button", { name: "내 크레딧 5 · 내역" })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "내 크레딧 7 · 내역" }),
  ).toBeVisible();
  await context.close();
});

test("Kakao cancellation preserves photo bytes and all editor settings in the same browser", async ({ page }) => {
  await simulatedKakao(page, unique(), true);
  await upload(page);
  const draft = () => page.evaluate(async () => {
    const { flushDraft, getDraft } = await import('/src/lib/launch.ts');
    await flushDraft();
    const d = await getDraft();
    return { ...d, at: 0, original: Array.from(new Uint8Array(await d.original.arrayBuffer())) };
  });
  const before = await draft();
  await page.getByRole("button", { name: "AI 영상 만들기" }).click();
  await page.getByRole("button", { name: "카카오로 시작하기" }).click();
  await expect(page.getByText("편집하던 사진을 복원했어요.")).toBeVisible();
  await expect(page.getByText(/카카오 로그인이 취소되었거나/)).toBeVisible();
  const after = await draft();
  expect(after.original).toEqual(before.original);
  for (const key of ['cells', 'adjusts', 'memo', 'selectedFrame', 'sourceSize']) expect(after[key]).toEqual(before[key]);
  expect(page.url()).not.toContain('error_description');
});
test("mobile layout does not overflow; forged amount and unauthenticated generation are rejected", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "내 크레딧" }).click();
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

test("tilted two-by-two panels use original proportions and can return to manual editing", async ({ page }) => {
  await page.route("**/api/extract-cells", (route) => {
    const cells = [[100, 100], [500, 100], [100, 500], [500, 500]].map(([x, y]) => ({ x, y, width: 350, height: 290 }));
    const corners = cells.map(({ x, y }) => [
      { x: x + 30, y }, { x: x + 350, y: y + 45 },
      { x: x + 320, y: y + 290 }, { x, y: y + 240 },
    ]);
    return route.fulfill({ json: { layout: "2x2", cells, corners } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "🖼️ 불러오기" }).waitFor();
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 400;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ac759a";
    context.fillRect(0, 0, 400, 400);
    return canvas.toDataURL().split(",")[1];
  });
  await page.locator("input[type=file]").nth(1).setInputFiles({
    name: "tilted.png", mimeType: "image/png", buffer: Buffer.from(image, "base64"),
  });
  await page.getByRole("button", { name: "사진 전송에 동의하고 AI로 찾기" }).click();
  const manual = page.getByRole("button", { name: "원본에서 직접 맞추기" });
  await expect(page.getByText("사진 영역 직접 조정하기")).toBeVisible();
  await expect(manual).toBeHidden();
  const panels = page.getByAltText("보정할 컷");
  await expect(panels).toHaveCount(4);
  const ratio = await panels.first().evaluate((element) => {
    const { width, height } = element.parentElement.getBoundingClientRect();
    return width / height;
  });
  expect(ratio).toBeGreaterThan(1.30);
  expect(ratio).toBeLessThan(1.36);
  await page.getByRole("button", { name: "AI 영상 만들기" }).click();
  for (const width of [360, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const metrics = await page.locator(".nz-make-button, .nz-style-card strong, .nz-style-card small, .nz-style-cost").evaluateAll(nodes => nodes.map(node => ({
      overflow: node.scrollWidth > node.clientWidth,
      height: node.getBoundingClientRect().height,
      width: node.getBoundingClientRect().width,
      radius: getComputedStyle(node).borderRadius,
      fontSize: getComputedStyle(node).fontSize,
    })));
    expect(metrics.every(metric => !metric.overflow)).toBe(true);
    expect(metrics[0].height).toEqual(metrics[1].height);
    if ([360,390,430].includes(width)) {
      await page.getByRole("button", { name: /애니메이션.*3 크레딧/ }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: "artifacts/launch/phase5-editor-" + width + ".png" });
    }
  }
  await page.getByText("사진 영역 직접 조정하기").click();
  await manual.click();
  await expect(manual).toHaveCount(0);
  await expect(panels).toHaveCount(4);
});

test("Kakao callback exchange failure preserves the open video style and edit", async ({ page }) => {
  await simulatedKakao(page, unique(), false, true);
  await upload(page);
  const memo = page.getByRole("textbox").last();
  await memo.fill("콜백 실패 복원");
  const open = page.getByRole("button", { name: "AI 영상 만들기" });
  await open.click();
  const drawing = page.getByRole("button", { name: /애니메이션.*3 크레딧/ });
  await drawing.click();
  await page.getByRole("button", { name: "카카오로 시작하기" }).click();
  await expect(page.getByText(/로그인을 확인하지 못했어요/)).toBeVisible({ timeout: 15000 });
  await expect(open).toHaveAttribute("aria-expanded", "true");
  await expect(drawing).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox").last()).toHaveValue("콜백 실패 복원");
});

test("AI extraction and video failures retain manual editing and permit a fresh style choice", async ({ page }) => {
  let generationRequests = 0;
  await page.route("**/api/extract-cells", route => route.fulfill({ status: 503, json: { error: "offline" } }));
  await page.route("**/api/launch", route => {
    if (route.request().postDataJSON()?.action !== "generate") return route.continue();
    generationRequests++;
    return route.fulfill({ json: { id: "failed-ui-fixture", status: "failed", style: "memory", cost: 1, downloadable: false } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "🖼️ 불러오기" }).waitFor();
  const bytes = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 1200;
    const context = canvas.getContext("2d");
    context.fillStyle = "#d88caf";
    context.fillRect(0, 0, 400, 1200);
    return canvas.toDataURL().split(",")[1];
  });
  await page.locator("input[type=file]").nth(1).setInputFiles({
    name: "fallback.png", mimeType: "image/png", buffer: Buffer.from(bytes, "base64"),
  });
  await page.getByRole("button", { name: "사진 전송에 동의하고 AI로 찾기" }).click();
  await expect(page.getByRole("region", { name: "원본에서 네 컷 테두리 맞추기" })).toBeVisible();
  await page.getByRole("button", { name: "AI 영상 만들기" }).click();
  await login(page, unique());
  await page.getByRole("checkbox", { name: /사진 속 인물의 허락/ }).check();
  await page.getByRole("button", { name: /영상 만들기.*1 크레딧/ }).click();
  await expect(page.getByText("제작 실패가 확인되어 예약 크레딧을 복구했어요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "내 크레딧 5 · 내역" })).toBeVisible();
  await page.getByRole("button", { name: "다른 스타일로 영상 만들기" }).click();
  await page.getByRole("button", { name: /애니메이션.*3 크레딧/ }).click();
  await expect(page.getByRole("button", { name: /영상 만들기.*3 크레딧/ })).toBeDisabled();
  expect(generationRequests).toBe(1);
});


test("automatic margin correction preserves photo content anywhere in the tail", async ({page}) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const {rectifyPhotoCells}=await import('/src/lib/rectifyPhotoCells.ts');
    const run=async (content) => {
      const c=document.createElement('canvas'); c.width=120;c.height=560;const x=c.getContext('2d');
      x.fillStyle='white';x.fillRect(0,0,120,560);
      const ys=[0,130,260,390];
      for(const y of ys)for(let i=0;i<100;i++){x.fillStyle=i%8<4?'#102030':'#dc7860';x.fillRect(i,y,1,100);}
      if(content){x.fillStyle='#c02452';x.fillRect(0,520,100,10);}
      const im=new Image();im.src=c.toDataURL();await im.decode();
      const corners=ys.map((y,i)=>[{x:0,y},{x:100,y},{x:100,y:y+(i===3?140:100)},{x:0,y:y+(i===3?140:100)}]);
      return rectifyPhotoCells(im,corners,p=>p,'1x4').cells[3].height;
    };
    return {paper:await run(false),content:await run(true)};
  });
  expect(results.paper).toBeGreaterThanOrEqual(100);expect(results.paper).toBeLessThanOrEqual(106);
  expect(results.content).toBe(140);
});


test("photo A restores its job after reload; photo B excludes A while account history retains it", async ({page}) => {
  await upload(page);await page.getByRole('button',{name:'AI 영상 만들기'}).click();await login(page,unique());
  await page.getByRole('checkbox',{name:/사진 속 인물의 허락/}).check();
  await page.getByRole('button',{name:/영상 만들기.*1 크레딧/}).click();
  await expect(page.getByText('영상이 완성됐어요!',{exact:true})).toBeVisible({timeout:45000});
  const keys=await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('nz-credit-job:')));
  expect(keys).toHaveLength(1);const job=await page.evaluate(k=>sessionStorage.getItem(k),keys[0]);
  await page.reload();await expect(page.getByText('영상이 완성됐어요!',{exact:true})).toBeVisible({timeout:45000});
  await page.getByRole('button',{name:'돌아가기',exact:true}).click();await upload(page,false);
  await page.getByRole('button',{name:'AI 영상 만들기'}).click();
  await expect(page.getByLabel('완성된 AI 영상')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/영상 만들기.*1 크레딧/})).toBeVisible();
  expect(await page.evaluate(k=>sessionStorage.getItem(k),keys[0])).toBe(job);
  await page.getByRole('button',{name:'내 크레딧 4 · 내역'}).click();await page.getByRole('tab',{name:'내 영상',exact:true}).click();
  await expect(page.getByRole('button',{name:'완성본 다시 저장 · 무료'})).toBeVisible();
});

test("late generation response stays in photo A scope after photo B is selected", async ({page}) => {
  let release;const gate=new Promise(resolve=>release=resolve);let requested;const seen=new Promise(resolve=>requested=resolve);
  await page.route('**/api/launch',async route=>{
    if(route.request().postDataJSON()?.action!=='generate')return route.continue();
    requested();await gate;await route.fulfill({json:{id:'late-photo-a',status:'failed',style:'memory',cost:1,downloadable:false}});
  });
  await upload(page);await page.getByRole('button',{name:'AI 영상 만들기'}).click();await login(page,unique());
  await page.getByRole('checkbox',{name:/사진 속 인물의 허락/}).check();await page.getByRole('button',{name:/영상 만들기.*1 크레딧/}).click();await seen;
  await page.getByRole('button',{name:'돌아가기',exact:true}).click();await upload(page,false);
  await page.getByRole('button',{name:'AI 영상 만들기'}).click();release();
  await expect.poll(()=>page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('nz-credit-job:')).length)).toBe(1);
  await expect(page.getByText('제작 실패가 확인되어 예약 크레딧을 복구했어요.')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/영상 만들기.*1 크레딧/})).toBeVisible();
});

test("completed job waits for playable media and retries failed download without another generation", async ({page}) => {
  let generates=0, files=0;
  await page.route('**/api/launch',route=>{if(route.request().postDataJSON()?.action==='generate')generates++;return route.continue();});
  await page.route('**/api/launch?action=file&**',route=>{files++;return files===1?route.fulfill({status:503,json:{error:'fixture download failure'}}):route.continue();});
  await upload(page);await page.getByRole('button',{name:'AI 영상 만들기'}).click();await login(page,unique());
  await page.getByRole('button',{name:/애니메이션.*3 크레딧/}).click();
  await page.getByRole('checkbox',{name:/사진 속 인물의 허락/}).check();await page.getByRole('button',{name:/영상 만들기.*3 크레딧/}).click();
  await expect(page.getByRole('list',{name:'영상 제작 단계'}).getByRole('listitem')).toHaveCount(4);
  await page.getByRole('button',{name:'영상 다시 불러오기 · 무료'}).waitFor({timeout:45000});
  await expect(page.getByText('영상이 완성됐어요!',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'영상 다시 불러오기 · 무료'}).click();
  await expect(page.getByText('영상이 완성됐어요!',{exact:true})).toBeVisible({timeout:45000});
  expect(await page.getByLabel('완성된 AI 영상').evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(2);
  expect(generates).toBe(1);expect(files).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('button',{name:'내 크레딧 2 · 내역'})).toBeVisible();
  await expect(page.getByRole('button',{name:'소개 문구와 주소 복사',exact:true})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'AI 영상 제작'}).getByText('https://4zzal.com',{exact:true})).toHaveCount(0);
});


test('home and account share identical invitation data for guests and signed-in members without skin rewards',async({page})=>{
  await page.addInitScript(()=>{window.invitationShares=[];localStorage.setItem('naezzal4zzal-share-count','3');Object.defineProperty(navigator,'share',{configurable:true,value:async data=>invitationShares.push(data)});});
  await page.goto('/');const home=page.getByRole('button',{name:'친구 초대하기',exact:true});await home.waitFor();await home.click();
  await expect(page.getByText(/로그인 후 친구를 초대하면 새 친구의 첫 GIF/).first()).toBeVisible();
  await page.getByRole('button',{name:'내 크레딧',exact:true}).click();let panel=page.getByRole('dialog',{name:'내 크레딧'});
  await panel.getByRole('button',{name:'친구 초대하기',exact:true}).click();
  let shares=await page.evaluate(()=>invitationShares);expect(shares[0]).toEqual(shares[1]);expect(shares[0].url).toBe('https://4zzal.com');
  await login(page,unique());await panel.getByRole('button',{name:'친구 초대하기',exact:true}).click();
  await panel.getByRole('button',{name:'크레딧 닫기'}).click();await home.click();shares=await page.evaluate(()=>invitationShares);
  expect(shares[2]).toEqual(shares[3]);expect(shares[2].url).toMatch(/^http:\/\/127\.0\.0\.1:5173\/\?ref=.+/);
  expect(shares[2].text).toBe('네 컷 사진을 짤과 영상으로!\n친구와의 추억을 공유하는 새로운 방법, 내짤4짤');
  expect(shares[2].files).toBeUndefined();expect(await page.evaluate(()=>localStorage.getItem('naezzal4zzal-share-count'))).toBe('3');
  await expect(page.getByRole('dialog',{name:'더 편하게 내짤4짤을 즐겨보세요!'})).toHaveCount(0);
  for(const width of [360,390,430]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'artifacts/launch/phase6-home-'+width+'.png',fullPage:true});}
});

test('Kakao guide copies the entire invitation URL and external browser recognizes the referral',async({page,browser})=>{
  await page.goto('/');await page.getByRole('button',{name:'내 크레딧',exact:true}).click();await login(page,unique());
  const code=await page.evaluate(async()=>{const {launchApi}=await import('/src/lib/launch.ts');return (await launchApi('account')).invite.code;});
  const ctx=await browser.newContext({userAgent:'Mozilla/5.0 Mobile Safari KAKAOTALK/26',viewport:{width:390,height:844},permissions:['clipboard-read','clipboard-write']});
  const kakao=await ctx.newPage();await kakao.goto('http://127.0.0.1:5173/?ref='+code+'&campaign=kakao');
  const guide=kakao.getByRole('dialog',{name:'더 편하게 내짤4짤을 즐겨보세요!'});await guide.waitFor();
  for(const width of [360,390,430]){await kakao.setViewportSize({width,height:844});expect(await guide.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);await kakao.screenshot({path:'artifacts/launch/phase6-kakao-'+width+'.png'});}
  await guide.getByRole('button',{name:'앱 주소 복사하기'}).click();const copied=await kakao.evaluate(()=>navigator.clipboard.readText());
  expect(copied).toBe('http://127.0.0.1:5173/?ref='+code+'&campaign=kakao');
  await guide.getByRole('button',{name:'카카오톡에서 계속 이용하기'}).click();await expect(guide).toHaveCount(0);await kakao.reload();await kakao.getByRole('button',{name:'🖼️ 불러오기'}).waitFor();await expect(guide).toHaveCount(0);
  const external=await browser.newContext({viewport:{width:390,height:844}});const tab=await external.newPage();await tab.goto(copied);await tab.getByRole('button',{name:'🖼️ 불러오기'}).waitFor();
  await expect(tab.getByRole('dialog',{name:'더 편하게 내짤4짤을 즐겨보세요!'})).toHaveCount(0);
  expect(await tab.evaluate(async()=>{const {launchApi}=await import('/src/lib/launch.ts');return (await launchApi('visit',{code:new URL(location.href).searchParams.get('ref')})).invited;})).toBe(true);
  await external.close();await ctx.close();
});


test('perspective panels of mixed ratios share equal frames and GIF preserves their fitted image ratios',async({page})=>{
  const cells=[{x:50,y:50,width:300,height:200},{x:500,y:50,width:180,height:300},{x:50,y:500,width:300,height:300},{x:500,y:500,width:350,height:200}];
  const corners=cells.map(c=>[{x:c.x+5,y:c.y},{x:c.x+c.width,y:c.y+6},{x:c.x+c.width-5,y:c.y+c.height},{x:c.x,y:c.y+c.height-6}]);
  await page.route('**/api/extract-cells',r=>r.fulfill({json:{layout:'2x2',cells,corners}}));await page.goto('/');await page.getByRole('button',{name:'🖼️ 불러오기'}).waitFor();
  const data=await page.evaluate(({corners})=>{const c=document.createElement('canvas');c.width=c.height=1000;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,1000,1000);corners.forEach((q,i)=>{x.fillStyle=['#e35555','#55a566','#5577dd','#e9bd49'][i];x.beginPath();q.forEach((p,i)=>i?x.lineTo(p.x,p.y):x.moveTo(p.x,p.y));x.closePath();x.fill();});return c.toDataURL().split(',')[1];},{corners});
  await page.locator('input[type=file]').nth(1).setInputFiles({name:'mixed-perspective.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});await page.getByRole('button',{name:'사진 전송에 동의하고 AI로 찾기'}).click();await expect(page.locator('.nz-preview-slot')).toHaveCount(4);
  for(const width of [360,390,430]){await page.setViewportSize({width,height:844});const slots=await page.locator('.nz-preview-slot').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height};}));expect(Math.max(...slots.map(x=>x.width))-Math.min(...slots.map(x=>x.width))).toBeLessThan(1);expect(Math.max(...slots.map(x=>x.height))-Math.min(...slots.map(x=>x.height))).toBeLessThan(1);const controls=await page.locator('.nz-adjustable-cut').evaluateAll(ns=>ns.map(n=>n.querySelector('button').getBoundingClientRect().top));expect(Math.abs(controls[0]-controls[1])).toBeLessThan(1);expect(Math.abs(controls[2]-controls[3])).toBeLessThan(1);await page.screenshot({path:'artifacts/launch/phase7-frames-'+width+'.png',fullPage:true});}
  const ratios=await page.getByAltText('보정할 컷').evaluateAll(ns=>ns.map(n=>{const r=n.parentElement.getBoundingClientRect();return r.width/r.height;}));
  await page.getByRole('button',{name:'움짤 만들기',exact:true}).click();await page.getByRole('button',{name:'헐레벌떡 GIF',exact:true}).click();await page.getByRole('button',{name:/기본 핑크 프레임/}).click();await page.getByAltText('완성된 움짤').waitFor({timeout:30000});
  const decoded=await page.getByAltText('완성된 움짤').evaluate(async img=>{const bytes=await(await fetch(img.src)).arrayBuffer();const decoder=new ImageDecoder({data:bytes,type:'image/gif'});await decoder.tracks.ready;const out=[];for(let i=0;i<4;i++){const {image}=await decoder.decode({frameIndex:i});const c=document.createElement('canvas');c.width=image.displayWidth;c.height=image.displayHeight;const x=c.getContext('2d');x.drawImage(image,0,0);image.close();const d=x.getImageData(0,0,c.width,c.height).data;let minX=c.width,minY=c.height,maxX=0,maxY=0;for(let y=0;y<c.height;y++)for(let xx=0;xx<c.width;xx++){const k=(y*c.width+xx)*4,r=d[k],g=d[k+1],b=d[k+2];const match=i===0?r>140&&g<130&&b<130:i===1?g>100&&r<130&&b<160:i===2?b>130&&r<130:r>170&&g>100&&g<200&&b<120;if(match){minX=Math.min(minX,xx);minY=Math.min(minY,y);maxX=Math.max(maxX,xx);maxY=Math.max(maxY,y);}}out.push({width:c.width,height:c.height,ratio:(maxX-minX+1)/(maxY-minY+1)});}decoder.close();return out;});
  expect(new Set(decoded.map(x=>x.width+'x'+x.height)).size).toBe(1);decoded.forEach((x,i)=>expect(Math.abs(x.ratio-ratios[i])).toBeLessThan(.08));
});

test('completed memory and drawing MP4 save once locally, survive reload, filter, play, share, download and delete without new charges',async({page})=>{
  page.on('dialog',d=>d.accept());let variant='memory',generates=0;
  const files={memory:readFileSync('tests/fixtures/share-test.mp4'),drawing:readFileSync('tests/fixtures/share-test-drawing.mp4')};
  await page.route('**/api/launch',r=>{if(r.request().postDataJSON()?.action==='generate')generates++;return r.continue();});
  await page.route('**/api/launch?action=file&**',r=>r.fulfill({contentType:'video/mp4',body:files[variant]}));
  await page.addInitScript(()=>{Object.defineProperties(navigator,{canShare:{configurable:true,value:()=>true},share:{configurable:true,value:async data=>{window.lastFileType=data.files?.[0]?.type;window.lastFileText=data.text;}}});});
  await upload(page);await page.evaluate(async()=>{const {getGalleryItems}=await import('/src/lib/galleryStore.ts');await getGalleryItems();const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('naezzal4zzal-gallery',2);r.onsuccess=()=>resolve(r.result);r.onerror=reject;});await new Promise((resolve,reject)=>{const tx=db.transaction('saved-gifs','readwrite');tx.objectStore('saved-gifs').put({id:'phase7-old-gif',gifBlob:new Blob([Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),c=>c.charCodeAt(0))],{type:'image/gif'}),memo:'기존 GIF',styleName:'기존 스타일',createdAt:'2026-11-24T00:00:00Z'});tx.oncomplete=resolve;tx.onerror=reject;});db.close();});
  await page.getByRole('button',{name:'AI 영상 만들기'}).click();await login(page,unique());const studio=page.getByRole('region',{name:'AI 영상 제작'});
  for(const style of ['memory','drawing']){variant=style;if(style==='drawing')await studio.getByRole('button',{name:/애니메이션.*3 크레딧/}).click();await studio.getByRole('checkbox',{name:/사진 속 인물의 허락/}).check();await studio.getByRole('button',{name:style==='memory'?/영상 만들기.*1 크레딧/:/영상 만들기.*3 크레딧/}).click();await expect(studio.getByText('영상이 완성됐어요!',{exact:true})).toBeVisible({timeout:45000});const save=studio.getByRole('button',{name:'보관함에 저장하기',exact:true});expect(await save.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(51, 51, 51)');await save.click();await expect(studio.getByRole('button',{name:'보관함 저장 완료'})).toBeDisabled();await expect(page.getByRole('button',{name:style==='memory'?'내 크레딧 4 · 내역':'내 크레딧 1 · 내역'})).toBeVisible();await page.evaluate(async()=>{const {saveGalleryItem}=await import('/src/lib/galleryStore.ts');const item=await saveGalleryItem(document.querySelector('video[aria-label="완성된 AI 영상"]').src,'동일 영상','실사 영상','video');URL.revokeObjectURL(item.gifUrl);});if(style==='memory')await studio.getByRole('button',{name:'다른 스타일로 영상 만들기'}).click();}
  expect(generates).toBe(2);await page.getByRole('button',{name:'돌아가기',exact:true}).click();await page.getByRole('button',{name:'💗 내 보관함'}).click();await expect(page.getByRole('tab',{name:'전체',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.getByRole('button',{name:/^실사 영상 ·/})).toHaveCount(1);await expect(page.getByRole('button',{name:/^애니메이션 영상 ·/})).toHaveCount(1);await expect(page.getByRole('button',{name:/^실사 영상 ·/}).locator('img')).toHaveCount(1);await expect(page.getByRole('button',{name:/^애니메이션 영상 ·/}).locator('img')).toHaveCount(1);await expect(page.getByAltText('기존 GIF')).toHaveCount(1);
  await page.getByRole('tab',{name:'움짤',exact:true}).click();await expect(page.getByAltText('기존 GIF')).toBeVisible();await expect(page.getByRole('button',{name:/^실사 영상 ·/})).toHaveCount(0);await page.getByRole('tab',{name:'AI 영상',exact:true}).click();await expect(page.getByAltText('기존 GIF')).toHaveCount(0);
  for(const width of [360,390,430]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'artifacts/launch/phase7-gallery-'+width+'.png',fullPage:true});}
  await page.reload();await page.getByRole('button',{name:'💗 내 보관함'}).click();await expect(page.getByRole('tab',{name:'전체',exact:true})).toHaveAttribute('aria-selected','true');
  await page.route('**/api/launch?action=file&**',r=>r.abort());await page.getByRole('button',{name:/^실사 영상 ·/}).click();const modal=page.getByRole('dialog',{name:'보관한 내짤'});await expect.poll(()=>modal.locator('video').evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(2);await modal.locator('video').evaluate(async v=>{v.muted=true;await v.play();});await modal.getByRole('button',{name:'공유하기',exact:true}).click();expect(await page.evaluate(()=>lastFileType)).toBe('video/mp4');expect(await page.evaluate(()=>lastFileText)).toBeUndefined();const download=page.waitForEvent('download');await modal.getByRole('button',{name:'기기에 저장하기',exact:true}).click();expect((await download).suggestedFilename()).toBe('naezzal4zzal.mp4');await modal.getByRole('button',{name:'삭제',exact:true}).click();await expect(page.getByRole('button',{name:/^실사 영상 ·/})).toHaveCount(0);await expect(page.getByAltText('기존 GIF')).toHaveCount(1);await expect(page.getByRole('button',{name:'내 크레딧 1 · 내역'})).toBeVisible();expect(generates).toBe(2);
});

test('fullscreen is offered near install only when supported and copy-guide preserves the referral',async({page,browser})=>{
  await page.goto('/');const full=page.getByRole('button',{name:'전체화면으로 보기'});await full.waitFor();expect(await full.evaluate(e=>!!e.parentElement.textContent.includes('홈화면에 설치하기'))).toBe(true);await full.click();await expect(page.getByRole('button',{name:'전체화면 닫기'})).toBeVisible();await page.getByRole('button',{name:'전체화면 닫기'}).click();
  const ctx=await browser.newContext();await ctx.addInitScript(()=>Object.defineProperty(document,'fullscreenEnabled',{configurable:true,value:false}));const tab=await ctx.newPage();await tab.goto('http://127.0.0.1:5173');await tab.getByRole('button',{name:'🖼️ 불러오기'}).waitFor();await expect(tab.getByRole('button',{name:'전체화면으로 보기'})).toHaveCount(0);await ctx.close();
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);await page.goto('/?copy=app&ref=phase7-code');await expect(page.getByRole('link',{name:'내짤4짤 시작하기'})).toBeVisible();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('http://127.0.0.1:5173/?ref=phase7-code');expect(await page.getByRole('link',{name:'내짤4짤 시작하기'}).getAttribute('href')).toBe('http://127.0.0.1:5173/?ref=phase7-code');
});

test('copy-only route falls back to explicit copy without claiming success',async({page})=>{
  await page.addInitScript(()=>{let attempts=0;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(++attempts===1)throw new Error('denied');window.copiedAddress=text;}}});});
  await page.goto('/?copy=app&ref=copy-fallback');
  await expect(page.getByText('앱 주소를 복사했어요.',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'앱 주소 복사하기'}).click();
  await expect(page.getByText('앱 주소를 복사했어요.',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.copiedAddress)).toBe('http://127.0.0.1:5173/?ref=copy-fallback');
});
test('installation guide provides Samsung, Chrome and Safari steps',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'📱 홈화면에 설치하기'}).click();
  const guide=page.getByRole('dialog',{name:'홈 화면에 내짤4짤 설치하기'});
  await expect(guide).toBeVisible();
  await guide.getByRole('button',{name:'삼성 인터넷',exact:true}).click();
  await expect(guide.getByText('현재 페이지 추가',{exact:true})).toBeVisible();
  await guide.getByRole('button',{name:'Safari',exact:true}).click();
  await expect(guide.getByText('공유 버튼 누르기',{exact:true})).toBeVisible();
  await guide.getByRole('button',{name:'닫기',exact:true}).click();
  await expect(guide).toHaveCount(0);
});
test('install event during splash is retained and invokes native prompt',async({page})=>{
  await page.addInitScript(()=>{window.installCalls=0;window.addEventListener('DOMContentLoaded',()=>{const e=new Event('beforeinstallprompt',{cancelable:true});Object.defineProperties(e,{prompt:{value:async()=>{window.installCalls++;}},userChoice:{value:Promise.resolve({outcome:'accepted'})}});window.dispatchEvent(e);});});
  await page.goto('/');
  await page.getByRole('button',{name:'📱 홈화면에 설치하기'}).click();
  await expect.poll(()=>page.evaluate(()=>window.installCalls)).toBe(1);
  await expect(page.getByRole('dialog',{name:'홈 화면에 내짤4짤 설치하기'})).toHaveCount(0);
});
