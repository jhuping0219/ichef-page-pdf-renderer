const { chromium } = require('playwright');

(async () => {
  const url = process.env.STORE_URL;

  if (!url) {
    throw new Error('缺少 STORE_URL');
  }

  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 1200
    }
  });

  await page.goto(url, {
    waitUntil: 'networkidle',
    timeout: 60000
  });

  await page.waitForTimeout(5000);

  console.log('TITLE:', await page.title());
  console.log('URL:', page.url());

  await page.screenshot({
    path: 'preview.png',
    fullPage: true
  });

  await browser.close();
})();
