export interface NewsItem {
  title: string;
  summary?: string;
  url: string;
  source: string;
  /** 资讯分类，与短视频赛道 code 一致；缺省 ai-news */
  category?: string;
  publishedAt?: Date;
}

export interface CrawlerResult {
  source: string;
  category: string;
  items: NewsItem[];
  error?: string;
}

export interface NewsCrawler {
  source: string;
  /** 该源归属的资讯分类（与短视频赛道 code 一一对应） */
  category: string;
  crawl(): Promise<CrawlerResult>;
}
