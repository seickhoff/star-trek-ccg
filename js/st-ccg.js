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
			// select matching multiple classes
			$("td.player.mission.c" + intCol).html("<img class='thumb' src='" + objCardDb[cardId].jpg + "'>");
			
			// set column of player's Headquarters
			if (objCardDb[cardId].missiontype == "Headquarters")
				intPlayerHeadquarters = intCol;	
			
			intCol++;
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

function parseUniqueId (cardId) {
	arr = cardId.split("-", 2);
	return arr[1];
}
function parseCardId (cardId) {
	arr = cardId.split("-", 1);
	return arr[0];
}

/*
	New Turn
*/
function newTurn() {
	intPlayerTurn = 0;
	intPlayerCounter = 7;
	
	// reset Range of all ships
	resetRange();
	updateTurnSummary();
	showHand();
}

/*
	Turn Incrementer
*/
function nextPhase() {
	intPlayerTurn++;
	closeOrders();
	showHand();
	updateTurnSummary();
}

/*
	Reset Remaining Range back to Ship's default Range
*/
function resetRange() {
	// for each Mission
	for (intMission = 0; intMission < 5; intMission++) {

		// for each grouping on this mission
		$.each(arrPlayed[intMission], function(intGroup, arrCards) {
		
			// for each Card on this mission
			$.each(arrCards, function(intCard, cardId) {
			
				if (objCardDb[cardId].type == "Ship") 
					objCardDb[cardId].rangeRemaining = objCardDb[cardId].range;
				
			});		
		});
	}
}


/*
	Update turn summary
*/
function updateTurnSummary() {

	// advance to Orders
	if (intPlayerTurn == 0 && intPlayerCounter == 0) {
		intPlayerTurn = 1;
	}

	$("td.turn.summary").html(arrTurns[intPlayerTurn] + ". Hand: " + arrHand.length + ", Counters Remaining: " + intPlayerCounter);	
	
	// Orders
	if (intPlayerTurn == 1) {
		$("td.turn.summary").append("  <button onclick=\"centerListOrders()\">List Orders</button>");
		$("td.turn.summary").append("  <button onclick=\"nextPhase()\">Next Phase</button>");
	}	
	
	// Start New Turn
	if (intPlayerTurn == 2 && intPlayerCounter == 0 && arrHand.length <= 7) {
		$("td.turn.summary").append("  <button onclick=\"newTurn()\">Start New Turn</button>");
	}	
	
}

function centerListOrders() {

	listOrders();
		$("#dialog").center();
}

