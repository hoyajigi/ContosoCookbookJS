// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232509
(function () {
    "use strict";

    var BLOCK_SIZE = 8;
    var FILENAME = "Bitmap.dat";
    var _saveButton;
    var _filename;
    var _mainCanvas, _mainContext;
    var _hiddenCanvas, _hiddenContext;
    var _bitmap = null;
    var _dx = 0;
    var _dy = 0;
    var _scale = 1;
    var _gesture = new MSGesture();

    var _annotating = false;
    var _redEyeButton;
    var _annotateButton;
    var _points = {};

    var app = WinJS.Application;
    var activation = Windows.ApplicationModel.Activation;
    var imaging = Windows.Graphics.Imaging;
    var pickers = Windows.Storage.Pickers;
    var streams = Windows.Storage.Streams;
    var popups = Windows.UI.Popups;

    WinJS.strictProcessing();

    app.onactivated = function (args) {
        // Create a secondary canvas and a rendering context to go with it
        _hiddenCanvas = document.createElement("canvas");
        _hiddenContext = _hiddenCanvas.getContext("2d");

        // Get a reference to the main canvas and a rendering context
        _mainCanvas = document.getElementById("photo");
        _mainContext = _mainCanvas.getContext("2d");

        document.querySelector("#openButton").addEventListener("click", onOpenButtonClicked);
        _saveButton = document.querySelector("#saveButton");
        _saveButton.addEventListener("click", onSaveButtonClicked);
        _saveButton.setAttribute("disabled", "");

        _redEyeButton = document.querySelector("#redEyeButton");
        _redEyeButton.addEventListener("click", onRedEyeButtonClicked);
        _redEyeButton.setAttribute("disabled", "");
        _annotateButton = document.querySelector("#annotateButton");
        _annotateButton.addEventListener("click", onAnnotateButtonClicked);

        // Register for DataRequested events to enable sharing
        var dataTransferManager = Windows.ApplicationModel.DataTransfer.DataTransferManager.getForCurrentView();
        dataTransferManager.addEventListener("datarequested", onDataRequested);

        // Register for Suspending events to enable PLM
        Windows.UI.WebUI.WebUIApplication.addEventListener("suspending", onSuspending);

        if (args.detail.previousExecutionState === Windows.ApplicationModel.Activation.ApplicationExecutionState.terminated) {
            // Restore application state followingh suspension and termination
            var data = Windows.Storage.ApplicationData.current.localSettings.values;

            var width = data["Width"];
            var height = data["Height"];

            if (width !== undefined && height !== undefined) {
                _hiddenCanvas.width = width;
                _hiddenCanvas.height = height;

                var ratio = height / width;
                _mainCanvas.width = Math.min(600, width);
                _mainCanvas.height = _mainCanvas.width * ratio;

                restoreBitmapAsync(width, height).then(function () {
                    _dx = data["TranslateX"];
                    _dy = data["TranslateY"];
                    _scale = data["Scale"];
                    _mainCanvas.style.msTransform = "scale(" + _scale + ") translate(" + _dx + "px," + _dy + "px)";
                    _filename = data["FileName"];
                    document.querySelector("#message").style.display = "none";
                    if (data["Save"] !== "")
                        _saveButton.removeAttribute("disabled");
                });
            }
        }

        args.setPromise(WinJS.UI.processAll());

        // Register handlers for MSPointerDown events for gesture support
        document.querySelector("#message").addEventListener("MSPointerDown", onAssignPointer);
        document.querySelector("#main").addEventListener("MSPointerDown", onAssignPointer);
        _mainCanvas.addEventListener("MSPointerDown", onAssignPointer);

        // Register handlers for MSGesture events for gesture recognition
        document.querySelector("#message").addEventListener("MSGestureTap", onOpeningMessageTapped);
        _mainCanvas.addEventListener("MSGestureTap", onImageTapped);
        _mainCanvas.addEventListener("MSGestureChange", onGestureChange);
        document.querySelector("#main").addEventListener("MSGestureDoubleTap", onDoubleTap);
        document.addEventListener("mousewheel", onMouseWheelChanged);

        // Register handlers for pointer events
        _mainCanvas.addEventListener("MSPointerDown", onPointerDown);
        _mainCanvas.addEventListener("MSPointerMove", onPointerMove);
        _mainCanvas.addEventListener("MSPointerUp", onPointerUp);
        _mainCanvas.addEventListener("MSPointerOut", onPointerOut);
    };

    app.oncheckpoint = function (args) {
        // TODO: This application is about to be suspended. Save any state
        // that needs to persist across suspensions here. You might use the
        // WinJS.Application.sessionState object, which is automatically
        // saved and restored across suspension. If you need to complete an
        // asynchronous operation before your application is suspended, call
        // args.setPromise().
    };

    app.start();

    function onSuspending(e) {
        var folder = Windows.Storage.ApplicationData.current.localFolder;
        var data = Windows.Storage.ApplicationData.current.localSettings.values;

        if (_bitmap !== null) {
            // If an image has been loaded, persist it
            data["Width"] = _bitmap.width;
            data["Height"] = _bitmap.height;
            data["TranslateX"] = _dx;
            data["TranslateY"] = _dy;
            data["Scale"] = _scale;
            data["FileName"] = _filename;
            data["Save"] = _saveButton.getAttribute("disabled");

            // Request a deferral
            var deferral = e.suspendingOperation.getDeferral();

            // Create a data file and wrap a DataWriter around it
            folder.createFileAsync(FILENAME, Windows.Storage.CreationCollisionOption.replaceExisting).then(function (file) {
                file.openAsync(Windows.Storage.FileAccessMode.readWrite).then(function (stream) {
                    var output = stream.getOutputStreamAt(0);
                    var writer = new streams.DataWriter(output);

                    // Write the pixels to the file with the DataWriter
                    writer.writeBytes(_bitmap.data);
                    writer.storeAsync().then(function () {
                        output.flushAsync().then(function () {
                            writer.close();
                            stream.close();
                            deferral.complete();
                        });
                    });
                });
            });
        }
        else {
            // If an image hasn't been loaded but LocalSettings and LocalFolder
            // contain PLM data, remove it so the app will come back up in the
            // default state if it is reactivated
            var width = data["Width"];
            var height = data["Height"];

            if (width !== undefined && height !== undefined) {
                data.remove("Width");
                data.remove("Height");
                data.remove("TranslateX");
                data.remove("TranslateY");
                data.remove("Scale");
                data.remove("FileName");
                data.remove("Save");

                var deferral = e.suspendingOperation.getDeferral();

                folder.getFileAsync(FILENAME).then(function (file) {
                    if (file !== undefined && file !== null) {
                        file.deleteAsync().then(function () {
                            deferral.complete();
                        });
                    }
                });
            }
        }
    }

    function onOpenButtonClicked(e) {
        var picker = new pickers.FileOpenPicker();
        picker.fileTypeFilter.replaceAll([".jpg", ".png", ".bmp"]);
        picker.commitButtonText = "Open";
        picker.suggestedStartLocation = pickers.PickerLocationId.picturesLibrary;

        picker.pickSingleFileAsync().then(function (file) {
            if (file != null) {
                _filename = file.name;

                // Hide the opening message
                document.querySelector("#message").style.display = "none";

                // Create a FileReader object and read the file's contents
                var reader = new FileReader();

                reader.onload = function (e) {
                    var image = new Image();

                    image.onload = function () {
                        // Set the width and height of the canvas based on the image size
                        var width = image.width;
                        var height = image.height;
                        var ratio = height / width;

                        _mainCanvas.width = Math.min(600, width);
                        _mainCanvas.height = _mainCanvas.width * ratio;

                        // Reset the transform and related variables
                        _dx = 0;
                        _dy = 0;
                        _scale = 1;
                        _mainCanvas.style.msTransform = "scale(1) translate(0px,0px)";

                        // Convert the image into an ImageData object by drawing it to
                        // the hidden canvas and calling getImageData on that canvas
                        _hiddenCanvas.width = image.width;
                        _hiddenCanvas.height = image.height;
                        _hiddenContext.drawImage(image, 0, 0, _hiddenCanvas.width, _hiddenCanvas.height);
                        _bitmap = _hiddenContext.getImageData(0, 0, _hiddenCanvas.width, _hiddenCanvas.height);

                        // Transfer (and scale) the image from the hidden canvas to the main canvas
                        _mainContext.drawImage(_hiddenCanvas, 0, 0, _mainCanvas.width, _mainCanvas.height);

                        // Disable the Save button
                        _saveButton.setAttribute("disabled", "");
                    }

                    // Point the image to the file that the user selected
                    image.src = e.target.result;
                }

                // Read the contents of the image file as a data URL
                reader.readAsDataURL(file);
            }
        });
    }

    function onSaveButtonClicked(e) {
        var picker = new pickers.FileSavePicker();
        picker.fileTypeChoices.insert("PNG Image", [".png"]);
        picker.fileTypeChoices.insert("BMP Image", [".bmp"]);
        picker.fileTypeChoices.insert("JPEG Image", [".jpg"]);
        picker.suggestedStartLocation = pickers.PickerLocationId.picturesLibrary;
        picker.suggestedFileName = _filename;

        picker.pickSaveFileAsync().then(function (file) {
            if (file !== null) {
                var encoderId;

                switch (file.fileType) {
                    case ".jpg":
                        encoderId = imaging.BitmapEncoder.jpegEncoderId;
                        break;
                    case ".bmp":
                        encoderId = imaging.BitmapEncoder.bmpEncoderId;
                        break;
                    case ".png":
                    default:
                        encoderId = imaging.BitmapEncoder.pngEncoderId;
                        break;
                }

                file.openAsync(Windows.Storage.FileAccessMode.readWrite).then(function (stream) {
                    encodeBitmapToStreamAsync(_bitmap, stream, encoderId).then(function () {
                        _saveButton.setAttribute("disabled", "");
                    });
                });
            }
        });
    }

    function onDataRequested(e) {
        if (_bitmap != null) {
            var deferral = e.request.getDeferral();
            var imageStream = new streams.InMemoryRandomAccessStream();
            var streamReference = streams.RandomAccessStreamReference.createFromStream(imageStream);

            encodeBitmapToStreamAsync(_bitmap, imageStream, imaging.BitmapEncoder.jpegEncoderId).then(function () {
                e.request.data.properties.title = _filename;
                e.request.data.properties.description = "Image shared from Contoso Photo";
                e.request.data.setBitmap(streamReference);
                deferral.complete();
            });
        }
    }

    function encodeBitmapToStreamAsync(bitmap, stream, encoderId) {
        return new WinJS.Promise(function (complete, error, progress) {
            imaging.BitmapEncoder.createAsync(encoderId, stream).then(function (encoder) {
                var width = bitmap.width;
                var height = bitmap.height;

                // Encode the image and write it to the stream
                encoder.setPixelData(imaging.BitmapPixelFormat.rgba8, imaging.BitmapAlphaMode.straight, width, height, 96, 96, bitmap.data);
                encoder.flushAsync().then(function () {
                    complete();
                });
            });
        });
    }

    function restoreBitmapAsync(width, height) {
        return new WinJS.Promise(function (complete, error, progress) {
            var bitmap = _hiddenContext.createImageData(width, height);
            var folder = Windows.Storage.ApplicationData.current.localFolder;

            folder.getFileAsync(FILENAME).then(function (file) {
                file.openAsync(Windows.Storage.FileAccessMode.read).then(function (stream) {
                    var input = stream.getInputStreamAt(0);
                    var reader = new Windows.Storage.Streams.DataReader(input);

                    reader.loadAsync(stream.size).then(function (size) {
                        reader.readBytes(bitmap.data);
                        _hiddenContext.putImageData(bitmap, 0, 0);
                        _mainContext.drawImage(_hiddenCanvas, 0, 0, _mainCanvas.width, _mainCanvas.height); _bitmap = bitmap;
                        _bitmap = bitmap;

                        reader.close();
                        input.close();
                        stream.close();
                        complete();
                    });
                });
            });
        });
    }

    function removeRedEye(x, y) {
        // Compute bounds of the region to examine
        var d = Math.round(BLOCK_SIZE * (_hiddenCanvas.width / _mainCanvas.width));
        var x1 = Math.max(0, x - d);
        var x2 = Math.min(x + d, _bitmap.width);
        var y1 = Math.max(0, y - d);
        var y2 = Math.min(y + d, _bitmap.height);

        // Create a copy of the region
        var pixels = [];
        for (var i = x1; i < x2; i++) {
            for (var j = y1; j < y2; j++) {
                var index = (i + j * _bitmap.width) << 2;
                pixels.push(_bitmap.data[index + 0]);
                pixels.push(_bitmap.data[index + 1]);
                pixels.push(_bitmap.data[index + 2]);
                pixels.push(_bitmap.data[index + 3]);
            }
        }

        // Remove red eye from the region
        var effect = new PhotoEffects.RedEyeComponent();
        pixels = effect.removeRedEye(pixels);

        // Copy the modified pixels to the bitmap
        var k = 0;

        for (var i = x1; i < x2; i++) {
            for (var j = y1; j < y2; j++) {
                var index = (i + j * _bitmap.width) << 2;
                _bitmap.data[index + 0] = pixels[k++];
                _bitmap.data[index + 1] = pixels[k++];
                _bitmap.data[index + 2] = pixels[k++];
                _bitmap.data[index + 3] = pixels[k++];
            }
        }
/*
        // Loop through the pixels in the region, lowering red values that
        // exceed the sum of the blue and green values
        for (var i = x1; i < x2; i++) {
            for (var j = y1; j < y2; j++) {
                var index = (i + j * _bitmap.width) << 2;
                var r = _bitmap.data[index + 0];
                var g = _bitmap.data[index + 1];
                var b = _bitmap.data[index + 2];
        
                if (r > (g + b)) {
                    _bitmap.data[index + 0] = (g + b) / 2;
                }
            }
        }
*/
        // Draw the portion of the bitmap that was modified onto the hidden canvas
        _hiddenContext.putImageData(_bitmap, 0, 0, x1, y1, x2 - x1, y2 - y1);

        // Transfer (and scale) the image from the hidden canvas to the main canvas
        _mainContext.drawImage(_hiddenCanvas, 0, 0, _mainCanvas.width, _mainCanvas.height);
    }

    function onAssignPointer(e) {
        try {
            _gesture.target = e.target;
        } catch (err) { }
        if (e.target == _gesture.target) {
            _gesture.addPointer(e.pointerId);
        }
    }

    function onOpeningMessageTapped(e) {
        onOpenButtonClicked(e);
    }

    function onImageTapped(e) {
        if (_bitmap !== null && !_annotating) {
            var x, y;

            // Get the click coordinates
            x = e.offsetX;
            y = e.offsetY;

            // Translate click coordinates into image coordinates
            x = Math.round(x * _hiddenCanvas.width / _mainCanvas.width);
            y = Math.round(y * _hiddenCanvas.height / _mainCanvas.height);

            // Fix red eye in region under cursor
            removeRedEye(x, y);

            // Enable the Save button
            _saveButton.removeAttribute("disabled");
        }
    }

    function onGestureChange(e) {
        if (!_annotating) {
            _dx += e.translationX;
            _dy += e.translationY;
            _scale = _scale * e.scale;
            _scale = Math.min(_scale, 4);
            _scale = Math.max(_scale, 1);
            e.target.style.msTransform = "scale(" + _scale + ") translate(" + _dx + "px," + _dy + "px)";
        }
    }

    function onDoubleTap(e) {
        _dx = 0;
        _dy = 0;
        _scale = 1.0;
        _mainCanvas.style.msTransform = "scale(1) translate(0px,0px)";
    }

    function onMouseWheelChanged(e) {
        if (_bitmap != null && e.ctrlKey) {
            if (e.wheelDelta > 0) {
                // Zoom in
                if (_scale < 4.0) {
                    _scale += 0.1;
                    _mainCanvas.style.msTransform = "scale(" + _scale + ") translate(" + _dx + "px," + _dy + "px)";
                }
            }
            else {
                // Zoom out
                if (_scale > 1.0) {
                    _scale -= 0.1;
                    _mainCanvas.style.msTransform = "scale(" + _scale + ") translate(" + _dx + "px," + _dy + "px)";
                }
            }
        }
    }

    function onPointerDown(e) {
        if (_annotating && e.currentPoint.isInContact) {
            _points[e.pointerId] = e.currentPoint;
            _mainContext.lineWidth = 8;
            _mainContext.lineCap = "round";
            _mainContext.strokeStyle = "Yellow";
        }
    }

    function onPointerMove(e) {
        if (_annotating && e.currentPoint.isInContact) {
            var point = e.currentPoint;

            if (_points[e.pointerId] !== undefined) {
                var prev = _points[e.pointerId];
                _mainContext.beginPath();
                _mainContext.moveTo(prev.position.x, prev.position.y);
                _mainContext.lineTo(point.position.x, point.position.y);
                _mainContext.stroke();
            }

            _points[e.pointerId] = point;
        }
    }

    function onPointerUp(e) {
        if (_annotating && _points[e.pointerId] !== undefined) {
            delete _points[e.pointerId];
        }
    }

    function onPointerOut(e) {
        if (_annotating && _points[e.pointerId] !== undefined) {
            delete _points[e.pointerId];
        }
    }

    function onRedEyeButtonClicked(e) {
        _annotating = false;
        _redEyeButton.setAttribute("disabled", "");
        _annotateButton.removeAttribute("disabled");
    }

    function onAnnotateButtonClicked(e) {
        _annotating = true;
        _redEyeButton.removeAttribute("disabled");
        _annotateButton.setAttribute("disabled", "");
    }
})();
