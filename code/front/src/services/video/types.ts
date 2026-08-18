/**
 * 短视频模块共享类型与常量（前后端通用，勿引入服务端依赖）。
 */

/** 短视频赛道（内容方向） */
export const TRACKS = [
  { code: "ai-news", name: "AI/科技资讯解读", emoji: "🤖" },
  { code: "novel-promo", name: "小说推文", emoji: "📚" },
  { code: "emotion", name: "情感/知识口播", emoji: "💡" },
  { code: "humor", name: "搞笑段子", emoji: "😂" },
  { code: "general", name: "通用", emoji: "🎬" },
] as const;

export type TrackCode = (typeof TRACKS)[number]["code"];

export function trackName(code: string): string {
  return TRACKS.find((t) => t.code === code)?.name ?? code;
}

export function trackEmoji(code: string): string {
  return TRACKS.find((t) => t.code === code)?.emoji ?? "🎬";
}

/** 可选配音音色（阿里百炼 CosyVoice 中文音色；edge 兜底引擎已弃用这些 id） */
export const VOICES = [
  { id: "longxiaochun", name: "小淳", gender: "女", style: "明亮活泼" },
  { id: "longwan", name: "龙婉", gender: "女", style: "温柔端庄" },
  { id: "longjing", name: "龙婧", gender: "女", style: "亲切甜美" },
  { id: "longshu", name: "龙书", gender: "男", style: "温润儒雅" },
  { id: "longshuo", name: "龙硕", gender: "男", style: "自然沉稳" },
  { id: "longfei", name: "龙飞", gender: "男", style: "激昂磁性" },
] as const;

export const DEFAULT_VOICE = "longxiaochun";

/** 单个分镜 */
export interface VideoShotItem {
  id: string;
  sort: number;
  visual: string;
  line: string;
  duration: number;
  /** AI 预生成的英文素材搜索词（旧脚本为 null） */
  materialQuery: string | null;
  /** 选定素材的视频直链（未选为 null） */
  materialUrl: string | null;
  /** 素材缩略图链接（未选为 null） */
  materialThumb: string | null;
}

/** 脚本（含分镜；列表与详情共用） */
export interface VideoScriptItem {
  id: string;
  track: string;
  topic: string;
  /** 采用的主标题（默认是 titles[0]） */
  title: string;
  /** AI 生成的候选标题（5 个） */
  titles: string[];
  /** 完整口播稿 */
  narration: string;
  createdAt: string;
  shots: VideoShotItem[];
  /** 来源新闻（无则为 null） */
  news: { title: string; url: string; source: string } | null;
  /** 配音音色 id（未配音为 null） */
  voice: string | null;
  /** 音频访问路径（未配音为 null） */
  audioUrl: string | null;
  /** SRT 字幕文本（未配音为 null） */
  srt: string | null;
}

/** 项目卡片摘要 */
export interface VideoProjectSummary {
  id: string;
  name: string;
  positioning: string | null;
  scriptCount: number;
  updatedAt: string;
}

/** 画面描述六段式公式的选项定义 */
export interface VisualPromptOption {
  code: string;
  name: string;
}