/*
	Modal pop-up
*/
function listOrders() {

	intMission = intPlayerHeadquarters; // column

	// clear div content
	$("#dialog").html("");
	
	var strHtml = "";
	
	// for each Mission
	for (intMission = 0; intMission < 5; intMission++) {
			
		// count of ships
		intShips = arrPlayed[intMission].length - 1;
		
		// count of personnel on planet/headquarters
		intPlanetside = arrPlayed[intMission][0].length;


		// no personnel or ships at mission
		if (arrPlayed[intMission].length == 1 && intPlanetside == 0)
			continue;
		
		// Mission name		
		strHtml += "<span style='font-weight: bold; font-size: 14pt; color: #003366;'>" + objCardDb[arrPlayerMissions[intMission]].name + "</span><br/><br/>\n";
		
		// for each grouping on this mission
		$.each(arrPlayed[intMission], function(intGroup, arrCards) {
		

			
			// create a row and add cards only if the grouping has cards
			if (arrCards.length > 0) {
			
				strHtml += "<table border=0>\n";
			
				
				// show each card
				$.each(arrCards, function(intCard, cardId) {

					// PERSONNEL GROUP 0, CARD 0
					if (intGroup == 0 && intCard == 0) {
						if (intShips == 0)
							strHtml += "<tr><th class='list' colspan='" + (intShips + 1) + "'>Personnel</tr>\n";
						else
							strHtml += "<tr><th class='list'>Personnel<th class='list' colspan='" + intShips + "'>Beam</tr>\n";
					}
				
					// PERSONNEL GROUP 0, CARD 0
					if (intGroup == 0) {

						strHtml += "<tr><td class='list'>" + objCardDb[cardId].name;
						
						// beam to ship buttons
						for (j = 0; j < intShips; j++) {
							strHtml += "<td><button onclick=\"beamCard(" + intMission + ", " + intGroup + ", " + intCard + ", " + (j + 1) + ");\">Ship # " + (j + 1) + "</button>";
						}
						strHtml += "</tr>\n";
					}
					// PERSONNEL GROUP 0, CARD 1+
					else if (intGroup == 0 && intCard != 0) {
					
						strHtml += "<tr><td class='list'>" + objCardDb[cardId].name;
						
						// beam to ship buttons
						for (j = 0; j < intShips; j++) {
							strHtml += "<td><button onclick=\"beamCard(" + intMission + ", " + intGroup + ", " + intCard + ", " + (j + 1) + ");\">Ship # " + (j + 1) + "</button>";
						}
						strHtml += "</tr>\n";				
					}
					// SHIP GROUP 1+, CARD 0 (the ship itself)
					else if (intGroup != 0 &&  intCard == 0) {
					
						// is ship staffed for movement?
						isStaffed = checkStaffed(arrCards);
					
						strHtml += "<tr><td style='text-align: left; font-size: 10pt; font-weight: bold;' colspan='" + (intShips + 1) + "'>Ship #" + 
							intGroup + ": " + objCardDb[cardId].name + " (Range Remaining: " + objCardDb[cardId].rangeRemaining + ")</tr>\n";
						
						strHtml += "<tr><th class='list' colspan='" + (intShips + 1) + "'>";
						
						// move to other missions
						for (m = 0; m <5; m++) {
						
							// does ship have enough remaining Range?
							hasRange = checkRange(intMission, intGroup, m);						
						
							missionCard = arrPlayerMissions[m];
						
							if (m != intMission && isStaffed && hasRange)
								strHtml += "<button onclick=\"moveShip(" + intMission + ", " + intGroup + ", " + m + ");\">" + objCardDb[missionCard].name + "</button>";
						}
						strHtml += "</tr>\n";
					}
					// SHIP GROUP 1+, CARD 1+ (personnel on ship)
					else if (intGroup != 0 && intCard != 0) {
								
						strHtml += "<tr><td class='list'>" + objCardDb[cardId].name;
						
						// headquarters or planet mission
						missionCardId = arrPlayerMissions[intMission];
						strMissionType = objCardDb[missionCardId].missiontype;

						// beam to headquarters or planet mission button
						if (strMissionType == "Headquarters" || strMissionType == "Planet") {
							strHtml += "<td><button onclick=\"beamCard(" + intMission + ", " + intGroup + ", " + intCard + ", " + 0 + ");\">" + strMissionType + "</button>";					
						}
						
						// beam to ship buttons
						for (j = 0; j < intShips; j++) {
							if (intGroup != (j +  1))
								strHtml += "<td><button onclick=\"beamCard(" + intMission + ", " + intGroup + ", " + intCard + ", " + (j + 1) + ");\">Ship # " + (j + 1) + "</button>";
						}
						strHtml += "</tr>\n";				
					}			
				});			
				strHtml += "</table><br/>\n";	
			}
		});
	}
	
	$("#dialog").append(strHtml);

	$("#dialog").append("<button onclick='closeOrders();'>Close Orders</button>");	

	//$("#dialog").center();
	$('#dialog').show();

}

/*
	verify range is available to move a ship from one mission to another
*/
function checkRange(intSourceMission, intGroup, intDestinationMission) {
	shipCardId = arrPlayed[intSourceMission][intGroup][0];
	
	startQuadrant = objCardDb[arrPlayerMissions[intSourceMission]].quadrant;
	endQuadrant = objCardDb[arrPlayerMissions[intDestinationMission]].quadrant;	
	
	startRange = objCardDb[arrPlayerMissions[intSourceMission]].range;
	endRange = objCardDb[arrPlayerMissions[intDestinationMission]].range;		

	cost = startRange + endRange;
	
	if (startQuadrant != endQuadrant)
		cost += 2;
	
	if (objCardDb[shipCardId].rangeRemaining >= cost)
		return true;
		
	return false;
}

