/*
	Scott Eickhoff
	May 2013
*/

function playMP3(soundId){
	document.getElementById("soundId").play();
}



/* 
	Parse deck into missions/dilemmas/reserve - called once
*/
function playerDeckSetup() {
	$.each(arrPlayerFullDeck_U, function(index, strCard) {

		cardId = parseCardId(strCard);
	
		if (objCardDb[cardId].type == "Mission")
			arrPlayerMissions.push(strCard);
		else if (objCardDb[cardId].type == "Dilemma")
			arrPlayerDilemmas.push(strCard);
		else
			arrPlayerDeck.push(strCard);					

	});	
}

/*
	Place player's missions on the table
*/
function placePlayerMissions() {
	var intCol = 0;
	$.each(arrPlayerMissions, function(index, strCard) {
	
		cardId = parseCardId(strCard);
	
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

/*
	Return the numeric portion of the Unique Card ID
*/
function parseUniqueId (cardId) {
	arr = cardId.split("-", 2);
	return arr[1];
}

/*
	Return the Card ID portion of the Unique Card ID
*/
function parseCardId (cardId) {
	arr = cardId.split("-", 1);
	return arr[0];
}

/*
	New Turn
*/
function newTurn() {
	intPlayerTurn++;
	intPlayerRound = 0;
	intPlayerCounter = 7;
	
	// reset Range of all ships
	resetRange();
	// reset Stooped personnel back to Unstopped
	resetStopped();
	updateTurnSummary();
	updateGroupContainer();
	showHand();
}

/*
	Turn Incrementer
*/
function nextPhase() {
	intPlayerRound++;
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
			
				if (objPlayerFullDeck_U[cardId].type == "Ship") 
					objPlayerFullDeck_U[cardId].rangeRemaining = objPlayerFullDeck_U[cardId].range;
			});		
		});
	}
}

/*
	Reset Stopped personnel back to Active
*/
function resetStopped() {

	// remove all red borders from cards in the player-personnel area
	$("td.player.personnel").find("img").removeClass("red"); 
	
	// for each Mission	
	for (intMission = 0; intMission < 5; intMission++) {

		// for each grouping on this mission
		$.each(arrPlayed[intMission], function(intGroup, arrCards) {
		
			// for each Card on this mission
			$.each(arrCards, function(intCard, cardId) {
			
				// reset Stopped to Unstopped
				if (objPlayerFullDeck_U[cardId].status == "Stopped")
					objPlayerFullDeck_U[cardId].status = "Unstopped";
			});		
		});
	}
}


/*
	Update turn summary
*/
function updateTurnSummary() {

	// advance to Orders
	if (intPlayerRound == 0 && intPlayerCounter == 0) {
		intPlayerRound = 1;
	}

	$("td.turn.summary").html(arrTurns[intPlayerRound] + ". Hand: " + arrHand.length + ", Counters Remaining: " + intPlayerCounter + ", Turn: " + intPlayerTurn + ", Score: " + intPlayerScore);	
	$("td.turn.summary").append(", Completed Planet Missions: " + intCompletedPlanetMissions + ", Completed Space Missions: " + intCompletedSpaceMissions);	
		
	// check winning condition 
	if (intPlayerScore >= 100 && intCompletedPlanetMissions >= 1 && intCompletedSpaceMissions >= 1) {
	
		$("td.turn.summary").append(", Game Over: YOU WON!");	
	
		closeOrders();
		return;
	}
	
	// check losing condition
	
	
	// Orders
	if (intPlayerRound == 1) {
		$("td.turn.summary").append("  <button onclick=\"centerListOrders()\">List Orders</button>");
		$("td.turn.summary").append("  <button onclick=\"nextPhase()\">Next Phase</button>");
	}	
	
	// Start New Turn
	if (intPlayerRound == 2 && intPlayerCounter == 0 && arrHand.length <= 7) {
		$("td.turn.summary").append("  <button onclick=\"newTurn()\">Start New Turn</button>");
	}	
	
}

function centerListOrders() {

	listOrders();
	$("#dialog").center();
}


