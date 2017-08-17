var app = angular.module("behaviour", []);
var behaviour = app.factory('behaviours', ['$http', function($http, baseURL, defaults) {

    var behavioursJson = null;
    var parameters = Object.assign(JSON.parse(window.localStorage.getItem('Behaviours') || '{}'), defaults || {});
    var getValueForParameter = function(parameter, data, key, name) {

        return (typeof data === 'object' && typeof key === 'string' && data[key]) || (function() {

            if (parameter.value) return typeof parameter.value === 'function' ? parameter.value(name, data) : parameter.value;
            else
                return getParamterFromCache(parameter.source, key)[key].value;
        }());
    };

    var getParamterFromCache = function(source, key) {

        if (typeof source === 'string' && typeof window[source] === 'function')
            return JSON.parse(window[source].getItem('Behaviours') || (key ? '{"' + key + '":null}' : '{}'));
        return (key ? { key: null } : {});
    }

    var setParameterToCache = function(parameter) {

        if (typeof parameter.source === 'string' && typeof window[parameter.source] === 'function')
            window[parameter.source].setItem('Behaviours', JSON.stringify(parameter));
    }

    var self = {

        getBehaviour: function(behaviourName) {

            if (typeof behaviourName !== 'string') {

                throw new Error('Invalid behaviour name');
            }
            if (!behavioursJson) {

                throw new Error('Behaviours is not ready yet');
            }
            if (behavioursJson[behaviourName]) {

                var behaviour = behavioursJson[behaviourName];
                return function(behaviourData, callback) {

                    if (typeof behaviourData !== 'object') behaviourData = {};
                    var params = Object.assign(behaviour.parameters || {}, parameters);
                    var keys = Object.keys(params);
                    var headers = {};
                    var data = {};
                    var url = behaviour.path;
                    for (var key in keys) {

                        if (Array.isArray(params[keys[key]].unless) && params[keys[key]].unless.indexOf(behaviourName) > -1) continue;
                        if (Array.isArray(params[keys[key]].for) && params[keys[key]].for.indexOf(behaviourName) === -1) continue;
                        var type = params && typeof params[keys[key]] === 'object' ? params[keys[key]].type : '';
                        switch (type) {

                            case 'header':
                                headers[params[keys[key]].key] = getValueForParameter(params[keys[key]], behaviourData, keys[key], behaviourName);
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
                                if (lastPath) nestedData[lastPath] = getValueForParameter(params[keys[key]], behaviourData, keys[key], behaviourName);
                                break;
                            case 'path':
                                url.replace(':' + encodeURIComponent(params[keys[key]].key), encodeURIComponent(getValueForParameter(params[keys[key]],
                                    behaviourData, keys[key], behaviourName)));
                                break;
                            case 'query':
                                if (url.indexOf('?') === -1) {

                                    url += '?';
                                }
                                url += '&' + encodeURIComponent(params[keys[key]].key) + '=' +
                                    encodeURIComponent(getValueForParameter(params[keys[key]], behaviourData, keys[key], behaviourName));
                                break;
                        }
                    }
                    $http({
                        method: behaviour.method,
                        url: url,
                        data: data,
                        headers: headers
                    }).then(function successCallback(response) {

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
                                                setParameterToCache(param);
                                                break;
                                        }
                                    }
                                }
                                return behaviour.returns[key].type === 'header';
                            }).length > 0) {

                            callback(Object.assign(headers, Object.keys(data).length === 0 ? {

                                data: response.data
                            } : data), null);
                        } else callback(response.data, null);
                    }, function errorCallback(error) {

                        callback(null, error);
                    });
                };
            } else {

                throw new Error('This behaviour does not exist.');
            }
            return null;
        }
    };
    $http.get((typeof baseURL === 'string' && baseURL.length > 0 ? typeof baseURL.split('/')[0] === 'string' &&
        baseURL.split('/')[0].startsWith('http') ? baseURL : window.location.origin + baseURL : '') + '/behaviours').then(function(response) {

        behavioursJson = response.data;
        if (typeof behavioursJson === 'object') {

            var keys = Object.keys(behavioursJson);
            for (var i = 0; i < keys.length; i++) {

                self[keys[i]] = self.getBehaviour(keys[i]);
            }
        } else {

            throw new Error('Error in initializing Behaviours');
        }
    }, function(error) {

        throw new Error('Error in initializing Behaviours' + error.message);
    });
    return self;
}]);