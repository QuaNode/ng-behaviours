describe('Start tests on behaviour factory', function() {
	var $httpBackend;
	var Behaviours;
	beforeEach(module('behaviour'));
	beforeEach(inject(function($injector) {

		$httpBackend = $injector.get("$httpBackend");
		$httpBackend.when("GET", "/data").respond(200, {

			'login': {

				'name': 'login',
				'path': '/login',
				'method': 'POST',
				'parameters': {

					'password': {

						'key': 'user.password',
						'type': 'body'
					},
					'username': {

						'key': 'user.username',
						'type': 'body'
					}
				}
			},
			'register': {

				'name': 'register',
				'path': '/register',
				'method': 'POST',
				'parameters': {

					'password': {

						'key': 'user.password',
						'type': 'header'
					},
					'username': {

						'key': 'user.username',
						'type': 'header'
					},
					'email': {

						'key': 'user.email',
						'type': 'header'
					}
				}
			}
		});
		$httpBackend.when("POST", "/login").respond(200, {

			'status': 'success'
		});
		$httpBackend.when("POST", "/register").respond(200, {

			'status': 'success'
		});
	}));
	beforeEach(inject(function(behaviours) {

		Behaviours = behaviours;
		$httpBackend.flush();
	}));
	afterEach(function() {

		$httpBackend.verifyNoOutstandingRequest();
	});

	it('Check Behaviours existence ', function(done) {

		expect(Behaviours).toBeDefined();
		done();
	});

	it('Check getBehaviour function existence', function(done) {

		expect(Behaviours.getBehaviour('login')).toBeDefined();
		done();
	});

	it('Check if login returns http request  ', function(done) {

		Behaviours.getBehaviour('login')({
			'username': 'Mohamed',
			'password': '123456',
		}, function(res) {

			expect(res.status).toBe("success");
			done();
		});
		$httpBackend.flush();
	});

	it('Check if register returns http request  ', function(done) {

		Behaviours.getBehaviour('register')({
			'username': 'Mohamed',
			'password': '123456',
			'email': 'mohamed.feasal@gmail.com'
		}, function(res) {

			expect(res.status).toBe("success");
			done();
		});
		$httpBackend.flush();
	});
});