/*
	Check if mission requirements can be met
*/
function checkMission(arrCards, missionCardId) {
	var strMissionAttribute = objPlayerFullDeck_U[missionCardId].attribute;
	var intMissionValue = objPlayerFullDeck_U[missionCardId].value;
	var arrMissionSkills = objPlayerFullDeck_U[missionCardId].skills;

	var boolMissionRequirementsMet = false;
	
	// player's skills
	var intStrength = 0;
	var intIntegrity = 0;
	var intCunning = 0;
	var intCount = 0;
	var objSkills = { };	
	
	// each card
	$.each(arrCards, function(index, cardId) {
	
		// For Active (unstopped) Personnel, sum strength/cunning/integrity and skills
		if (objPlayerFullDeck_U[cardId].type == "Personnel" && objPlayerFullDeck_U[cardId].status == "Unstopped") { 
	
			intStrength += objPlayerFullDeck_U[cardId].strength;
			intIntegrity += objPlayerFullDeck_U[cardId].integrity;
			intCunning += objPlayerFullDeck_U[cardId].cunning;
			
			// skills
			$.each(objPlayerFullDeck_U[cardId].skills, function(i, v) {
				$.each(v, function(i2, v2) {
					// new Skill, start tracking it
					if (! objSkills.hasOwnProperty(v2)) 
						objSkills[v2] = 1;
					// Increment counter for the skill
					else
						objSkills[v2] += 1; 
				});
			});
		}
	});		
	
	objSkills.Strength = intStrength;
	objSkills.Integrity = intIntegrity;
	objSkills.Cunning = intCunning;
	
	// foreach skills requirement
	$.each(arrMissionSkills, function(index1, arrSkills) {
	
		var intFails = 0;
	
		// copy of player's stats
		var objPlayersStats = jQuery.extend(true, {}, objSkills);
		
		$.each(arrSkills, function(index2, strSkill) {
	
			// Skill doesn't exist (property doesn't exist): it's a fail
			if (! objPlayersStats.hasOwnProperty(strSkill)) 
				intFails += 1;
			else
				objPlayersStats[strSkill] -= 1;
			
			// Not enough skill: it's a fail
			if (objPlayersStats[strSkill] < 0)
				intFails += 1;						
		});
		
		if (strMissionAttribute == "Strength" && objPlayersStats.Strength <= intMissionValue)
			intFails += 1;
		else if (strMissionAttribute == "Integrity" && objPlayersStats.Integrity <= intMissionValue)		
			intFails += 1;
		else if (strMissionAttribute == "Cunning" && objPlayersStats.Cunning <= intMissionValue)	
			intFails += 1;		
		
		// mission requirements met
		if (intFails == 0)
			boolMissionRequirementsMet = true;

	});
	
	return boolMissionRequirementsMet;
}


/*
	Get summary stats for a group
*/
function groupStats(intMission, intGroup) {

	var arrCards = arrPlayed[intMission][intGroup];

	// player's skills
	var intStrength = 0;
	var intIntegrity = 0;
	var intCunning = 0;
	var intCount = 0;
	var objSkills = { };	
	var intPersonnel = 0;
	
	// each card
	$.each(arrCards, function(index, cardId) {
	
		// For Active (unstopped) Personnel, sum strength/cunning/integrity and skills
		if (objPlayerFullDeck_U[cardId].type == "Personnel" && objPlayerFullDeck_U[cardId].status == "Unstopped") { 
	
			intStrength += objPlayerFullDeck_U[cardId].strength;
			intIntegrity += objPlayerFullDeck_U[cardId].integrity;
			intCunning += objPlayerFullDeck_U[cardId].cunning;
			intPersonnel++;
			
			// skills
			$.each(objPlayerFullDeck_U[cardId].skills, function(i, v) {
				$.each(v, function(i2, v2) {
					objSkills[v2] = objSkills[v2] + 1 || 1; // Increment counter for each value
				});
			});
		}
	});		
	
	strSkillList = joinSkills(objSkills); // join						
	return ("Unstopped Personnel: " + intPersonnel + ", Integrity: " + intIntegrity + ", Cunning: " + intCunning + ", Strength: " + intStrength + ", " + strSkillList);
}

