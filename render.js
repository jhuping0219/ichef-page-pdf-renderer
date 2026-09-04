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

  // 保留之前測試成功的等待時間
  await page.waitForTimeout(10000);

  // --------------------------------------------------
  // 2. 嘗試等待餐廳名稱元素
  // --------------------------------------------------

  try {
    await page.waitForSelector(
      '[data-testid="StoreAuthHeader-storeName"]',
      {
        timeout: 5000
      }
    );
  } catch (error) {
    console.log(
      'StoreAuthHeader-storeName not found after waiting'
    );
  }

  // --------------------------------------------------
  // 3. 修改頂部餐廳名稱
  //
  // 會依序嘗試多個 selector
  // 找不到也不會中止 PDF
  // --------------------------------------------------

  const restaurantResult = await page.evaluate(
    (companyName) => {
      const selectors = [
        '[data-testid="StoreAuthHeader-storeName"]',
        '[data-test-id="StoreAuthHeader-storeName"]',
        'header h4',
        'header [class*="StoreName"]'
      ];

      let element = null;
      let usedSelector = '';

      for (const selector of selectors) {
        const found =
          document.querySelector(selector);

        if (found) {
          const text =
            (found.textContent || '')
              .trim();

          if (text) {
            element = found;
            usedSelector = selector;
            break;
          }
        }
      }

      if (!element) {
        return {
          updated: false,
          selector: ''
        };
      }

      const originalName =
        element.textContent.trim();

      const suffix =
        `（${companyName}）`;

      if (!originalName.endsWith(suffix)) {
        element.textContent =
          `${originalName}${suffix}`;
      }

      return {
        updated: true,
        selector: usedSelector,
        originalName
      };
    },
    companyName
  );

  if (restaurantResult.updated) {
    console.log(
      'Restaurant name updated with selector:',
      restaurantResult.selector
    );
  } else {
    console.log(
      'WARNING: Restaurant name element not found. PDF will still continue.'
    );
  }

  // --------------------------------------------------
  // 4. 修正造成 PDF 大量空白的高度
  // --------------------------------------------------

  await page.evaluate(() => {
    const selectors = [
      'html',
      'body',
      '#app',
      '#appPaper',
      '[class*="FullViewportHeightLayoutContent"]',
      '[data-testid="restaurantMenuPage"]',
      '[data-test-id="restaurantMenuPage"]',
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

      [data-testid="restaurantMenuPage"],
      [data-test-id="restaurantMenuPage"] {
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
  // 6. 使用螢幕樣式輸出 PDF
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
