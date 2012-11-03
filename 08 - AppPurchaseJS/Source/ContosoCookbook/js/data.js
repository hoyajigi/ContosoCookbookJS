(function () {
    "use strict";

    // Get a reference for an item, using the group key and item title as a
    // unique reference to the item that can be easily serialized.
    function getItemReference(item) {
        return [item.group.key, item.title];
    }

    function resolveGroupReference(key) {
        for (var i = 0; i < groupedItems.groups.length; i++) {
            if (groupedItems.groups.getAt(i).key === key) {
                return groupedItems.groups.getAt(i);
            }
        }
    }

    function resolveItemReference(reference) {
        for (var i = 0; i < groupedItems.length; i++) {
            var item = groupedItems.getAt(i);
            if (item.group.key === reference[0] && item.title === reference[1]) {
                return item;
            }
        }
    }

    // This function returns a WinJS.Binding.List containing only the items
    // that belong to the provided group.
    function getItemsFromGroup(group) {
        return list.createFiltered(function (item) { return item.group.key === group.key; });
    }

    var list = new WinJS.Binding.List();
    var groupedItems = list.createGrouped(
        function groupKeySelector(item) { return item.group.key; },
        function groupDataSelector(item) { return item.group; }
    );

    // TODO: Replace the data with your real data.
    // You can add data from asynchronous sources whenever it becomes available.
    // To load recipe data from Azure, change "data/Recipes.txt" to
    // "http://contosorecipes8.blob.core.windows.net/AzureRecipesRP".
    WinJS.xhr({ url: "data/Recipes.txt" }).then(function (xhr) {
       var items = JSON.parse(xhr.responseText);

        // Add the items to the WinJS.Binding.List
        items.forEach(function (item) {
            list.push(item);
        });
    });

    WinJS.Namespace.define("Data", {
        items: groupedItems,
        groups: groupedItems.groups,
        getItemsFromGroup: getItemsFromGroup,
        getItemReference: getItemReference,
        resolveGroupReference: resolveGroupReference,
        resolveItemReference: resolveItemReference
    });
})();
