import {
  Http
} from '@angular/http';

export declare class Behaviours {

    constructor(http: Http, baseURL: string, errorCallback: any, defaults: any);
    constructor(http: Http, baseURL: string, errorCallback: any);
    constructor(http: Http, baseURL: string);
    getBaseUrl();
    getBaseURL();
    ready(cb: any);
    getBehaviour(behaviourName: string);
 }
