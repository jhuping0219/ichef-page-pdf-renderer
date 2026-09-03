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

  console.log('Opening:', url);

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log('DOM loaded');

  await page.waitForTimeout(10000);

  console.log('TITLE:', await page.title());
  console.log('URL:', page.url());

  await page.screenshot({
    path: 'preview.png',
    fullPage: true
  });

  console.log('Screenshot saved');

  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
