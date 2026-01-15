import axios, {AxiosInstance} from "axios";
import {SCRAPEAPI_TOKEN} from "@/config/env";

interface AiReviews {
    items: any[];
    content: string;
}

interface ProductReview {
    date: string;
    country: string;
    imgs: string[];
    star: string;
    reviewLink: string;
    author: string;
    videos: string[];
    title: string;
    authorId: string;
    content: string;
    purchased: boolean;
    vineVoice: boolean;
    authorLink: string;
    attributes: unknown[];
    helpful: string;
    reviewId: string;
}

interface ProductDescriptionItem {
    images: string[];
}

export interface ProductDetail {
    aiReviews?: AiReviews;
    aiReviewsSummary?: AiReviews;
    category_name: string;
    color: string;
    product_weight: string;
    rating: string;
    description: string;
    first_date?: string;
    sales?: string;
    product_dims: string;
    merchant_id: string;
    galleryThumbnails: string[];
    title: string;
    customerReviews: string;
    category_id: string;
    reviews: ProductReview[];
    additional_details: boolean;
    pkg_dims: string;
    product_description: ProductDescriptionItem[];
    brand: string;
    image: string;
    price?: string;
    strikethroughPrice?: { value: string, key: string };
    inStock?: string;
    images: string[];
    star: string;
    coupon: string;
    attributes?: {
        key: string;
        value: string;
    }[];
    otherAsins: string[];
    highResolutionImages: string[];
    has_cart: boolean;
    delivery?: {
        deliveryTime:string
        fastestDelivery:string
    };
    asin: string;
}

export interface ProductResult {
    nature_rank: number;
    spRank?: number;
    sales: string;
    star: string;
    prime: string;
    more_choices: string;
    rating: string;
    price: string;
    title: string;
    images: string[];
    sponsored: string;
    asin: string;
    image: string;
    badge?: string;
}

export interface KeywordSearchResponse {
    keyword: string;
    nextPage: string;
    pageIndex: string;
    results: ProductResult[];
}

// 嵌套产品接口
export interface BestsellerProduct {
    image: string;
    star: string;
    rating: string;
    rank: string;
    asin: string;
    title: string;
    price?: string;
}

// 畅销榜响应接口
export interface BestsellerResponse {
    refTag: string;
    acpParam: string;
    recsList: string;
    offset: string;
    nextPage: string;
    results: BestsellerProduct[];
    acpPath: string;
}

export class Scrapeapi {
    private readonly axios:AxiosInstance;
    private constructor(token:string) {
        this.axios = axios.create({
            baseURL: `https://scrapeapi.pangolinfo.com`,
            headers: { 'Content-Type': 'application/json; charset=utf-8',"Authorization":`Bearer ${token}` }
        });
    }
    private static instance:Scrapeapi
    public readonly sites = [
        {site: "www.amazon.com",regex: ["10041", "90001", "60601", "84104"]},//美国
        {site: "www.amazon.co.uk", regex: ["W1S 3AS", "EH15 1LR", "M13 9PL", "M2 5BQ"]},//英国
        {site: "www.amazon.ca", regex: ["M4C 4Y4", "V6E 1N2", "H3G 2K8", "T2R 0G5"]},//加拿大
        {site: "www.amazon.de", regex: ["80331", "10115", "20095", "60306"]},//德国
        {site: "www.amazon.fr", regex: ["75000", "69001", "06000", "13000"]},//法国
        {site: "www.amazon.co.jp",regex: ["100-0004", "060-8588", "163-8001", "900-8570"]},//日本
        {site: "www.amazon.it", regex: ["20019", "50121", "00042", "30100"]},//意大利
        {site: "www.amazon.es", regex: ["41001", "28001", "08001", "46001"]},//西班牙
        {site: "www.amazon.com.au", regex: ["2000_SYDNEY", "3000_MELBOURNE"]},//澳大利亚
        {site: "www.amazon.com.mx", regex: ["01000", "55000"]},//墨西哥
        {site: "www.amazon.sa", regex: ["Riyadh_الرياض", "Jeddah_جدة"]},//沙特阿拉伯
        {site: "www.amazon.ae",regex: ["Abu Dhabi_ADCO Compound", "Ajman_Aamra"]},//阿联酋
        {site: "www.amazon.com.br", regex: ["03001-000", "20031-000"]}//巴西
    ];

    public static createInstance() {
        if (!this.instance) {
            if(!SCRAPEAPI_TOKEN){
                throw new Error("SCRAPEAPI_TOKEN is not defined");
            }
            this.instance = new Scrapeapi(SCRAPEAPI_TOKEN);
        }
        return this.instance;
    }
    public static getInstance(){
        return this.instance;
    }

    //关键字查询asin
    public async keywordSearchAsin(keyword:string,zipcode:string,page:number=1):Promise<KeywordSearchResponse>{
        const response = await this.axios.post(`/api/v1/scrape`,{
            "url": `https://${this.getAmazonSiteByZipcode(zipcode)}/s?k=${keyword?.replace(/\s/g,'+')}&page=${page}`,
            "format": "json",
            "parserName": "amzKeyword",
            "bizContext": {
                "zipcode": zipcode?.toString()
            }
        });
        if(response.data.code!=0){
            throw new Error(`Scrapeapi keywordSearchAsin error: ${response.data}`);
        }
        return response.data.data.json[0].data as KeywordSearchResponse;
    }

    //根据asin获取商品详情
    public async getProductByAsin(asin: string, zipcode: string): Promise<ProductDetail | null> {
        const response = await this.axios.post(`/api/v1/scrape`, {
            "url": `https://${this.getAmazonSiteByZipcode(zipcode)}/dp/${asin}`,
            "format": "json",
            "parserName": "amzProductDetail",
            "bizContext": {
                "zipcode": zipcode
            }
        });
        if (response.data.code != 0) {
            throw new Error(`Scrapeapi getProductByAsin error: ${response.data}`);
        }
        return response.data?.data?.json?.[0]?.data?.results?.[0] as ProductDetail || null;
    }

    //获取畅销榜排名
    public async getBestsellerRank(url: string, zipcode: string): Promise<BestsellerResponse | null> {
        const response = await this.axios.post(`/api/v1/scrape`, {
            "url": url,
            "format": "json",
            "parserName": "amzBestSellers",
            "bizContext": {
                "zipcode": zipcode
            }
        });
        if (response.data.code != 0) {
            throw new Error(`Scrapeapi getBestsellerRank error: ${response.data}`);
        }
        return response.data?.data?.json?.[0]?.data as BestsellerResponse || null;
    }

    //根据邮编获取亚马逊站点地址
    public getAmazonSiteByZipcode(zipcode: string):string {
        const site = this.sites.find(s=>s.regex.includes(zipcode));
        return site ? site.site : this.sites[0].site; //默认美国站点
    }

    //通过site获取zipcode
    public getZipcodeBySite(site: string):string|null {
        const siteObj = this.sites.find(s=>s.site==site);
        return siteObj ? siteObj.regex[0] : null
    }

}
