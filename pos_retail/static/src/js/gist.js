(function monkeyPatchJQueryAutocomplete($) {

    /**
     * Proxies a private
     * prototype method to the
     * options Object
     *
     * @param  {Object} obj
     * @param  {String} funcName
     */
    function proxyPrivateMethodToOptions(obj, funcName) {
        var __super = obj.prototype[funcName];
        obj.prototype[funcName] = function() {
            if (this.options[funcName]) {
                return this.options[funcName].apply(this, arguments);
            }
            return __super.apply(this, arguments);
        };
    }

    // Make the private _renderItem
    // method available through the options Object
    proxyPrivateMethodToOptions($.ui.autocomplete, '_renderItem');
	proxyPrivateMethodToOptions($.ui.autocomplete, '_renderMenu');
	proxyPrivateMethodToOptions($.ui.autocomplete, '_renderItemData');

	

    // We can do this for other methods as well:
    
    // @example
    //
    //      $('.some-input').autocomplete({
    //          _renderItem: function(ul, item) {
    //              console.log(__super);
    //              return $("<li>")
    //                  .append($("<a>").text(item.label))
    //                  .appendTo(ul);
    //          }
    //      });
    // 

}($));
