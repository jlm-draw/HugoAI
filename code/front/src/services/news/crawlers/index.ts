import type { NewsCrawler } from "../types";
import { jiqizhixinCrawler } from "./jiqizhixin";
import { liangziweiCrawler } from "./liangziwei";
import { kr36Crawler } from "./36kr";
import { decoderCrawler } from "./decoder";

export const allCrawlers: NewsCrawler[] = [
  jiqizhixinCrawler,
  liangziweiCrawler,
  kr36Crawler,
  decoderCrawler,
];

export { jiqizhixinCrawler, liangziweiCrawler, kr36Crawler, decoderCrawler };
