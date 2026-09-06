/**
 * Снимает статическую копию страницы Контакты с локального WordPress
 * в ~/Desktop/onyca-static: скачивает стили, скрипт, картинки и шрифты
 * в index_files/, переписывает пути на относительные, убирает ссылки на
 * localhost и служебные скрипты WordPress.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SRC = 'http://localhost:8080/contacts/';
const OUT = path.join(process.env.HOME, 'Desktop/onyca-static');
const FILES = path.join(OUT, 'index_files');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  const assets = new Map();
  page.on('response', async r => {
    const u = r.url();
    if (!/\.(css|js|svg|woff2?|ttf|png|jpe?g)(\?|$)/i.test(u)) return;
    if (u.includes('wp-emoji')) return;
    try { assets.set(u, await r.body()); } catch (e) {}
  });

  await page.goto(SRC, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  let html = await page.content();
  await browser.close();

  fs.rmSync(FILES, { recursive: true, force: true });
  fs.mkdirSync(FILES, { recursive: true });

  // карта: исходный URL → имя файла рядом с index.html
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

  // пути внутри самих стилей — файлы лежат рядом
  for (const name of fs.readdirSync(FILES)) {
    if (!name.endsWith('.css')) continue;
    const f = path.join(FILES, name);
    let css = rewrite(fs.readFileSync(f, 'utf8'), './');
    css = css.replace(/url\((['"]?)\.\.\/[^)'"]*\/([^)'"\/]+)\1\)/g, "url('./$2')");
    fs.writeFileSync(f, css);
  }

  html = rewrite(html, './index_files/');

  // служебные скрипты WordPress: на статике падают с ошибкой
  html = html.replace(/<script id="wp-emoji-settings"[^>]*>[\s\S]*?<\/script>\s*/g, '');
  html = html.replace(/<script[^>]*>(?:(?!<\/script>)[\s\S])*?_wpemojiSettings[\s\S]*?<\/script>\s*/g, '');
  html = html.replace(/<script[^>]*wp-emoji-release[^>]*><\/script>\s*/g, '');

  // ссылки: страница Контакты — это сама копия, остальных страниц в ней нет
  html = html.replace(/http:\/\/localhost:8080\/contacts\/#/g, '#');
  html = html.replace(/http:\/\/localhost:8080\/contacts\//g, 'index.html');
  html = html.replace(/http:\\?\/\\?\/localhost:8080\\?\/[^"'\s>]*/g,
    'https://privarnikova.github.io/onyca-static/');
  html = html.replace(/href="https:\/\/privarnikova\.github\.io\/onyca-static\/"/g, 'href="#"');
  html = html.replace(/http:\/\/localhost:8080\/[^"'\s>]*/g, '#');

  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log('файлов в index_files:', fs.readdirSync(FILES).length);
  console.log('localhost в index.html:', (html.match(/localhost/g) || []).length);
})();