/*
	Auto-pick Dilemmas for mission
*/
function missionDilemmas() {
	
	var intMission	= objDilemma.intMission;
	var intGroup = objDilemma.intGroup;

	var missionCardId = arrPlayerMissions[intMission];

	// count unstopped personnel
	var arrCards = arrPlayed[intMission][intGroup];
	var intUnstoppedPersonnel = 0;
	$.each(arrCards, function(index, cardId) {
		if (objPlayerFullDeck_U[cardId].type == "Personnel" && objPlayerFullDeck_U[cardId].status == "Unstopped") { 	
			intUnstoppedPersonnel++;
		}
	});
	
	// minus overcome dilemmas
	var arrDilemmas = arrPlayedDilemmas[intMission];
	$.each(arrDilemmas, function(index, cardId) {
		if (objPlayerFullDeck_U[cardId].overcome) { 	
			intUnstoppedPersonnel--;
		}
	});	
	
	// draw dilemma cards
	var arrDrawnDilemmas = [];
	
	for (var i = 0; i < intUnstoppedPersonnel; i++) {
		if (arrPlayerDilemmas.length == 0)
			continue;
			
		arrDrawnDilemmas.push(arrPlayerDilemmas.shift());
	}
	
	var arrSelectedDilemmas = [];
	var arrSelectedDilemmasSimpleId = [];
	var intSpent = 0;

	// select applicable dilemmas
	for (var i = 0; i < arrDrawnDilemmas.length; i++) {	
		var dilammaCardId = arrDrawnDilemmas[i];
		var dilammaCardSimpleId = parseCardId(arrDrawnDilemmas[i]);
		
		// legal dilemma
		if ((objPlayerFullDeck_U[dilammaCardId].where == "Dual" || objPlayerFullDeck_U[dilammaCardId].where == objPlayerFullDeck_U[missionCardId].missiontype) && // matching type for mission
			(objPlayerFullDeck_U[dilammaCardId].deploy + intSpent <= intUnstoppedPersonnel) && // check spent deployment amount
			($.inArray(dilammaCardSimpleId, arrSelectedDilemmasSimpleId) == -1) ) { // check if duplicate (-1: not a duplicate)
			
			arrSelectedDilemmas.push(dilammaCardId); // add card to selected dilemmas
			arrSelectedDilemmasSimpleId.push(dilammaCardSimpleId); // add card to selected dilemmas
			intSpent += objPlayerFullDeck_U[dilammaCardId].deploy; // add deploy cost to running total
		}
		// place face up back in dilemma stack
		else {
			objPlayerFullDeck_U[dilammaCardId].faceup = true;
			arrPlayerDilemmas.push(dilammaCardId);
		}
	}	

	// store selection
	objDilemma.arrSelectedDilemmas = arrSelectedDilemmas;	
	objDilemma.intDilemma = 0;

	//alert("Selected Dilemmas: " + arrSelectedDilemmas);
	
	// reveal and overcome each dilemma
	listDilemma();
}

/*
	Determine if all personnel attempting a dilemma are stopped
*/
function checkAllStopped() {
	intMission = objDilemma.intMission;
	intGroup = objDilemma.intGroup;
	
	var boolAllStopped = true;
	
	// check personnel		
	$.each(arrPlayed[intMission][intGroup], function(index, playerCardId) {
		if (objPlayerFullDeck_U[playerCardId].type == "Personnel" && objPlayerFullDeck_U[playerCardId].status == "Unstopped") { 	
			boolAllStopped = false;
		}
	});	
	
	return boolAllStopped;
}

