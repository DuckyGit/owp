require([ 'jQuery', 'WebGLRenderer', 'CanvasRenderer', 'AssetManager', 'q', 'Game', 'Util/FramerateCounter', 'Util/gPubSub' ], function ($, WebGLRenderer, CanvasRenderer, AssetManager, Q, Game, FramerateCounter, gPubSub) {
    var mapAssetManager = new AssetManager('assets');
    var skinAssetManager = new AssetManager('.');

    var init = function () {
        var renderers = [ ];
        var playAreas = [ ];

        function makeCanvas(contextName, RendererClass, attributes) {
            var canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            canvas.style.cursor = 'none';

            var context;

            try {
                context = canvas.getContext(contextName, attributes);
            } catch (e) {
                // Could not get context; ignore
                return true;
            }

            if (!context) {
                return false;
            }

            var renderer = new RendererClass(context);

            renderers.push(renderer);
            playAreas.push(canvas);

            $(document.body)
                .append('<h3>' + contextName + '</h3>')
                .append(canvas);
        }

        makeCanvas('2d', CanvasRenderer);

        if (!makeCanvas('webgl', WebGLRenderer, { antialias: true })) {
            makeCanvas('experimental-webgl', WebGLRenderer, { antialias: true });
        }

        return {
            renderers: renderers,
            playAreas: playAreas
        };
    };

    var loop = function (callback, interval) {
        var innerLoop = function () {
            Q.when(callback(), function () {
                setTimeout(innerLoop, interval);
            });
        };

        innerLoop();
    };

    var hardLoop = function (callback, interval) {
        var timer = setInterval(function () {
            if (callback() === false) {
                clearInterval(timer);
            }
        }, interval);
    };

    var renderLoop = function (callback) {
        window.requestAnimFrame(function () {
            callback();
            renderLoop(callback);
        }, document.body); // should prolly use the canvas here...
    };

    var infLoop = function (callback) {
        hardLoop(function () {
            var i;

            for (i = 0; i < 10; ++i) {
                callback();
            }
        }, 0);
    };

    var renderFps = new FramerateCounter();
    var gameUpdateFps = new FramerateCounter();

    var game;

    var go = function (io) {
        game = new Game();
        game.setSkin(skinAssetManager);
        game.startMap(mapAssetManager, 'map');

        renderLoop(function () {
            io.renderers.forEach(function (renderer) {
                game.render(renderer);
            });

            renderFps.addTick();
        });

        infLoop(function () {
            gPubSub.publish('tick');

            gameUpdateFps.addTick();
        });

        var mouseX, mouseY;
        var isLeftDown = false;
        var isRightDown = false;

        function mouseStateChanged() {
            game.mouse({
                x: mouseX,
                y: mouseY,
                left: isLeftDown,
                right: isRightDown
            });
        }

        $(io.playAreas).mousedown(function (e) {
            mouseX = e.pageX - this.offsetLeft;
            mouseY = e.pageY - this.offsetTop;
            isLeftDown = true;
            mouseStateChanged();
        });

        $(io.playAreas).mouseup(function (e) {
            mouseX = e.pageX - this.offsetLeft;
            mouseY = e.pageY - this.offsetTop;
            isLeftDown = false;
            mouseStateChanged();
        });

        $(io.playAreas).mousemove(function (e) {
            mouseX = e.pageX - this.offsetLeft;
            mouseY = e.pageY - this.offsetTop;
            mouseStateChanged();
        });

        $('body').keydown(function (e) {
            isLeftDown = true;
            mouseStateChanged();
        });

        $('body').keyup(function (e) {
            isLeftDown = false;
            mouseStateChanged();
        });
    };

    var getPaintCount = function () {
        return window.mozPaintCount || 0;
    };

    var lastPaintCount = 0;
    var paintFps = new FramerateCounter();

    var debugInfo = function () {
        var currentPaintCount = getPaintCount();
        paintFps.addTicks(currentPaintCount - lastPaintCount);
        lastPaintCount = currentPaintCount;

        var debug = {
            'paint fps': paintFps.framerate,
            'game update fps': gameUpdateFps.framerate,
            'render fps': renderFps.framerate
        };

        return $.extend({ }, debug, game.debugInfo());
    };

    var updateDebugInfo = function () {
        if (!game) {
            return;
        }

        var $debug = $('#debug');

        if (!$debug.length) {
            return;
        }

        var debug = debugInfo();

        var text = Object.keys(debug).map(function (key) {
            var value = debug[key];

            if (typeof value === 'number') {
                value = value.toFixed(2);
            }

            return key + ': ' + value;
        }).join('\n');

        $debug.text(text);
    };

    var getMissingFeatures = function () {
        var features = [ ];

        if (!window.Audio) {
            features.push('HTML5 <audio> element');
        }

        return features;
    };

    var missingFeatures = getMissingFeatures();

    if (missingFeatures.length > 0) {
        var text = 'Your browser is not supported; it is missing the following features:';
        text = [ text ].concat(missingFeatures).join('\n* ');

        $('<pre/>').text(text).appendTo('body');

        return;
    }

    loop(updateDebugInfo, 100);

    Q.when(init()).then(go);
});
