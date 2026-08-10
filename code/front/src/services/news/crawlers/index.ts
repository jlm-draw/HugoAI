import type { NewsCrawler } from "../types";
import { jiqizhixinCrawler } from "./jiqizhixin";
import { liangziweiCrawler } from "./liangziwei";
import { kr36Crawler } from "./36kr";
import { decoderCrawler } from "./decoder";
import { baiduHotCrawler } from "./baidu-hot";
import { thepaperCrawler } from "./thepaper";
import { qidianCrawler } from "./qidian";
import { zhihuDailyCrawler } from "./zhihudaily";

export const allCrawlers: NewsCrawler[] = [
  jiqizhixinCrawler,
  liangziweiCrawler,
  kr36Crawler,
  decoderCrawler,
  baiduHotCrawler,
  thepaperCrawler,
  qidianCrawler,
  zhihuDailyCrawler,
];

export {
  jiqizhixinCrawler,
  liangziweiCrawler,
  kr36Crawler,
  decoderCrawler,
  baiduHotCrawler,
  thepaperCrawler,
  qidianCrawler,
  zhihuDailyCrawler,
};
