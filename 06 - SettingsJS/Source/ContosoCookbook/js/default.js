// For an introduction to the Grid template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkID=232446
(function () {
    "use strict";

    var app = WinJS.Application;
    var activation = Windows.ApplicationModel.Activation;
    var nav = WinJS.Navigation;
    var appdata = Windows.Storage.ApplicationData;
    WinJS.strictProcessing();

    app.addEventListener("activated", function (args) {
        if (args.detail.kind === activation.ActivationKind.launch) {
            // If "Remember where I was" is enabled and roaming settings
            // contains a history, apply it to go back to where the user
            // was before
            var remember = appdata.current.roamingSettings.values["remember"];
            remember = !remember ? false : remember; // false if value is undefined

            if (remember) {
                var history = appdata.current.roamingSettings.values["history"];
                if (history !== undefined) {
                    nav.history = JSON.parse(history);
                }
            }

            if (args.detail.previousExecutionState !== activation.ApplicationExecutionState.terminated) {
                // TODO: This application has been newly launched. Initialize
                // your application here.
            } else {
                // TODO: This application has been reactivated from suspension.
                // Restore application state here.
            }

            app.onsettings = function (e) {
                e.detail.applicationcommands = {
                    // Add an About command
                    "about": {
                        href: "/pages/about/about.html",
                        title: "About"
                    },
                    "preferences": {
                        href: "/pages/preferences/preferences.html",
                        title: "Preferences"
                    }
                }

                WinJS.UI.SettingsFlyout.populateSettings(e);
            };



            if (app.sessionState.history) {
                nav.history = app.sessionState.history;
            }
            args.setPromise(WinJS.UI.processAll().then(function () {
                if (nav.location) {
                    nav.history.current.initialPlaceholder = true;
                    return nav.navigate(nav.location, nav.state);
                } else {
                    return nav.navigate(Application.navigator.home);
                }
            }));
        }

    });

    app.oncheckpoint = function (args) {
        // TODO: This application is about to be suspended. Save any state
        // that needs to persist across suspensions here. If you need to 
        // complete an asynchronous operation before your application is 
        // suspended, call args.setPromise().
        app.sessionState.history = nav.history;

        // If "Remember where I was" is enabled, write the history to
        // roaming settings so it can be restored later
        var remember = appdata.current.roamingSettings.values["remember"];
        remember = !remember ? false : remember; // false if value is undefined

        if (remember) {
            appdata.current.roamingSettings.values["history"] = JSON.stringify(nav.history);
        }

    };

    app.start();
})();
