require('dotenv').config();
const querystring = require('querystring');
const colors = require('colors');
const puppeteer = require('puppeteer');

(async () => {

   async function getLocalStorage(p) {
    console.log('\tlocalStorage'.underline.bgRed);
    return await p.evaluate(() =>  Object.assign({}, window.localStorage));
  }

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/usr/bin/google-chrome',
  });
  const page = await browser.newPage()

  // This snoops on all client requests
  await page.setRequestInterception(true)
  let requestCount = 0;
  page.on('request', async request => {
    const url = new URL(await request.url())
    console.log(`--> ${requestCount++}:`.bgCyan + ` ${await request.method()} ${url.host}${url.pathname}`)

    // Show query params, if any
    if (url.search) {
      console.log(`\tQuery parameters sent:`.underline)
      let qs = querystring.parse(url.search.replace('?', ''))
      for (let key in qs) {
        console.log(`\t  ${key}: ${qs[key]}`)
      }
    }

    // Show POST data, if any
    //
    // Only uncomment this if you are executing in a safe place.
    //
    // Printing POST data will expose your password

    //const posted = await request.postData()
    //if (posted) {
    //  console.log(`\tPOSTed data:`.underline)
    //  let data = querystring.parse(posted)
    //  for (let key in data) {
    //    console.log(`\t  ${key}: ${data[key]}`)
    //  }
    //}

    console.log('\n')
    request.continue()
  })


  page.on('requestFinished', async request => {
    console.log(`\t  ${await getLocalStorage(page)}`);
  });

  // This snoops on all server responses
  let responseCount = 0;
  page.on('response', async response => {
    console.log(`<-- ${responseCount++}:`.bgBlue + ` ${await response.status()}`.green)

    const cookies = await page.cookies()
    if (cookies.length) {
      console.log(`\tCurrent cookies:`.underline)
      for (let cookie of cookies) {
        console.log(`\t  ${cookie.name}: ${cookie.domain}`)
      }
    }

//    const json = await page.evaluate(() => {
//      console.log("EVALUATE");
//      let json = {};
//      for (let i = 0; i < localStorage.length; i++) {
//        const key = localStorage.key(i);
//        json[key] = localStorage.getItem(key);
//      }
//      return json;
//    });
//    console.log('localStorage'.underline)
//    console.log(json)

    console.log('\n')
  })



  const navigationPromise = page.waitForNavigation()

  console.log('Request Identity from silid-server'.black.bgWhite);
  await page.goto('https://id.whatdandoes.info/')

  // Click Identity login link
  console.log('Click Login'.black.bgWhite);
  await page.waitForSelector('body #login-link')
  await page.click('body #login-link')

  await navigationPromise
  console.log(`\t  ${await getLocalStorage(page)}`);

  // Login with Google account
  console.log('Login with Google account'.black.bgWhite);

  await page.waitForSelector('button[type="submit"][data-provider="google"]')
  await page.click('button[type="submit"][data-provider="google"]')

  await navigationPromise
//  console.log(await getLocalStorage(page));

  // Enter email
  console.log('Enter email'.black.bgWhite);
  await page.waitForSelector('input[type="email"]')
  await page.type('input[type="email"]', process.env.EMAIL)
  await page.waitForSelector('#identifierNext')
  await page.click('#identifierNext')

  // Wait for password field to appear
  //
  // Can't wait for navigation, because the page URL doesn't change
  await page.waitForTimeout(2000)

  // Enter password
  console.log('Enter password'.black.bgWhite);
  await page.waitForSelector('input[type="password"]')
  await page.type('input[type="password"]', process.env.PASSWORD)
  await page.waitForSelector('#passwordNext')
  await page.click('#passwordNext')

  await navigationPromise
  console.log(`\t  ${await getLocalStorage(page)}`);

  // Wait for identity-react to load and then logout
  await page.waitForSelector('.MuiPaper-root > .MuiToolbar-root > #logout-button > .MuiButton-label > span')
  console.log('identity-react received. Logout...'.black.bgWhite);
  await page.click('.MuiPaper-root > .MuiToolbar-root > #logout-button > .MuiButton-label > span')

  await navigationPromise
  console.log(`\t  ${await getLocalStorage(page)}`);

  await page.waitForSelector('body #login-link')
  console.log('All SIL apps logged out'.black.bgBrightWhite);

  await browser.close()
})();
