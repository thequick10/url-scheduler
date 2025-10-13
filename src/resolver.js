import puppeteer from 'puppeteer-core';

export function getRegionZoneMap() {
  return {
    US: process.env.BRIGHTDATA_US_PROXY,
    CA: process.env.BRIGHTDATA_CA_PROXY,
    GB: process.env.BRIGHTDATA_GB_PROXY,
    IN: process.env.BRIGHTDATA_IN_PROXY,
    AU: process.env.BRIGHTDATA_AU_PROXY,
    DE: process.env.BRIGHTDATA_DE_PROXY,
    FR: process.env.BRIGHTDATA_FR_PROXY,
    JP: process.env.BRIGHTDATA_JP_PROXY,
    SG: process.env.BRIGHTDATA_SG_PROXY,
    BR: process.env.BRIGHTDATA_BR_PROXY,
    TW: process.env.BRIGHTDATA_TW_PROXY,
    CZ: process.env.BRIGHTDATA_CZ_PROXY,
    UA: process.env.BRIGHTDATA_UA_PROXY,
    AE: process.env.BRIGHTDATA_AE_PROXY,
    PL: process.env.BRIGHTDATA_PL_PROXY,
    ES: process.env.BRIGHTDATA_ES_PROXY,
    ID: process.env.BRIGHTDATA_ID_PROXY,
    ZA: process.env.BRIGHTDATA_ZA_PROXY,
    MX: process.env.BRIGHTDATA_MX_PROXY,
    MY: process.env.BRIGHTDATA_MY_PROXY,
    IT: process.env.BRIGHTDATA_IT_PROXY,
    TH: process.env.BRIGHTDATA_TH_PROXY,
    NL: process.env.BRIGHTDATA_NL_PROXY,
    AR: process.env.BRIGHTDATA_AR_PROXY,
    BY: process.env.BRIGHTDATA_BY_PROXY,
    RU: process.env.BRIGHTDATA_RU_PROXY,
    IE: process.env.BRIGHTDATA_IE_PROXY,
    HK: process.env.BRIGHTDATA_HK_PROXY,
    KZ: process.env.BRIGHTDATA_KZ_PROXY,
    NZ: process.env.BRIGHTDATA_NZ_PROXY,
    TR: process.env.BRIGHTDATA_TR_PROXY,
    DK: process.env.BRIGHTDATA_DK_PROXY,
    GR: process.env.BRIGHTDATA_GR_PROXY,
    NO: process.env.BRIGHTDATA_NO_PROXY,
    AT: process.env.BRIGHTDATA_AT_PROXY,
    IS: process.env.BRIGHTDATA_IS_PROXY,
    SE: process.env.BRIGHTDATA_SE_PROXY,
    PT: process.env.BRIGHTDATA_PT_PROXY,
    CH: process.env.BRIGHTDATA_CH_PROXY,
    BE: process.env.BRIGHTDATA_BE_PROXY,
    PH: process.env.BRIGHTDATA_PH_PROXY,
    IL: process.env.BRIGHTDATA_IL_PROXY,
    MD: process.env.BRIGHTDATA_MD_PROXY,
    RO: process.env.BRIGHTDATA_RO_PROXY,
    CL: process.env.BRIGHTDATA_CL_PROXY,
    SA: process.env.BRIGHTDATA_SA_PROXY,
    FI: process.env.BRIGHTDATA_FI_PROXY,
    LI: process.env.BRIGHTDATA_LI_PROXY
  };
}

const userAgents = {
  desktop: [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:139.0) Gecko/20100101 Firefox/139.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.61",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
  ],
  mobile: [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; SM-S926B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/123.0 Mobile/15E148 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; moto g power (2023)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 15; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/124.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 14; OnePlus 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
  ]
};

export function getBrowserWss(regionCode) {
  const regionZoneMap = getRegionZoneMap();
  const zone = regionZoneMap[regionCode?.toUpperCase()];
  const password = process.env.BRIGHTDATA_PASSWORD;

  if (!zone || !password) {
    throw new Error(`Missing proxy configuration for region: ${regionCode}`);
  }

  return `wss://${zone}:${password}@brd.superproxy.io:9222`;
}

function getRandomUserAgent(type) {
  let uaType = type;
  if (!uaType || uaType === 'random' || (uaType !== 'desktop' && uaType !== 'mobile')) {
    uaType = Math.random() < 0.5 ? 'desktop' : 'mobile';
  }
  const uaList = userAgents[uaType];
  const userAgent = uaList[Math.floor(Math.random() * uaList.length)];
  return { userAgent, isMobile: uaType === 'mobile', uaType };
}

export async function resolveWithBrowserAPI(inputUrl, region = "US", uaType) {
  const browserWSEndpoint = getBrowserWss(region);
  const browser = await puppeteer.connect({ browserWSEndpoint });

  try {
    const page = await browser.newPage();
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const blockedResources = ["image", "stylesheet", "font", "media", "other"];
      if (blockedResources.includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
    console.log(`[INFO] Resolving URL: [${inputUrl}] with region: [${region}]`);
    const { userAgent, isMobile } = getRandomUserAgent(uaType);
    console.log(`[INFO] Using ${isMobile ? 'Mobile' : 'Desktop'} User-Agent:\n${userAgent}`);
    await page.setUserAgent(userAgent);

    if (isMobile) {
      await page.setViewport({
        width: 375 + Math.floor(Math.random() * 20) - 10,
        height: 812 + Math.floor(Math.random() * 20) - 10,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      });
    } else {
      await page.setViewport({
        width: 1366 + Math.floor(Math.random() * 20) - 10,
        height: 768 + Math.floor(Math.random() * 20) - 10,
        isMobile: false,
      });
    }

    page.setDefaultNavigationTimeout(20000);

    const envTimeout = Number(process.env.NAVIGATION_TIMEOUT);
    const timeout = isNaN(envTimeout) ? 60000 : envTimeout;

    if (!isNaN(envTimeout)) {
        console.log(`[INFO] Using navigation timeout: ${timeout} ms`);
    } else {
        console.log("[INFO] Using default timeout of 60000 ms");
    }

    if (!inputUrl || typeof inputUrl !== 'string' || !inputUrl.startsWith('http')) {
        console.error('[ERROR] Invalid or missing input URL:', inputUrl);
        process.exit(1);
    }

    try {
      await page.goto(inputUrl, { waitUntil: "domcontentloaded", timeout: timeout });
    } catch (err) {
      console.error(`[ERROR] Failed to navigate to ${inputUrl}:`, err.message);
    }

    await page.waitForSelector("body", {timeout: 120000});

    const finalUrl = page.url();

    const ipData = await page.evaluate(async () => {
      try {
        const res = await fetch("https://get.geojs.io/v1/ip/geo.json");
        return await res.json();
      } catch (e) {
        return { error: "IP lookup failed" };
      }
    });

    console.log(`[INFO] Final URL: [${finalUrl}]`);

    console.log(`→ URLs Resolved with [${region}] Check IP Data ⤵`);
    if (ipData?.ip) {
        console.log(`🌍 IP Info : ${ipData.ip} (${ipData.country || "Unknown Country"} - ${ipData.region || "Unknown Region"} - ${ipData.country_code || "Unknown country_code"})`);
        console.log(`🔍 Region Match: ${ipData.country_code?.toUpperCase() === region.toUpperCase() ? '✅ REGION MATCHED' : '❌ REGION MISMATCH'}`);
    }

    return { finalUrl, ipData };
  } catch(err){
    console.log(`[ERROR] ${err.message}`);
    return {error: err.message};
  } finally {
    await browser.disconnect();
  }
}