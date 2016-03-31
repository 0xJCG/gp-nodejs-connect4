var http = require("http"),
	async = require('async'),
    fs = require('fs'),
    url = require('url');

var contentTypes = {
  'html' : 'text/html',
  'js' : 'text/javascript',
  'css' : 'text/css',
  'png' : 'image/png',
  'gif' : 'image/gif'
};

// Creating the server.
var server = http.createServer(function(req, res) {
	var path = (url.parse(req.url).pathname == '/')?'/index.html':url.parse(req.url).pathname; // Loading the index file if nothing selected.
	var extension = path.split('.').pop(); // Taking the extension of the file selected.
	fs.readFile(__dirname + '/static' + path, function(error, data) { // Loading the file selected.
		if (error) { // If there is an error, we put 404 error on screen.
			res.writeHead(404);
			res.write('404');
			res.end();
		} else { // If all is going well.
			res.writeHead(200, {'Content-Type': contentTypes[extension]}); // We serve the file.
			res.write(data, 'utf8');
			res.end();
		}
	});
});
var io = require('socket.io').listen(server.listen(80, '0.0.0.0'));

// Helper function.
function getPair(row, column, step) {
    l = [];
    for(var i = 0; i < 4; i++) {
        l.push([row, column]);
        row += step[0];
        column += step[1];
    }
    return l;
}

// A list to hold win cases.
var check = [];

check.push(function check_horizontal(room, row, startColumn, callback) {
    for(var i = 1; i < 5; i++) {
        var count = 0;
        var column = startColumn + 1 - i;
        var columnEnd = startColumn + 4 - i;
        if(columnEnd > 6 || column < 0) {
            continue;
        }
        var pairs = getPair(row, column, [0,1]);
        for(var j = column; j < columnEnd + 1; j++) {
            count += games[room]['board'][row][j];
        }
        if(count == 4)
            callback(1, pairs);
        else if(count == -4)
            callback(2, pairs);
    }
});

check.push(function check_vertical(room, startRow, column, callback) {
    for(var i = 1; i < 5; i++) {
        var count = 0;
        var row = startRow + 1 - i;
        var rowEnd = startRow + 4 - i;
        if(rowEnd > 5 || row < 0) {
            continue;
        }
        var pairs = getPair(row, column, [1,0]);
        for(var j = row; j < rowEnd + 1; j++) {
            count += games[room]['board'][j][column];
        }
        if(count == 4)
            callback(1, pairs);
        else if(count == -4)
            callback(2, pairs);
    }
});

check.push(function check_leftDiagonal(room, startRow, startColumn, callback) {
    for(var i = 1; i < 5; i++) {
        var count = 0;
        var row = startRow + 1 - i;
        var rowEnd = startRow + 4 - i;
        var column = startColumn + 1 - i;
        var columnEnd = startColumn + 4 - i;
        if(column < 0 || columnEnd > 6 || rowEnd > 5 || row < 0) {
            continue;
        }
        var pairs = getPair(row, column, [1,1]);
        for(var j = 0; j < pairs.length; j++) {
            count += games[room]['board'][pairs[j][0]][pairs[j][1]];
        }
        if(count == 4)
            callback(1, pairs);
        else if(count == -4)
            callback(2, pairs);
    }
});


check.push(function check_rightDiagonal(room, startRow, startColumn, callback) {
    for(var i = 1; i < 5; i++) {
        var count = 0;
        var row = startRow + 1 - i;
        var rowEnd = startRow + 4 - i;
        var column = startColumn -1 + i;
        var columnEnd = startColumn - 4 + i;
        if(column < 0 || columnEnd > 6 || rowEnd > 5 || row < 0) {
            continue;
        }
        var pairs = getPair(row, column, [1,-1]);
        for(var j = 0; j < pairs.length; j++) {
            count += games[room]['board'][pairs[j][0]][pairs[j][1]];
        }
        if(count == 4)
            callback(1, pairs);
        else if(count == -4)
            callback(2, pairs);
        else {
            check_draw(room, function() {
                games[room].board = [[0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0]];
                io.sockets.in(room).emit('reset', {win: 2, 'inc': [0,0]});
            });
        }
    }
});

// Function to check for draw
function check_draw(room, callback) {
    for(var index in games[room]['board'][0]) {
        if(games[room]['board'][0][index] == 0)
            return;
    }
    callback();
}

var games = {}; // List to save the games.
var room = 0; // Room number to distinguish each game.

