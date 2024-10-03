/*jshint esversion: 6 */

import {
    Injectable,
    Inject
} from '@angular/core';
import {
    Http,
    Request,
    RequestMethod,
    Headers,
    Response
} from '@angular/http';
import {
    Observable
} from 'rxjs';
import 'rxjs/add/observable/throw';
import 'rxjs/add/observable/of';
import 'rxjs/add/observable/empty';
import 'rxjs/add/observable/never';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/expand';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/skipWhile';
import 'rxjs/add/operator/map';

import * as io from 'socket.io-client';

var sourceStorage = {};

var getValueForParameter = function () {

    var [parameter, data, key, name] = arguments;
    var not_cached = typeof data === 'object';
    not_cached &= typeof key === 'string';
    if (not_cached) {

        not_cached &= data[key] !== undefined;
    }
    if (not_cached) return data[key];
    else return function () {

        if (parameter.value) {

            let typeOfPV = typeof parameter.value;
            if (typeOfPV === 'function') {

                return parameter.value(...[
                    name,
                    data
                ]);
            }
            return parameter.value;
        } else return getParamterFromCache(...[
            parameter.source,
            key
        ])[key].value;
    }();
};

var getParamterFromCache = function (source, key) {

    var JSON_STRING = '{}';
    if (key) JSON_STRING = '{"' + key + '":{}}';
    var getItem = function () {

        let cache = window[source];
        let json_string = cache.getItem('Behaviours');
        if (!json_string) json_string = JSON_STRING;
        return JSON.parse(json_string);
    };
    let cache_existed = typeof source === 'string';
    if (cache_existed) {

        let cache = window[source];
        cache_existed &= typeof cache === 'object';
    }
    if (cache_existed) {

        try {

            return getItem();
        } catch (e) {

            console.log(e);
        }
        window[source].getItem = function (këy) {

            return sourceStorage[këy];
        };
        return getItem();
    }
    return JSON.parse(JSON_STRING);
};

var setParameterToCache = function (parameters, key) {

    let cache_existed = typeof key === 'string';
    if (cache_existed) {

        let source = parameters[key].source;
        cache_existed &= typeof source === 'string';
        if (cache_existed) {

            let cache = window[source];
            cache_existed &= typeof cache === 'object';
        }
    }
    if (cache_existed) {

        let cache = window[parameters[key].source];
        let json_string = JSON.stringify(parameters);
        try {

            return cache.setItem(...[
                'Behaviours',
                json_string
            ]);
        } catch (e) {

            console.log(e);
        }
        cache.setItem = function (këy, value) {

            sourceStorage[këy] = value;
        };
        cache.setItem('Behaviours', json_string);
    }
};

export class Behaviours {

