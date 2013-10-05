'use strict';


angular.module('angularOauth.interceptors', [])
.factory('bearerTokenInterceptor', function($injector, $q) {
  console.log('init interceptor');
  /*
   * This interceptor is available for providers that use the header based
   * bearer token for authentication
   */
  return {
    'request': function(config) {
      /*
       * We need to use $injector to get access to the Token provider within
       * the body of the ctor - lest we want circular references created
       * by providers that need to use the interceptor (and also need the 
       * Token provider
       */
      console.log(config);
      var Token = $injector.get('Token');
      config.headers.get = {'Authorization': 'Bearer ' + Token.get() };
      return config || $q.when(config);
    },

    'response': function(config) {
      console.log('well shit' + config);
    }
  };
});

angular.module('angularOauth', [])
.provider('Token', function() {

  /**
   * Given an flat object, returns a query string for use in URLs.  Note
   * that for a given object, the return value may be.
   *
   * @example
   * <pre>
    // returns 'color=red&size=large'
    objectToQueryString({color: 'red', size: 'large'})
   * </pre>
   *
   * @param {Object} obj A flat object containing keys for such a string.
   * @returns {string} A string suitable as a query string.
   */
  var objectToQueryString = function(obj) {
    var str = [];
    angular.forEach(obj, function(value, key) {
      str.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
    });
    return str.join("&");
  };

  // This response_type MUST be passed to the authorization endpoint using
  // the implicit grant flow (4.2.1 of RFC 6749).
  var RESPONSE_TYPE = 'token';

  // Create a special object for config fields that are required and missing.
  // If any config items still contain it when Token is used, raise an error.
  var REQUIRED_AND_MISSING = {};

  var config = {
    clientId: REQUIRED_AND_MISSING,
    redirectUri: REQUIRED_AND_MISSING,
    authorizationEndpoint: REQUIRED_AND_MISSING,
    localStorageName: 'accessToken',
      verifyFunc: REQUIRED_AND_MISSING,
      scopes: []
    };

    this.extendConfig = function(configExtension) {
      config = angular.extend(config, configExtension);
    };

    this.$get = function($q, $http, $window, $rootScope) {
      var requiredAndMissing = [];
      angular.forEach(config, function(value, key) {
        if (value === REQUIRED_AND_MISSING) {
          requiredAndMissing.push(key);
        }
      });

      if (requiredAndMissing.length) {
        throw new Error("TokenProvider is insufficiently configured.  Please " +
          "configure the following options using " +
          "TokenProvider.extendConfig: " + requiredAndMissing.join(", "));
      }

      if (!config.clientId) {
        throw new Error("clientId needs to be configured using TokenProvider.");
      }

      var getParams = function() {
        // TODO: Facebook uses comma-delimited scopes. This is not compliant with section 3.3 but perhaps support later.

        return {
          response_type: RESPONSE_TYPE,
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          scope: config.scopes.join(" ")
        };
      };

      return {
        // TODO: get/set might want to support expiration to reauthenticate
        // TODO: check for localStorage support and otherwise perhaps use other methods of storing data (e.g. cookie)

        /**
         * Returns the stored access token.
         *
         * @returns {string} The access token.
         */
        get: function() {
          return localStorage[config.localStorageName];
        },

        /**
         * Persist the access token so that it can be retrieved later by.
         *
         * @param accessToken
         */
        set: function(accessToken) {
          localStorage[config.localStorageName] = accessToken;
        },

        /**
         * Verifies that the access token is was issued for the use of the current client.
         *
         * @param accessToken An access token received from the authorization server.
         * @returns {Promise} Promise that will be resolved when the authorization server has verified that the
         *  token is valid, and we've verified that the token is passed back has audience that matches our client
         *  ID (to prevent the Confused Deputy Problem).
         *
         *  If there's an error verifying the token, the promise is rejected with an object identifying the `name` error
         *  in the name member.  The `name` can be either:
         *
         *    - `invalid_audience`: The audience didn't match our client ID.
         *    - `error_response`: The server responded with an error, typically because the token was invalid.  In this
         *      case, the callback parameters to `error` callback on `$http` are available in the object (`data`,
         *      `status`, `headers`, `config`).
         */
        verifyAsync: function(accessToken) {
          return config.verifyFunc(config, accessToken);
        },

        /**
         * Verifies an access token asynchronously.
         *
         * @param extraParams An access token received from the authorization server.
         * @param popupOptions Settings for the display of the popup.
         * @returns {Promise} Promise that will be resolved when the authorization server has verified that the
         *  token is valid, and we've verified that the token is passed back has audience that matches our client
         *  ID (to prevent the Confused Deputy Problem).
         *
         *  If there's an error verifying the token, the promise is rejected with an object identifying the `name` error
         *  in the name member.  The `name` can be either:
         *
         *    - `invalid_audience`: The audience didn't match our client ID.
         *    - `error_response`: The server responded with an error, typically because the token was invalid.  In this
         *      case, the callback parameters to `error` callback on `$http` are available in the object (`data`,
         *      `status`, `headers`, `config`).
         */
        getTokenByPopup: function(extraParams, popupOptions) {
          popupOptions = angular.extend({
            name: 'AuthPopup',
            openParams: {
              width: 650,
              height: 300,
              resizable: true,
              scrollbars: true,
              status: true
            }
          }, popupOptions);

          var deferred = $q.defer(),
            params = angular.extend(getParams(), extraParams),
            url = config.authorizationEndpoint + '?' + objectToQueryString(params);

          var formatPopupOptions = function(options) {
            var pairs = [];
            angular.forEach(options, function(value, key) {
              if (value || value === 0) {
                value = value === true ? 'yes' : value;
                pairs.push(key + '=' + value);
              }
            });
            return pairs.join(',');
          };

          var popup = window.open(url, popupOptions.name, formatPopupOptions(popupOptions.openParams));

          // TODO: binding occurs for each reauthentication, leading to leaks for long-running apps.

          angular.element($window).bind('message', function(event) {
            if (event.source === popup && event.origin === window.location.origin) {
              $rootScope.$apply(function() {
                if (event.data.access_token) {
                  deferred.resolve(event.data);
                } else {
                  deferred.reject(event.data);
                }
              });
            }
          });

          // TODO: reject deferred if the popup was closed without a message being delivered + maybe offer a timeout

          return deferred.promise;
        }
      };
    };
  }).

  /**
   * A controller for the redirect endpoint that inspects the URL redirected to by the authorization server and sends
   * it back to other windows using.
   */
  controller('CallbackCtrl', function($scope, $location) {

    /**
     * Parses an escaped url query string into key-value pairs.
     *
     * (Copied from Angular.js in the AngularJS project.)
     *
     * @returns Object.<(string|boolean)>
     */
    function parseKeyValue(/**string*/keyValue) {
      var obj = {}, key_value, key;
      angular.forEach((keyValue || "").split('&'), function(keyValue){
        if (keyValue) {
          key_value = keyValue.split('=');
          key = decodeURIComponent(key_value[0]);
          obj[key] = angular.isDefined(key_value[1]) ? decodeURIComponent(key_value[1]) : true;
        }
      });
      return obj;
    }

    var queryString = $location.path().substring(1);  // preceding slash omitted
    var params = parseKeyValue(queryString);

    // TODO: The target origin should be set to an explicit origin.  Otherwise, a malicious site that can receive
    //       the token if it manages to change the location of the parent. (See:
    //       https://developer.mozilla.org/en/docs/DOM/window.postMessage#Security_concerns)

    window.opener.postMessage(params, "*");
    window.close();
  });
