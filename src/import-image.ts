import fs from "fs";
import path from 'path';
import crypto from 'crypto';

const md5 = (plain: string) => crypto.createHash('md5').update(plain).digest("hex")

const TARGET = "D:\\lancing\\jd-scraping\\jdcom-download\\data\\backup"

interface ItemType {
    "url": string
    "desc": string
    "price": number
    "reviews": string
    "image": string
    "products": Array<
        {
            "url": string,
            "image": string
        }
    >
}

const processJson = (directoryPath: string, json: ItemType[]) => {
    for (let i of json) {
        delete i.image
        delete i.url
        for (let v of i.products) {
            const src = `${directoryPath}/images/${v.image}`
            v.image = `${md5(v.url)}.jpg`
            const dst = `${TARGET}/images/${v.image}`
            if (fs.existsSync(src) && !fs.existsSync(dst)) {
                fs.copyFileSync(src, dst)
            }
        }
    }
    return json
    
}

const readJsonFiles = (directoryPath: string): void => {
    try {
        // Read all files in the directory
        const files = fs.readdirSync(directoryPath);
        const prods = []
        // Filter for JSON files and process them
        files.filter(file => path.extname(file).toLowerCase() === '.json')
            .forEach(jsonFile => {
                const filePath = path.join(directoryPath, jsonFile);
                try {
                    // Read and parse JSON file
                    const fileContent = fs.readFileSync(filePath, 'utf8');
                    const jsonData = JSON.parse(fileContent);
                    const items = processJson(directoryPath, jsonData)
                    for (let i of items) prods.push(i)
                    // Process the JSON data here
                    console.log(`Processing ${jsonFile}`);
                    
                } catch (error) {
                    console.error(`Error processing ${jsonFile}:`, error);
                }
            });
        
        fs.writeFileSync(`${TARGET}/index.json`, JSON.stringify(prods, null, '\t'))


    } catch (error) {
        console.error('Error reading directory:', error);
    }
};

readJsonFiles("D:/lancing/jd-scraping/code/data/内衣")