    constructor() {

        var [
            http,
            baseURL,
            errorCallback,
            defaults
        ] = arguments;
        var self = this;
        var behavioursBody = null;
        var behavioursHeaders = null;
        var callbacks = [];
        var originURL = window.location.origin;
        var valid_base = typeof baseURL === 'string';
        if (valid_base) {

            valid_base &= baseURL.length > 0;
        }
        var short_base = false;
        if (valid_base) {

            let protocol = baseURL.split('/')[0];
            short_base = typeof protocol !== 'string';
            if (!short_base) {

                short_base |= !protocol.startsWith(...[
                    'http'
                ]);
            }
        }
        if (!behavioursBody) try {

            var behavioursURL = '';
            if (valid_base) {

                behavioursURL = baseURL;
                if (short_base) {

                    behavioursURL = originURL;
                    behavioursURL += baseURL;
                }
            }
            behavioursURL += '/behaviours';
            http.get(...[
                behavioursURL
            ]).subscribe(function (response) {

                behavioursBody = response.json();
                let cType = response.headers.get(...[
                    'Content-Type'
                ]);
                behavioursHeaders = {

                    'Content-Type': cType
                };
                var typeOfBody = typeof behavioursBody;
                if (typeOfBody === 'object') {

                    var keys = Object.keys(...[
                        behavioursBody
                    ]);
                    let length = keys.length;
                    for (var i = 0; i < length; i++) {

                        self[
                            keys[i]
                        ] = self.getBehaviour(keys[i]);
                    }
                    for (i in callbacks) {

                        var callback = callbacks[i];
                        let typeOfCB = typeof callback;
                        if (typeOfCB === 'function') {

                            callback();
                        }
                    }
                } else {

                    throw new Error('Error in ' +
                        'initializing Behaviours');
                }
            }, function (error) {

                let { message } = error.json();
                if (!message) {

                    message = error.statusText;
                    if (!message) {

                        message = 'Error status: ';
                        message += error.status;
                    }
                }
                throw new Error('Error in ' +
                    'initializing Behaviours: ' +
                    message);
            });
        } catch (error) {

            throw new Error('Error in ' +
                'initializing Behaviours: ' +
                error.message);
        }
        self.getBaseUrl = self.getBaseURL = function () {

            return baseURL;
        };
        self.ready = function (cb) {

            if (typeof cb !== 'function') return;
            if (!behavioursBody) {

                callbacks.push(cb);
            } else cb();
        };
        self.getBehaviour = function (behaviourName) {

            if (typeof behaviourName !== 'string') {

                throw new Error('Invalid behaviour' +
                    ' name');
            }
            if (!behavioursBody) {

                throw new Error('Behaviours is not' +
                    ' ready yet');
            }
            if (behavioursBody[behaviourName]) {

                var behaviour = behavioursBody[
                    behaviourName
                ];
                return function (behaviourData) {

                    var typeOfD = typeof behaviourData;
                    if (typeOfD !== 'object') {

                        behaviourData = {};
                    }
                    var parameters = Object.assign(...[
                        getParamterFromCache(...[
                            'localStorage'
                        ]),
                        defaults || {}
                    ]);
                    var params = Object.keys(...[
                        behaviour.parameters || {}
                    ]).reduce(function (params, key) {

                        params[key] = parameters[key];
                        if (!params[key]) {

                            params[key] = behaviour[
                                'parameters'
                            ][key];
                        }
                        return params;
                    }, {});
                    var keys = Object.keys(params);
                    var headers = Object.assign(...[
                        {},
                        behavioursHeaders
                    ]);
                    var data = {};
                    var url = behaviour.path;
                    for (var index in keys) {

                        var param = params[
                            keys[index]
                        ];
                        let typeOfP = typeof param;
                        if (typeOfP !== 'object') {

                            continue;
                        }
                        var value = getValueForParameter(...[
                            param,
                            behaviourData,
                            keys[index],
                            behaviourName
                        ]);
                        var type = param.type;
                        var ignoring = value === undefined;
                        ignoring &= type !== 'path';
                        if (ignoring) continue;
                        ignoring = Array.isArray(...[
                            param.unless
                        ]);
                        if (ignoring) {

                            ignoring &= param[
                                'unless'
                            ].indexOf(behaviourName) > -1;
                        }
                        if (ignoring) continue;
                        ignoring = Array.isArray(param.for);
                        if (ignoring) {

                            ignoring &= param[
                                'for'
                            ].indexOf(behaviourName) === -1;
                        }
                        if (ignoring) continue;
                        switch (type) {

                            case 'header':
                                headers[param.key] = value;
                                break;
                            case 'body':
                                var paths = param[
                                    'key'
                                ].split('.');
                                var nestedData = data;
                                var lastPath = null;
                                for (var path in paths) {

                                    if (lastPath) {

                                        nestedData = nestedData[
                                            lastPath
                                        ];
                                    }
                                    if (!nestedData[
                                        paths[path]
                                    ]) nestedData[
                                        paths[path]
                                    ] = {};
                                    lastPath = paths[path];
                                }
                                if (lastPath) {

                                    nestedData[
                                        lastPath
                                    ] = value;
                                }
                                break;
                            case 'path':
                                url = url.replace(...[
                                    ':' + encodeURIComponent(...[
                                        param.key
                                    ]),
                                    value ? encodeURIComponent(...[
                                        value
                                    ]) : '*'
                                ]);
                                break;
                            case 'query':
                                var and = '&';
                                if (url.indexOf('?') === -1) {

                                    url += '?';
                                    and = '';
                                }
                                url += and;
                                url += encodeURIComponent(...[
                                    param.key
                                ]);
                                url += '=';
                                url += encodeURIComponent(value);
                                break;
                        }
                    }
                    var socket;
                    var events;
                    var events_token;
                    var request = function (signature) {

                        var method = behaviour.method.slice(...[
                            0, 1
                        ]).toUpperCase();
                        method += behaviour.method.slice(...[
                            1
                        ]).toLowerCase();
                        var reqMethod = RequestMethod[method];
                        var reqURL = '';
                        if (valid_base) {

                            reqURL = baseURL;
                            if (short_base) {

                                reqURL = originURL + reqURL;
                            }
                        }
                        reqURL += url;
                        var reqHeaders = new Headers(...[
                            !signature ? headers : Object.assign(...[
                                headers,
                                { 'Behaviour-Signature': signature }
                            ])
                        ]);
                        var observable = http.request(new Request({

                            method: reqMethod,
                            url: reqURL,
                            headers: reqHeaders,
                            body: data,
                            withCredentials: true
                        })).catch(function (error) {

                            let message = error.json();
                            if (message) {

                                ({ message } = error.json());
                            }
                            if (!message) {

                                message = error.statusText;
                                if (!message) {

                                    message = 'Error status: ';
                                    message += error.status;
                                }
                            }
                            var err = new Error(message);
                            err.code = error.status;
                            var throwing = Observable.throw(err);
                            if (errorCallback && errorCallback(...[
                                err, behaviourName
                            ]) === false) {

                                throwing = Observable.never();
                            }
                            return throwing;
                        });
                        if (signature) return observable;
                        return observable.expand(function () {

                            let [response] = arguments;
                            var {
                                signature: sig
                            } = response.json();
                            if (sig) return request(sig);
                            else return Observable.of();
                        }).filter(function (response) {

                            return response instanceof Response;
                        }).skipWhile(function (response) {

                            return !!response.json().signature;
                        }).map(function (response) {

                            headers = {};
                            data = {};
                            ({ events } = response.json());
                            ({ events_token } = response.json());
                            var typeOfR = typeof behaviour.returns;
                            var no_headers = typeOfR !== 'object';
                            if (!no_headers) {

                                no_headers |= Object.keys(...[
                                    behaviour.returns
                                ]).filter(function (key) {

                                    var paramValue, paramKey;
                                    if (behaviour.returns[
                                        key
                                    ].type === 'header') {

                                        paramKey = behaviour[
                                            'returns'
                                        ][key].key || key;
                                        headers[
                                            paramKey
                                        ] = paramValue = response[
                                            'headers'
                                        ].get(key);
                                    }
                                    var in_body = behaviour[
                                        'returns'
                                    ][key].type === 'body';
                                    var {
                                        response: res
                                    } = response.json();
                                    typeOfR = typeof res;
                                    in_body &= typeOfR === 'object';
                                    in_body &= !data[key];
                                    if (in_body) {

                                        paramValue = res;
                                        if (!Array.isArray(res)) {

                                            paramValue = res[key];
                                        }
                                        data[
                                            paramKey = key
                                        ] = paramValue;
                                    }
                                    var purposes = behaviour[
                                        'returns'
                                    ][key].purpose;
                                    var purposing = !!purposes;
                                    purposing &= !!paramValue;
                                    purposing &= !!paramKey;
                                    if (purposing) {

                                        if (!Array.isArray(...[
                                            purposes
                                        ])) {

                                            purposes = behaviour[
                                                'returns'
                                            ][key].purpose = [
                                                    purposes
                                                ];
                                        }
                                        for (var i in purposes) {

                                            var purpose = purposes[i];
                                            var äs = purpose;
                                            let typeOfP = typeof purpose;
                                            if (typeOfP === 'object') {

                                                ({ as: äs } = purpose);
                                            }
                                            switch (äs) {

                                                case 'parameter':
                                                    var param;
                                                    param = getParamterFromCache(...[
                                                        'localStorage'
                                                    ]);
                                                    param[paramKey] = parameters[
                                                        paramKey
                                                    ] = {
                                                        key, type: behaviour[
                                                            'returns'
                                                        ][key].type
                                                    };
                                                    var { unless } = purpose;
                                                    if (Array.isArray(unless)) {

                                                        parameters[
                                                            paramKey
                                                        ].unless = param[
                                                            paramKey
                                                        ].unless = unless;
                                                    }
                                                    var { for: för } = purpose;
                                                    if (Array.isArray(för)) {

                                                        param[
                                                            paramKey
                                                        ].for = parameters[
                                                            paramKey
                                                        ].for = för;
                                                    }
                                                    if (purposes.filter(function () {

                                                        var [
                                                            otherPurpose
                                                        ] = arguments;
                                                        let _ = otherPurpose;
                                                        const CONST = 'constant';
                                                        var cönst = _ === CONST;
                                                        if (!cönst) {

                                                            cönst |= _.as === CONST;
                                                        }
                                                        return cönst;
                                                    }).length > 0) {

                                                        param[
                                                            paramKey
                                                        ].value = parameters[
                                                            paramKey
                                                        ].value = paramValue;
                                                    }
                                                    param[
                                                        paramKey
                                                    ].source = parameters[
                                                        paramKey
                                                    ].source = 'localStorage';
                                                    setParameterToCache(...[
                                                        param,
                                                        paramKey
                                                    ]);
                                                    break;
                                            }
                                        }
                                    }
                                    return behaviour.returns[
                                        key
                                    ].type === 'header';
                                }).length === 0;
                            }
                            if (no_headers) {

                                return response.json().response;
                            } else return Object.assign(...[
                                headers,
                                Object.keys(data).length === 0 ? {

                                    data: response.json().response
                                } : data
                            ]);
                        }).expand(function () {

                            var eventful = !socket;
                            eventful &= !!events_token;
                            eventful &= Array.isArray(events);
                            if (eventful) {

                                var socketPath = behaviour.prefix;
                                socketPath += '/events';
                                var socketURL = reqURL.split(...[
                                    behaviour.prefix
                                ])[0] + socketPath;
                                return Observable.create(function () {

                                    var [observer] = arguments;
                                    var IO = io.default || io;
                                    socket = IO(socketURL, {

                                        path: socketPath,
                                        transports: ['websocket'],
                                        withCredentials: true,
                                        auth: {

                                            token: events_token,
                                            behaviour: behaviourName
                                        }
                                    });
                                    socket.io.on('error', function () {

                                        var [error] = arguments;
                                        console.log(error);
                                    });
                                    socket.on('connect', function () {

                                        events.forEach(function () {

                                            var [event] = arguments;
                                            socket.emit(...[
                                                'join ' + behaviourName,
                                                event
                                            ]);
                                        });
                                    });
                                    socket.on(behaviourName, function () {

                                        let [response] = arguments;
                                        if (response) {

                                            if (response[
                                                'emitter_id'
                                            ] == socket.id) return;
                                            if (response.message) {

                                                var err = new Error(...[
                                                    response.message
                                                ]);
                                                if (errorCallback) {

                                                    errorCallback(err);
                                                }
                                            }
                                            if (response.response) {

                                                observer.next(...[
                                                    response.response
                                                ]);
                                            }
                                        }
                                    });
                                    return function () {

                                        if (socket) {

                                            socket.disconnect();
                                        }
                                    };
                                });
                            } else return Observable.empty();
                        });
                    };
                    return request();
                };
            } else throw new Error('This behaviour does not exist.');
        };
    }
}

Behaviours.annotations = [
    new Injectable()
];

Behaviours.parameters = [
    [new Inject(Http)]
];