io.sockets.on('connection', function(socket) { // Connecting to the server.
    socket.on('join', function() {
        if (room in games) { // If the room is already created, we connect the second player with the first one.
            if (typeof games[room].player2 != "undefined") { // If there is a problem with the second player.
                socket.emit('leave'); // Disconnecting the second player.
                return;
            }
            socket.join(room); // Joining the second player in the room.
			
			// Setting the variables of the second player.
            socket.set('room', room);
            socket.set('color', '#FB6B5B');
            socket.set('pid', -1);
            games[room].player2 = socket; // Adding the socket created to the room game.
            
			// Set opponents.
            socket.set('opponent', games[room].player1);
            games[room].player1.set('opponent', games[room].player2);

            // Setting the turns. Always starts the first player connected.
            socket.set('turn', false); // Second player waits.
            socket.get('opponent', function(err, opponent) {
                opponent.set('turn', true); // First player starts.
            });

            socket.emit('assign', {pid: 2}); // Telling the second player that he/she is the player 2.

            games[room].player1.emit('notify', {connected: 1, turn: true}); // Telling the first player that the game is ready.
			room++; // Incrementing the room number for assignation to the next game.
            socket.emit('notify', {connected: 1, turn: false}); // Telling the second player that the game is ready.
        } else {
            socket.join(room);  // Joining the first player in the room.
			
			// Setting the variables of the first player.
            socket.set('room', room);
            socket.set('color', '#FFC333');
            socket.set('pid', 1);
            socket.set('turn', false);
			
			// Creating the room.
            games[room] = {
                player1: socket,
                board: [[0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0]], // Game board.
            };
			
			// Assigning the ID to the player.
            socket.emit('assign', {pid: 1});
        }
    });

	// Checking the click done by the user.
	// Pre: data -> column.
    socket.on('click', function(data) {
        async.parallel([
            socket.get.bind(this, 'turn'),
            socket.get.bind(this, 'opponent'),
            socket.get.bind(this, 'room'),
            socket.get.bind(this, 'pid')
        ], function(err, results) {
            if (results[0]) {
				// Assigning the turns of the players.
                socket.set('turn', false);
                results[1].set('turn', true);
				
				// Telling the players if it is their turn or not.
				socket.emit('turn', {turn: false});
				results[1].emit('turn', {turn: true});

                var i = 5; // Number of rows.
                
				// Checking if there is an space in the column selected.
				while (i >= 0) {
                    if (games[results[2]].board[i][data.column] == 0) {
                        break;
					}
                    i--;
                }
				
                if (i >= 0 && data.column >= 0) {
                    games[results[2]].board[i][data.column] = results[3];
                    socket.get('color', function(err, color) {
                        socket.emit('drop', {row: i, column: data.column, color: color});
                        results[1].emit('drop', {row: i, column: data.column, color: color});
                    });
                    var win = false;
                    check.forEach(function(method) {
                        method(results[2], i, data.column, function(player, pairs) {
                            if (player == 1) {
                                games[results[2]].player1.emit('reset', {win: 1, 'inc': [1,0], highlight: pairs});
                                games[results[2]].player2.emit('reset', {win: 0, 'inc': [1,0], highlight: pairs});
                            } else {
                                games[results[2]].player1.emit('reset', {win: 0, 'inc': [0,1], highlight: pairs});
                                games[results[2]].player2.emit('reset', {win: 1, 'inc': [0,1], highlight: pairs});
                            }
                            games[results[2]].board = [[0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0]];
                        });
                    });
                }
            }
        });
    });

    /*socket.on('continue', function() {
        socket.get('turn', function(err, turn) {
            socket.emit('notify', {connected: 1, turn: turn});
        });
    });*/

	// If someone disconnects.
    socket.on('disconnect', function() {
        console.log('Disconnected');
        socket.get('room', function(err, room) {
            io.sockets.in(room).emit('leave');
            if (room in games) { // If the game exists,
                delete games.room; // We delete it from the list.
            }
        });
    });
	
	// The countdown passes.
    socket.on('countdown', function(data) {
        console.log('Player ' + data.player + ' inactive');
        socket.get('room', function(err, room) {
			if (data.player == 1) {
				games[room].player1.emit('reload'); // The inactive player must reload the game.
				games[room].player2.emit('leave'); // The other player will wait for another game.
			} else {
				games[room].player1.emit('leave');
				games[room].player2.emit('reload');
			}
            if (room in games) { // If the game exists,
                delete games.room; // We delete it from the list.
            }
        });
    });
	
	// Chat.
	socket.on('message_to_server', function(data) { 
		var message = data['message'];
		var player = data['player'];
		socket.get('room', function(err, room) { // Emitting the text to the players.
			games[room].player1.emit("message_to_client", {message: message, player: player}); 
			games[room].player2.emit("message_to_client", {message: message, player: player}); 
		});
	});
});

console.log('Listening on port 80');
