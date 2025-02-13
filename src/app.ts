import fs from "fs";
import { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import model, { DFenhongbao, DFenhongbaoRaw } from "./model";
import cities from "./cities.json";
import { AnyBulkWriteOperation } from "mongodb";
import { existsFileInGridFS, uploadToGridFS } from "./gridfs";
import { getFirstIdFromCollection, getLastIdFromCollection } from "./model";
import ConsoleProgress from './console-progress'

const md5 = (plain: string) => crypto.createHash('md5').update(plain).digest("hex")
const wait = (mill: number) => (new Promise(resolve => setTimeout(resolve, Math.max(mill, 1000))))

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

let showImage = false
// let failedImage = 0
// let successImage = 0
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
//     "过夜价格": "priceAllNight",
//     "营业时间": "business_time",
//     "环境": "environment",
//     "服务": "service",
//     "安全": "security",
//     "评价": "serveLv",
//     "综合评价": "comprehensive",
//     "女孩数量": "girlNum",
//     "评分": "score"
// }

// const ContactKeys = {
//     "QQ": "qq",
//     "微信": "wechat",
//     "电话": "phone",
//     "Telegram ": "telegram",
//     "与你号": "yuni"
// }

/*

https://mao618.xyz

*/

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
let fenhongbaoLastId = 0

const domain = "https://mao527.xyz"
// const image_origin = "https://s1.img115.xyz/info/picture/"
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
        // if (fs.existsSync(imageUri)) {
        //     return name
        // }
        if (await existsFileInGridFS(name)) {
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
        if (fs.existsSync(imageUri)) {
            try {
                const stat = fs.statSync(imageUri)
                if (stat.size === 32533) {
                    return null
                } else {
                    await uploadToGridFS(imageUri)
                }
            } catch (error) {
                console.log(error)
            } finally {
                fs.unlinkSync(imageUri)
            }
        }
        
        return name;
    } catch (error) {
        // console.error(`Error downloading ${url}: ${error}`);
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

declare namespace NodeJS {
    interface HTMLElement {
        
        __data: any
    }
}


const fetchPageData = async (page: Page, city: string, pageNo: number) => {
    try {
        await page.evaluate((domain: string, cityCode: string, pageNo: number) => {
            try {
                const url = `${domain}/api/web/info/page.json?sort=publish&cityCode=${cityCode}${pageNo > 1 ? `&page=${pageNo}` : ""}`
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
        }, domain, city, pageNo);
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
            // console.log(`\t\t#${city} ${pageNo} wait 1s`)
            await wait(1000)
            repeat++
        }
    } catch (error) {
        console.log(error)

    }
}

// const processPageData2 = async (records: any[]) => {
//     const data = [] as AnyBulkWriteOperation<SchemaFenhongbaoRaw>[]
//     for (const i of records) {
//         i.cover = ""
//         i.imgs = []
//         if (i.coverPicture) {
//             const image = await downloadImage(`https://s1.img115.xyz/info/picture/${i.coverPicture}`, `./data/`)
//             if (image) {
//                 i.cover = image
//             }
//         }
        
//         if (!!i.picture) {
            
//             const x = i.picture.split(',')
//             for (const img of x) {
//                 const image = await downloadImage(`https://s1.img115.xyz/info/picture/${img}`, `./data/`)
//                 if (!!image) {
//                     i.imgs.push(image)
//                 }
//             }
//         }
//         i.imgCnt = i.imgs.length
//         const _id = i.id
//         delete i.id
//         data.push({
//             updateOne: {
//                 filter: {_id},
//                 update: {$set: i},
//                 upsert: true
//             }
//         })
//     }
//     await DFenhongbaoRaw.bulkWrite(data)
// }

const processPageData = async (label: string, records: Array<FenhongbaoRaw & {id: number}>) => {
    let _cnt = 0
    for (const i of records) {
        let _imgs = !!i.picture ? i.picture.split(',') : []
        _cnt += (i.coverPicture ? 1 : 0) + _imgs.length
    }
    const bar = new ConsoleProgress(_cnt, label);
    let successImage = 0
    let failedImage = 0
    for (const i of records) {
        let cover = ""
        let imgs = []
        let _imgs = !!i.picture ? i.picture.split(',') : []

        if (i.coverPicture) {
            const image = await downloadImage(`https://s1.img115.xyz/info/picture/${i.coverPicture}`, `./data/`)
            if (image) {
                successImage++
                i.cover = image
            } else {
                failedImage++
            }
            bar.tick(1, ` (图片 ${successImage} 失败 ${failedImage})`)
        }
        
        for (const img of _imgs) {
            const image = await downloadImage(`https://s1.img115.xyz/info/picture/${img}`, `./data/`)
            if (!!image) {
                imgs.push(image)
                successImage++
            } else {
                failedImage++
            }
            bar.tick(1, ` (图片 ${successImage} 失败 ${failedImage})`)
        }
        let imgCnt = imgs.length
        if (i.isExpired) {
            // console.log(`expired: ${i.id}`)
            continue
        }
        const meta = {} as Record<string, string|number>
        for (let field of metaFields) {
            if (field in i && !!i[field] && isValidValue(i[field])) {
                meta[field] = i[field]
            }
        }
        let contents = isValidValue(i.desc) ? i.desc : ''
        const d = await DFenhongbao.findOne({orgId: i.id})
        if (d) {
            await DFenhongbao.updateOne(
                {_id: d._id},
                {$set: {
                    title: i.title, // 粉红豹标题
                    contents,
                    cityCode: i.cityCode, // 城市ID
                    meta,
                    imgCnt,
                    imgs,
                    cover,
                    vipOnly: i.vipView==="only vip have",
                }}
            )
        } else {
            await DFenhongbao.insertOne({
                _id: ++fenhongbaoLastId, // 粉红豹ID
                orgId: i.id,
                title: i.title, // 粉红豹标题
                contents,
                cityCode: i.cityCode, // 城市ID
                contacts: null,
                meta,
                replies: [],
                pinned: i.isRecommend,
                replyCnt: 0,
                viewCnt: i.viewCount,
                anonymous: i.anonymous,
                imgCnt,
                imgs,
                cover,
                vipOnly: i.vipView==="only vip have",
                actived: false,
                updated: 0,
                deleted: 0,
                created: Math.round(i.publishedAt / 1000)
            })
        }
    }
}


const convertRawToSchema = async () => {
    try {
        await DFenhongbao.deleteMany({})

        const startId = await getFirstIdFromCollection(DFenhongbaoRaw)
        const endId = await getLastIdFromCollection(DFenhongbaoRaw)
        const batch = 1000
        const cnt = await DFenhongbaoRaw.countDocuments()
        fenhongbaoLastId = 0
        const progress = new ConsoleProgress(cnt, '转换原始数据')
        for (let _id = startId; _id <= endId; _id+=batch) {
            const rows = await DFenhongbaoRaw.find({_id: {$gte: _id, $lt: _id + batch}}).toArray()
            const data = [] as SchemaFenhongbao[]
            for (const i of rows) {
                if (!isValidValue(i.title)) continue
                const meta = {} as Record<string, string|number>
                for (let field of metaFields) {
                    if (field in i && !!i[field] && isValidValue(i[field])) {
                        meta[field] = i[field]
                    }
                }
                
                const _contacts = {} as Record<string, string>
                for (let field of contactFields) {
                    if (field in i && !!i[field] && isValidValue(i[field])) {
                        _contacts[field] = i[field]
                    }
                }
                if (i.isExpired) {
                    console.log(`expired: #${i._id}`)
                    continue
                }
                const contacts = Object.keys(_contacts).length > 0 ? _contacts : null
                let contents = isValidValue(i.desc) ? i.desc : ''

                data.push({
                    _id: ++fenhongbaoLastId, // 粉红豹ID
                    orgId: i._id,
                    title: i.title, // 粉红豹标题
                    contents, // 粉红豹描述
                    cityCode: i.cityCode, // 城市ID
                    contacts,
                    meta,
                    replies: [],
                    pinned: i.isRecommend,
                    replyCnt: 0,
                    viewCnt: i.viewCount,
                    anonymous: i.anonymous,
                    imgCnt: i.imgCnt,
                    imgs: i.imgs,
                    cover: i.cover,
                    vipOnly: i.vipView==="only vip have",
                    actived: contacts!==null,
                    updated: 0,
                    deleted: 0,
                    created: Math.round(i.publishedAt / 1000)
                })
                progress.tick()
            }
            if (data.length > 0) 
                await DFenhongbao.insertMany(data)
        }
    } catch (error) {
        console.log(error)
    }
    
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
        // await DFenhongbao.deleteMany({})
        // await convertRawToSchema()
        // return;
        fenhongbaoLastId = await getLastIdFromCollection(DFenhongbao)
        console.log("started")
        const page = await initPuppeteer();
        // showImage = true
        // await page.setUserAgent('Mozilla/5.0 (Windows NT 5.1; rv:5.0) Gecko/20100101 Firefox/5.0')

        await openUrl(page, domain)
        await wait(5000)
        // showImage = false

        const state = await readState() as {[key: string]: {page: number, pages: number, total: number}}
        // const html = await page.content()
        // await shouldLogin(page, html)
        let cnt = 0
        for (const province in cities) {

            console.log(`${province} (${Object.keys(cities[province]).length})个城市`)
            for (const city in cities[province]) {

                if (state[city] && state[city].page >= state[city].pages) continue
                const cityName = cities[province][city]
                let processedCnt = 0
                while(true) {
                    try {
                        const time = +new Date()
                        const resp = await fetchPageData(page, city, 1)
                        if (!resp) {
                            console.log(`\t\t#${city} ${province} ${cityName} 重试5次失败 重新登录`)
                            await wait(10000)
                            continue
                        }
                        const {pages, records, total} = resp
                        // console.log(`#${city} ${province} ${cityName} ${pages}页 ${processedCnt + records.length}/${total}条记录 ${+new Date() - time}ms`)
                        await processPageData(`#${city} ${province} ${cityName} 共${pages}页 ${processedCnt + records.length}/${total} 读取 ${((+new Date() - time) / 1000).toFixed(2)}s`, records)
                        if (state[city]) {
                            state[city].pages = pages
                            state[city].total = total
                            processedCnt = (state[city].page - 1) * 30
                        } else {
                            state[city] = {page: 1, pages, total}

                        }
                        processedCnt += records.length
                        cnt++
                        break
                    } catch (error) {
                        console.log(`#${city} ${province} ${cityName} 报错 重试`)
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

                            // if (records.length > 0) {
                            //     await processPageData(records)
                            // }
                            
                            const isAbnormal = records.length !== 30 && i < pages
                            await processPageData(`#${city} ${province} ${cityName} 第${i}/${pages}页${isAbnormal ? ' 异常' : ''} ${processedCnt + records.length}/${total} 读取 ${((+new Date() - time) / 1000).toFixed(2)}s`, records)

                            if (isAbnormal) {
                                await wait(10000)
                                continue
                            }
                            state[city].pages = records.length !==30 ? i : pages
                            state[city].total = total
                            state[city].page = i
                            processedCnt += records.length
                            writeState(state)
                            // console.log(`#${city} ${province} ${cities[province][city]} 第${i}/${pages}页 ${records.length}条记录 共${total}条记录 ${+new Date() - time}ms`)
                            cnt++
                            if (cnt % 10===0) {
                                // console.log(`#${cnt} wait 10s`)
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