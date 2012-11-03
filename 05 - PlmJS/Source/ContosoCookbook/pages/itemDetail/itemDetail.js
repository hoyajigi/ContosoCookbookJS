(function () {
    "use strict";

    var ui = WinJS.UI;
    var utils = WinJS.Utilities;
    var storage = Windows.Storage;
    var dtm = Windows.ApplicationModel.DataTransfer.DataTransferManager;
    var capture = Windows.Media.Capture;
    var _photo;
    var _video;
    var item;


    ui.Pages.define("/pages/itemDetail/itemDetail.html", {
        // This function is called whenever a user navigates to this page. It
        // populates the page elements with the app's data.
        ready: function (element, options) {
            item = options && options.item ? Data.resolveItemReference(options.item) : Data.items.getAt(0);
            element.querySelector(".titlearea .pagetitle").textContent = item.group.title;
            element.querySelector("article .item-title").textContent = item.title;
            element.querySelector("article .item-subtitle").textContent = item.preptime;
            element.querySelector("article .item-image").src = item.backgroundImage;
            element.querySelector("article .item-image").alt = item.shortTitle;

            // Display ingredients list
            var ingredients = element.querySelector("article .item-ingredients");
            for (var i = 0; i < item.ingredients.length; i++) {
                var ingredient = document.createElement("h2");
                ingredient.textContent = item.ingredients[i];
                ingredient.className = "ingredient";
                ingredients.appendChild(ingredient);
            }

            // Display cooking directions
            element.querySelector("article .item-directions").textContent = item.directions;
            element.querySelector(".content").focus();

            // Register for datarequested events for sharing
            dtm.getForCurrentView().addEventListener("datarequested", this.onDataRequested);

            // Handle click events from the Photo command
            document.getElementById("photo").addEventListener("click", function (e) {
                var camera = new capture.CameraCaptureUI();

                // Capture a photo and display the share UI
                camera.captureFileAsync(capture.CameraCaptureUIMode.photo).then(function (file) {
                    if (file != null) {
                        _photo = file;
                        dtm.showShareUI();
                    }
                });
            });

            
            // Handle click events from the Video command
            document.getElementById("video").addEventListener("click", function (e) {
                var camera = new capture.CameraCaptureUI();
                camera.videoSettings.format = capture.CameraCaptureUIVideoFormat.wmv;

                // Capture a video and display the share UI
                camera.captureFileAsync(capture.CameraCaptureUIMode.video).then(function (file) {
                    if (file != null) {
                        _video = file;
                        dtm.showShareUI();
                    }
                });
            });


        },

       
        onDataRequested: function (e) {
            var request = e.request;
            request.data.properties.title = item.title;

            if (_photo != null) {
                request.data.properties.description = "Recipe photo";
                var reference = storage.Streams.RandomAccessStreamReference.createFromFile(_photo);
                request.data.properties.Thumbnail = reference;
                request.data.setBitmap(reference);
                _photo = null;
            }


            else if (_video != null) {
                request.data.properties.description = "Recipe video";
                request.data.setStorageItems([_video]);
                _video = null;
            }



            else {
                request.data.properties.description = "Recipe ingredients and directions";

                // Share recipe text
                var recipe = "\r\nINGREDIENTS\r\n" + item.ingredients.join("\r\n");
                recipe += ("\r\n\r\nDIRECTIONS\r\n" + item.directions);
                request.data.setText(recipe);

                // Share recipe image
                var uri = item.backgroundImage;
                if (item.backgroundImage.indexOf("http://") != 0)
                    uri = "ms-appx:///" + uri;

                uri = new Windows.Foundation.Uri(uri);
                var reference = storage.Streams.RandomAccessStreamReference.createFromUri(uri);
                request.data.properties.thumbnail = reference;
                request.data.setBitmap(reference);
            }
        },




        unload: function () {
            WinJS.Navigation.removeEventListener("datarequested", this.onDataRequested);
        }

    });
})();