/*
	Dilemma Modal pop-up
*/
function listDilemma() {

	var intMission = objDilemma.intMission;
	var intGroup = objDilemma.intGroup;
	var arrSelectedDilemmas = objDilemma.arrSelectedDilemmas;
	
	// check if all personnel are killed, stopped
	boolAllStopped = checkAllStopped();
	
	/* 	If all the personnel you have attempting a mission are killed, stopped, or otherwise 
		removed from the mission attempt, your personnel do not face any remaining dilemmas in 
		your opponent’s dilemma stack. Instead, those remaining dilemmas are overcome.
	*/
	if (boolAllStopped) {
		for (var i = 0; i < arrSelectedDilemmas.length; i++) {
			dilemmaCardId = arrSelectedDilemmas.shift();
			objPlayerFullDeck_U[dilemmaCardId].overcome = true;
			arrPlayedDilemmas[intMission].push(dilemmaCardId);
		}
		//$('#dialog2').hide();
	}
	
	// Have a dilemma to present
	if (arrSelectedDilemmas.length > 0) {
	
		var arrCards = arrPlayed[intMission][intGroup];

		$('#dialog').hide();

		var missionCardId = arrPlayerMissions[intMission];

		$("#dialog2").center();
		$('#dialog2').show();	
		
		var intDilemma = 0;
		
		// show and resolve each dilemma
		dilemmaCardId = arrSelectedDilemmas.shift();
		objDilemma.intDilemma = objDilemma.intDilemma + 1;
		

		var strHtml = "Dilemma # " + objDilemma.intDilemma + " on " + objPlayerFullDeck_U[missionCardId].name + "<br/><br/>" +
			"<img class='thumb' src='" + objPlayerFullDeck_U[dilemmaCardId].jpg + "'><br/>";
		
		// show div HTML content
		$("#dialog2").html(strHtml);
		
		// so dilemma images are clickable in dialog 2
		imgClickToggle();
		
		// resolve
		if (objPlayerFullDeck_U[dilemmaCardId].rule == "StopElseStopAll") {
			$("#dialog2").append(dilemmaStopElseStopAll(dilemmaCardId, arrCards));			 
		}
		else if (objPlayerFullDeck_U[dilemmaCardId].rule == "UnlessStopElseStopAll") {
			$("#dialog2").append(dilemmaUnlessStopElseStopAll(dilemmaCardId, arrCards));			 
		}
		else if (objPlayerFullDeck_U[dilemmaCardId].rule == "StopElseKill") {
			$("#dialog2").append(dilemmaStopElseKill(dilemmaCardId, arrCards));			 
		}
		else if (objPlayerFullDeck_U[dilemmaCardId].rule == "UnlessRandomKill") {
			$("#dialog2").append(dilemmaUnlessRandomKill(dilemmaCardId, arrCards));	
		}
	}
	// no dilemmas
	else {
		alert("Faced all Dilemmas");
		$('#dialog2').hide();
		scoreCompletedMission ();
	}
}




/*
	updateMissionContainer
*/
function updateMissionContainer() {

	var intMission = objDilemma.intMission;
	var missionCardId = arrPlayerMissions[intMission];

	// clear td content of specific mission
	$("td.player.mission.c" + intMission).html("");
	
	// create a div
	$("td.player.mission.c" + intMission).append("<div class=\"player mission c" + intMission + "\"style=\"border: solid 1px white; padding: 10px;\">");
	
	// add mission to div
	$("div.player.mission.c" + intMission).append("<img class='thumb' src='" + objPlayerFullDeck_U[missionCardId].jpg + "'>");
	
	// Each dilemma
	$.each(arrPlayedDilemmas[intMission], function(i, c) {
		
		// add overcome dilemma to div
		if (objPlayerFullDeck_U[c].overcome)
			$("div.player.mission.c" + intMission).append("<img class='thumb red' src='" + objPlayerFullDeck_U[c].jpg + "'/>&nbsp;"); 	
		// add dilemma to div
		else
			$("div.player.mission.c" + intMission).append("<img class='thumb' src='" + objPlayerFullDeck_U[c].jpg + "'/>&nbsp;"); 	
	});
	
	$("td.player.mission.c" + intMission).append("</div>"); 
	
	imgClickToggle();
}


/*
	Attempt mission and reveal results
*/
function attemptMission(intMission, intGroup) {

	objDilemma.intMission = intMission;
	objDilemma.intGroup = intGroup;

	var missionCardId = arrPlayerMissions[intMission];
	
	// dilemmas
	missionDilemmas();
}

