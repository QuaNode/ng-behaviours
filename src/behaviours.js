var app = angular.module("behaviour", []);
var behaviour = app.factory('behaviours', ['$http', function($http, baseURL, defaults) {

	var behavioursJson = null;
	var parameters = Object.assign(JSON.parse(window[parameter.source].getItem('Behaviours') || '{}'), defaults || {});
	var getValueForParameter = function(parameter, data, key, name) {

		return data[key] || (function() {

			if (parameter.value) return typeof parameter.value === 'function' ? parameter.value(name, data) : parameter.value;
			else if (parameter.source && window[parameter.source])
				return JSON.parse(window[parameter.source].getItem('Behaviours') || '{"' + key + '":null}')[key].value ||
					window[parameter.source].getItem(key);
		}());
	};
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

					if (typeof behaviourData !== 'object') {

						throw new Error(behaviourName + ' behaviour parameters should be an object');
					}
					var keys = Object.keys(behaviourData);
					var headers = {};
					var data = {};
					var url = behaviour.path;
					var params = Object.assign(parameters, behaviour.parameters || {});
					for (var key in keys) {

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

								var value;
								if (behaviour.returns[key].type === 'header')
									headers[behaviour.returns[key].key || key] = value = response.headers(key);
								if (behaviour.returns[key].type === 'body' && typeof response.data === 'object' && !data[key])
									data[key] = value = Array.isArray(response.data) ? response.data : response.data[key];
								if (behaviour.returns[key].default && value) {

									var param = {};
									param[behaviour.returns[key].key || key] = parameters[behaviour.returns[key].key || key] = {

										key: key,
										type: behaviour.returns[key].type,
										source: 'localStorage'
									};
									window.localStorage.setItem('Behaviours', JSON.stringify(param));
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