'use strict';

/**
 * A module to include instead of `angularOauth` for a service preconfigured
 * for Google OAuth authentication.
 *
 * Guide: https://developers.google.com/accounts/docs/OAuth2UserAgent
 */
angular.module('googleOauth', ['angularOauth']).

  constant('GoogleTokenVerifier', function(config, accessToken) {
    var $injector = angular.injector(['ng']);
    return $injector.invoke(['$http', '$rootScope', '$q', function($http, $rootScope, $q) {
      var deferred = $q.defer();
      var verificationEndpoint = 'https://www.googleapis.com/oauth2/v1/tokeninfo';

      $rootScope.$apply(function() {
        $http({method: 'GET', url: verificationEndpoint, params: {access_token: accessToken}}).
          success(function(data) {
            if (data.audience === config.clientId) {
              deferred.resolve(data);
            } else {
              deferred.reject({name: 'invalid_audience'});
            }
          }).
          error(function(data, status, headers, config) {
            deferred.reject({
              name: 'error_response',
              data: data,
              status: status,
              headers: headers,
              config: config
            });
          });
      });

      return deferred.promise;
    }]);
  }).

  config(function(TokenProvider, GoogleTokenVerifier) {
    TokenProvider.extendConfig({
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/auth',
      scopes: ["https://www.googleapis.com/auth/userinfo.email"],
      verifyFunc: GoogleTokenVerifier
    });
  });

'use strict';

/*
 * https://www.yammer.com/dialog/oauth?client_id=[:client_id]&redirect_uri=[:redirect_uri]&response_type=token
 * https://www.yammer.com/oauth2/access_token.json?client_id=[:client_id]&client_secret=[:client_secret]&code=[:code]
 */
angular.module('yammerOauth', ['angularOauth', 'angularOauth.interceptors'])
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
      $http({ method: 'GET', url: 'https://www.yammer.com/api/v1/users/current.json' })
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
})
.config(function(TokenProvider, YammerTokenVerifier) {
  TokenProvider.extendConfig({
    authorizationEndpoint: 'https://www.yammer.com/dialog/oauth',
    verifyFunc: YammerTokenVerifier
  });
})
.config(function($httpProvider) {
  /*
   * Yammer uses a bearer token - in comes the BearerTokenInterceptor!
   */
  $httpProvider.interceptors.push('bearerTokenInterceptor');
  console.log('adding interceptors');
});