function scoreCompletedMission () {

	var intMission = objDilemma.intMission;
	var intGroup = objDilemma.intGroup;
	
	var missionCardId = arrPlayerMissions[intMission];
	
	var arrCards = arrPlayed[intMission][intGroup];
	var boolResult = checkMission(arrCards, missionCardId); // mission completion possible ?

	// mission completed
	
	if (boolResult) {
		// adjust score
		intPlayerScore += objPlayerFullDeck_U[missionCardId].score;
		
		// take away mission button
		objPlayerFullDeck_U[missionCardId].completed = true;
		listOrders();
		
		if (objPlayerFullDeck_U[missionCardId].missiontype == "Planet")
			intCompletedPlanetMissions++;
		else if (objPlayerFullDeck_U[missionCardId].missiontype == "Space")
			intCompletedSpaceMissions++;
			
		// adjust mission card down
		$("td.player.mission.c" + intMission).addClass("padTop");
			
		alert("Mission Completed");
		
		// show revised score
		updateTurnSummary();
		
	}
	else {
		alert("Mission Unsuccessful");	
		
		// stop all personnel
		$.each(arrCards, function(i, c) {	
		
			if (objPlayerFullDeck_U[c].type == "Personnel") 
				objPlayerFullDeck_U[c].status = "Stopped";
		});
	}
	updateMissionContainer();
	updateGroupContainer();
}


function resetObjDilemma () {
	objDilemma.intMission = 0;
	objDilemma.intGroup = 0;
	objDilemma.arrSelectedDilemmas = [];	
	objDilemma.intDilemma = 0;
}

