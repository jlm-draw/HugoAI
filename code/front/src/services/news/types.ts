export interface NewsItem {
  title: string;
  summary?: string;
  url: string;
  source: string;
  publishedAt?: Date;
}

export interface CrawlerResult {
  source: string;
  items: NewsItem[];
  error?: string;
}

export interface NewsCrawler {
  source: string;
  crawl(): Promise<CrawlerResult>;
}
