var app = angular.module("behaviour", []);
var behaviour = app.factory('behaviours', ['$http', function($http, baseURL, errorCallback, defaults) {

    var behavioursBody = null;
    var behavioursHeaders = null;
    var callbacks = [];
    var getValueForParameter = function(parameter, data, key, name) {

        if (typeof data === 'object' && typeof key === 'string' && data[key] !== undefined) return data[key];
        else return (function() {

            if (parameter.value) return typeof parameter.value === 'function' ? parameter.value(name, data) : parameter.value;
            else return getParamterFromCache(parameter.source, key)[key].value;
        }());
    };
    var getParamterFromCache = function(source, key) {

        if (typeof source === 'string' && typeof window[source] === 'object')
            return JSON.parse(window[source].getItem('Behaviours') || (key ? '{"' + key + '":{}}' : '{}'));
        return JSON.parse(key ? '{"' + key + '":{}}' : '{}');
    };
    var setParameterToCache = function(parameters, key) {

        if (typeof key === 'string' && typeof parameters[key].source === 'string' && typeof window[parameters[key].source] === 'object')
            window[parameters[key].source].setItem('Behaviours', JSON.stringify(parameters));
    };
    var self = {

        ready: function(cb) {

            if (typeof cb !== 'function') return;
            if (!behavioursBody) {

                callbacks.push(cb);
            } else cb();
        },
        getBehaviour: function(behaviourName) {

            if (typeof behaviourName !== 'string') {

                throw new Error('Invalid behaviour name');
            }
            if (!behavioursBody) {

                throw new Error('Behaviours is not ready yet');
            }
            if (behavioursBody[behaviourName]) {

                var behaviour = behavioursBody[behaviourName];
                return function(behaviourData) {

                    if (typeof behaviourData !== 'object') behaviourData = {};
                    var parameters = Object.assign(getParamterFromCache('localStorage'), defaults || {});
                    var params = Object.assign(behaviour.parameters || {}, parameters);
                    var keys = Object.keys(params);
                    var headers = {};
                    var data = {};
                    var url = behaviour.path;
                    for (var key in keys)
                        if (params && typeof params[keys[key]] === 'object') {

                            var value = getValueForParameter(params[keys[key]], behaviourData, keys[key], behaviourName);
                            var type = params[keys[key]].type;
                            if (value === undefined && type !== 'path') continue;
                            if (Array.isArray(params[keys[key]].unless) && params[keys[key]].unless.indexOf(behaviourName) > -1) continue;
                            if (Array.isArray(params[keys[key]].for) && params[keys[key]].for.indexOf(behaviourName) === -1) continue;
                            switch (type) {

                                case 'header':
                                    headers[params[keys[key]].key] = value;
                                    break;
                                case 'body':
                                    var paths = params[keys[key]].key.split('.');
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
                                    url = url.replace(':' + encodeURIComponent(params[keys[key]].key), value ? encodeURIComponent(value) : '*');
                                    break;
                                case 'query':
                                    var and = '&';
                                    if (url.indexOf('?') === -1) {

                                        url += '?';
                                        and = '';
                                    }
                                    url += and + encodeURIComponent(params[keys[key]].key) + '=' + encodeURIComponent(value);
                                    break;
                            }
                        }
                    if (Object.keys(behavioursHeaders).length > 0) headers = Object.assign(headers, behavioursHeaders);
                    $http({

                        method: behaviour.method.slice(0, 1).toUpperCase() + behaviour.method.slice(1).toLowerCase(),
                        url: (typeof baseURL === 'string' && baseURL.length > 0 ? typeof baseURL.split('/')[0] === 'string' &&
                            baseURL.split('/')[0].startsWith('http') ? baseURL : window.location.origin + baseURL : '') + url,
                        data: data,
                        headers: headers
                    }).then(function(response) {

                        headers = {};
                        data = {};
                        if (typeof behaviour.returns === 'object' && Object.keys(behaviour.returns).filter(function(key) {

                                var paramValue, paramKey;
                                if (behaviour.returns[key].type === 'header')
                                    headers[paramKey = behaviour.returns[key].key || key] = paramValue = response.headers.get(key);
                                if (behaviour.returns[key].type === 'body' && typeof response.json().response === 'object' && !data[key])
                                    data[paramKey = key] = paramValue = Array.isArray(response.json().response) ? response.json().response : response.json().response[key];
                                if (behaviour.returns[key].purpose && paramValue && paramKey) {

                                    if (!Array.isArray(behaviour.returns[key].purpose)) behaviour.returns[key].purpose = [behaviour.returns[key].purpose];
                                    for (var index in behaviour.returns[key].purpose) {

                                        var purpose = behaviour.returns[key].purpose[index];
                                        switch (typeof purpose === 'object' ? purpose.as : purpose) {

                                            case 'parameter':
                                                var param = getParamterFromCache('localStorage');
                                                param[paramKey] = parameters[paramKey] = {

                                                    key: key,
                                                    type: behaviour.returns[key].type
                                                };
                                                if (Array.isArray(purpose.unless)) param[paramKey].unless = parameters[paramKey].unless = purpose.unless;
                                                if (Array.isArray(purpose.for)) param[paramKey].for = parameters[paramKey].for = purpose.for;
                                                if (behaviour.returns[key].purpose.filter(function(p) {

                                                        return p === 'constant' || p.as === 'constant';
                                                    }).length > 0) param[paramKey].value = parameters[paramKey].value = paramValue;
                                                param[paramKey].source = parameters[paramKey].source = 'localStorage';
                                                setParameterToCache(param, paramKey);
                                                break;
                                        }
                                    }
                                }
                                return behaviour.returns[key].type === 'header';
                            }).length > 0) {

                            callback(Object.assign(headers, Object.keys(data).length === 0 ? {

                                data: response.data.response
                            } : data));
                        } else callback(response.data.response);
                    }, function(error) {

                        var err = new Error((error.data && error.data.message) || error.statusText ||
                            ('Error status: ' + error.status));
                        err.code = error.status;
                        if (errorCallback) errorCallback(err);
                        callback(null, err);
                    });
                };
            } else {

                throw new Error('This behaviour does not exist.');
            }
        }
    };
    self.getBaseUrl = self.getBaseURL = function() {

        return baseURL;
    };
    if (!behavioursBody) $http.get((typeof baseURL === 'string' && baseURL.length > 0 ? typeof baseURL.split('/')[0] === 'string' &&
        baseURL.split('/')[0].startsWith('http') ? baseURL : window.location.origin + baseURL : '') + '/behaviours').then(function(response) {

        behavioursBody = response.data;
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
    }, function(error) {

        throw new Error('Error in initializing Behaviours: ' + error.data.message || error.statusText || ('Error status: ' + error.status));
    });
    return self;
}]);
