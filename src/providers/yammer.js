'use strict';

/*
 * https://www.yammer.com/dialog/oauth?client_id=[:client_id]&redirect_uri=[:redirect_uri]&response_type=token
 * https://www.yammer.com/oauth2/access_token.json?client_id=[:client_id]&client_secret=[:client_secret]&code=[:code]
 */
var app = angular.module('yammerOauth', ['angularOauth'])
.constant('YammerTokenVerifier', function() {

  /*
   * Token verification is actually not as common as it should be, 
   * services like Yammer are more than happy to just give you a token.
   * This is probably a pattern problem in angular-oauth.  Oh well.
   */

  var $injector = angular.injector(['ng']);

  return $injector.invoke(['$http', '$rootScope', '$q', function($http, $rootScope, $q) {
    var deferred = $q.defer();

    $rootScope.$apply(function() {
      $http.get('https://www.yammer.com/api/v1/users/current.json')
      .success(function(data) {
        deferred.resolve(data);
      })
      .error(function(data, status, headers, config) {
        console.log(data);
        console.log(status);
        console.log(headers);
        console.log(config);
        deferred.reject(data);
      });
    });

    return deferred.promise;
  }]);
});

app.factory('SomeInterceptor', function($window) {
  return {
    request: function(config) {
      $window.alert('intercepted!');
      config = config;
    }
  };
});

app.config(function(TokenProvider, YammerTokenVerifier, $httpProvider) {
  TokenProvider.extendConfig({
    authorizationEndpoint: 'https://www.yammer.com/dialog/oauth',
    verifyFunc: YammerTokenVerifier
  });

  /*
   * Yammer uses a bearer token - in comes the BearerTokenInterceptor!
   */
  $httpProvider.interceptors.push(BearerTokenInterceptor);
  $httpProvider.interceptors.push(SomeInterceptor);
});

