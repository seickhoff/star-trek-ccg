/*

Thanks to lonesomeday at stackoverflow http://stackoverflow.com/a/8568191/250241

Usage

$(selector).zindex('up'); //pushes to top of stack
$(selector).zindex('down'); //pushes down the stack

*/

(function($) {
    var highest = 1;
    var publicMethods = {
        up : function() {
            this.css('z-index', ++highest); // increase highest by 1 and set the style
            return this;
        },
        down : function(){
            this.css('z-index', --highest); // increase highest by 1 and set the style
            return this;
        }
    }
    $.fn.zindex = function(method){
        if (publicMethods[method]){
            return publicMethods[method].apply(this);
        }
        else{
            $.error( 'Method ' +  method + ' does not exist. Yo.' );
        }
    }

})(jQuery);
