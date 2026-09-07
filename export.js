/**
 * Снимает статическую копию сайта с локального WordPress в
 * ~/Desktop/onyca-static: страницу Контактов (index.html) и страницу 404
 * (404.html — GitHub Pages сам отдаёт её на несуществующие адреса).
 *
 * Скачивает стили, скрипты, картинки и шрифты в index_files/, переписывает
 * пути на относительные, убирает ссылки на localhost и служебные скрипты
 * WordPress, которые на статике падают с ошибкой.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Playwright ждёт браузер строго своей ревизии и, не найдя, требует
 * `npx playwright install`. Качать сотню мегабайт незачем: сначала
 * смотрим в кеш Playwright, потом — на обычный Chrome из /Applications.
 * Ничего не нашли — оставляем пустым, тогда Playwright сам скажет, что
 * нужно доустановить. Тот же приём, что в tests/playwright.config.js.
 */
function findChromium() {
  if (process.env.CHROMIUM_PATH) {
    return process.env.CHROMIUM_PATH;
  }

  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');

  if (fs.existsSync(cache)) {
    const dirs = fs.readdirSync(cache).filter(n => n.startsWith('chromium-')).sort().reverse();

    for (const dir of dirs) {
      const macOs = path.join(cache, dir, 'chrome-mac-arm64');
      if (!fs.existsSync(macOs)) continue;
      const app = fs.readdirSync(macOs).find(n => n.endsWith('.app'));
      if (!app) continue;
      const binary = path.join(macOs, app, 'Contents/MacOS', app.replace('.app', ''));
      if (fs.existsSync(binary)) return binary;
    }
  }

  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  return fs.existsSync(chrome) ? chrome : undefined;
}

const PAGES = [
  { url: 'http://localhost:8080/contacts/', out: 'index.html' },
  { url: 'http://localhost:8080/no-such-page-for-404/', out: '404.html' },
];
const OUT = path.join(process.env.HOME, 'Desktop/onyca-static');
const FILES = path.join(OUT, 'index_files');

(async () => {
  const executablePath = findChromium();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const assets = new Map();
  const pages = [];

  for (const item of PAGES) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

    page.on('response', async r => {
      const u = r.url();
      if (!/\.(css|js|svg|woff2?|ttf|png|jpe?g)(\?|$)/i.test(u)) return;
      if (u.includes('wp-emoji')) return;
      if (assets.has(u)) return;
      try { assets.set(u, await r.body()); } catch (e) {}
    });

    await page.goto(item.url, { waitUntil: 'load' });
    await page.waitForTimeout(1500);

    // Баннер cookie на живой странице уже раскрыт скриптом — в копию он
    // должен попасть скрытым, иначе у посетителя появится до проверки согласия
    await page.evaluate(() => {
      const banner = document.querySelector('[data-cookie-banner]');
      if (banner) {
        banner.hidden = true;
        banner.removeAttribute('data-accepted');
      }
    });

    pages.push({ out: item.out, html: await page.content() });
    await page.close();
  }

  await browser.close();

  fs.rmSync(FILES, { recursive: true, force: true });
  fs.mkdirSync(FILES, { recursive: true });

  const map = new Map();
  for (const [url, body] of assets) {
    const name = path.basename(new URL(url).pathname);
    fs.writeFileSync(path.join(FILES, name), body);
    map.set(url, name);
  }

  const rewrite = (text, prefix) => {
    for (const [url, name] of map) {
      const bare = url.split('?')[0];
      text = text.split(url).join(prefix + name);
      text = text.split(bare).join(prefix + name);
    }
    return text;
  };

  for (const name of fs.readdirSync(FILES)) {
    if (!name.endsWith('.css')) continue;
    const f = path.join(FILES, name);
    let css = rewrite(fs.readFileSync(f, 'utf8'), './');
    css = css.replace(/url\((['"]?)\.\.\/[^)'"]*\/([^)'"\/]+)\1\)/g, "url('./$2')");
    fs.writeFileSync(f, css);
  }

  for (const page of pages) {
    let html = rewrite(page.html, './index_files/');

    html = html.replace(/<script id="wp-emoji-settings"[^>]*>[\s\S]*?<\/script>\s*/g, '');
    html = html.replace(/<script[^>]*>(?:(?!<\/script>)[\s\S])*?_wpemojiSettings[\s\S]*?<\/script>\s*/g, '');
    html = html.replace(/<script[^>]*wp-emoji-release[^>]*><\/script>\s*/g, '');

    html = html.replace(/http:\/\/localhost:8080\/contacts\/#/g, '#');
    html = html.replace(/http:\/\/localhost:8080\/contacts\//g, 'index.html');
    html = html.replace(/http:\\?\/\\?\/localhost:8080\\?\/[^"'\s>]*/g,
      'https://privarnikova.github.io/onyca-static/');
    html = html.replace(/href="https:\/\/privarnikova\.github\.io\/onyca-static\/"/g, 'href="index.html"');
    html = html.replace(/http:\/\/localhost:8080\/[^"'\s>]*/g, '#');

    fs.writeFileSync(path.join(OUT, page.out), html);
    console.log(page.out + ': localhost —', (html.match(/localhost/g) || []).length);
  }

  console.log('файлов в index_files:', fs.readdirSync(FILES).length);
})();