/** 六段式画面描述公式的预设选项 */
export const VISUAL_PROMPT_OPTIONS = {
  /** 1. 镜头运镜 */
  cameraMove: [
    { code: "固定机位", name: "固定机位" },
    { code: "缓慢横移", name: "缓慢横移" },
    { code: "向前推进", name: "向前推进" },
    { code: "镜头拉远", name: "镜头拉远" },
    { code: "缓慢推近", name: "缓慢推近" },
    { code: "航拍俯瞰", name: "航拍俯瞰" },
    { code: "跟随镜头", name: "跟随镜头" },
    { code: "手持晃动", name: "手持晃动" },
    { code: "环绕运镜", name: "环绕运镜" },
    { code: "快速切换", name: "快速切换" },
  ] as VisualPromptOption[],
  /** 2. 画面主体场景 */
  scene: [
    { code: "白天商业街", name: "白天商业街" },
    { code: "傍晚小区楼下", name: "傍晚小区楼下" },
    { code: "深夜写字楼格子间", name: "深夜写字楼格子间" },
    { code: "雨天小巷", name: "雨天小巷" },
    { code: "阳光海滩", name: "阳光海滩" },
    { code: "城市天台", name: "城市天台" },
    { code: "地铁车厢", name: "地铁车厢" },
    { code: "菜市场", name: "菜市场" },
    { code: "校园操场", name: "校园操场" },
    { code: "咖啡馆角落", name: "咖啡馆角落" },
    { code: "超市货架前", name: "超市货架前" },
    { code: "工厂车间", name: "工厂车间" },
    { code: "公园长椅", name: "公园长椅" },
    { code: "高速公路", name: "高速公路" },
    { code: "餐厅内", name: "餐厅内" },
  ] as VisualPromptOption[],
  /** 3. 核心画面动作/状态 */
  action: [
    { code: "商超卷帘门拉下闭店，周边摊贩全部收摊，街道空旷冷清", name: "商超卷帘门拉下闭店，周边摊贩全部收摊，街道空旷冷清" },
    { code: "年轻人低头刷手机面无表情", name: "年轻人低头刷手机面无表情" },
    { code: "外卖骑手在雨中奔跑送餐", name: "外卖骑手在雨中奔跑送餐" },
    { code: "老人坐在门口晒太阳目光呆滞", name: "老人坐在门口晒太阳目光呆滞" },
    { code: "白领伏案工作电脑屏幕亮着，桌上堆满文件和空咖啡杯", name: "白领伏案工作电脑屏幕亮着，桌上堆满文件和空咖啡杯" },
    { code: "一家三口围坐餐桌吃饭暖光映在脸上", name: "一家三口围坐餐桌吃饭暖光映在脸上" },
    { code: "上班族匆忙进出站低头看手机", name: "上班族匆忙进出站低头看手机" },
    { code: "学生背着书包快步走进校门", name: "学生背着书包快步走进校门" },
    { code: "厨师在灶台前翻炒火焰升腾", name: "厨师在灶台前翻炒火焰升腾" },
    { code: "护士在病房里记录病人数据", name: "护士在病房里记录病人数据" },
    { code: "快递员骑着电动车穿梭街道", name: "快递员骑着电动车穿梭街道" },
    { code: "清洁工弯腰捡拾路边垃圾", name: "清洁工弯腰捡拾路边垃圾" },
    { code: "情侣手牵手漫步街头", name: "情侣手牵手漫步街头" },
    { code: "小孩在草地上奔跑嬉戏", name: "小孩在草地上奔跑嬉戏" },
    { code: "司机专注驾驶双手握方向盘", name: "司机专注驾驶双手握方向盘" },
    { code: "顾客在柜台前排队点餐", name: "顾客在柜台前排队点餐" },
    { code: "工人在流水线上组装零件", name: "工人在流水线上组装零件" },
    { code: "摄影师举着相机对焦拍摄", name: "摄影师举着相机对焦拍摄" },
    { code: "健身教练指导学员做动作", name: "健身教练指导学员做动作" },
    { code: "摊贩在路边吆喝招揽客人", name: "摊贩在路边吆喝招揽客人" },
  ] as VisualPromptOption[],
  /** 4. 氛围情绪 */
  mood: [
    { code: "烟火气", name: "烟火气" },
    { code: "冷清萧条", name: "冷清萧条" },
    { code: "热闹繁华", name: "热闹繁华" },
    { code: "纪实市井氛围感", name: "纪实市井氛围感" },
    { code: "温馨治愈", name: "温馨治愈" },
    { code: "紧张压抑", name: "紧张压抑" },
    { code: "孤独落寞", name: "孤独落寞" },
    { code: "充满希望", name: "充满希望" },
    { code: "焦虑不安", name: "焦虑不安" },
    { code: "岁月静好", name: "岁月静好" },
    { code: "忙碌充实", name: "忙碌充实" },
    { code: "悠闲惬意", name: "悠闲惬意" },
  ] as VisualPromptOption[],
  /** 5. 画质风格 */
  style: [
    { code: "纪实摄影", name: "纪实摄影" },
    { code: "电影质感", name: "电影质感" },
    { code: "2D卡通动画", name: "2D卡通动画/动漫" },
    { code: "3D动画渲染", name: "3D动画渲染" },
    { code: "日式动漫风格", name: "日式动漫风格" },
    { code: "水彩画风", name: "水彩画风" },
    { code: "油画风格", name: "油画风格" },
    { code: "8K 高清", name: "8K 高清" },
    { code: "写实风格", name: "写实风格" },
    { code: "胶片质感", name: "胶片质感" },
    { code: "自然光感", name: "自然光感" },
    { code: "暖色调", name: "暖色调" },
    { code: "冷色调", name: "冷色调" },
    { code: "高对比度", name: "高对比度" },
    { code: "柔光效果", name: "柔光效果" },
  ] as VisualPromptOption[],
  /** 6. 约束条件（固定） */
  constraints: [
    { code: "无 logo、无水印、无文字字幕、画面流畅、人物面部模糊处理", name: "无 logo、无水印、无文字字幕、画面流畅、人物面部模糊处理" },
  ] as VisualPromptOption[],
};

/** GET /api/video/projects/[id] 返回的工作台全量数据 */
export interface VideoWorkspaceData {
  project: VideoProjectSummary;
  scripts: VideoScriptItem[];
}
