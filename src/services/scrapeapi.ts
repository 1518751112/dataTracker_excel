import axios, {AxiosInstance} from "axios";
import {SCRAPEAPI_TOKEN} from "@/config/env";

interface ProductImage {
    url: string;
    scale: string;
}

interface ProductResult {
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

interface KeywordSearchResponse {
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

}

