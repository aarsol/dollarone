( function( $ ) {

$.widget( "custom.tablecomplete", $.ui.autocomplete, {
	_create: function() {
		this._super( "_create" );
		this.menu = $( "<table>" )
			.addClass( "ui-autocomplete" )
			.appendTo( "body" )
			.hide()
			.menu()
			.data( "menu" );
	},
	_renderMenu: function( menu, items ) {
		$.each( items, function() {
			$( "<tr>" )
				.data( "item.autocomplete", this )
				.append( $( "<td>", { text: this.label } ) )
				.append( $( "<td>", { text: this.state } ) )
				.append( $( "<td>", { text: this.population } ) )
				.appendTo( menu );
		});
	}
});

return $.ui.tablecomplete;

});