/*
	Modal pop-up
*/
function listOrders() {

	// clear div content
	$("#dialog").html("");
	
	var strHtml = "";
	
	// for each Mission
	for (var intMission = 0; intMission < 5; intMission++) {
			
		// count of ships
		intShips = arrPlayed[intMission].length - 1;
		
		// count of personnel on planet/headquarters
		intPlanetside = arrPlayed[intMission][0].length;

		// no personnel or ships at mission
		if (arrPlayed[intMission].length == 1 && intPlanetside == 0)
			continue;
		
		// Mission name	
		missionCardId = arrPlayerMissions[intMission];

		strHtml += "<span style='font-weight: bold; font-size: 14pt; color: #CC6666;'>" + objPlayerFullDeck_U[missionCardId].name + ": " + objPlayerFullDeck_U[missionCardId].missiontype + "</span><br/>\n";
		
		
		// for each grouping on this mission
		$.each(arrPlayed[intMission], function(intGroup, arrCards) {	
		
			// create a row and add cards only if the grouping has cards
			if (arrCards.length > 0) {
			
				// mission button
				if (! objPlayerFullDeck_U[missionCardId].completed &&
					((objPlayerFullDeck_U[missionCardId].missiontype == "Planet" && intGroup == 0) || (objPlayerFullDeck_U[missionCardId].missiontype == "Space" && intGroup > 0))) {
				
					// have ability to complete mission ?
					boolMissionReqCheck =  checkMission(arrCards, missionCardId);
					
					if (boolMissionReqCheck) {
						strHtml += "<br/><button onclick=\"attemptMission(" + intMission + ", " + intGroup + ");\">Attempt Mission</button><br/>";
					}
				}				
			
				strHtml += "<table border='0' width='100%'>\n";
							
				// show each card
				$.each(arrCards, function(intCard, cardId) {

					// PERSONNEL GROUP 0, CARD 0
					if (intGroup == 0 && intCard == 0) {
						//if (intShips == 0)
						//	strHtml += "<tr><th class='list' colspan='" + (intShips + 1) + "'>Personnel</tr>\n";
						//else
						if (intShips > 0)
							strHtml += "<tr><td><td style='text-align: center; font-size: 10pt; font-weight: bold; color: #cc99cc;' colspan='" + intShips + "'>Beam to...</tr>\n";
					}
				
					// PERSONNEL GROUP 0, CARD 0
					if (intGroup == 0) {
					
						//if (intShips > 0)
							strHtml += "<tr><td class='list'>" + objPlayerFullDeck_U[cardId].name + "<td>";
						
						// beam to ship buttons
						for (j = 0; j < intShips; j++) {
							strHtml += "<button onclick=\"beamCard(" + intMission + ", " + intGroup + ", " + intCard + ", " + (j + 1) + ");\">Ship # " + (j + 1) + "</button>";
						}
						strHtml += "</tr>\n";
					}
					// PERSONNEL GROUP 0, CARD 1+
					else if (intGroup == 0 && intCard != 0) {
					
						//if (intShips > 0)
							strHtml += "<tr><td class='list'>" + objPlayerFullDeck_U[cardId].name + "<td>";
						
						// beam to ship buttons
						for (j = 0; j < intShips; j++) {
							strHtml += "<button onclick=\"beamCard(" + intMission + ", " + intGroup + ", " + intCard + ", " + (j + 1) + ");\">Ship # " + (j + 1) + "</button>";
						}
						strHtml += "</tr>\n";				
					}
					// SHIP GROUP 1+, CARD 0 (the ship itself)
					else if (intGroup != 0 &&  intCard == 0) {
					
						// is ship staffed for movement?
						isStaffed = checkStaffed(arrCards);
					
						strHtml += "<tr><td style='text-align: left; font-size: 10pt; font-weight: bold; color: #ff9900;' colspan='" + (intShips + 1) + "'>Ship #" + 
							intGroup + ": " + objPlayerFullDeck_U[cardId].name + " (Range Remaining: " + objPlayerFullDeck_U[cardId].rangeRemaining + ")</tr>\n";
									
						var intMove = 0;
						var strHtmlMove = "<tr><td colspan='2'>";
						
						// move to other missions
						for (m = 0; m <5; m++) {
						
							// does ship have enough remaining Range?
							hasRange = checkRange(intMission, intGroup, m);						

							missionCard = arrPlayerMissions[m];
						
							if (m != intMission && isStaffed && hasRange) {
								strHtmlMove += "<button onclick=\"moveShip(" + intMission + ", " + intGroup + ", " + m + ");\">" + objPlayerFullDeck_U[missionCard].name + "</button>";
								intMove++;
							}
						}
						
						strHtmlMove += "</tr>\n";
						
						if (intMove > 0) 
							strHtml += "<tr><td style='text-align: center; font-size: 10pt; font-weight: bold; color: #cc99cc;' colspan='" + (intMove + 1) + "'>Move Ship to...</tr>\n" + strHtmlMove;	
						
					}
					// SHIP GROUP 1+, CARD 1+ (personnel on ship)
					else if (intGroup != 0 && intCard != 0) {

						// headquarters or planet mission
						missionCardId = arrPlayerMissions[intMission];
						strMissionType = objPlayerFullDeck_U[missionCardId].missiontype;					
					
						if (intCard == 1 && (strMissionType == "Headquarters" || strMissionType == "Planet"))
							strHtml += "<tr><td><td style='text-align: center; font-size: 10pt; font-weight: bold; color: #cc99cc;' colspan='" + intShips + "'>Beam to...</tr>\n";	
					
						strHtml += "<tr><td class='list' style='height: 10pt;'>" + objPlayerFullDeck_U[cardId].name + "<td>";
						
						// beam to headquarters or planet mission button
						if (strMissionType == "Headquarters" || strMissionType == "Planet") {
							strHtml += "<button onclick=\"beamCard(" + intMission + ", " + intGroup + ", " + intCard + ", " + 0 + ");\">" + strMissionType + "</button>";					
						}
												
						
						// beam to ship buttons
						for (j = 0; j < intShips; j++) {
							if (intGroup != (j +  1))
								strHtml += "<button onclick=\"beamCard(" + intMission + ", " + intGroup + ", " + intCard + ", " + (j + 1) + ");\">Ship # " + (j + 1) + "</button>";
						}
						strHtml += "</tr>\n";				
					}			
				});			
				strHtml += "</table><br/>\n";	
			}
		});
	}
	
	$("#dialog").append(strHtml);

	$("#dialog").append("<center><button onclick='closeOrders();'>Close Orders</button></center>");	

	//$("#dialog").center();
	$('#dialog').show();

}

