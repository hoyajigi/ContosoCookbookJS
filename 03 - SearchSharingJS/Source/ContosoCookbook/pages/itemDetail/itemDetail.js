(function () {
    "use strict";

    var ui = WinJS.UI;
    var utils = WinJS.Utilities;
    var storage = Windows.Storage;
    var dtm = Windows.ApplicationModel.DataTransfer.DataTransferManager;
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
        },

        onDataRequested: function (e) {
            var request = e.request;
            request.data.properties.title = item.title;
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

        },

        unload: function () {
            WinJS.Navigation.removeEventListener("datarequested", this.onDataRequested);
        }


    });
})();
