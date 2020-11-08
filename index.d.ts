import {
    HttpClient
} from '@angular/common/http';

export declare class Behaviours {

    constructor(http: HttpClient, baseURL: string, errorCallback: any, defaults: any);
    constructor(http: HttpClient, baseURL: string, errorCallback: any);
    constructor(http: HttpClient, baseURL: string);
    getBaseUrl();
    getBaseURL();
    ready(cb: any);
    getBehaviour(behaviourName: string);
}
