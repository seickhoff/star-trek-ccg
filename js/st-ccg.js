/*
	Scott Eickhoff
	May 2013
*/

/* 
	Parse deck into missions/dilemmas/reserve - called once
*/
function playerDeckSetup() {
	$.each(arrPlayerFullDeck, function(index, cardId) {
		if (objCardDb[cardId].type == "Mission")
			arrPlayerMissions.push(cardId);
		else if (objCardDb[cardId].type == "Dilemma")
			arrPlayerDilemmas.push(cardId);
		else
			arrPlayerDeck.push(cardId);					

	});	
}

/*
	Place player's missions on the table
*/
function placePlayerMissions() {
	var intCol = 0;
	$.each(arrPlayerMissions, function(index, cardId) {
		if (objCardDb[cardId].type == "Mission") { // [array] notation when property is a variable
			intCol++;
			// select matching multiple classes
			$("td.player.mission.c" + intCol).html("<img class='thumb' src='" + objCardDb[cardId].jpg + "'>");
			
			// set column of player's Headquarters
			if (objCardDb[cardId].missiontype == "Headquarters")
				intPlayerHeadquarters = intCol;	
		}
	});		
}

/*
	Draw an amount of cards into hand
*/
function playerDraw(intCount) {
	for (draw = 1; draw <= intCount; draw++) {
		card = arrPlayerDeck.shift();
		arrHand.push(card);
	}
	showHand();
}

/*
	New Turn
*/
function newTurn() {
	intPlayerCounter = 7;
	updateTurnSummary();
	showHand();
}

/*
	Update turn summary
*/
function updateTurnSummary() {
	$("td.turn.summary").html(strPlayerRound + ". Hand: " + arrHand.length + ", Counters Remaining: " + intPlayerCounter);	
	
	if (intPlayerCounter == 0) {
		if (arrHand.length <= 7) {
			$("td.turn.summary").append("  <button onclick=\"newTurn()\">Start New Turn</button>");
		}
	}
}

/*
	Move deployed card from hand to mission; remove from hand
*/
function deploy(cardId, col) {

	// check if enough counters are available to deploy
	if (intPlayerCounter - objCardDb[cardId].deploy >= 0) {
		intPlayerCounter = intPlayerCounter - objCardDb[cardId].deploy;
	}
	// not enough counters
	else {
		return;		
	}

	if (objCardDb[cardId].type == "Personnel" || objCardDb[cardId].type == "Ship") { // [array] notation when property is a variable
		arrPlayed[col].push(cardId);
		$("td.player.personnel.c" + col).append("<img class='thumb' src='" + objCardDb[cardId].jpg + "'> "); // select matching multiple classes
		
		imgClickToggle();
		removeFromHand(cardId);
		showHand();
		updateTurnSummary();
		updatePlayerSummary();			
	}
}

/*
	Summary bar - stats on deployed cards per mission
*/
function updatePlayerSummary() {
	$.each(arrPlayed, function(index, value) {
		if (index > 0 && index <= 5) {
			intStrength = 0;
			intIntegrity = 0;
			intCunning = 0;
			intCount = 0;
			var objSkills = { };
			var arrUnique = [ ];
			
			$.each(value, function(index, id) {
			
				// just track Personnel for strength/cunning/integrity
				if (objCardDb[id].type == "Personnel") {
			
					intStrength += objCardDb[id].strength;
					intIntegrity += objCardDb[id].integrity;
					intCunning += objCardDb[id].cunning;
					intCount++;
					
					// track unique cards
					if (objCardDb[id].unique == true)
						arrUnique.push(id);
					
					// skills
					$.each(objCardDb[id].skills, function(i, v) {
						$.each(v, function(i2, v2) {
							objSkills[v2] = objSkills[v2] + 1 || 1; // Increment counter for each value
						
						});
					});
				}
				arrUniquePlayed = arrUnique;
			});	
			
			strSkillList = joinSkills(objSkills); // join
							
			if (intCount > 0) {
				$("td.summary.c" + index).html("Personnel:&nbsp;" + intCount);					
				$("td.summary.c" + index).append(", Integrity:&nbsp;" + intIntegrity);
				$("td.summary.c" + index).append(", Cunning:&nbsp;" + intCunning);
				$("td.summary.c" + index).append(", Strength:&nbsp;" + intStrength);
				$("td.summary.c" + index).append(", " + strSkillList);
			}
			else {
				$("td.summary.c" + index).html("Personnel:&nbsp;" + intCount);					
			}
		}
	});			
}

