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

  console.log('Opening:', url);
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

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log('DOM loaded');

  // 等待 iCHEF 頁面的 JavaScript 完成主要渲染
  await page.waitForTimeout(10000);

  console.log('TITLE:', await page.title());
  console.log('URL:', page.url());

  console.log(
    'navigator.language:',
    await page.evaluate(() => navigator.language)
  );

  console.log(
    'navigator.languages:',
    await page.evaluate(() => navigator.languages)
  );

  // 在整個網頁最上方加入公司名稱
  await page.evaluate((name) => {
    const header = document.createElement('div');

    header.textContent = name;

    header.style.cssText = `
      width: 100%;
      box-sizing: border-box;
      padding: 24px 32px;
      background: #ffffff;
      color: #222222;
      font-size: 26px;
      font-weight: 700;
      line-height: 1.5;
      border-bottom: 1px solid #dddddd;
      font-family: Arial, "Noto Sans TC", sans-serif;
    `;

    document.body.insertBefore(
      header,
      document.body.firstChild
    );
  }, companyName);

  await page.emulateMedia({
    media: 'screen'
  });

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
