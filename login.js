const fs = require('fs');
const puppeteer = require('puppeteer');

function formatToISO(date) {
  return date.toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d{3}Z/, '');
}

async function delayTime(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  // 读取 accounts.json 中的 JSON 字符串
  const accountsJson = fs.readFileSync('accounts.json', 'utf-8');
  const accounts = JSON.parse(accountsJson);

  for (const account of accounts) {
    const { username, password, panelnum } = account;

    const browser = await puppeteer.launch({ 
      headless: false,  // 如果在服务器(如GitHub Actions)运行，通常需要改为 'new' 或 true
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-software-rasterizer'
      ]
    });
    const page = await browser.newPage();

    // 设置一个真实的用户代理，防止因为默认的Headless UA被拦截
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    let url = `https://panel${panelnum}.serv00.com/login/?next=/`;

    try {
      console.log(`正在登录账号: ${username} ...`);
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // 等待用户名输入框加载 (ID依然是 id_username)
      await page.waitForSelector('#id_username');

      // 清空用户名输入框的原有值
      const usernameInput = await page.$('#id_username');
      if (usernameInput) {
        await usernameInput.click({ clickCount: 3 });
        await usernameInput.press('Backspace');
      }

      // 输入实际的账号和密码
      await page.type('#id_username', username, { delay: 50 });
      await page.type('#id_password', password, { delay: 50 });
      // 提交登录表单
      const submitSelector = 'button[type="submit"]';
      const loginButton = await page.$(submitSelector);

      if (loginButton) {
        await Promise.all([
          page.waitForNavigation(),
          loginButton.click()
        ]);
      } else {
        throw new Error('无法找到登录按钮 (button[type="submit"])');
      }

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }), // 等待页面跳转
        page.click(submitSelector) // 点击登录按钮
      ]);
      const isLoggedIn = await page.evaluate(() => {
        // 检查是否存在含有 logout 字样的链接
        const logoutLinks = document.querySelector('a[href*="logout"]');
        return logoutLinks !== null;
      });

      if (isLoggedIn) {
        const nowUtc = formatToISO(new Date());
        const nowBeijing = formatToISO(new Date(new Date().getTime() + 8 * 60 * 60 * 1000));
        console.log(`✅ 账号 ${username} 于北京时间 ${nowBeijing}（UTC时间 ${nowUtc}）登录成功！`);
      } else {
        console.error(`❌ 账号 ${username} 登录失败，未能检测到登录后的状态。`);
      }

    } catch (error) {
      console.error(`❌ 账号 ${username} 登录时出现错误: ${error.message}`);
    } finally {
      await page.close();
      await browser.close();

      const delay = Math.floor(Math.random() * 8000) + 1000; 
      await delayTime(delay);
    }
  }

  console.log('所有账号登录完成！');
})();
