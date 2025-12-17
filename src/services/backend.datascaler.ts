import axios, {AxiosInstance} from "axios";
import {BACKEND_SERVER_URL} from "@/config/env";

export interface IAsinKeywords{
    asin:string;
    pageSize?:number;
    pageNum?:number;
}

export interface ISearchesTrend {
    month: string;
    searches: number;
    searchRank: number;
}

export interface IRankPosition {
    page: number;
    pageSize: number;
    index: number;
    position: number;
    updatedTime: number;
}

export interface IAraClickItem {
    asin: string;
    imageUrl: string;
    clickRate: number;
    conversionRate: number;
    productTitle: string;
}

export interface IKeywordData {
    guestId: string | null;
    keywords: string;
    keywordCn: string;
    keywordJp: string;
    searches: number;
    products: number;
    purchases: number;
    purchaseRate: number;
    bid: number;
    bidMax: number;
    bidMin: number;
    minPhrasePpc: number;
    maxPhrasePpc: number;
    phrasePpc: number;
    minBroadPpc: number;
    maxBroadPpc: number;
    broadPpc: number;
    minExactPpc: number;
    maxExactPpc: number;
    exactPpc: number;
    badges: string[];
    position: string;
    positions: string[];
    gkDatas: unknown[];
    top10Asin: string;
    rankPosition: IRankPosition;
    adPosition: IRankPosition;
    updatedTime: number;
    searchesRank: number;
    searchesRankTimeFrom: number;
    searchesRankTimeTo: number;
    latest1daysAds: number;
    latest7daysAds: number;
    latest30daysAds: number;
    supplyDemandRatio: number;
    searchesTrend: ISearchesTrend[];
    trafficPercentage: number;
    trafficKeywordTypes: string[];
    conversionKeywordTypes: string[] | null;
    calculatedWeeklySearches: number;
    araClickTop3: IAraClickItem[];
    titleDensityExact: number;
    cprExact: number;
    avgPrice: number;
    avgReviews: number;
    avgRating: number;
    ac: unknown | null;
    naturalRatio: number;
    recommendRatio: number;
    adRatio: number;
    monopolyClickRate: number;
    top3ClickingRate: number;
    top3ConversionRate: number;
    clicks: number;
    impressions: number;
    guestVisited: boolean;
}

export interface IAsinKeywordsMeta {
    asin: string;
    marketplace: string;
    count: number;
}

export interface IAsinKeywordsResponse {
    data: IKeywordData[];
    meta: IAsinKeywordsMeta;
}

export class BackendDataScalerService {
    private readonly axios:AxiosInstance;
    private constructor() {
        this.axios = axios.create({
            baseURL: `${BACKEND_SERVER_URL}`,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
    private static instance:BackendDataScalerService

    public static createInstance() {
        if (!this.instance) {
            if(!BACKEND_SERVER_URL){
                throw new Error("BACKEND_SERVER_URL is not defined");
            }
            this.instance = new BackendDataScalerService();
        }
        return this.instance;
    }
    public static getInstance(){
        return this.instance;
    }

    /**
     * 获取asin反查关键词 默认100
     * 每页最多返回100条数据
     * @param config
     */
    public async getAsinKeywords(config:IAsinKeywords):Promise<IAsinKeywordsResponse>{
        const response = await this.axios.get(`api/market-data/${config.asin}/keywords`,{
            params:{
                pageSize:config.pageSize,
                pageNum:config.pageNum,
            }
        });
        return response.data;
    }

}