/*
	Verify enough range is available to move a ship from one mission to another
*/
function checkRange(intSourceMission, intGroup, intDestinationMission) {
	shipCardId = parseCardId(arrPlayed[intSourceMission][intGroup][0]);
		
	startQuadrant = objCardDb[parseCardId(arrPlayerMissions[intSourceMission])].quadrant;
	endQuadrant = objCardDb[parseCardId(arrPlayerMissions[intDestinationMission])].quadrant;	
	
	startRange = objCardDb[parseCardId(arrPlayerMissions[intSourceMission])].range;
	endRange = objCardDb[parseCardId(arrPlayerMissions[intDestinationMission])].range;		

	cost = startRange + endRange;
	
	if (startQuadrant != endQuadrant)
		cost += 2;
	
	shipCardId_U = arrPlayed[intSourceMission][intGroup][0];
	
	if (objPlayerFullDeck_U[shipCardId_U].rangeRemaining >= cost)
		return true;
		
	return false;
}

/*
	move a ship from one mission to another
*/
function moveShip(intSourceMission, intGroup, intDestinationMission) {

	shipCardId = arrPlayed[intSourceMission][intGroup][0];
	
	startQuadrant = objPlayerFullDeck_U[arrPlayerMissions[intSourceMission]].quadrant;
	endQuadrant = objPlayerFullDeck_U[arrPlayerMissions[intDestinationMission]].quadrant;	
	
	startRange = objPlayerFullDeck_U[arrPlayerMissions[intSourceMission]].range;
	endRange = objPlayerFullDeck_U[arrPlayerMissions[intDestinationMission]].range;		

	cost = startRange + endRange;
	
	if (startQuadrant != endQuadrant)
		cost += 2;
	
	objPlayerFullDeck_U[shipCardId].rangeRemaining -= cost;
	
	//add Group to destination mission
	arrPlayed[intDestinationMission].push(arrPlayed[intSourceMission][intGroup]);
	
	// remove from originating mission
	arrPlayed[intSourceMission].splice(intGroup, 1);
	
	updateGroupContainer();
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
	arrStaffRequirements = objPlayerFullDeck_U[arrCards[0]].staffing[0];
	
	$.each(arrStaffRequirements, function(index, strType) {
		if (strType == "Staff")
			objStaffingRequirements.staff += 1;
		else if (strType == "Command")
			objStaffingRequirements.command += 1;
	});
	
	objStaffingPersonnel = { };
	objStaffingPersonnel.staff = 0;
	objStaffingPersonnel.command = 0;	
	
	$.each(arrCards, function(index, cardId) {

		// skip the ship card; just scan personnel
		if (objPlayerFullDeck_U[cardId].type == "Personnel" && objPlayerFullDeck_U[cardId].status == "Unstopped") {
			if (objPlayerFullDeck_U[cardId].other == "Staff")
				objStaffingPersonnel.staff += 1;
			else if (objPlayerFullDeck_U[cardId].other == "Command") {
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
	
	//document.getElementById('beam').play(); // html5
	
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
function deploy(strCard, intColumn) {

	cardId = parseCardId(strCard);

	// check if enough counters are available to deploy
	if (intPlayerCounter - objPlayerFullDeck_U[strCard].deploy >= 0) {
		intPlayerCounter = intPlayerCounter - objPlayerFullDeck_U[strCard].deploy;
	}
	// not enough counters
	else {
		return;		
	}

	// 0 = characters/equipment; 1 ship; [2...] ships
	if (objPlayerFullDeck_U[strCard].type == "Personnel" || objPlayerFullDeck_U[strCard].type == "Ship") { 
	
		if (objPlayerFullDeck_U[strCard].type == "Personnel") 
			arrPlayed[intColumn][0].push(strCard);
			
		else if (objPlayerFullDeck_U[strCard].type == "Ship") 
			arrPlayed[intColumn].push([strCard]);
		
		if (objPlayerFullDeck_U[strCard].unique) 		
			arrUniquePlayed.push(cardId);
		
		// show each group of cards in a div; each grouping: Chars, Ship1, Ship[n...]
		updateGroupContainer();
		removeFromHand(strCard);
		showHand();
		updateTurnSummary();		
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
			
				// sorting: pull ship out, sort, add ship back
				if (objPlayerFullDeck_U[arrCards[0]].type == "Ship") {
					var shipCard = arrCards.shift();
					arrCards.sort(compareNames); 
					arrCards.unshift(shipCard);
				}
				else
					arrCards.sort(compareNames); 
				
		
				$("td.player.personnel.c" + intColumn).append(
					"<div class=\"player personnel c" + intColumn + index + "\" style=\"border: solid 1px white; padding: 10px;\">"
				);
				// show each card
				$.each(arrCards, function(i, c) {
					
					//stopped
					if (objPlayerFullDeck_U[c].type == "Personnel" && objPlayerFullDeck_U[c].status == "Stopped")
						$("div.player.personnel.c" + intColumn + index).append("<img class='thumb red' src='" + objPlayerFullDeck_U[c].jpg + "'/>&nbsp;"); 	
					//unstopped
					else
						$("div.player.personnel.c" + intColumn + index).append("<img class='thumb' src='" + objPlayerFullDeck_U[c].jpg + "'/>&nbsp;"); 	
				});
				
				strStats = groupStats(intColumn, index);
				$("div.player.personnel.c" + intColumn + index).append("<br/><span style=\"color: white;\">" + strStats + "</span>");				
				
				$("td.player.personnel.c" + intColumn).append(strStats + "</div>"); 
			}
		});
	}
	imgClickToggle();
}




/*
	Toggle thumbnail / full for IMG tags
	
	Call after each adding of IMG tags
*/
function imgClickToggle() {
	$("img").unbind('click.addit').bind('click.addit',  // Event Namespacing (http://www.learningjquery.com/2008/05/working-with-events-part-2)
		function() {  
			if ($(this).is(".thumb")) 
				$(this).removeClass("thumb").addClass("full"); 

			else
				$(this).removeClass("full").addClass("thumb"); 
				
			//imgClickToggle();
		}
	); 
}		


/*
	Update the display for cards in hand
*/
function showHand() {

	arrHand.sort(compareNames); // sort

	intLastCol = 0;
	// 		<td class="player hand c14">
	for (intCol = 0; intCol < 14; intCol++) {
		strCard = arrHand[intCol];
		
		if (strCard != undefined) {
		
			cardId = parseCardId(strCard);
		
			intLastCol++;
			// show card
			$("td.player.hand.c" + (intCol + 1)).html("<img class='thumb' src='" + objPlayerFullDeck_U[strCard].jpg + "'>");
			
			// intPlayerCounter is 0 and too many cards
			if (intPlayerRound == 2 && intPlayerCounter == 0 && arrHand.length > 7)
				$("td.player.action.c" + (intCol + 1)).html("<button onclick=\"discard('" + strCard + "')\">Discard</button>");	
			// can't be deployed: intPlayerCounter is too low
			else if (intPlayerCounter == 0 || intPlayerCounter - objPlayerFullDeck_U[strCard].deploy < 0)
				$("td.player.action.c" + (intCol + 1)).html("");
			// can't be deployed: unique card is already deployed
			else if ($.inArray(cardId, arrUniquePlayed) != -1)
				$("td.player.action.c" + (intCol + 1)).html("");
			// show deploy button	
			else
				$("td.player.action.c" + (intCol + 1)).html("<button onclick=\"deploy('" + strCard + "', " + 
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

/*
	Sort by Type (descending), then Name (ascending)
*/
function compareNames(a, b) {
	var nameA = objPlayerFullDeck_U[a].name.toLowerCase( );
	var nameB = objPlayerFullDeck_U[b].name.toLowerCase( );

	var typeA = objPlayerFullDeck_U[a].type.toLowerCase( );
	var typeB = objPlayerFullDeck_U[b].type.toLowerCase( );	
	
	if (typeA > typeB) 
		return -1
	if (typeA < typeB) 
		return 1
	
	if (nameA < nameB) 
		return -1
	if (nameA > nameB) 
		return 1

	return 0;
}

Array.prototype.contains = function(v) {
    for(var i = 0; i < this.length; i++) {
        if(this[i] === v) return true;
    }
    return false;
};

Array.prototype.unique = function() {
    var arr = [];
    for(var i = 0; i < this.length; i++) {
        if(!arr.contains(this[i])) {
            arr.push(this[i]);
        }
    }
    return arr; 
}
