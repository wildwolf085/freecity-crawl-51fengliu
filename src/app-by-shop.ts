import fs from "fs";
import { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

import shops from './current.json'
import done from './done.json'

const md5 = (plain: string) => crypto.createHash('md5').update(plain).digest("hex")
const wait = (mill: number) => (new Promise(resolve => setTimeout(resolve, Math.max(mill, 1000))))

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

let showImage = false

let browser: Browser

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

async function scrollToBottom(page) {
    const distance = 1000;
    
    await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    await wait(1000);
    while (await page.evaluate(() => document.scrollingElement.scrollTop + window.innerHeight < document.scrollingElement.scrollHeight)) {
        await page.evaluate((y) => { document.scrollingElement.scrollBy(0, y); }, distance);
        await wait(4000);
    }
}
async function scrollTop(page) {
    
}

interface Product {
    url: string;
    image: string;
}

interface Item {
    // url: string;
    desc: string;
    price: number;
    reviews: string;
    // image: string;
    products: Product[];
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
        const imagedir = `${shopdir}/../images`
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

const processPage = async (html: string, page: number, shopdir: string) => {
    try {
        const jsonfile = `${shopdir}/${page}.json`
        if (fs.existsSync(jsonfile)) return
        const $ = cheerio.load(html);
        let lis = $('#J_GoodsList > ul > li');
        if (lis.length === 0) {
            lis = $("div[data-region='right-extra'] div.jItem");
        }
        
        const items = [] as Item[];
        const count = lis.length;
        
        let k = 0;
        console.log(`\t${k}/${count}`);
        // Replace jQuery each with for...of
        for (const li of lis.toArray()) {
            const liTag = $(li);
            let aTag = liTag.find('div.jDesc a');
            
            if (aTag.length===0) {
                aTag = liTag.find('a.c_title');
            }
            let url = aTag.attr('href') || '';
            let desc = aTag.text();

            let priceText = liTag.find('span.jdNum').text();
            // if (priceText==="") {
            //     priceText = liTag.find('div.jPrice span.jdNum').text();
            // }
            // if (priceText==="") {
            //     priceText = liTag.find('div.jPrice span.jdNum').text();
            // }
            const price = priceText === '' ? 0 : parseFloat(priceText);
            
            if (price === 0) {
                console.log('\t\tunexpected price');
            }

            let reviews = liTag.find('div.jExtra em').text();
            if (reviews==="") {
                reviews = liTag.find('em.jCommentNum').text();
            }
            if (reviews==="") {
                reviews = liTag.find('div.extra span.evaluate a').text();
            }
            if (reviews==="") {
                reviews = liTag.find('span.c_pl em').text();
            }
            
            const products: Product[] = [];
            const subImages = liTag.find('.jScrollWrap ul li');
            if (subImages.length===0) {
                const jPic = liTag.find('div.jPic img');
                if (jPic.length === 0) {
                    return; // continue in jQuery each
                }
                k++;
                const image = await downloadImage(url, jPic.attr('src'), shopdir);
                if (!!image) {
                    products.push({
                        url,
                        image,
                    });
                }
            } else {
                for (let subImage of subImages.toArray()) {
                    const subUrl = $(subImage).attr('data-href') || '';
                    const subImageSrc = $(subImage).attr('data-src') || '';
                    const image = await downloadImage(subUrl, subImageSrc, shopdir);
                    if (!!image) {
                        products.push({
                            url: subUrl,
                            image,
                        });
                    }
                }
            }

            items.push({
                // url,
                desc,
                price,
                reviews,
                // image,
                products,
            });
        }
        if (items.length!==0)
            fs.writeFileSync(jsonfile, JSON.stringify(items, null, '\t'))
        return true
    } catch (error) {
        console.log(error)
    }
    return false
    // return items;
};

const checkVerifyButton = async (page) => {
    while(true) {
        const shouldVerify = await await page.evaluate(() => {
            const elem = document.querySelector('.verifyBtn');
            return !!elem
        });
        if (!shouldVerify) break
        console.log("验证一下，购物无忧")
        await wait(10000)
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

const main = async () => {
    try {
        const rootDir = `${__dirname}/../data`
        if (!fs.existsSync(rootDir)) fs.mkdirSync(rootDir)
        console.log("started")
        const page = await initPuppeteer();
        await openUrl(page, "https://jd.com")
        await wait(10000)
        
        for (let type in shops) {
            console.log(type)
            const typeDir = `${rootDir}/${type}`
            if (!fs.existsSync(typeDir)) fs.mkdirSync(typeDir)
            for (let [shop, url] of shops[type]) {
                if (shop==="") continue

                const shopDir = `${typeDir}/${shop}`
                
                if (fs.existsSync(shopDir)) {
                    if (fs.existsSync(`${shopDir}/done`)) continue
                } else {
                    fs.mkdirSync(shopDir)
                }
                
                console.log(`${type}-${shop}-1`)
                // const _file = `${shopDir}/1.html`
                await openUrl(page, url)
                // await page.goto(url, { waitUntil: "networkidle2" });
                await scrollToBottom(page);
                // await page.waitFor(3000);
                await wait(5000)
                await checkVerifyButton(page)
                // Remove all script and style tags from the page
                let html = await page.evaluate(() => {
                    let tag = document.querySelector('#J_GoodsList');
                    if (!tag)
                        tag = document.querySelector("div[data-region='right-extra']")
                    return tag?.outerHTML
                });
                if (!html) {
                    html = await page.content()
                }
                // fs.writeFileSync(_file, html)
                await processPage(html, 1, shopDir)
                // if (resp) fs.unlinkSync(_file)
                // 
                let count = 0, pageMode = false
                try {
                    const text = await page.evaluate(`document.querySelector('div#J_topPage > span.fp-text > i').innerText`) as string
                    count = Number(text)
                } catch (error) {
                    const text = await page.evaluate(() => {
                        try {
                            const as = document.querySelectorAll('div.jPage a') as any;
                            if (as.length > 2)
                                return as[as.length-2].innerText
                        } catch (error) {
                            console.log(error)
                        }
                        return 1
                    })
                    
                    // const text = await page.evaluate(``) as string
                    count = Number(text)
                    pageMode = true
                }
                
                // const count = await getPageCount(page);
                for (let k = 2; k <= count; k++) {
                    console.log(`${type}-${shop}-${k}`)
                    if (pageMode) {
                        if (fs.existsSync(`${shopDir}/${k}.json`))
                            continue
                        const _url = `${url.slice(0, -7)}-${k}.html`;
                        await openUrl(page, _url)
                        // await page.goto(_url, { waitUntil: "networkidle2" });
                        // 
                        await checkVerifyButton(page)
                    } else {
                        // pageGoodsList(1 + 1, this)
                        if (fs.existsSync(`${shopDir}/${k}.json`)) 
                            continue
                        try {
                            
                            // while(true) {
                            await page.evaluate(
                                (a) => window.pageGoodsList(a, document.querySelector('div#J_topPage a.fp-next')),
                                k,
                            );
                            // await wait(10000)
                            // 
                            await checkVerifyButton(page)
                            // }
                        } catch (error) {
                            console.log("not found page", error)
                        }
                    }
                    // 
                    await wait(10000)
                    await scrollToBottom(page);
                    await wait(5000)
                    html = await page.evaluate(() => {
                        let tag = document.querySelector('#J_GoodsList');
                        if (!tag)
                            tag = document.querySelector("div[data-region='right-extra']")
                        return tag?.outerHTML
                    });
                    if (!html) {
                        html = await page.content()
                    }
                    await processPage(html, k, shopDir)
                }
                fs.writeFileSync(`${shopDir}/done`, "")
            }
        }
        await closeBrowser()
    } catch (err) {
        console.log(err)
    }
    console.log("done")
}

const removeDup = () => {
    const buf = fs.readFileSync(`${__dirname}/candidate.txt`, "utf-8")
    const lines = buf.split(/\n|\r|\r\n/g)
    const clothes = Object.fromEntries(done["内衣"])
    const data = []
    for (let line of lines) {
        if (line==="") continue
        let [k, v] = line.split("\t")
        k = k.replace(" ", "")
        if (clothes[k]===undefined) {
            data.push([k, v])
        }
    }
    fs.writeFileSync(`${__dirname}/candidate-1.json`, JSON.stringify(data, null, '\t'))
}

main()
// removeDup()
