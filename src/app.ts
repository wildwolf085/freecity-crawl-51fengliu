import fs from "fs";
import { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import model, { DFenhongbao, DFenhongbaoRaw } from "./model";
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
const imagehashes = {} as {[key: string]: string}

async function downloadImage(goodlink: string, url: string, shopdir: string): Promise<string | null> {
    try {
        if (url.startsWith("//")) url = `https:${url}`;
        const match = url.match(/^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/);
        // return match && {
        //     href: href,
        //     protocol: match[1],
        //     host: match[2],
        //     hostname: match[3],
        //     port: match[4],
        //     pathname: match[5],
        //     search: match[6],
        //     hash: match[7]
        // }
        let pathname = match[5]

        // let _url = url.slice(url.lastIndexOf("/") + 1)
        let p = pathname.lastIndexOf("!")
        if (p!==-1) pathname = pathname.slice(0, p)
        const imagehash = md5(pathname);
        if (!!imagehashes[imagehash]) {
            console.log(`\t\texists ${url}`)
            return imagehashes[imagehash]
        }
        const imagedir = `${shopdir}/images`
        if (!fs.existsSync(imagedir)) fs.mkdirSync(imagedir)
        const name = md5(goodlink) + ".jpg"
        const imageUri = `${imagedir}/${name}`
        if (fs.existsSync(imageUri)) {
            // console.log(`\t\texists ${url}`)
            return name
        }
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(imageUri, res.data);
        console.log(`\t\tdownload ${url}`)
        imagehashes[imagehash] = name
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

const fetchPageData = async (page: Page, city: string, pageNo: number) => {
    try {
        await page.evaluate((cityCode: string, pageNo: number) => {
            try {
                fetch(`https://51fengliu.com/api/web/info/page.json?sort=publish&cityCode=${cityCode}${pageNo > 1 ? `&page=${pageNo}` : ""}`, {
                    "headers": { 
                        "accept": "application/json, text/plain, */*",
                    },
                    "body": null,
                    "method": "GET"
                }).then(res => {
                    document.body.__data = res.json()
                    
                })    
            } catch (error) {
                console.log(error)
            }
        }, city, pageNo);
        await wait(1500)
        let repeat = 0
        while(true) {
            if (repeat > 5) {
                console.log(`\t\t#${city} ${pageNo} 重试5次失败 重新登录`)
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
            console.log(`\t\t#${city} ${pageNo} wait 1s`)
            await wait(1000)
            repeat++
        }
    } catch (error) {
        console.log(error)

    }
}

const processPageData = async (records: any[]) => {

    await DFenhongbaoRaw.bulkWrite(records.map(i=>{
        const _id = i.id
        delete i.id
        return {
            updateOne: {
                filter: {_id},
                update: {$set: i},
                upsert: true
            }
        }
    }))
}
const state_filename = `${__dirname}/cities_state.json`

const readState = () => {
    if (fs.existsSync(state_filename)) {
        return JSON.parse(fs.readFileSync(state_filename, 'utf8'))
    }
    return {}
}
const writeState = (state: any) => {
    fs.writeFileSync(state_filename, JSON.stringify(state, null, '\t'))
}


model.open().then(async () => {
    try {
        console.log("started")
        const page = await initPuppeteer();
        await openUrl(page, "https://51fengliu.com/")
        await wait(30000)
        const state = await readState() as {[key: string]: {page: number, pages: number, total: number}}
        // const html = await page.content()
        // await shouldLogin(page, html)
        let cnt = 0
        for (const province in cities) {

            console.log(`${province} (${Object.keys(cities[province]).length})个城市`)
            for (const city in cities[province]) {

                if (state[city] && state[city].page >= state[city].pages) continue
                
                while(true) {
                    try {
                        const time = +new Date()
                        const resp = await fetchPageData(page, city, 1)
                        if (!resp) {
                            console.log(`\t\t#${city} ${province} ${cities[province][city]} 重试5次失败 重新登录`)
                            await wait(10000)
                            continue
                        }
                        const {pages, records, total} = resp
                        console.log(`#${city} ${province} ${cities[province][city]} ${pages}页 ${records.length}条记录 共${total}条记录 ${+new Date() - time}ms`)
                        if (records.length > 0) await processPageData(records)
                        state[city] = {page: 1, pages, total}
                        cnt++
                        break
                    } catch (error) {
                        console.log(`#${city} ${province} ${cities[province][city]} 报错 重试`)
                        await wait(10000)
                    }
                }
                writeState(state)
                // if (state[city]) {

                for (let i=state[city].page + 1; i<=state[city].pages; i++) {
                    // console.log(`${province} ${cities[province][city]} 第${i}/${state[city].pages}页`)
                    // for (let k = 0; k < 10; k++) {
                    while(true) {
                        try {
                            await wait(10000)
                            const time = +new Date()
                            const resp = await fetchPageData(page, city, i)
                            if (!resp) {
                                console.log(`\t\t#${city} ${province} ${cities[province][city]} 重试5次失败 重新登录`)
                                await wait(10000)
                                continue
                            }
                            const {pages, records, total} = resp

                            if (records.length > 0) {
                                await processPageData(records)
                            }

                            if (records.length !== 30 && i<pages) {
                                console.log(`#${city} ${province} ${cities[province][city]} 第${i}/${pages}页 ${records.length}条记录 共${total}条记录 数据异常 再试试`)
                                await wait(10000)
                                continue
                            }
                            state[city].pages = records.length !==30 ? i : pages
                            state[city].total = total
                            state[city].page = i
                            
                            writeState(state)
                            console.log(`#${city} ${province} ${cities[province][city]} 第${i}/${pages}页 ${records.length}条记录 共${total}条记录 ${+new Date() - time}ms`)
                            cnt++
                            if (cnt % 10===0) {
                                console.log(`#${cnt} wait 10s`)
                                await wait(10000)
                            }
                            break
                        } catch (error) {
                            console.log(error)
                        }
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