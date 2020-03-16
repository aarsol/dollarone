odoo.define('pierce_pos_keyboard_shortcuts_new.pierce_pos_keyboard_shortcuts', function(require) {
"use strict";

var screens = require('point_of_sale.screens');
var PosBaseWidget = require('point_of_sale.BaseWidget');
var ScreenWidget = screens.ScreenWidget;
var NumpadWidget = screens.NumpadWidget;
var PaymentScreenWidget = screens.PaymentScreenWidget;
var ReceiptScreenWidget = screens.ReceiptScreenWidget;
var ClientListScreenWidget = screens.ClientListScreenWidget;
var core = require("web.core");

var FormView = require('web.FormView');
var gui = require('point_of_sale.gui');

/*
8  back space
9  tab
27 Esc
33 page up
34 page down
35  End
36  Home
37  left arrow
38  up arrow
39  right arrow
40  down arrow
45  insert
46  delete
48-57   0-9
61   =
65-90   A-Z
96-105     0-9 numeric pad
107  numeric keypad +
109  numeric keypad -
112-123   F1-F12
110  .
190  .

*/
/*    - Get the value from python-    */
var resultarray;
var barcode = '';
var isBarCode = false;
var barCodeCounter = 0;
var focusState; // Product Input text box focus state.

ScreenWidget.include({
    init: function(parent, options) {
        var self = this;
        this._super(parent, options);

        this.bar_code_handler = function (e) {
            focusState = $("div.searchbox input").is(":focus");
            if (e.which != 13) {
                barcode += String.fromCharCode(e.which);
            } else {
                isBarCode=true;
            }
        }

        this.pi_keydown_handler = function(e){
            setTimeout(function(){self.process_keydown_if_required(e);},150);
        }

        this.process_keydown_if_required = function(e){
            if(isBarCode && barCodeCounter < barcode.length){
                barCodeCounter +=1;

            } else if(barCodeCounter == barcode.length) {
                barcode = '';
                isBarCode = false;
                barCodeCounter = 0;
            } else {
               this.pi_process_keydown(e);
               barcode = '';
            }
        }


        this.pi_keypress_handler = function(e){
            setTimeout(function(){self.process_keypress_if_required(e);},150);
        }

        this.process_keypress_if_required = function(e){
            if(isBarCode && barCodeCounter < barcode.length){
                barCodeCounter +=1;
            } else if(barCodeCounter == barcode.length) {
                barcode = '';
                isBarCode = false;
                barCodeCounter = 0;
            } else {
               //this.pi_process_keypress(e);
               barcode = '';
            }
        }
    },
    show: function(){
        window.document.body.addEventListener('keydown',this.bar_code_handler);
        window.document.body.addEventListener('keydown',this.pi_keydown_handler);
        window.document.body.addEventListener('keypress',this.pi_keypress_handler);
        this._super();
    },
    hide: function(){
        window.document.body.removeEventListener('keydown',this.bar_code_handler);
        window.document.body.removeEventListener('keydown',this.pi_keydown_handler);
        window.document.body.addEventListener('keypress',this.pi_keypress_handler);
        this._super();
    },

    
    pi_process_keypress: function(e){
		
	},
	
    pi_process_keydown: function(e){        
	        if($(".model-order-line-note").is(":visible")){ 	        	
                if(e.keyCode == 27){  // Cancel to set line note                    
                    $(".model-order-line-note").find(".cancel").trigger("click");
                }                
                	
	        }
	        else if($(".popup.popup-textinput").is(":visible")){ 	        	
                if(e.keyCode == 27){  // Cancel              
                    $(".popup.popup-textinput").find(".cancel").trigger("click");
                }                
                	
	        }
	        else if($(".popup.popup-number").is(":visible")){ 	        	
                if(e.keyCode == 27){  // Cancel                   
                    $(".popup.popup-number").find(".cancel").trigger("click");
                }                
                	
	        }
	        else if($(".popup.popup-selection").is(":visible")){ 	        	
                if(e.keyCode == 27){  // Cancel                    
                    $(".popup.popup-selection").find(".cancel").trigger("click");
                }                
                	
	        }
	        else if($(".popup.popup-confirm").is(":visible")){ 	        	
                if(e.keyCode == 27){  // Cancel                   
                    $(".popup.popup-confirm").find(".cancel").trigger("click");
                }                     
                	
	        }	    	       		       	        
	        else if($(".product-screen").is(":visible")){    // Screen 1 Product Screen
				   	
				   	if(e.keyCode == 9){         // Tab to focus search box
					    setTimeout(function(){
					        if (focusState){
				                $(".leftpane").focus();
						    } else {
						        $("div.searchbox input").focus();
						    }
					    });
					}
					//alert(focusState);
					//if ($("div.searchbox input").is(':not(:focus)')){
	                if(focusState == false){
						if(e.keyCode == 61 || e.keyCode == 107){            // for new order nutton

						    $(".neworder-button").trigger("click");
						}
						else if(e.keyCode == 173 || e.keyCode == 109){                  // for delete order button
						    $(".deleteorder-button").trigger("click");
						}
						
		               
		                
		      
					} // not search box
            } // product screen
            else if($(".clientlist-screen").is(":visible")){     // Customer screen
                if(e.keyCode == resultarray.customer ){         // new customer button using customer key
                    var customer = String.fromCharCode(resultarray.customer);   // convert to keydown
        		    customer = (customer.charCodeAt(0) - 32);
                        if(e.keyCode == customer){
                            $(".new-customer").trigger("click");
                        }
                }
        	}
           
    },

});

ClientListScreenWidget.include({
    show:function(){
        var self = this;
        this._super();
        
        this.pi_client_keyboard_handler = function(event){
            if (event.type === "keydown") {
                if( event.keyCode == 37 ){    // Back to go left
                    self.gui.back();
                }
                if(event.keyCode == 13){  // Enter to set customer
                    if($(".next").is(":visible")){
                        self.save_changes();
                        self.gui.back();
                    }
                }
            }
        }
        window.document.body.addEventListener('keydown',this.pi_client_keyboard_handler);
    },
    hide: function(){
        window.document.body.removeEventListener('keydown',this.pi_client_keyboard_handler);
        this._super();
    },
});

PaymentScreenWidget.include({
    show:function(){
           
        	   if(resultarray.invoice){
                     var invoice = String.fromCharCode(resultarray.invoice);   // convert to keydown
        		     invoice = (invoice.charCodeAt(0) - 32);
        	        if( event.keyCode == invoice ){                           // For next order 'ESC' key
        	            if($(".js_invoice").hasClass("highlight")){
                             $('.js_invoice').removeClass('highlight');
                        }
                        else{
                        $('.js_invoice').addClass('highlight');
                        }
        	        }
        	   }
        	   if(resultarray.customer){
                    var customer = String.fromCharCode(resultarray.customer);   // convert to keydown
        		    customer = (customer.charCodeAt(0) - 32);
                        if(event.keyCode == customer) { //  for customer button
    	        		    $(".set-customer").trigger("click");
                        }
                    }

        }
    }
   
});

ReceiptScreenWidget.include({

    init: function(parent, options) {

        var self = this;
        this._super(parent, options);
        self._rpc({
		    model: 'pos.shortcut',
		    method: 'paymentscreen',
		    args: [{}],
        })
        .done(function(result_dic) {
               resultarray = result_dic;
        });
        this.pi_keyboard_handler = function(event){
            var key = '';
            if (event.type === "keydown") {
                if( event.keyCode == 27 ||event.keyCode == 13 ){                           // For next order 'ESC' key
        	        if (!self._locked) {
                         self.click_next();
                    }
        	    }
        	    if( event.keyCode == 80){                                           // For Print button (P)
        	        $(".print").trigger("click");
        	    }
            }
        }
    },
    show: function(){
        window.document.body.addEventListener('keydown',this.pi_keyboard_handler);
        this._super();
    },
    hide: function(){
        window.document.body.removeEventListener('keydown',this.pi_keyboard_handler);
        this._super();
    },
	start: function() {

       }
});

NumpadWidget.include({                      // Numpad widget bind the number
      start: function() {
        this.state.bind('change:mode', this.changedMode, this);
        this.changedMode();
        this.$el.find('.numpad-minus').click(_.bind(this.clickSwitchSign, this));
        this.$el.find('.mode-button').click(_.bind(this.clickChangeMode, this));
        this.$el.find('.aarsol_one').click(_.bind(this.clickAppendNewChar, this));
        this.$el.find('.aarsol_two').click(_.bind(this.clickAppendNewChar, this));
        this.$el.find('.aarsol_three').click(_.bind(this.clickAppendNewChar, this));
        this.$el.find('.aarsol_four').click(_.bind(this.clickAppendNewChar, this));
        this.$el.find('.aarsol_five').click(_.bind(this.clickAppendNewChar, this));
        this.$el.find('.aarsol_six').click(_.bind(this.clickAppendNewChar, this));
        this.$el.find('.aarsol_seven').click(_.bind(this.clickAppendNewChar, this));
        this.$el.find('.aarsol_eight').click(_.bind(this.clickAppendNewChar, this));
        this.$el.find('.aarsol_nine').click(_.bind(this.clickAppendNewChar, this));
        this.$el.find('.aarsol_zero').click(_.bind(this.clickAppendNewChar, this));
        this.$el.find('.aarsol_dot').click(_.bind(this.clickAppendNewChar, this));
        this.$el.find('.aarsol_numpad_backspace').click(_.bind(this.clickDeleteLastChar, this));
        this.$el.find('.aarsol_price').click(_.bind(this.clickChangeMode, this));
        this.$el.find('.aarsol_disc').click(_.bind(this.clickChangeMode, this));
        this.$el.find('.aarsol_qty').click(_.bind(this.clickChangeMode, this));

      }
});

});
