import { paymentWebhook } from "../server/launch/paymentWebhook.ts";

export default {
  fetch(request: Request) {
    return paymentWebhook(request, async () => {
      const { runtime } = await import("../server/launch/runtime.ts");
      return (await runtime()).service;
    });
  },
};