/*
	Toggle thumbnail / full for IMG tags
	
	Call after each adding of IMG tags
*/
function imgClickToggle() {
	$("img").unbind('click.addit').bind('click.addit',  // Event Namespacing (http://www.learningjquery.com/2008/05/working-with-events-part-2)
		function() {  
			if ($(this).is(".thumb")) 
				$(this).attr("class","full");
			else
				$(this).attr("class","thumb");
			imgClickToggle();
		}
	); 
}		


/*
	Update the display for cards in hand
*/
function showHand() {
	intLastCol = 0;
	// 		<td class="player hand c14">
	for (intCol = 0; intCol < 14; intCol++) {
		cardId = arrHand[intCol];
		
		if (cardId != undefined) {
			intLastCol++;
			// show card
			$("td.player.hand.c" + (intCol + 1)).html("<img class='thumb' src='" + objCardDb[cardId].jpg + "'>");
			
			// intPlayerCounter is 0 and too many cards
			if (intPlayerCounter == 0 && arrHand.length > 7)
				$("td.player.action.c" + (intCol + 1)).html("<button onclick=\"discard('" + cardId + "')\">Discard</button>");	
			// can't be deployed: intPlayerCounter is too low
			else if (intPlayerCounter == 0 || intPlayerCounter - objCardDb[cardId].deploy < 0)
				$("td.player.action.c" + (intCol + 1)).html("");
			// can't be deployed: unique card is already deployed
			else if ($.inArray(cardId, arrUniquePlayed) != -1)
				$("td.player.action.c" + (intCol + 1)).html("");
			// show deploy button	
			else
				$("td.player.action.c" + (intCol + 1)).html("<button onclick=\"deploy('" + cardId + "', " + 
					intPlayerHeadquarters + ")\">Deploy</button>");					
		}
		else {
			// clear card
			$("td.player.hand.c" + (intCol + 1)).html("");
			// clear deploy button
			$("td.player.action.c" + (intCol + 1)).html("");	
		
		}
	}
	// Draw button
	if (intPlayerCounter > 0 && arrPlayerDeck.length > 0) {
		$("td.player.action.c" + (intLastCol + 1)).html("<button onclick=\"drawCard()\">Draw Card</button>");	
	}
	else
		$("td.player.action.c" + (intLastCol + 1)).html("");	
	
	if (arrPlayerDeck.length > 0) 		
		$("td.player.hand.c" + (intLastCol + 1)).html("<img src=\"card-back.jpg\" class=\"thumb\">");	
	
	imgClickToggle();
}

/*
	Draw Card
*/
function drawCard() {
	cardId = arrPlayerDeck.shift();
	arrHand.push(cardId);
	
	--intPlayerCounter;

	updateTurnSummary();
	showHand();
}

/*
	Discard Card
*/
function discard(cardId) {
	removeFromHand(cardId);
	updateTurnSummary();
	showHand();
}

/*
	Remove a specific card from hand
*/
function removeFromHand(card) {
	arrNewHand = [];
	match = false;
	$.each(arrHand, function(index, cardId) {
		if (cardId == card && match == false) {
			match = true;
		}
		else
		arrNewHand.push(cardId);
	});
	arrHand = arrNewHand;
}

/* 
	Basicially an advanced Join function
*/
function joinSkills(skills) {
	var arrSkills = [];
	$.each(skills, function(index, value) {
		arrSkills.push(index + ":&nbsp;" + value);
	});	
	arrSkills.sort();
	return arrSkills.join(", ");
}

/* 
	Shuffles an array
*/
function shuffle (arr) {
	for (var j, x, i = arr.length; i; j = parseInt(Math.random() * i), x = arr[--i], arr[i] = arr[j], arr[j] = x);
	return arr;
}