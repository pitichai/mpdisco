var React = require('./vendor/react/react-with-addons.js');
var _ = require('underscore');

var cx = React.addons.classSet;

var PlaylistItem = require('./playlist_item.jsx');

var SelectableListMixin = require('./mixins/selectable_list_mixin.js');
var DragDropMixin = require('./vendor/react-dnd/dist/ReactDND.min.js').DragDropMixin;
var SortableMixin = require('./mixins/sortable_mixin.js');

var accepts = ['artist', 'album', 'song'];

var Playlist = React.createClass({

    mixins: [SelectableListMixin, DragDropMixin, SortableMixin],

    statics: {
        configureDragDrop: function(register) {
            accepts.forEach(function(itemType) {
                register(itemType, {
                    dropTarget: {
                        acceptDrop: function(component, item) {
                            component.props.model.addItem(itemType, item);
                        }
                    }
                });
            });
        }
    },

    getInitialState: function() {
        return {
            state: {
                random: 0,
                repeat: 0,
                single: 0
            },
            items: [],
            selectedItems: [],
            focusedItemIndex: 0,
            playingItem: null
        };
    },

    componentWillMount: function() {
        this.props.player.on('song', function(song) {
            this.setState({
                playingItemId: song.id
            });
        }.bind(this));

        this.props.player.on('state', function(state) {
            this.setState({
                state: state
            });
        }.bind(this));

        this.props.model.on('playlist', function(playlist) {
            this.setState({
                items: playlist || []
            });
        }.bind(this));

        this.props.model.fetchPlaylist();

        document.addEventListener('keydown', this.handleKeyboard, false);
    },

    componentWillUnmount: function() {
        document.removeEventListener('keydown', this.handleKeyboard, false);
    },

    render: function() {

        var shuffleClasses = cx({
            shuffle: true,
            active: +this.state.state.random
        });

        var repeatClasses = cx({
            repeat: true,
            active: +this.state.state.repeat,
            single: +this.state.state.single
        });

        var removeClasses = cx({
            remove: true,
            disabled: (this.state.selectedItems.length <= 0)
        });

        var dropStates = accepts.map(this.getDropState);

        var playlistClasses = cx({
            'playlist-drop': _.any(dropStates, function (state) {
                return state.isDragging || state.isHovering;
            })
        });

        var items = this.state.items;

        items = items.map(function(item, i) {
            var focused  = (this.state.focusedItemIndex === i);
            var selected = (this.state.selectedItems.indexOf(item) >= 0);
            var playing  = (this.state.playingItemId === item.id);

            return (
                <PlaylistItem
                    key={item.id}
                    item={item}
                    selected={selected}
                    playing={playing}
                    focused={focused}
                    onItemClick={this.itemSelected}
                    onItemDblClick={this.itemPlayed}
                    onReorder={this.reorder}
                    onDidReorder={this.reordered}
                    />
            );
        }.bind(this));

        return (
            <section id="playlist" className={playlistClasses} {...this.dropTargetFor.apply(this, accepts)}>
                <header>
                    <span>Playlist</span>
                    <div className="playlist-tools button-group">
                        <input type="text" id="url" name="url" placeholder="Add a link" />
                        <span className="separator"></span>
                        <a className={shuffleClasses} href="#" onClick={this.toggleShuffle}><i className="icon-random"></i></a>
                        <a className={repeatClasses} href="#" onClick={this.toggleRepeat}><i className="icon-refresh"></i></a>
                        <span className="separator"></span>
                        <a className={removeClasses} href="#" onClick={this.remove}><i className="icon-trash"></i></a>
                    </div>
                </header>
                <ul className="list content">
                    {items}
                </ul>
            </section>
        );
    },

    reordered: function(from, to) {
        this.props.model.reorderItems(this.state.items);
    },

    itemPlayed: function(e, item) {
        MPDisco.network.command('playid', item.id);
    },

    remove: function(e) {
        this.props.model.removeItems(this.state.selectedItems);

        e.preventDefault();
    },

    //drop: function(e, ui) {
    //    var model = ui.helper.data('model'),
    //        args = [];
    //
    //    _.each(['artist', 'album', 'title'], function(key) {
    //        var value = model[key];
    //        if (value) {
    //            args.push(key);
    //            args.push(value);
    //        }
    //    });
    //
    //    if (args.length) {
    //        MPDisco.command('findadd', args);
    //    }
    //},

    toggleShuffle: function(e) {
        var random = (~this.state.state.random & 1);

        this.props.player.toggleShuffle(random);

        e.preventDefault();
    },

    toggleRepeat: function(e) {
        var repeat = +this.state.state.repeat,
            single = +this.state.state.single;

        // Note single cannot be on without repeat.

        if (repeat && single) {
            // Both on, turn both off.
            this.props.player.toggleRepeat(0, 0);
        } else if (repeat) {
            // Repeat on, turn single on.
            this.props.player.toggleRepeat(1, 1);
        } else {
            // Both off, turn repeat on.
            this.props.player.toggleRepeat(1, 0);
        }

        e.preventDefault();
    },

    scrollIntoView: function(item) {
        var scrollTop = this.ui.playlist.prop('scrollTop'),
            height = this.ui.playlist.height(),
            itemTop = item.position().top,
            itemHeight = item.outerHeight();

        if (itemTop < 0) {
            scrollTop += itemTop;
        } else if (itemTop + itemHeight > height) {
            scrollTop -= height - itemTop - itemHeight;
        }

        this.ui.playlist.prop('scrollTop', scrollTop);
    },

    handleKeyboard: function(e) {
        var funcs = {
                0x0d: function(e) {
                    var item = _.first(this.state.selectedItems);

                    if (item) {
                        this.itemPlayed(e, item);
                    }
                },
                0x23: function(e) {
                    if (e.shiftKey) {
                        this.selectRange(this.$('.selected').last(), this.$('.playlist-item').last());
                    }else{
                        this.select(this.$('.playlist-item').last());
                    }

                    e.preventDefault();
                },
                0x24: function(e) {
                    if (e.shiftKey) {
                        this.selectRange(this.$('.selected').last(), this.$('.playlist-item').first());
                    }else{
                        this.select(this.$('.playlist-item').first());
                    }

                    e.preventDefault();
                },
                0x26: this.itemSelectPrev,
                0x28: this.itemSelectNext,
                0x2e: this.remove,
                0x41: function(e) {
                    if (e.ctrlKey) {
                        this.itemSelectAll();

                        e.preventDefault();
                    }
                },
                0x44: function(e) {
                    if (e.ctrlKey) {
                        this.itemSelectNone();

                        e.preventDefault();
                    }
                }
            },
            fn = funcs[e.which];

        if (fn) {
            return fn.call(this, e);
        }
    }
});

module.exports = Playlist;