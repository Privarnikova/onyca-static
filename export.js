/**
 * Снимает статическую копию сайта с локального WordPress в
 * ~/Desktop/onyca-static: главную (index.html), Контакты, прайс-лист,
 * страницы направлений, блог со статьями, правовые документы и
 * страницу 404 (404.html —
 * GitHub Pages сам отдаёт её на несуществующие адреса).
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
  { url: 'http://localhost:8080/', out: 'index.html' },
  { url: 'http://localhost:8080/contacts/', out: 'contacts.html' },
  { url: 'http://localhost:8080/services/', out: 'price-list.html' },
  { url: 'http://localhost:8080/services/branding/', out: 'branding.html' },
  { url: 'http://localhost:8080/services/ux-ui/', out: 'ux-ui.html' },
  { url: 'http://localhost:8080/services/cg-motion/', out: 'cg-motion.html' },
  { url: 'http://localhost:8080/services/design-support/', out: 'design-support.html' },
  { url: 'http://localhost:8080/blog/', out: 'blog.html' },
  { url: 'http://localhost:8080/policy/', out: 'policy.html' },
  { url: 'http://localhost:8080/cookie/', out: 'cookie.html' },
  { url: 'http://localhost:8080/no-such-page-for-404/', out: '404.html' },
];

/*
 * Внутренние адреса, которые в копии существуют. Порядок важен: сначала
 * длинные пути (/services/branding/), иначе более короткий /services/
 * подменил бы их начало.
 */
const ROUTES = [
  ['/services/branding/', 'branding.html'],
  ['/services/ux-ui/', 'ux-ui.html'],
  ['/services/cg-motion/', 'cg-motion.html'],
  ['/services/design-support/', 'design-support.html'],
  ['/services/', 'price-list.html'],
  ['/contacts/', 'contacts.html'],
  ['/blog/', 'blog.html'],
  ['/policy/', 'policy.html'],
  ['/cookie/', 'cookie.html'],
];
/*
 * Адреса с параметрами и страницы пагинации: заменяются целиком, а не по
 * пути. Заполняется в collectBlogViews().
 */
const EXACT = [];

const OUT = path.join(process.env.HOME, 'Desktop/onyca-static');
const FILES = path.join(OUT, 'index_files');

/**
 * Статьи и услуги в список страниц вручную не вписываем: их количество
 * меняется. Берём адреса из карт сайта — там перечислены все записи
 * нужного типа, включая те, на которые нет ссылок в меню и списках.
 *
 * @param {import('playwright').Browser} browser
 * @param {string} sitemap Имя карты, например 'post-sitemap.xml'.
 * @param {string} prefix  Начало имени файла в копии.
 */
async function collectFromSitemap( browser, sitemap, prefix ) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  await page.goto('http://localhost:8080/', { waitUntil: 'load' });

  const xml = await page.evaluate(
    async url => ( await fetch( url ) ).text(),
    'http://localhost:8080/' + sitemap
  );

  await page.close();

  const links = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

  for (const link of links) {
    /* Карта записей включает и саму страницу блога — она уже в списке */
    if (PAGES.some(page => page.url === link)) {
      continue;
    }

    const pathname = new URL(link).pathname;
    /* Имя файла — последний кусок адреса: у услуг перед ним ещё лежит
       направление, и оно в имени не нужно */
    const slug = pathname.replace(/\/$/, '').split('/').pop();
    const out = prefix + slug + '.html';

    PAGES.splice(PAGES.length - 1, 0, { url: link, out });
    ROUTES.push([pathname, out]);
  }

  /* Длинные пути должны стоять раньше коротких — иначе короткий
     подменит начало длинного */
  ROUTES.sort((a, b) => b[0].length - a[0].length);
}

/**
 * Виды страницы блога: фильтры по темам и страницы пагинации.
 *
 * На живом сайте это адреса с параметром (?topic=…) и /page/2/ — в копии
 * их нет, поэтому каждый вид снимается отдельным файлом, а ссылки на них
 * переписываются на эти файлы. Так в статике работают и табы, и
 * пагинация, и кнопка «Посмотреть еще» (она догружает следующую
 * страницу тем же адресом).
 *
 * @param {import('playwright').Browser} browser
 */
async function collectBlogViews( browser ) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  await page.goto('http://localhost:8080/blog/', { waitUntil: 'load' });

  const topics = await page.evaluate(() =>
    [...document.querySelectorAll('.blog-page__filters .tab-pill')]
      .map(link => link.href)
      .filter(href => href.includes('topic='))
  );

  for (const url of topics) {
    const slug = new URL(url).searchParams.get('topic');
    const out = 'blog-topic-' + slug + '.html';

    PAGES.splice(PAGES.length - 1, 0, { url, out });
    EXACT.push([url, out]);
  }

  /* Страницы пагинации: идём по кнопке «Посмотреть еще», пока она есть */
  let next = await page.evaluate(() => {
    const link = document.querySelector('[data-load-more]');
    return link ? link.href : '';
  });

  for (let number = 2; next; number++) {
    const out = 'blog-page-' + number + '.html';

    PAGES.splice(PAGES.length - 1, 0, { url: next, out });
    EXACT.push([next, out]);

    await page.goto(next, { waitUntil: 'load' });

    next = await page.evaluate(() => {
      const link = document.querySelector('[data-load-more]');
      return link ? link.href : '';
    });
  }

  await page.close();
}

(async () => {
  const executablePath = findChromium();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});

  await collectFromSitemap(browser, 'post-sitemap.xml', 'article-');
  await collectFromSitemap(browser, 'service-sitemap.xml', 'service-');
  await collectBlogViews(browser);
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

    // Прокрутка до низа и обратно: так подгружаются ленивые картинки
    // (обложки проектов, логотипы), а анимации первого экрана
    // возвращаются в исходное состояние — иначе в снимок попал бы
    // разросшийся шоурил.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1200);

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

    /*
     * Точные адреса — первыми: у фильтров и страниц пагинации путь
     * начинается с /blog/, и правило по пути отрезало бы у них хвост
     * («?topic=…», «page/2/»).
     */
    for (const [url, file] of EXACT) {
      html = html.split(url).join(file);
    }

    // Внутренние адреса: страницы из PAGES ведут на свои файлы,
    // остальное (Проекты, Блог, отдельные услуги) на статике не
    // существует — такие ссылки гасим, чтобы они не вели на localhost.
    for (const [route, file] of ROUTES) {
      const base = 'http://localhost:8080' + route;
      html = html.split(base + '#').join('#');
      html = html.split(base).join(file);
    }

    html = html.replace(/http:\/\/localhost:8080\/"/g, 'index.html"');
    html = html.replace(/http:\/\/localhost:8080\/'/g, "index.html'");
    html = html.replace(/http:\\?\/\\?\/localhost:8080\\?\/[^"'\s>]*/g,
      'https://privarnikova.github.io/onyca-static/');
    // Адрес без пути — так он записан в разметке Yoast (JSON-LD), где
    // слэши экранированы: предыдущее правило его не ловит.
    html = html.replace(/http:\\?\/\\?\/localhost:8080/g, 'https://privarnikova.github.io/onyca-static');
    html = html.replace(/href="https:\/\/privarnikova\.github\.io\/onyca-static\/"/g, 'href="index.html"');
    html = html.replace(/http:\/\/localhost:8080\/[^"'\s>]*/g, '#');

    fs.writeFileSync(path.join(OUT, page.out), html);
    console.log(page.out + ': localhost —', (html.match(/localhost/g) || []).length);
  }

  console.log('файлов в index_files:', fs.readdirSync(FILES).length);
})();
