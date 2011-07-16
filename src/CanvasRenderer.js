define('CanvasRenderer', [ 'mapObject', 'Util/Cache', 'canvasShaders', 'MapState', 'Util/gPubSub', 'Util/util' ], function (mapObject, Cache, shaders, MapState, gPubSub, util) {
    function getColorStyle(color) {
        function c(x) {
            var s = x.toString(16);
            return s.length === 1 ? '0' + s : s;
        }

        return '#' + color.map(c).join('');
    }

    function renderMap(vars) {
        var mapState = vars.mapState;
        var ruleSet = mapState.ruleSet;
        var skin = vars.skin;
        var time = vars.time;
        var c = vars.context;
        var caches = vars.caches;
        var mouseHistory = vars.mouseHistory;

        function getShadedGraphic(skin, graphicName, shader, shaderData) {
            var key = [ graphicName, skin, shader, shaderData ];

            return caches.graphics.get(key, function () {
                var images = skin.assetManager.get(graphicName, 'image-set');
                var shadedImages = [ ], i;

                images.forEach(function (image) {
                    shadedImages.push(
                        shaders.applyShaderToImage(shader, shaderData, image)
                    );
                });

                return shadedImages;
            });
        }

        function getCoord(x) {
            return Math.floor(x);
        }

        function drawImage(image, scale, x, y, cache) {
            var key = [ image, scale ];

            var scaledWidth = Math.ceil(image.width * scale);
            var scaledHeight = Math.ceil(image.height * scale);

            if (!cache) {
                c.drawImage(
                    image,
                    getCoord(x - scaledWidth / 2),
                    getCoord(y - scaledHeight / 2),
                    scaledWidth,
                    scaledHeight
                );

                return;
            }

            var scaledImage = caches.scaledImages.get(key, function () {
                // Cache scaled image
                var newCanvas = document.createElement('canvas');
                newCanvas.width = scaledWidth;
                newCanvas.height = scaledHeight;

                var newContext = newCanvas.getContext('2d');
                newContext.globalCompositeOperation = 'copy';
                newContext.drawImage(image, 0, 0, scaledWidth, scaledHeight);

                return newCanvas;
            });

            c.drawImage(
                scaledImage,
                getCoord(x - scaledImage.width / 2),
                getCoord(y - scaledImage.height / 2)
            );
        }

        function getNumberImages(number) {
            var digits = '' + number;

            var images = [ ];

            var i, digit, graphic;
            var frame = 0;

            digits.split('').forEach(function (digit) {
                graphic = skin.assetManager.get('default-' + digit, 'image-set');

                images.push(graphic[frame]);
            });

            return images;
        }

        function renderComboNumber(number, x, y) {
            var images = getNumberImages(number);
            var spacing = skin.hitCircleFontSpacing;

            if (images.length === 0) {
                // No images?  Don't render anything.
                return;
            }

            var totalWidth = images.reduce(function (acc, image) {
                return acc + image.width;
            }, 0);

            totalWidth += spacing * (images.length - 1);

            var scale = Math.pow(images.length, -1 / 4) * 0.9;
            scale *= ruleSet.getCircleSize() / 128;
            var offset = -totalWidth / 2;

            images.forEach(function (image) {
                drawImage(
                    image,
                    scale,
                    x + (offset + image.width / 2) * scale,
                    y,
                    true
                );

                offset += image.width + spacing;
            });
        }

        function renderHitCircle(hitCircle, progress) {
            var scale = ruleSet.getCircleSize() / 128;

            // Hit circle base
            var hitCircleGraphic = getShadedGraphic(
                skin, 'hitcircle',
                shaders.multiplyByColor, hitCircle.combo.color
            );

            var hitCircleFrame = 0;

            drawImage(
                hitCircleGraphic[hitCircleFrame],
                scale,
                hitCircle.x,
                hitCircle.y,
                true
            );

            // Combo numbering
            renderComboNumber(hitCircle.comboIndex + 1, hitCircle.x, hitCircle.y);

            // Hit circle overlay
            var hitCircleOverlayGraphic = skin.assetManager.get('hitcircleoverlay', 'image-set');
            var hitCircleOverlayFrame = 0;

            drawImage(
                hitCircleOverlayGraphic[hitCircleOverlayFrame],
                scale,
                hitCircle.x,
                hitCircle.y,
                true
            );
        }

        function renderApproachCircle(hitObject, progress) {
            var radius = 1;

            if (progress > 0) {
                radius += (1 - progress);
            } else {
                radius += (1 - (-progress)) / 4;
            }

            radius *= ruleSet.getCircleSize() / 128;

            var approachCircleGraphic = getShadedGraphic(
                skin, 'approachcircle',
                shaders.multiplyByColor, hitObject.combo.color
            );

            var approachCircleFrame = 0;

            drawImage(
                approachCircleGraphic[approachCircleFrame],
                radius,
                hitObject.x, hitObject.y,
                false
            );
        }

        function renderHitMarker(hitMarker) {
            var graphicName = ruleSet.getHitMarkerImageName(hitMarker);
            if (!graphicName) {
                return;
            }

            var scale = ruleSet.getHitMarkerScale(hitMarker, time);

            var hitMarkerGraphic = skin.assetManager.get(graphicName, 'image-set');
            var hitMarkerFrame = 0;

            drawImage(
                hitMarkerGraphic[hitMarkerFrame],
                scale,
                hitMarker.hitObject.x,
                hitMarker.hitObject.y,
                true
            );
        }

        function renderHitCircleObject(object) {
            var approachProgress = ruleSet.getObjectApproachProgress(object, time);

            c.globalAlpha = ruleSet.getObjectOpacity(object, time);

            renderHitCircle(object);
            renderApproachCircle(object, approachProgress);
        }

        function renderHitMarkerObject(object) {
            renderHitMarker(object);
        }

        function renderSliderTrack(points, object) {
            function draw() {
                c.beginPath();

                c.moveTo(points[0][0], points[0][1]);
                points.slice(1).forEach(function (point) {
                    c.lineTo(point[0], point[1]);
                });

                c.stroke();
                c.closePath();
            }

            c.lineCap = 'round';
            c.lineJoin = 'round';
            c.lineWidth = ruleSet.getCircleSize();
            c.strokeStyle = '#FFFFFF';

            draw();

            c.lineWidth = ruleSet.getCircleSize() * .9;
            c.strokeStyle = getColorStyle(object.combo.color);

            draw();

            var hitCircleGraphic = getShadedGraphic(
                skin, 'hitcircle',
                shaders.multiplyByColor, object.combo.color
            );

            var hitCircleFrame = 0;

            drawImage(
                hitCircleGraphic[hitCircleFrame],
                ruleSet.getCircleSize() / 128,
                points[points.length - 1][0],
                points[points.length - 1][1],
                true
            );
        }

        function renderSliderBall(object) {
            var sliderBallPosition = object.curve.getSliderBallPosition(object, time, ruleSet);

            if (sliderBallPosition) {
                var scale = ruleSet.getCircleSize() / 128;

                var sliderBallGraphic = skin.assetManager.get('sliderb0', 'image-set');
                var sliderBallFrame = 0;

                drawImage(
                    sliderBallGraphic[sliderBallFrame],
                    scale,
                    sliderBallPosition[0],
                    sliderBallPosition[1],
                    true
                );
            }
        }

        function renderSliderObject(object) {
            var growPercentage = ruleSet.getSliderGrowPercentage(object, time);
            var points = object.curve.render(growPercentage);

            if (!points.length) {
                return;
            }

            c.save();

            var scale = ruleSet.getCircleSize() / 128;
            var opacity = ruleSet.getObjectOpacity(object, time);

            c.globalAlpha = opacity;
            renderSliderTrack(points, object);

            renderHitCircle(object);

            var visibility = ruleSet.getObjectVisibilityAtTime(object, time);

            if (visibility === 'during') {
                renderSliderBall(object);
            }

            var approachProgress = ruleSet.getObjectApproachProgress(object, time);
            renderApproachCircle(object, approachProgress);

            c.restore();
        }

        function renderSliderTickObject(object) {
            var sliderTickGraphic = skin.assetManager.get('sliderscorepoint', 'image-set');
            var sliderTickGraphicFrame = 0;

            var scale = ruleSet.getCircleSize() / 128;

            drawImage(
                sliderTickGraphic[sliderTickGraphicFrame],
                scale,
                object.x,
                object.y,
                true
            );
        }

        function renderObject(object) {
            mapObject.match(object, {
                HitCircle:  renderHitCircleObject,
                HitMarker:  renderHitMarkerObject,
                Slider:     renderSliderObject,
                SliderTick: renderSliderTickObject,
                _: function () {
                    throw new TypeError('Unknown object type');
                }
            });
        }

        function renderCursor(state) {
            if (!state) {
                return;
            }

            var cursorGraphic = skin.assetManager.get('cursor', 'image-set');
            var cursorFrame = 0;

            drawImage(cursorGraphic[cursorFrame], 1, state.x, state.y, false);
        }

        function renderCursorTrail(state, alpha) {
            if (!state) {
                return;
            }

            var cursorTrailGraphic = skin.assetManager.get('cursortrail', 'image-set');
            var cursorTrailFrame = 0;

            c.globalAlpha = alpha;

            drawImage(cursorTrailGraphic[cursorTrailFrame], 1, state.x, state.y, false);
        }

        function getObjectsToRender() {
            // Visible objects
            var objects = mapState.getVisibleObjects(time);

            // Hit markers
            objects = objects.concat(
                mapState.timeline.getAllInTimeRange(time - 2000, time, MapState.HIT_MARKER_CREATION)
            );

            return ruleSet.getObjectsByZ(objects);
        }

        getObjectsToRender().forEach(function (object) {
            renderObject(object);

            gPubSub.publish('tick');
        });

        var i;

        for (i = 0; i < 5; ++i) {
            renderCursorTrail(mouseHistory.getDataAtTime(time - (6 - i) * 30), i / 5);
        }

        renderCursor(mouseHistory.getDataAtTime(time));
    }

    function CanvasRenderer(context) {
        // TODO Double-buffering

        var canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.width = 640;
        canvas.height = 480;

        var context;

        try {
            context = canvas.getContext('2d');

            if (!context) {
                throw new Error();
            }
        } catch (e) {
            throw new Error('2D canvas not supported');
        }

        var c = context;

        var container = document.createElement('div');
        container.style.display = 'block';
        container.style.position = 'relative';
        container.appendChild(canvas);

        var caches = {
            // [ 'graphic-name', skin, shader, shaderData ] => graphic
            graphics: new Cache(),

            // [ graphic, canvasWidth, canvasHeight ] => graphic
            background: new Cache(),

            // [ sliderObject, mapState, skin ] => { image, pointCount }
            sliderTrack: new Cache(),

            // [ graphic, scale ] => graphic
            scaledImages: new Cache()
        };

        function renderBackground(graphic) {
            var key = [ graphic, canvas.width, canvas.height ];

            var backgroundGraphic = caches.background.get(key, function () {
                // TODO Split?

                var canvasAR = canvas.width / canvas.height;
                var imageAR = graphic.width / graphic.height;
                var scale;

                if (imageAR > canvasAR) {
                    // Image is wider
                    scale = c.canvas.width / graphic.width;
                } else {
                    // Image is taller
                    scale = c.canvas.height / graphic.height;
                }

                var backgroundCanvas = document.createElement('canvas');
                backgroundCanvas.width = canvas.width;
                backgroundCanvas.height = canvas.height;

                var bc = backgroundCanvas.getContext('2d');

                bc.globalCompositeOperation = 'copy';
                bc.translate(
                    (backgroundCanvas.width - graphic.width * scale) / 2,
                    (backgroundCanvas.height - graphic.height * scale) / 2
                );
                bc.scale(scale, scale);
                bc.drawImage(graphic, 0, 0);

                return backgroundCanvas;
            });

            c.drawImage(backgroundGraphic, 0, 0);
        }

        var viewport = { };

        function resize(width, height) {
            container.style.width = width + 'px';
            container.style.height = height + 'px';

            var rect = util.fitRectangle(width, height, 640, 480);

            viewport = {
                x: Math.max(0, rect.x),
                y: Math.max(0, rect.y),
                width: Math.min(width, rect.width),
                height: Math.min(height, rect.height)
            };

            canvas.style.left = viewport.x + 'px';
            canvas.style.right = viewport.y + 'px';
            canvas.style.width = viewport.width + 'px';
            canvas.style.height = viewport.height + 'px';
        }

        resize(640, 480);

        return {
            element: container,

            resize: resize,

            mouseToGame: function (x, y) {
                return {
                    x: (x - viewport.x) / viewport.width * 640,
                    y: (y - viewport.y) / viewport.height * 480
                };
            },

            beginRender: function () {
                c.save();

                c.clearRect(0, 0, 640, 480);
            },

            endRender: function () {
                c.restore();
            },

            renderMap: function (state, time) {
                renderMap({
                    mapState: state.mapState,
                    skin: state.skin,
                    mouseHistory: state.mouseHistory,
                    time: time,
                    context: c,
                    caches: caches
                });
            },

            renderStoryboard: function (storyboard, assetManager, time) {
                // Background
                var background = storyboard.getBackground(time);
                var backgroundGraphic;

                if (background) {
                    backgroundGraphic = assetManager.get(background.fileName, 'image');

                    renderBackground(backgroundGraphic);
                }

                // TODO Real storyboard stuff
            }
        };
    }

    return CanvasRenderer;
});
