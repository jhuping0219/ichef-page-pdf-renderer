const { chromium } = require('playwright');

(async () => {
  const url = process.env.STORE_URL;
  const companyName = process.env.COMPANY_NAME;
  const requestedLocale = process.env.BROWSER_LOCALE || 'zh-TW';

  if (!url) {
    throw new Error('缺少 STORE_URL');
  }

  if (!companyName) {
    throw new Error('缺少 COMPANY_NAME');
  }

  const locale =
    requestedLocale === 'en-US'
      ? 'en-US'
      : 'zh-TW';

  const acceptLanguage =
    locale === 'en-US'
      ? 'en-US,en;q=0.9'
      : 'zh-TW,zh;q=0.9,en;q=0.8';

  console.log('Browser locale:', locale);

  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome'
  });

  const context = await browser.newContext({
    locale,
    timezoneId: 'Asia/Taipei',
    viewport: {
      width: 1440,
      height: 1200
    },
    extraHTTPHeaders: {
      'Accept-Language': acceptLanguage
    }
  });

  const page = await context.newPage();

  // --------------------------------------------------
  // 1. 開啟 iCHEF 網頁
  // --------------------------------------------------

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log('DOM loaded');

  // 先讓 iCHEF 的 JavaScript 完成初步渲染
  await page.waitForTimeout(8000);

  // --------------------------------------------------
  // 2. 自動往下捲動
  //    讓 lazy-load 圖片 / 商品 / 元件盡可能先載入
  // --------------------------------------------------

  await page.evaluate(async () => {
    const sleep = (ms) =>
      new Promise(resolve => setTimeout(resolve, ms));

    const step = 700;

    let previousHeight = 0;
    let stableCount = 0;

    for (let i = 0; i < 100; i++) {
      const currentHeight =
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight
        );

      window.scrollBy(0, step);

      await sleep(120);

      const newHeight =
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight
        );

      if (newHeight === previousHeight) {
        stableCount++;
      } else {
        stableCount = 0;
      }

      previousHeight = newHeight;

      if (
        window.scrollY + window.innerHeight >=
          newHeight - 100 &&
        stableCount >= 3
      ) {
        break;
      }
    }

    window.scrollTo(0, 0);
  });

  await page.waitForTimeout(2000);

  // --------------------------------------------------
  // 3. 修改頂部餐廳名稱
  //
  // 原：
  // 基隆三兄弟豆花夜市攤販
  //
  // 改：
  // 基隆三兄弟豆花夜市攤販（公司名稱）
  // --------------------------------------------------

  const restaurantNameUpdated = await page.evaluate(
    (companyName) => {
      const restaurantName =
        document.querySelector(
          '[data-testid="StoreAuthHeader-storeName"]'
        );

      if (!restaurantName) {
        return false;
      }

      const originalName =
        restaurantName.textContent.trim();

      const suffix =
        `（${companyName}）`;

      if (!originalName.endsWith(suffix)) {
        restaurantName.textContent =
          `${originalName}${suffix}`;
      }

      return true;
    },
    companyName
  );

  if (!restaurantNameUpdated) {
    throw new Error(
      '找不到 StoreAuthHeader-storeName 餐廳名稱元素'
    );
  }

  console.log('Restaurant name updated');

  // --------------------------------------------------
  // 4. 清除列印時造成大量空白的版型高度
  // --------------------------------------------------

  await page.addStyleTag({
    content: `
      @media print {

        html,
        body,
        #app,
        #appPaper {
          height: auto !important;
          min-height: 0 !important;
        }

        [class*="FullViewportHeightLayoutContent"] {
          height: auto !important;
          min-height: 0 !important;
        }

        [data-testid="restaurantMenuPage"] {
          height: auto !important;
          min-height: 0 !important;
        }

        [class*="RestaurantMenuPage"] {
          min-height: 0 !important;
        }

      }
    `
  });

  // --------------------------------------------------
  // 5. 找出「巨大但完全沒有內容」的空白 spacer
  //
  // 這是目前 PDF 第 7～14 頁空白的主要處理邏輯。
  // --------------------------------------------------

  const removedSpacers = await page.evaluate(() => {
    const elements =
      Array.from(document.querySelectorAll('div'));

    let removed = 0;

    for (const el of elements) {
      // 不碰主要網站骨架
      if (
        el.id === 'app' ||
        el.id === 'appPaper'
      ) {
        continue;
      }

      const rect =
        el.getBoundingClientRect();

      // 只處理非常高的元素
      if (rect.height < 1000) {
        continue;
      }

      const text =
        (el.innerText || '')
          .replace(/\s+/g, '')
          .trim();

      const hasMedia =
        !!el.querySelector(
          'img, picture, svg, canvas, video'
        );

      const hasInteractive =
        !!el.querySelector(
          'button, a, input, select, textarea'
        );

      const hasMenuContent =
        !!el.querySelector(
          '[data-testid], [role="button"]'
        );

      // 必須真的完全沒有內容，才移除
      if (
        text.length === 0 &&
        !hasMedia &&
        !hasInteractive &&
        !hasMenuContent
      ) {
        el.style.setProperty(
          'height',
          '0',
          'important'
        );

        el.style.setProperty(
          'min-height',
          '0',
          'important'
        );

        el.style.setProperty(
          'margin',
          '0',
          'important'
        );

        el.style.setProperty(
          'padding',
          '0',
          'important'
        );

        el.style.setProperty(
          'overflow',
          'hidden',
          'important'
        );

        removed++;
      }
    }

    return removed;
  });

  console.log(
    'Removed blank spacers:',
    removedSpacers
  );

  // --------------------------------------------------
  // 6. 再處理可能把 footer 推到很下面的容器
  // --------------------------------------------------

  await page.evaluate(() => {
    const selectors = [
      '#app',
      '#appPaper',
      '[class*="FullViewportHeightLayoutContent"]',
      '[data-testid="restaurantMenuPage"]'
    ];

    for (const selector of selectors) {
      const elements =
        document.querySelectorAll(selector);

      elements.forEach(el => {
        el.style.setProperty(
          'min-height',
          '0',
          'important'
        );

        el.style.setProperty(
          'height',
          'auto',
          'important'
        );
      });
    }
  });

  await page.waitForTimeout(1000);

  // --------------------------------------------------
  // 7. PDF 使用螢幕版 CSS
  // --------------------------------------------------

  await page.emulateMedia({
    media: 'screen'
  });

  // --------------------------------------------------
  // 8. 輸出 PDF
  // --------------------------------------------------

  await page.pdf({
    path: 'output.pdf',
    format: 'A4',
    printBackground: true,

    margin: {
      top: '8mm',
      right: '8mm',
      bottom: '8mm',
      left: '8mm'
    },

    preferCSSPageSize: false
  });

  console.log('PDF saved');

  await browser.close();

})().catch(error => {
  console.error(error);
  process.exit(1);
});
