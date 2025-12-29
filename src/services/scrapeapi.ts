import axios, {AxiosInstance} from "axios";
import {SCRAPEAPI_TOKEN} from "@/config/env";

interface AiReviews {
    items: unknown[];
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
    aiReviews: AiReviews;
    category_name: string;
    color: string;
    product_weight: string;
    rating: string;
    description: string;
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
    images: string[];
    star: string;
    coupon: string;
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
    sales: string;
    star: string;
    prime: string;
    more_choices: string;
    rating: string;
    price: string;
    title: string;
    images: string[];
    sponsered: string;
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

export class Scrapeapi {
    private readonly axios:AxiosInstance;
    private constructor(token:string) {
        this.axios = axios.create({
            baseURL: `https://scrapeapi.pangolinfo.com`,
            headers: { 'Content-Type': 'application/json; charset=utf-8',"Authorization":`Bearer ${token}` }
        });
    }
    private static instance:Scrapeapi

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
            "url": `https://www.amazon.com/s?k=${keyword?.replace(/\s/g,'+')}&page=${page}`,
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
            "url": `https://www.amazon.com/dp/${asin}`,
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

}

