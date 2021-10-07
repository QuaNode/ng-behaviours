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

import * as io from 'socket.io-client';

var sourceStorage = {};

var getValueForParameter = function (parameter, data, key, name) {

    if (typeof data === 'object' && typeof key === 'string' && data[key] !== undefined) return data[key];
    else return (function () {

        if (parameter.value) return typeof parameter.value === 'function' ? parameter.value(name, data) :
            parameter.value;
        else return getParamterFromCache(parameter.source, key)[key].value;
    }());
};

var getParamterFromCache = function (source, key) {

    var getItem = function () {

        return JSON.parse(window[source].getItem('Behaviours') || (key ? '{"' + key + '":{}}' : '{}'));
    };
    if (typeof source === 'string' && typeof window[source] === 'object') {

        try {

            return getItem();
        } catch (e) {

            console.log(e);
        }
        window[source].getItem = function (key) {

            return sourceStorage[key];
        };
        return getItem();
    }
    return JSON.parse(key ? '{"' + key + '":{}}' : '{}');
};

var setParameterToCache = function (parameters, key) {

    if (typeof key === 'string' && typeof parameters[key].source === 'string' &&
        typeof window[parameters[key].source] === 'object') {

        try {

            return window[parameters[key].source].setItem('Behaviours', JSON.stringify(parameters));
        } catch (e) {

            console.log(e);
        }
        window[parameters[key].source].setItem = function (key, value) {

            sourceStorage[key] = value;
        };
        window[parameters[key].source].setItem('Behaviours', JSON.stringify(parameters));
    }
};

export class Behaviours {

