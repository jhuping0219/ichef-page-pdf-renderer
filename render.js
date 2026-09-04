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

  // --------------------------------------------------
  // 1. 啟動 Chrome
  // --------------------------------------------------

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
  // 2. 開啟 iCHEF 網頁
  // --------------------------------------------------

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log('DOM loaded');

  // 保留之前已經測試成功的等待方式
  await page.waitForTimeout(10000);

  // --------------------------------------------------
  // 3. 修改頂部餐廳名稱
  //
  // 原本：
  // 基隆三兄弟豆花夜市攤販
  //
  // 修改：
  // 基隆三兄弟豆花夜市攤販（公司名稱）
  // --------------------------------------------------

  const updated = await page.evaluate((companyName) => {
    const element = document.querySelector(
      '[data-testid="StoreAuthHeader-storeName"]'
    );

    if (!element) {
      return false;
    }

    const originalName =
      element.textContent.trim();

    const suffix =
      `（${companyName}）`;

    if (!originalName.endsWith(suffix)) {
      element.textContent =
        `${originalName}${suffix}`;
    }

    return true;
  }, companyName);

  if (!updated) {
    throw new Error(
      '找不到餐廳名稱元素：StoreAuthHeader-storeName'
    );
  }

  console.log('Restaurant name updated');

  // --------------------------------------------------
  // 4. 修正 iCHEF 頁面造成 PDF 大量空白的高度設定
  //
  // 不再掃描所有 div。
  // 只處理我們已經確認存在的主要版型容器。
  // --------------------------------------------------

  await page.evaluate(() => {
    const selectors = [
      'html',
      'body',
      '#app',
      '#appPaper',
      '[class*="FullViewportHeightLayoutContent"]',
      '[data-testid="restaurantMenuPage"]',
      '[class*="RestaurantMenuPage__Wrapper"]'
    ];

    selectors.forEach((selector) => {
      document
        .querySelectorAll(selector)
        .forEach((element) => {
          element.style.setProperty(
            'min-height',
            '0',
            'important'
          );

          element.style.setProperty(
            'height',
            'auto',
            'important'
          );

          element.style.setProperty(
            'max-height',
            'none',
            'important'
          );
        });
    });
  });

  // --------------------------------------------------
  // 5. 加入 PDF 專用 CSS
  // --------------------------------------------------

  await page.addStyleTag({
    content: `
      html,
      body {
        height: auto !important;
        min-height: 0 !important;
      }

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

      [class*="RestaurantMenuPage__Wrapper"] {
        height: auto !important;
        min-height: 0 !important;
      }
    `
  });

  await page.waitForTimeout(1000);

  // --------------------------------------------------
  // 6. 使用畫面上的 CSS 樣式輸出
  // --------------------------------------------------

  await page.emulateMedia({
    media: 'screen'
  });

  // --------------------------------------------------
  // 7. 輸出 PDF
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
    }
  });

  console.log('PDF saved');

  await browser.close();

})().catch(error => {
  console.error(error);
  process.exit(1);
});
