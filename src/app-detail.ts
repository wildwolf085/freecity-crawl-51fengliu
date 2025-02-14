import fs from "fs";
import { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import model, { DFenhongbao, DFenhongbaoRawDetail, getFirstIdFromCollection, getLastIdFromCollection } from "./model";
import cities from "./cities.json";
import config from './config.json'
const md5 = (plain: string) => crypto.createHash('md5').update(plain).digest("hex")
const wait = (mill: number) => (new Promise(resolve => setTimeout(resolve, Math.max(mill, 1000))))

// const username = ""
// const password = ""

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

let showImage = false

let browser: Browser

// const MetaKeys = {
//     "地址": "address",
//     "信息来源": "resource",
//     "年龄": "age",
//     "服务质量": "quality",
//     "外形": "appearance",
//     "颜值": "appearance",
//     "服务内容": "project",
//     "价格": "price",
//     "营业时间": "business_time",
//     "环境": "environment",
//     "服务": "service",
//     "安全": "security",
//     "综合评价": "comprehensive"
// }

// const ContactKeys = {
//     "地址": "address",
//     "QQ": "qq",
//     "微信": "wechat",
//     "电话": "phone",
//     "Telegram ": "telegram",
//     "与你号": "yuni",
// }

const contactFields = [
    "address",
    "email",
    "phone",
    "qq",
    "wechat",
    "telegram",
    "yuni",
]

const isValidValue = (value: string) => !["无", "示例信息1", "示例信息2"].includes(value)

/*

https://mao618.xyz

*/
const domain = "https://mao527.xyz"

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

// const processPage = async (html: string, _id: number) => {
//     try {
//         const data = {
//             _id,
//             title: '',
//             contents: '',
//             province: '',
//             city: '',
//             district: '',
//             contact: {},
//             meta: {},
//             imgs: [] as string[],
//             viewCnt: 0,
//             anonymous: false,
//             actived: true,
//             updated: 0,
//             created: 0
//         } as SchemaFenhongbao
//         const $ = cheerio.load(html);
//         let parts = $('com-loading');
//         if (parts.length === 3) {
//             // Part 1: Images, title, created date, views, anonymous status
//             const part1 = $(parts[0]);
//             // Get images
//             part1.find('nz-image-group div.item').each((_, img) => {
//                 const bgImage = $(img).attr('style');
//                 if (bgImage) {
//                     const urlMatch = bgImage.match(/url\("([^"]+)"\)/);
//                     if (urlMatch) data.imgs.push(urlMatch[1]);
//                 }
//             });
//             data.imgCnt = data.imgs.length
//             // Get title and metadata
//             data.title = part1.find('.text-title').first().text().trim();
//             data.actived = !["示例信息1", "无"].includes(data.title)
//             const extra = part1.find('small.text-content2 > div')

//             const updated = $(extra[0]).text().trim();
//             data.created = Math.round(new Date(updated).getTime() / 1000);
//             data.updated = data.created;
//             data.viewCnt = parseInt($(extra[1]).text().trim()) || 0;
//             data.anonymous = $(extra[2]).text().trim() == "匿名"
            
//             // Get location and other metadata
//             part1.find('div > strong.text-title').each((_, elem) => {
//                 const label = $(elem).text().trim();
//                 const value = $(elem).next().text().trim();
//                 if (["示例信息1", "无"].includes(value)) return
//                 if (label === '地区：') {
//                     const [province, city] = value.split('-');
//                     data.province = province;
//                     data.city = city;
//                 } else {
//                     const _label = label.replace('：', '')
//                     const key = MetaKeys[_label]
//                     if (key) {
//                         data.meta[key] = value
//                     } else {
//                         data.meta[_label] = value
//                         console.log(`unknown meta: ${_label} = ${value}`)
//                     }
//                 }
                
//             });

//             // Part 2: Contact information
//             const part2 = $(parts[1]);
//             part2.find('.flex.my-3').each((_, elem) => {
//                 const label = $(elem).find('strong').text().trim().replace('：', '');
//                 const value = $(elem).find('span').text().trim();
//                 if (["示例信息1", "无"].includes(value)) return
//                 const key = ContactKeys[label]
//                 if (key) {
//                     data.contact[key] = value;
//                 } else {
//                     data.contact[label] = value;
//                     console.log(`unknown contact: ${label} = ${value}`)
//                 }
//             });

//             // Part 3: Detailed content
//             const part3 = $(parts[2]);
//             let content = part3.find('p').text().trim();
//             if (["示例信息1", "无"].includes(content)) content = ""
//             data.contents = content;
//             // Save to database
//             await DFenhongbao.insertOne(data);
//             return true;
//         } else {
//             console.log("unexpected page structure");
//             return false;
//         }
//     } catch (error) {
//         console.log(error);
//         return false;
//     }
// };

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
        
        return await _login(page)
    }
    return false;
}


const forceLogin = async (page: Page) => {
    try {
        await openUrl(page, `${domain}/login`)
        // Check if login button exists
        // Wait for login form to appear
        const signed = await _login(page)
        if (signed) {
            await openUrl(page, domain)
            return true
        }
    } catch (error) {
        console.log(error)
    }
    return false
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
                console.log(`\t\t#${id} 重试${repeat}次失败`)
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
                console.log(`\t\t#${id} 没有数据`)
                return null
            }
            console.log(`\t\t#${id} wait 1s`)
            await wait(1000)
            repeat++
        }
    } catch (error) {
        console.log(error)

    }
}

model.open().then(async () => {
    try {
        console.log("started")
        const page = await initPuppeteer();
        await openUrl(page, domain)
        await wait(2000)
        const html = await page.content()
        await shouldLogin(page, html)
        let cnt = 0
        const startId = await getFirstIdFromCollection(DFenhongbao)
        const endId = await getLastIdFromCollection(DFenhongbao)
        const batch = 1000
        let success = 0
        for (let _id = startId; _id <= endId; _id+=batch) {
            const rows = await DFenhongbao.find({_id: {$gte: _id, $lt: _id + batch}}).toArray()
            
            console.log(`processing ${_id} to ${_id + batch}: ${rows.length} records`)
            for (const i of rows) {
                if (i.contacts) {
                    cnt++
                    success++
                    continue
                }
                // , $or: [{contracts: null}, {updated: {$lt: Math.round(Date.now() / 1000) - 3 * 30 * 86400}}]
                while(true) {
                    try {
                        const time = +new Date()
                        // await wait(1000)
                        const d = await DFenhongbaoRawDetail.findOne({_id: i._id})
                        let v = d || await fetchDetailData(page, i._id) as SchemaFenhongbaoRaw
                        if (v) {
                            const contacts = {} as Record<string, string>
                            for (let field of contactFields) {
                                if (field in v && !!v[field] && isValidValue(v[field])) {
                                    contacts[field] = v[field]
                                }
                            }
                            if (Object.keys(contacts).length > 0) {
                                success++
                                const timestamp = Math.round(Date.now() / 1000)
                                await DFenhongbao.updateOne(
                                    {_id: i._id}, 
                                    {$set: { updated: timestamp, contacts, actived: true }}
                                )
                            }
                            delete v["id"]
                            if (!d) {
                                await DFenhongbaoRawDetail.updateOne(
                                    {_id: i._id},
                                    {$set: v},
                                    {upsert: true}
                                )
                            }
                        }
                        cnt++
                        console.log(`#${i._id} | ${cnt}/${endId} | 成功 ${success} 失败 ${cnt - success} | ${+new Date() - time}ms`)
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