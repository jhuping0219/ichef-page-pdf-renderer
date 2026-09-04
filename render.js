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

  // 開啟 iCHEF 頁面
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log('DOM loaded');

  // 保留原本已驗證成功的等待方式
  await page.waitForTimeout(10000);

  // 修改頁面頂部的餐廳名稱
  const result = await page.evaluate((companyName) => {
    const selectors = [
      '[data-testid="StoreAuthHeader-storeName"]',
      '[data-test-id="StoreAuthHeader-storeName"]',
      'header h4',
      'header [class*="StoreName"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);

      if (!element) {
        continue;
      }

      const originalName =
        (element.textContent || '').trim();

      if (!originalName) {
        continue;
      }

      const suffix = `（${companyName}）`;

      if (!originalName.endsWith(suffix)) {
        element.textContent =
          `${originalName}${suffix}`;
      }

      return {
        updated: true,
        selector
      };
    }

    return {
      updated: false,
      selector: ''
    };
  }, companyName);

  if (result.updated) {
    console.log(
      'Restaurant name updated:',
      result.selector
    );
  } else {
    console.log(
      'WARNING: Restaurant name was not found.'
    );
  }

  // 使用畫面顯示樣式
  await page.emulateMedia({
    media: 'screen'
  });

  // 輸出 PDF
  await page.pdf({
    path: 'output.pdf',
    format: 'A4',
    printBackground: true,
    margin: {
      top: '10mm',
      right: '8mm',
      bottom: '10mm',
      left: '8mm'
    }
  });

  console.log('PDF saved');

  await browser.close();

})().catch(error => {
  console.error(error);
  process.exit(1);
});