/*
	move a ship from one mission to another
*/
function moveShip(intSourceMission, intGroup, intDestinationMission) {

	shipCardId = arrPlayed[intSourceMission][intGroup][0];
	
	startQuadrant = objCardDb[arrPlayerMissions[intSourceMission]].quadrant;
	endQuadrant = objCardDb[arrPlayerMissions[intDestinationMission]].quadrant;	
	
	startRange = objCardDb[arrPlayerMissions[intSourceMission]].range;
	endRange = objCardDb[arrPlayerMissions[intDestinationMission]].range;		

	cost = startRange + endRange;
	
	if (startQuadrant != endQuadrant)
		cost += 2;
	
	objCardDb[shipCardId].rangeRemaining -= cost;
	
	//add Group to destination mission
	arrPlayed[intDestinationMission].push(arrPlayed[intSourceMission][intGroup]);
	
	// remove from originating mission
	arrPlayed[intSourceMission].splice(intGroup, 1);
	
	updateGroupContainer();
	imgClickToggle();
	updatePlayerSummary();		
	listOrders();	
}
/*
	Check if a Ship is staffed; supply the Group (array of shift and personnel onboard)
*/
function checkStaffed(arrCards) {
	
	objStaffingRequirements = { };
	objStaffingRequirements.staff = 0;
	objStaffingRequirements.command = 0;
	
	// get staff requirements from ship card
	arrStaffRequirements = objCardDb[arrCards[0]].staffing[0];
	
	$.each(arrStaffRequirements, function(index, strType) {
		if (strType == "Staff")
			objStaffingRequirements.staff += 1;
		else if (strType == "Command")
			objStaffingRequirements.command += 1;
	});
	
	//alert(objStaffingRequirements.staff + " : " + objStaffingRequirements.command);

	objStaffingPersonnel = { };
	objStaffingPersonnel.staff = 0;
	objStaffingPersonnel.command = 0;	
	
	$.each(arrCards, function(index, cardId) {

		// skip the ship card; just scan personnel
		if (objCardDb[cardId].type == "Personnel") {
			if (objCardDb[cardId].other == "Staff")
				objStaffingPersonnel.staff += 1;
			else if (objCardDb[cardId].other == "Command") {
				objStaffingPersonnel.command += 1;
			}
		}
	});
	
	intCommand = objStaffingRequirements.command - objStaffingPersonnel.command;
	
	// not enough command
	if (intCommand > 0)
		return false;
	else {
		// add the remaining Command as Satff
		objStaffingPersonnel.staff += Math.abs(intCommand);
	}
	
	
	if (objStaffingPersonnel.staff >= objStaffingRequirements.staff)
		return true;
	
	return false;
}


function beamCard(intMission, intOldGroup, intCard, intNewGroup) {
	sourceCardId = arrPlayed[intMission][intOldGroup][intCard];
	
	//remove card
	arrNew = [];
	arrCards = arrPlayed[intMission][intOldGroup];
	$.each(arrCards, function(i, cardId) {
		if (i != intCard)
			arrNew.push(cardId);
	});
	arrPlayed[intMission][intOldGroup] = arrNew;
	
	arrnew = arrPlayed[intMission][intNewGroup];
	arrnew.push(sourceCardId);
	arrPlayed[intMission][intNewGroup] = arrnew;
	
	updateGroupContainer();
	imgClickToggle();
	updatePlayerSummary();		
	listOrders();
	
}

function closeOrders() {
	$('#dialog').hide();
}

/*
	DIV centering function
*/
jQuery.fn.center = function () {
    this.css("position","absolute");
    this.css("top", Math.max(0, (($(window).height() - $(this).outerHeight()) / 2) + $(window).scrollTop()) + "px");
    this.css("left", Math.max(0, (($(window).width() - $(this).outerWidth()) / 2) + $(window).scrollLeft()) + "px");
    return this;
}


