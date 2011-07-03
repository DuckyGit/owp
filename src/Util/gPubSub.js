define('Util/gPubSub', [ 'Util/PubSub' ], function (PubSub) {
    var secret = 'gpubsub';

    var events = new PubSub();

    window.addEventListener('message', function (event) {
        if (event.data && event.data.secret === secret) {
            events.publishSync.apply(
                events,
                [ event.data.key ].concat(event.data.args)
            );

            event.preventDefault();
            return false;
        }
    }, false);

    return {
        publish: function (key) {
            var args = Array.prototype.slice.call(arguments, 1);

            window.postMessage({ secret: secret, key: key, args: args }, '*');
        },

        subscribe: function (key, callback) {
            return events.subscribe(key, callback);
        }
    };
});
