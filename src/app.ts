import fs from "fs";
import { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import config from "./config.json"

let _start = 18

const md5 = (plain: string) => crypto.createHash('md5').update(plain).digest("hex")
const wait = (mill: number) => (new Promise(resolve => setTimeout(resolve, Math.max(mill, 1000))))

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

let showImage = false
let browser: Browser

const metaFields = [
    "serveLv",
    "serveList",
    "consumeLv",
    "consumeAllNight",
    "girlBeauty",
    "girlAge",
    "girlNum",
    "score",
    "environment",
]

const contactFields = [
    "address",
    "email",
    "phone",
    "qq",
    "wechat",
    "telegram",
    "yuni",
]

const isValidValue = (value: string) => !["无", "示例信息1", '示例信息2'].includes(value)

const rootDir = path.resolve(__dirname, '../')

const domain = "https://mao527.xyz"
const initPuppeteer = async () => {
    const profileDir = `${__dirname}/../user-1`

    browser = await puppeteer.launch({
        protocolTimeout: 360000000,
        // headless: false, 
        headless: 'shell',
        args: [
            `--window-position=100,100`,
            `--window-size=1000,600`,
            '--disable-features=site-per-process',
            "--fast-start", 
            "--disable-extensions", 
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--disable-gpu",
        ],
        userDataDir: profileDir,
    });
    
    const page = await browser.newPage();
    await page.setRequestInterception(true);

    page.on('request', (req) => {
        const resourceType = req.resourceType()
        // req.continue();
        if (!showImage && (resourceType == 'font' || resourceType == 'image')) {
            req.abort();
        } else {
            req.continue();
        }
    });

    await page.setViewport({
        width: 1900,
        height: 1080,
        deviceScaleFactor: 1,
    });
    await page.setDefaultNavigationTimeout(0);
    return page
}

const closeBrowser = async () => {
    await browser.close();
}

async function downloadImage(url: string, dir: string): Promise<string | null> {
    try {
        if (url.startsWith("//")) url = `https:${url}`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        const ext = path.extname(url)
        const name = md5(url) + ext
        const imageUri = `${dir}/${name}`
        if (fs.existsSync(imageUri)) {
            return name
        }
        const res = await axios.get(url, { 
            responseType: 'arraybuffer',
            headers: {
                'Accept': 'image/webp,image/*,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': domain,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
            }
         });
        fs.writeFileSync(imageUri, res.data);
        return name;
    } catch (error) {
        return null;
    }
}

const openUrl = async (page: Page, url: string) => {
    while(true) {
        try {
            await page.goto(url, { waitUntil: "networkidle2" });
            break
        } catch (error) {
            console.log(`failed to open ${url}`)
        }
        await wait(5000)
    }
}

const _login = async (page: Page) => {
    try {
        for (let account of config.accounts) {
            await wait(2000);
            const url = page.url()
            await page.focus('input[formcontrolname="name"]')

            const username = await page.evaluate(() => {
                const input = document.querySelector('input[formcontrolname="name"]') as HTMLInputElement;
                return input.value
            });
            for (let i = 0; i < username.length; i++) {
                await page.keyboard.press('Backspace');
            }
            await page.keyboard.type(account.username)
            await page.focus('input[formcontrolname="password"]')
            const password = await page.evaluate(() => {
                const input = document.querySelector('input[formcontrolname="password"]') as HTMLInputElement;
                return input.value
            });
            for (let i = 0; i < password.length; i++) {
                await page.keyboard.press('Backspace');
            }
            await wait(100);
            await page.keyboard.type(account.password)
            
            // Submit login form
            await page.evaluate(() => {
                const submitBtn = document.querySelector('form button') as HTMLElement;
                if (submitBtn) submitBtn.click();
            });
            await wait(5000);
            const result = url!==page.url()
            if (result) 
                return true
        }
        return false
    } catch (error) {
        console.log(error)
    }
    return false
}
const shouldLogin = async (page: Page, html: string) => {
    const $ = cheerio.load(html);
    const loginText = $('button:contains("登录")');
    if (loginText.length > 0) {
        console.log("Need to login, attempting login...");
        await page.evaluate(() => {
            const loginBtn = document.querySelector('button.ant-btn-background-ghost') as HTMLElement;
            if (loginBtn) loginBtn.click();
        });
        return await _login(page)
    }
    return false;
}

const fetchListData = async (page: Page, pageNo: number) => {
    try {
        await page.evaluate((domain: string, pageNo: number) => {
            try {
                // // https://mao527.xyz/api/web/info/page.json?sort=publish&page=1
                const url = `${domain}/api/web/info/page.json?sort=publish${pageNo > 1 ? `&page=${pageNo}` : ""}`
                console.log(url)
                fetch(url, {
                    "headers": { 
                        "accept": "application/json, text/plain, */*",
                    },
                    "body": null,
                    "method": "GET"
                }).then(res => {
                    document.body.__data = res.json()
                    
                }).catch(error => { 
                    console.log(error)
                })
            } catch (error) {
                console.log(error)
            }
        }, domain, pageNo);
        await wait(1500)
        let repeat = 0
        while(true) {
            if (repeat > 5) {
                console.log(`\t\t#${pageNo} 重试5次失败 重新登录`)
                return null
            }
            const resp1 = await page.evaluate(() => {
                return document.body.__data
            });
            if (resp1?.data) {
                await page.evaluate(() => {
                    delete document.body.__data
                });
                const {pages, records, total} = resp1.data
                return {pages, records, total}
            }
            await wait(1000)
            repeat++
        }
    } catch (error) {
        console.log(error)

    }
}
const fetchDetailData = async (page: Page, id: number) => {
    try {
        await page.evaluate((domain: string, id: number) => {
            try {
                fetch(`${domain}/api/web/info/detail.json?infoId=${id}`, {
                    "headers": { "accept": "application/json, text/plain, */*" },
                    "body": null,
                    "method": "GET"
                }).then(res => {
                    document.body.__data = res.json()
                })
            } catch (error) {
                console.log(error)
            }
        }, domain, id);
        await wait(1000)
        let repeat = 0

        while(true) {
            if (repeat > 2) {
                return null
            }
            const resp1 = await page.evaluate(() => {
                return document.body.__data
            });
            if (resp1?.data) {
                await page.evaluate(() => {
                    delete document.body.__data
                });
                return resp1.data
            } else if (resp1?.data===null){
                return null
            }
            await wait(1000)
            repeat++
        }
    } catch (error) {
        console.log(error)
    }
}

const processImage = async (coverPicture: string, picture: string) => {
    let cover = ""
    let imgs = [] as string[]
    if (coverPicture) {
        const image = await downloadImage(`https://s1.img115.xyz/info/picture/${coverPicture}`, `./data/`)
        if (image) {
            cover = image
        }
    }
    
    if (!!picture) {
        const x = picture.split(',')
        for (const img of x) {
            const image = await downloadImage(`https://s1.img115.xyz/info/picture/${img}`, `./data/`)
            if (!!image) {
                imgs.push(image)
            }
        }
    }
    return [cover, imgs]
}

const main = async () => {
    while (true) {
        const timestamp = Date.now()
        try {
            console.log("started")
            const page = await initPuppeteer();
            await openUrl(page, `${domain}/list`)
            await wait(5000)
            const html = await page.content()
            await shouldLogin(page, html)
            let cnt = 0
            
            

            for (let i = 0; i < 10; i++) {
                const resp = await fetchListData(page, i)
                if (!resp) {
                    console.log(`\t\t#${i} failed, try logging in again.`)
                    await wait(10000)
                    continue
                }
                const {pages, records, total} = resp
                let k = 0
                for (let record of records) {
                    await wait(5000)
                    const {id} = record
                    console.log(`${new Date().toLocaleTimeString("zh-CN", {hour12: false})} 第${i + 1}页 ${k++}/${records.length} #${id}`)
                    const exist = await existData(id)
                    if (exist) {
                        console.log(`\t\t#${id} exists`)
                        continue
                    }
                    const d = await fetchDetailData(page, id)
                    if (!d) {
                        console.log(`\t\t#${id} failed, try logging in again`)
                        await wait(10000)
                        continue
                    }
                    const [cover, imgs] = await processImage(d.coverPicture, d.picture)
                    const contacts = {} as Record<string, string>
                    for (let field of contactFields) {
                        if (field in d && !!d[field] && isValidValue(d[field])) {
                            contacts[field] = d[field]
                        }
                    }
                    const contactCnt = Object.keys(contacts).length
                    if (contactCnt===0) {
                        console.log(`\t\t#${id} no contact information, try next`)
                        continue
                    }
                    const meta = {} as Record<string, string>
                    for (let field of metaFields) {
                        if (field in d && !!d[field] && isValidValue(d[field])) {
                            meta[field] = d[field]
                        }
                    }
                    const data = {
                        orgId: d.id, // 51风流 ID
                        title: d.title, // 粉红豹标题
                        contents: d.desc, // 粉红豹描述
                        hash: md5([d.title, d.desc].join('')),
                        cityCode: d.cityCode, // 城市ID
                        district: '', // 区县
                        contactCnt,
                        contacts,
                        meta,
                        replies: [],
                        pinned: false, // 是否置顶
                        replyCnt: 0,
                        viewCnt: d.viewCount,
                        anonymous: d.anonymous,
                        imgCnt: imgs.length,
                        imgs,
                        cover,
                        vipOnly: false,
                        actived: contactCnt > 0,
                        deleted: 0,
                        updated: 0,
                        created: Math.round(d.createdAt / 1000)
                    } as SchemaFenhongbao
                    const msg = await uploadData(data, cover as string, imgs as string[])
                    console.log(`\ttotal ${msg ? ++cnt : cnt} ${msg || 'faile'}`)
                    if (cnt && cnt % 100===0) {
                        console.log(`\t\tTotal ${cnt} wait for 300s`)
                        await wait(300000)
                        // await closeBrowser()
                        // console.log(`done ${cnt}`)
                        // process.exit(0)
                    }
                }
            }
            await closeBrowser()
        } catch (err) {
            console.log(err)
        }
        const spent = Math.round((Date.now() - timestamp) / 1000)
        const delay = 12 * 3600 - spent
        console.log(`wait for ${delay}s`)
        await wait(delay * 1000)
    }
}

const existData = async (orgId: number) => {
    const res = await axios.post(`${config.api}/api/fenhongbao/exists`, {orgId})
    return res.data.result
}

const uploadData = async (data: SchemaFenhongbao, cover: string, imgs: string[]) => {
    // axios post with file uploads
    const formData = new FormData()
    formData.append('data', JSON.stringify(data))
    if (cover) {
        const coverFile = fs.readFileSync(`${rootDir}/data/${cover}`)
        const coverBlob = new File([coverFile], cover)
        formData.append('cover', coverBlob)
    }
    for (let img of imgs) {
        const imgFile = fs.readFileSync(`${rootDir}/data/${img}`)
        const imgBlob = new File([imgFile], img)
        formData.append('imgs', imgBlob)
    }
    const res = await axios.post(`${config.api}/api/fenhongbao/add`, formData, {headers: {"Content-Type": "multipart/form-data"}})
    return res.data.message || ''
}

main()