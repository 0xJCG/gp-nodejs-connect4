$(document).ready(function() {
    var socket = io.connect(window.location.hostname); // Socket cration.
	var countdown = setInterval; // Variable for countdown.
	var lang = GetURLParameter('lang'); // Getting the language selected by the user. Default: spanish.
	
	// Getting the parameter of the URL that we want.
	function GetURLParameter(sParam) {
		var sPageURL = window.location.search.substring(1);
		var sURLVariables = sPageURL.split('&');
		for (var i = 0; i < sURLVariables.length; i++) {
			var sParameterName = sURLVariables[i].split('=');
			if (sParameterName[0] == sParam) {
				return sParameterName[1];
			}
		}
		return 'es'; // Spanish by default.
	}
	
	// Loading the file for the languaje.
	var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
	if (lang == 'en')
		script.src = 'js/en.js';
	else
		script.src = 'js/es.js';

    // Fire the loading.
    head.appendChild(script);
	
	function Player(pid) { // Function to create a new player.
		this.pid = pid;
    }

    var player = new Player('', ''); // Creating a new player.
	
	// The server tell us that we have a new message to show on the chat.
	socket.on('message_to_client', function(data) {
		writeInChat('Player ' + data['player'] + ': ' + data['message']); // Adding the new message to the chat.
		$('p#chatlog').animate({"scrollTop": $('p#chatlog')[0].scrollHeight}, "slow"); // Moving the scroll automatically to the bottom.
	});
	
	// When the user sends a message in the chat.
	$('#message_input').keypress(function(e) {
		if (e.which == 13) { // Only when the 'intro' is pushed.
			var msg = document.getElementById('message_input').value; // Getting the message of the inputbox.
			if (msg != "") { // If the message is not empty.
				socket.emit('message_to_server', {message: msg, player: player.pid}); // Sending the message to the server.
				document.getElementById('message_input').value = ''; // Deleting the text of the inputbox.
			}
		}
	});

	// The user connects to the game.
    socket.on('connect', function() {
        socket.emit('join', {}); // Telling the server we want to join a game.
    });

	// Assigning the player number to the user.
    socket.on('assign', function(data) {
        player.color = data.color;
        player.pid = data.pid;
        if (player.pid == 1)
			$('.p1-score p').addClass('current');
        else
			$('.p2-score p').addClass('current');
		// Telling the user on the chat that he is connected.
		writeInChat(connected);
	});

	// The opponent has left.
    socket.on('leave', function() {
        writeInChat(disconnected);
		$('#message_input').prop('disabled', true); // Disabling the chat.
		$('td').css('background-color', ''); // Resetting the game.
		socket.emit('join', {}); // Asking the server to join to another game.
    });

	// The opponent has joined. Notifying the user the has begun.
    socket.on('notify', function(data) {
        if(data.connected == 1) {
            if (data.turn) {
				$("#countdown").countdown(60); // Activating the countdown.
				writeInChat(playersConnectedYourTurn);
            } else
				writeInChat(playersConnectedNotYourTurn);
			$('#message_input').prop('disabled', false); // Enabling the chat.
        }
    });

	// Telling the player if it's his/her turn.
	socket.on('turn', function(data) {
		if (data.turn) { // My turn.
			$("#countdown").countdown(60); // Activating the countdown.
			writeInChat(yourTurn);
		} else // Opponent's turn.
			writeInChat(notYourTurn);
	});
	
	// Telling the server the box clicked by the player.
    $('.box').click(function() {
		clearInterval(countdown); // Stopping the countdown.
        // Getting the box the user has clicked.
        var click = {
            //row: $(this).data('row'), // The row is not needed.
            column: $(this).data('column')
        };
        socket.emit('click', click); // Telling the server the box clicked.
    });

	// Dropping the piece in its place.
    socket.on('drop', function(data) {
        var row = 0;
        stopVal = setInterval(function() {
            if(row == data.row)
                clearInterval(stopVal);
            fillBox(row, data.column, data.color);
            row++;
        }, 25);
    });

    function fillBox(row, column, color) {
        $('[data-row="'+(row-1)+'"][data-column="'+column+'"]').css('background', '');
        $('[data-row="'+row+'"][data-column="'+column+'"]').css('background', color);
    }

	// The game has ended, this function resets the game letting the players to play again.
    socket.on('reset', function(data) {
		// If either player has won, we set an animation for the line obtained.
        if (data.highlight) {
            setTimeout(function() {
                data.highlight.forEach(function(pair) { 
                    $('[data-row="'+pair[0]+'"][data-column="'+pair[1]+'"]').css('background-color', '#65BD77');
                });
            }, 500);
        }

		// Resetting the board.
		setTimeout(function() {
            $('td').css('background-color', '')
        }, 1200)
		
		// Telling the user the result of the game.
		if (data.win == 1) // Winner.
			writeInChat(youWin);
		else if (data.win == 0) // Loser.
			writeInChat(youLose);
		else // Draw.
			writeInChat(tie);
		
        // Set Scores
        p1 = parseInt($('.p1-score').html())+data['inc'][0];
        $('.p1-score').html(p1);
        p2 = parseInt($('.p2-score').html())+data['inc'][1];
        $('.p2-score').html(p2);
    });
	
	// The player has been inactive more than 60 seconds.
    socket.on('reload', function() {
		writeInChat(inactive);
        $('#message_input').prop('disabled', true); // Disabling the chat.
		$('td').css('background-color', ''); // Resetting the game.
    });
	
	// Our countdown plugin takes a callback, a duration, and an optional message
	$.fn.countdown = function(duration) {
		// Get reference to container, and set initial content
		var container = $(this[0]).html(duration);
		// Get reference to the interval doing the countdown
		countdown = setInterval(function () {
			// If seconds remain
			if (--duration) {
				// Update our container's message
				container.html(duration);
			// Otherwise
			} else {
				// Clear the countdown interval
				clearInterval(countdown);
				// If the time passes, we disconnect the player.
				socket.emit('countdown', {player: player.pid});   
			}
		// Run interval every 1000ms (1 second)
		}, 1000);
	};
	
	// Function to write a message in the chat.
	function writeInChat(message) {
		document.getElementById('chatlog').innerHTML = (document.getElementById('chatlog').innerHTML + message + '<br />');
	}
});