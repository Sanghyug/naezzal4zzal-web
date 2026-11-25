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
  await page.getByRole('button',{name:'친구 초대 링크 공유',exact:true}).click();
  await expect(page.getByText('초대 링크를 복사했어요.')).toBeVisible();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toMatch(/^http:\/\/127\.0\.0\.1:5173\/\?ref=/);
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Cancelled','AbortError')}}));
  await page.getByRole('button',{name:'친구 초대 링크 공유',exact:true}).click();
  await expect(page.getByText('공유를 취소했어요. 초대 보상은 아직 지급되지 않았어요.')).toBeVisible();
  await page.getByText('계정 관리',{exact:true}).click();
  await expect(page.getByText('계정 탈퇴와 서버 자료 삭제',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'크레딧 닫기'}).click();
  await expect(page.getByRole('button',{name:'내 크레딧 5 · 내역'})).toBeFocused();
});
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
  expect(await page.evaluate(() => capturedShares[0])).toEqual({ text: "네 컷 사진을 짤과 영상으로!\n친구와의 추억을 공유하는 새로운 방법, 내짤4짤\n\nhttps://4zzal.com", names: ["naezzal4zzal.gif"] });
  await page.route("**/api/launch", async route => {
    const body = route.request().postDataJSON();
    if (body?.action === "work") await new Promise(resolve => setTimeout(resolve, 3000));
    return route.continue();
  });
  await page.getByRole("checkbox", { name: /사진 속 인물의 허락/ }).check();
  await page
    .getByRole("button", { name: "1크레딧으로 실사 영상 제작" })
    .click();
  const progress = page.getByRole("list", { name: "영상 제작 단계" });
  await expect(progress.getByRole("listitem")).toHaveCount(4);
  await expect(page.getByText("사진 속 인물들이 움직이고 있어요!")).toBeVisible();
  await progress.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/launch/phase3-stage-390.png" });
  const video = page.getByLabel("완성된 AI 영상");
  await expect(video).toHaveAttribute("src", /^blob:/, { timeout: 45000 });
  await expect(
    page.getByRole("button", { name: "내 크레딧 4 · 내역" }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/launch/phase3-completed-390.png",
  });
  await expect(gif).toHaveAttribute("src", gifSource);
  const studio = page.getByRole("region", { name: "AI 영상 제작" });
  await studio.getByText("앱 소개와 주소 공유").click();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await studio.getByRole("button", { name: "앱 주소 복사하기" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("https://4zzal.com");
  await studio.getByRole("button", { name: "다른 스타일로 영상 만들기" }).click();
  await expect(studio.getByRole("button", { name: /애니메이션.*3 크레딧/ })).toBeVisible();
  await expect(studio.getByRole("button", { name: "1크레딧으로 실사 영상 제작" })).toBeDisabled();
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
  await expect(page.getByText("원본에서 세부 조정")).toBeVisible();
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
    expect(metrics[0]).toEqual(metrics[1]);
    if (width === 390) {
      await page.getByRole("button", { name: /애니메이션.*3 크레딧/ }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: "artifacts/launch/phase3-editor-390.png" });
    }
  }
  await page.getByText("원본에서 세부 조정").click();
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
  await page.getByRole("button", { name: "1크레딧으로 실사 영상 제작" }).click();
  await expect(page.getByText("제작 실패가 확인되어 예약 크레딧을 복구했어요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "내 크레딧 5 · 내역" })).toBeVisible();
  await page.getByRole("button", { name: "다른 스타일로 영상 만들기" }).click();
  await page.getByRole("button", { name: /애니메이션.*3 크레딧/ }).click();
  await expect(page.getByRole("button", { name: "3크레딧으로 애니메이션 영상 제작" })).toBeDisabled();
  expect(generationRequests).toBe(1);
});