    constructor(http, baseURL, errorCallback, defaults) {

        var self = this;
        var behavioursBody = null;
        var behavioursHeaders = null;
        var callbacks = [];
        if (!behavioursBody) try {

            http.get((typeof baseURL === 'string' && baseURL.length > 0 ?
                typeof baseURL.split('/')[0] === 'string' && baseURL.split('/')[0].startsWith('http') ?
                    baseURL : window.location.origin + baseURL : '') +
                '/behaviours').subscribe(function (response) {

                    behavioursBody = response.json();
                    behavioursHeaders = {

                        'Content-Type': response.headers.get('Content-Type')
                    };
                    if (typeof behavioursBody === 'object') {

                        var keys = Object.keys(behavioursBody);
                        for (var i = 0; i < keys.length; i++) {

                            self[keys[i]] = self.getBehaviour(keys[i]);
                        }
                        for (i in callbacks) {

                            var callback = callbacks[i];
                            if (typeof callback === 'function') callback();
                        }
                    } else {

                        throw new Error('Error in initializing Behaviours');
                    }
                }, function (error) {

                    throw new Error('Error in initializing Behaviours: ' + error.json().message ||
                        error.statusText || ('Error status: ' + error.status));
                });
        } catch (error) {

            throw new Error('Error in initializing Behaviours: ' + error.message);
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

                throw new Error('Invalid behaviour name');
            }
            if (!behavioursBody) {

                throw new Error('Behaviours is not ready yet');
            }
            if (behavioursBody[behaviourName]) {

                var behaviour = behavioursBody[behaviourName];
                return function (behaviourData) {

                    if (typeof behaviourData !== 'object') behaviourData = {};
                    var parameters = Object.assign(getParamterFromCache('localStorage'), defaults || {});
                    var params = Object.keys(behaviour.parameters || {}).reduce(function (params, key) {

                        params[key] = parameters[key] || behaviour.parameters[key];
                        return params;
                    }, {});
                    var keys = Object.keys(params);
                    var headers = Object.assign({}, behavioursHeaders);
                    var data = {};
                    var url = behaviour.path;
                    for (var index in keys) {

                        var param = params[keys[index]];
                        if (typeof param !== 'object') continue;
                        var value = getValueForParameter(param, behaviourData, keys[index],
                            behaviourName);
                        var type = param.type;
                        if (value === undefined && type !== 'path') continue;
                        if (Array.isArray(param.unless) && param.unless.indexOf(behaviourName) > -1)
                            continue;
                        if (Array.isArray(param.for) && param.for.indexOf(behaviourName) === -1)
                            continue;
                        switch (type) {

                            case 'header':
                                headers[param.key] = value;
                                break;
                            case 'body':
                                var paths = param.key.split('.');
                                var nestedData = data;
                                var lastPath = null;
                                for (var path in paths) {

                                    if (lastPath) nestedData = nestedData[lastPath];
                                    if (!nestedData[paths[path]]) nestedData[paths[path]] = {};
                                    lastPath = paths[path];
                                }
                                if (lastPath) nestedData[lastPath] = value;
                                break;
                            case 'path':
                                url = url.replace(':' + encodeURIComponent(param.key),
                                    value ? encodeURIComponent(value) : '*');
                                break;
                            case 'query':
                                var and = '&';
                                if (url.indexOf('?') === -1) {

                                    url += '?';
                                    and = '';
                                }
                                url += and + encodeURIComponent(param.key) + '=' +
                                    encodeURIComponent(value);
                                break;
                        }
                    }
                    var socket;
                    var events;
                    var events_token;
                    var request = function (signature) {

                        var reqMethod = RequestMethod[behaviour.method.slice(0, 1).toUpperCase() +
                            behaviour.method.slice(1).toLowerCase()];
                        var reqURL = (typeof baseURL === 'string' && baseURL.length > 0 ? typeof
                            baseURL.split('/')[0] === 'string' && baseURL.split('/')[0].startsWith('http') ?
                            baseURL : window.location.origin + baseURL : '') + url;
                        var reqHeaders = new Headers(!signature ? headers : Object.assign(headers, {

                            'Behaviour-Signature': signature
                        }));
                        var observable = http.request(new Request({

                            method: reqMethod,
                            url: reqURL,
                            headers: reqHeaders,
                            body: data,
                            withCredentials: true
                        })).catch(function (error) {

                            var err = new Error((error.json() && error.json().message) || error.statusText ||
                                ('Error status: ' + error.status));
                            err.code = error.status;
                            var throwing = Observable.throw(err);
                            if (errorCallback) errorCallback(err);
                            return throwing;
                        });
                        return signature ? observable : observable.expand(function (response) {

                            var sig = response.json().signature;
                            if (sig) return request(sig);
                            else return Observable.of();
                        }).filter(function (response) {

                            return response instanceof Response;
                        }).skipWhile(function (response) {

                            return !!response.json().signature;
                        }).map(function (response) {

                            headers = {};
                            data = {};
                            events = response.json().events;
                            events_token = response.json().events_token;
                            if (typeof behaviour.returns === 'object' &&
                                Object.keys(behaviour.returns).filter(function (key) {

                                    var paramValue, paramKey;
                                    if (behaviour.returns[key].type === 'header')
                                        headers[paramKey = behaviour.returns[key].key || key] =
                                            paramValue = response.headers.get(key);
                                    if (behaviour.returns[key].type === 'body' &&
                                        typeof response.json().response === 'object' && !data[key])
                                        data[paramKey = key] = paramValue =
                                            Array.isArray(response.json().response) ?
                                                response.json().response : response.json().response[key];
                                    var purposes = behaviour.returns[key].purpose;
                                    if (purposes && paramValue && paramKey) {

                                        if (!Array.isArray(purposes))
                                            purposes = behaviour.returns[key].purpose = [purposes];
                                        for (var index in purposes) {

                                            var purpose = purposes[index];
                                            switch (typeof purpose === 'object' ? purpose.as : purpose) {

                                                case 'parameter':
                                                    var param = getParamterFromCache('localStorage');
                                                    param[paramKey] = parameters[paramKey] = {

                                                        key: key,
                                                        type: behaviour.returns[key].type
                                                    };
                                                    if (Array.isArray(purpose.unless))
                                                        param[paramKey].unless = parameters[paramKey].unless =
                                                            purpose.unless;
                                                    if (Array.isArray(purpose.for)) param[paramKey].for =
                                                        parameters[paramKey].for = purpose.for;
                                                    if (purposes.filter(function (otherPurpose) {

                                                        return otherPurpose === 'constant' ||
                                                            otherPurpose.as === 'constant';
                                                    }).length > 0) param[paramKey].value =
                                                        parameters[paramKey].value = paramValue;
                                                    param[paramKey].source = parameters[paramKey].source =
                                                        'localStorage';
                                                    setParameterToCache(param, paramKey);
                                                    break;
                                            }
                                        }
                                    }
                                    return behaviour.returns[key].type === 'header';
                                }).length > 0) {

                                return Object.assign(headers, Object.keys(data).length === 0 ? {

                                    data: response.json().response
                                } : data);
                            } else return response.json().response;
                        }).expand(function () {

                            if (!socket && events_token && Array.isArray(events)) {

                                var socketPath = behaviour.prefix + '/events';
                                var socketURL = reqURL.split(behaviour.prefix)[0] + socketPath;
                                return Observable.create(function (observer) {

                                    socket = (io.default || io)(socketURL, {

                                        path: socketPath,
                                        transports: ['websocket'],
                                        withCredentials: reqURL.startsWith(window.location.origin) ?
                                            behaviour.credentials : true,
                                        auth: {

                                            token: events_token,
                                            behaviour: behaviourName
                                        }
                                    });
                                    socket.io.on('error', function (error) {

                                        console.log(error);
                                    });
                                    socket.on('connect', function () {

                                        events.forEach(function (event) {

                                            socket.emit('join ' + behaviourName, event);
                                        });
                                    });
                                    socket.on(behaviourName, function (response) {

                                        if (response) {

                                            if (response.emitter_id == socket.id) return;
                                            if (response.message) {

                                                var err = new Error(response.message);
                                                if (errorCallback) errorCallback(err);
                                            }
                                            if (response.response) observer.next(response.response);
                                        }
                                    });
                                    return function () {

                                        if (socket) socket.disconnect();
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
