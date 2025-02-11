import fs from "fs";
import { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import model, { DFenhongbao, DFenhongbaoRaw, getFirstIdFromCollection, getLastIdFromCollection } from "./model";
import cities from "./cities.json";

const md5 = (plain: string) => crypto.createHash('md5').update(plain).digest("hex")
const wait = (mill: number) => (new Promise(resolve => setTimeout(resolve, Math.max(mill, 1000))))

const username = "4445313@qq.com"
const password = "123qweasd"

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

let showImage = false

let browser: Browser

const MetaKeys = {
    "地址": "address",
    "信息来源": "resource",
    "年龄": "age",
    "服务质量": "quality",
    "外形": "appearance",
    "颜值": "appearance",
    "服务内容": "project",
    "价格": "price",
    "营业时间": "business_time",
    "环境": "environment",
    "服务": "service",
    "安全": "security",
    "综合评价": "comprehensive"
}

const ContactKeys = {
    "QQ": "qq",
    "微信": "wechat",
    "电话": "phone",
    "Telegram ": "telegram",
    "地址": "address"
}

const initPuppeteer = async () => {
    const profileDir = `${__dirname}/../puppeteer`

    browser = await puppeteer.launch({
        protocolTimeout: 360000000,
        headless: false, 
        args: [
            '--window-size=1920,1080',
            '--disable-features=site-per-process'
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
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(imageUri, res.data);
        console.log(`\t\tdownload ${url}`)
        return name;
    } catch (error) {
        console.error(`Error downloading ${url}: ${error}`);
        return null;
    }
}

const processPage = async (html: string, _id: number) => {
    try {
        const data = {
            _id,
            title: '',
            contents: '',
            province: '',
            city: '',
            district: '',
            contact: {},
            meta: {},
            imgs: [] as string[],
            viewCnt: 0,
            anonymous: false,
            actived: true,
            updated: 0,
            created: 0
        } as SchemaFenhongbao
        const $ = cheerio.load(html);
        let parts = $('com-loading');
        if (parts.length === 3) {
            // Part 1: Images, title, created date, views, anonymous status
            const part1 = $(parts[0]);
            // Get images
            part1.find('nz-image-group div.item').each((_, img) => {
                const bgImage = $(img).attr('style');
                if (bgImage) {
                    const urlMatch = bgImage.match(/url\("([^"]+)"\)/);
                    if (urlMatch) data.imgs.push(urlMatch[1]);
                }
            });
            data.imgCnt = data.imgs.length
            // Get title and metadata
            data.title = part1.find('.text-title').first().text().trim();
            data.actived = !["示例信息1", "无"].includes(data.title)
            const extra = part1.find('small.text-content2 > div')

            const updated = $(extra[0]).text().trim();
            data.created = Math.round(new Date(updated).getTime() / 1000);
            data.updated = data.created;
            data.viewCnt = parseInt($(extra[1]).text().trim()) || 0;
            data.anonymous = $(extra[2]).text().trim() == "匿名"
            
            // Get location and other metadata
            part1.find('div > strong.text-title').each((_, elem) => {
                const label = $(elem).text().trim();
                const value = $(elem).next().text().trim();
                if (["示例信息1", "无"].includes(value)) return
                if (label === '地区：') {
                    const [province, city] = value.split('-');
                    data.province = province;
                    data.city = city;
                } else {
                    const _label = label.replace('：', '')
                    const key = MetaKeys[_label]
                    if (key) {
                        data.meta[key] = value
                    } else {
                        data.meta[_label] = value
                        console.log(`unknown meta: ${_label} = ${value}`)
                    }
                }
                
            });

            // Part 2: Contact information
            const part2 = $(parts[1]);
            part2.find('.flex.my-3').each((_, elem) => {
                const label = $(elem).find('strong').text().trim().replace('：', '');
                const value = $(elem).find('span').text().trim();
                if (["示例信息1", "无"].includes(value)) return
                const key = ContactKeys[label]
                if (key) {
                    data.contact[key] = value;
                } else {
                    data.contact[label] = value;
                    console.log(`unknown contact: ${label} = ${value}`)
                }
            });

            // Part 3: Detailed content
            const part3 = $(parts[2]);
            let content = part3.find('p').text().trim();
            if (["示例信息1", "无"].includes(content)) content = ""
            data.contents = content;
            // Save to database
            await DFenhongbao.insertOne(data);
            return true;
        } else {
            console.log("unexpected page structure");
            return false;
        }
    } catch (error) {
        console.log(error);
        return false;
    }
};

const shouldLogin = async (page: Page, html: string) => {
    const $ = cheerio.load(html);
    
    // Check if login button exists
    const loginText = $('button:contains("登录")');
    if (loginText.length > 0) {
        console.log("Need to login, attempting login...");
        
        // Click the login button
        await page.evaluate(() => {
            const loginBtn = document.querySelector('button.ant-btn-background-ghost') as HTMLElement;
            if (loginBtn) loginBtn.click();
        });
        
        // Wait for login form to appear
        await wait(5000);
        await page.focus('input[formcontrolname="name"]')
        await page.keyboard.type(username)
        await page.focus('input[formcontrolname="password"]')
        await page.keyboard.type(password)
        
        // Submit login form
        await page.evaluate(() => {
            const submitBtn = document.querySelector('form button') as HTMLElement;
            if (submitBtn) submitBtn.click();
        });
        
        // Wait for login to complete
        await wait(5000);
        
        return true;
    }
    return false;
}


const forceLogin = async (page: Page) => {
    await openUrl(page, "https://51fengliu.com/login")
    // Check if login button exists
        // Wait for login form to appear
    await wait(5000);
    await page.focus('input[formcontrolname="name"]')
    await page.keyboard.type(username)
    await page.focus('input[formcontrolname="password"]')
    await page.keyboard.type(password)
    
    // Submit login form
    await page.evaluate(() => {
        const submitBtn = document.querySelector('form button') as HTMLElement;
        if (submitBtn) submitBtn.click();
    });
        
        // Wait for login to complete
    await wait(3000);
        
    await openUrl(page, "https://51fengliu.com")
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

const fetchDetailData = async (page: Page, id: number) => {
    try {
        await page.evaluate((id: number) => {
            try {
                fetch(`https://51fengliu.com/api/web/info/detail.json?infoId=${id}`, {
                    "headers": { "accept": "application/json, text/plain, */*" },
                    "body": null,
                    "method": "GET"
                }).then(res => {
                    document.body.__data = res.json()
                })    
            } catch (error) {
                console.log(error)
            }
        }, id);
        await wait(1000)
        const resp = await page.evaluate(() => (document.body.__data));
        return resp.data
        
    } catch (error) {
        console.log(error)

    }
}

model.open().then(async () => {
    try {
        console.log("started")
        const page = await initPuppeteer();
        await openUrl(page, "https://51fengliu.com/")
        await wait(5000)
        const html = await page.content()
        await shouldLogin(page, html)
        let cnt = 0
        const startId = await getFirstIdFromCollection(DFenhongbaoRaw)
        const endId = await getLastIdFromCollection(DFenhongbaoRaw)
        const batch = 1000
        for (let _id = startId; _id <= endId; _id+=batch) {
            const rows = await DFenhongbaoRaw.find({_id: {$gte: _id, $lt: _id + batch}, $or: [{crawled: {$exists: false}}, {crawled: {$lt: Math.round(Date.now() / 1000) - 3 * 30 * 86400}}]}).toArray()
            
            console.log(`processing ${_id} to ${_id + batch}: ${rows.length} records`)
            for (const i of rows) {
                while(true) {
                    try {
                        const time = +new Date()
                        const data = await fetchDetailData(page, i._id) as any
                        if (!data) {
                            forceLogin(page)
                            continue
                        }

                        if (data.coverPicture) {
                            const image = await downloadImage(`https://s1.img115.xyz/info/picture/${data.coverPicture}`, `./data/`)
                            data.cover = image
                        }

                        if (!!data.picture) {
                            const x = data.picture.split(',')
                            for (const img of x) {
                                const image = await downloadImage(`https://s1.img115.xyz/info/picture/${img}`, `./data/`)
                                data.imgs.push(image)
                            }
                        }

                        // const _id = data.id
                        delete data.id
                        await DFenhongbaoRaw.updateOne({_id: i._id}, {$set: {...data, crawled: Math.round(Date.now() / 1000)}})
                        cnt++
                        console.log(`#${i._id} total ${cnt} ${+new Date() - time}ms`)
                        if (cnt % 10 === 0) {
                            console.log(`#${cnt} wait 10s`)
                            await wait(10000)
                        }
                        break
                    } catch (error) {
                        console.log(`#${i._id} 报错 重试`)
                        await wait(10000)
                    }
                }
            }
        }
        await closeBrowser()
    } catch (err) {
        console.log(err)
    }
    console.log("done")
})