/*
	Move deployed card from hand to mission; remove from hand
*/
function deploy(cardId, intColumn) {

	// check if enough counters are available to deploy
	if (intPlayerCounter - objCardDb[cardId].deploy >= 0) {
		intPlayerCounter = intPlayerCounter - objCardDb[cardId].deploy;
	}
	// not enough counters
	else {
		return;		
	}

	// 0 = characters/equipment; 1 ship; [2...] ships
	if (objCardDb[cardId].type == "Personnel" || objCardDb[cardId].type == "Ship") { 
	
		if (objCardDb[cardId].type == "Personnel") 
			arrPlayed[intColumn][0].push(cardId);
			
		else if (objCardDb[cardId].type == "Ship") 
			arrPlayed[intColumn].push([cardId]);
		
		// show each group of cards in a div; each grouping: Chars, Ship1, Ship[n...]
		updateGroupContainer();

		imgClickToggle();
		removeFromHand(cardId);
		showHand();
		updateTurnSummary();
		updatePlayerSummary();			
	}
}


/*
	for all missions, show each group of cards its own div; each grouping: Chars/Equip, Ship1, Ship[n...]
*/
function updateGroupContainer() {

	// for all missions
	for (intColumn = 0; intColumn < 5; intColumn++) {

		// clear td content
		$("td.player.personnel.c" + intColumn).html("");
		
		// for each grouping on this mission
		$.each(arrPlayed[intColumn], function(index, arrCards) {
		
			// create a div and add cards only if the grouping has cards
			if (arrCards.length > 0) {
		
				$("td.player.personnel.c" + intColumn).append(
					"<div class=\"player personnel c" + intColumn + index + "\"style=\"border: solid 1px white; padding: 10px;\">"
				);
				// show each card
				$.each(arrCards, function(i, c) {
					
					$("div.player.personnel.c" + intColumn + index).append(
						"<img class='thumb' src='" + objCardDb[c].jpg + "'/>&nbsp;"
					); 				
					
				});
				$("td.player.personnel.c" + intColumn).append("</div>"); 
			}
		});
	}
}


/*
	Summary bar - stats on deployed cards per mission
*/
function updatePlayerSummary() {

	// each mission
	$.each(arrPlayed, function(intColumn, arrGroup) {

		var intStrength = 0;
		var intIntegrity = 0;
		var intCunning = 0;
		var intCount = 0;
		var objSkills = { };
		var arrUnique = [ ];	

		// each grouping: Chars, Ship1, Ship[n...]
		$.each(arrGroup, function(index1, arrCards) {		

			// each card
			$.each(arrCards, function(index2, cardId) {

				//if (cardId == undefined)
				//	return true; // jQuery continue
			
				// just track Personnel for strength/cunning/integrity
				if (objCardDb[cardId].type == "Personnel") {
			
					intStrength += objCardDb[cardId].strength;
					intIntegrity += objCardDb[cardId].integrity;
					intCunning += objCardDb[cardId].cunning;
					intCount++;
					
					// track unique cards
					if (objCardDb[cardId].unique == true)
						arrUnique.push(cardId);
					
					// skills
					$.each(objCardDb[cardId].skills, function(i, v) {
						$.each(v, function(i2, v2) {
							objSkills[v2] = objSkills[v2] + 1 || 1; // Increment counter for each value
						
						});
					});
				}
				arrUniquePlayed = arrUnique;
			});	
			
			strSkillList = joinSkills(objSkills); // join
							
			if (intCount > 0) {
				$("td.summary.c" + intColumn).html("Personnel:&nbsp;" + intCount);					
				$("td.summary.c" + intColumn).append(", Integrity:&nbsp;" + intIntegrity);
				$("td.summary.c" + intColumn).append(", Cunning:&nbsp;" + intCunning);
				$("td.summary.c" + intColumn).append(", Strength:&nbsp;" + intStrength);
				$("td.summary.c" + intColumn).append(", " + strSkillList);
			}
			else {
				$("td.summary.c" + intColumn).html("Personnel:&nbsp;" + intCount);					
			}
		});
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
			if (intPlayerTurn == 2 && intPlayerCounter == 0 && arrHand.length > 7)
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
function shuffle(arr) {
	for (var j, x, i = arr.length; i; j = parseInt(Math.random() * i), x = arr[--i], arr[i] = arr[j], arr[j] = x);
	return arr;
}


