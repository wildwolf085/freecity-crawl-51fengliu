import * as cheerio from 'cheerio';
import fs from 'fs';

const extractCities = (html: string) => {
    const $ = cheerio.load(html);
    const cities = {} as Record<number, string>;
    
    // Find all province links
    $('a.p-item').each((_, elem) => {
        const href = $(elem).attr('href');
        const name = $(elem).text().trim();
        
        // Skip the "全部" (all) link
        if (name === '全部') return;
        
        // Extract cityCode from href
        const codeMatch = href?.match(/cityCode=(\d+)/);
        if (codeMatch) {
            cities[codeMatch[1]] = name;
        }
    });
    return cities;
}


const files = fs.readdirSync(`${__dirname}/../cities`);
const provinces = {} as Record<string, Record<number, string>>;
for (const file of files) {
    const html = fs.readFileSync(`${__dirname}/../cities/${file}`, 'utf-8');
    // Example usage:
    const cities = extractCities(html);
    provinces[file.replace('.html', '')] = cities;
}

fs.writeFileSync(`${__dirname}/cities.json`, JSON.stringify(provinces, null, '\t'));