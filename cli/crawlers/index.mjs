import * as yahoo from './yahoo.mjs';
import * as coingecko from './coingecko.mjs';
import * as naver from './naver.mjs';
import * as custom from './custom.mjs';

const crawlers = { yahoo, coingecko, naver, custom };

export function getCrawler(type) { return crawlers[type] ?? null; }
