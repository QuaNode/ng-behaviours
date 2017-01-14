var app = angular.module("behaviour", []);
var behaviour = app.factory('behaviours', ['$http', function($http) {


	var behavioursJson = null;
	$http.get('/data').then(function(response) {

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
	return {

		getBehaviour: function(behaviourName) {

			while (!behavioursJson);
			if (behavioursJson[behaviourName]) {

				var behaviour = behavioursJson[behaviourName];
				return function(behaviourData, callback) {

					var keys = Object.keys(behaviourData);
					var headers = {};
					var data = {};
					var url = behaviour.path;
					var type = null;
					for (var key in keys) {
						type = behaviour.parameters[keys[key]].type;
						switch (type) {

							case 'header':
								headers[behaviour.parameters[keys[key]].key] = behaviourData[keys[key]];
								break;
							case 'body':
								var paths = behaviour.parameters[keys[key]].key.split('.');
								var nestedData = data;
								var lastPath = null;
								for (var path in paths) {

									if (lastPath) nestedData = nestedData[lastPath];
									if (!nestedData[paths[path]]) nestedData[paths[path]] = {};
									lastPath = paths[path];
								}
								if (lastPath) nestedData[lastPath] = behaviourData[keys[key]];
								break;
							case 'path':
								url.replace(':' + encodeURIComponent(behaviour.parameters[keys[key]].key), encodeURIComponent(behaviourData[keys[key]].key));
								break;
							case 'query':
								if (url.indexOf('?') === -1) {
									url += '?';
								}
								url += '&' + encodeURIComponent(behaviour.parameters[keys[key]].key) + '=' +
									encodeURIComponent(behaviourData[keys[key]].key);
								break;
						}
					};
					$http({
						method: behaviour.method,
						url: url,
						data: data,
						headers: headers
					}).then(function successCallback(response) {

						callback(response.data, null);
					}, function errorCallback(error) {

						callback(null, error);
					});
				}
			} else {

				throw new Error('This behaviour does not exist.');
			}
			return null;
		}
	}
}]);
