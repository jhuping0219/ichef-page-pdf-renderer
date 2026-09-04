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

  // 啟動 GitHub Runner 內建的 Chrome
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

  // 開啟 iCHEF 線上點餐頁
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log('DOM loaded');

  // 等待 iCHEF 前端 JavaScript 完成主要畫面渲染
  await page.waitForTimeout(10000);

  // 將公司名稱加入頂部餐廳名稱後方
  //
  // 原本：
  // 基隆三兄弟豆花夜市攤販
  //
  // 產出：
  // 基隆三兄弟豆花夜市攤販（資廚管理顧問股份有限公司）
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

  // 使用螢幕顯示樣式輸出
  await page.emulateMedia({
    media: 'screen'
  });

  // 產生 PDF
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
