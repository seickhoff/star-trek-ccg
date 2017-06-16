
/*
	1. Able to resolve Dilemmas like "System Diagnostics - EN01052"
	
	"Choose a personnel who has Engineer or Programming to be stopped. 
	If you cannot, all your personnel are stopped and this dilemma returns to its owner's dilemma pile."
	
*/
function dilemmaSystemDiagnostics(dilemmaCardId, arrCards) {

	var arrSelectedDilemmas = objDilemma.arrSelectedDilemmas;

	var arrSkills = objPlayerFullDeck_U[dilemmaCardId].skills; 
	
	intStopPossibilities = 0;
	
	var strHtml = "";
	
	var distinctList = [];
	
	$.each(arrCards, function(index, playerCardId) {

		if (objPlayerFullDeck_U[playerCardId].type == "Personnel" && objPlayerFullDeck_U[playerCardId].status == "Unstopped") { 	
		
			var arrPlayerSkills = objPlayerFullDeck_U[playerCardId].skills; 
	
			$.each(objPlayerFullDeck_U[playerCardId].skills, function(intSkill_1, arrSkills_1) {
				$.each(arrSkills_1, function(intSkill, strSkill) {			
					//match
					if ($.inArray(strSkill, arrSkills) != -1) { 

						// distinct card
						if ($.inArray(playerCardId, distinctList) == -1) {
							intStopPossibilities++;
							strHtml += "<button onclick=\"stopPersonnel('" + playerCardId + "', '" + dilemmaCardId + "');\">Stop (you choose)</button> " +
								"<span class='list' id='" + playerCardId + "'>" + objPlayerFullDeck_U[playerCardId].name + "</span><br/>";
							distinctList.push(playerCardId);
						}
					}
				});
			});	
		}
	});
	
	// couldn't find a applicable card to use as a Stop selection
	if (intStopPossibilities == 0) {

		// stop all personnel		
		$.each(arrCards, function(index, playerCardId) {
			if (objPlayerFullDeck_U[playerCardId].type == "Personnel" && objPlayerFullDeck_U[playerCardId].status == "Unstopped") { 	
				objPlayerFullDeck_U[playerCardId].status = "Stopped";
			}
		});	
		
		// turn dilemma face up
		objPlayerFullDeck_U[dilemmaCardId].faceup = true;
		
		// dilemma returns to its owner's dilemma pile
		arrPlayerDilemmas.push(dilemmaCardId);
		
		strHtml += "<br/><br/>No unstopped personnel with \"" + arrSkills.join(", ") + "\" found.\n\nAll your personnel are stopped and this dilemma returns to its owner's dilemma pile.<br/><br/>";
		strHtml += "<button onclick=\"listDilemma();\">Continue...</button><br/>";
		
		updateMissionContainer();
	}

	return strHtml;	
}

/*
	Personnel selected to satisfy a "Stop" dilemma

*/
function stopPersonnel (personnelId, dilemmaId) {

	// mark personnel as stopped and update group container
	objPlayerFullDeck_U[personnelId].status = "Stopped";
	updateGroupContainer();
	groupViewerRefresh();
	
	var intMission = objDilemma.intMission;
	
	// overcome dilemma and add to mission area
	objPlayerFullDeck_U[dilemmaId].overcome = true;
	arrPlayedDilemmas[intMission].push(dilemmaId);
	
	// go to next dilemma else score mission attempt
	if (objDilemma.arrSelectedDilemmas.length > 0) {
	
		updateMissionContainer();
		listDilemma();
	}
	else {
		$('#dialog2').hide();
		scoreCompletedMission();
	}	
}

/*
	Personnel all stopped, set this unplayed dilemma as overcome
	
	"If all the personnel you have attempting a mission are killed, stopped, or otherwise 
	removed from the mission attempt, your personnel do not face any remaining dilemmas in 
	your opponent’s dilemma stack. Instead, those remaining dilemmas are overcome."
	
*/
function allStopped(dilemmaCardId) {

	var intMission = objDilemma.intMission;
	
	// overcome dilemma and add to mission area
	objPlayerFullDeck_U[dilemmaCardId].overcome = true;
	arrPlayedDilemmas[intMission].push(dilemmaCardId);	

	updateMissionContainer();
	
	strHtml = "<br/><br/>Dilemma overcome because all personnel are stopped.<br/><br/>" +
		"<button onclick=\"listDilemma();\">Continue...</button><br/>";	

	return strHtml;	
}

/* ------------------------------------------------------------------------------------------------------------- */

/*
	2. Able to resolve Dilemmas like "Wavefront - EN01060"
	
	"Unless you have a personnel who has 2 Astrometrics or a personnel who has 2 Navigation, 
	your opponent chooses an Astrometrics or Navigation personnel to be stopped. 
	
	If your opponent cannot, all your personnel are stopped and this dilemma returns to its owner's dilemma pile."
	
*/
function dilemmaWavefront(dilemmaCardId, arrCards) {

	var arrSelectedDilemmas = objDilemma.arrSelectedDilemmas;
	var intMission = objDilemma.intMission;

	var arrSkillsDilemma = objPlayerFullDeck_U[dilemmaCardId].skills; 
	
	var objSkills = { }; // for dilemma
	var arrSkills = [ ]; // list of skills on dilemma
	
	// learn the dilemmas skill requirements
	$.each(arrSkillsDilemma, function(index, arrSkill) {
		$.each(arrSkill, function(index, strSkill) {
			// simple list of skills
			arrSkills.push(strSkill);
		
			if (! objSkills.hasOwnProperty(strSkill)) 
				objSkills[strSkill] = 1;
			// Increment counter for the skill
			else
				objSkills[strSkill] += 1; 
		});	
	});
	
	arrSkills = arrSkills.unique();
	
	intSkillPossibilities = 0;
	
	$.each(arrCards, function(index, playerCardId) {

		if (objPlayerFullDeck_U[playerCardId].type == "Personnel" && objPlayerFullDeck_U[playerCardId].status == "Unstopped") { 

			var objPlayerSkills = { }; // for personel

			$.each(objPlayerFullDeck_U[playerCardId].skills, function(intSkill_1, arrSkills_1) {
				$.each(arrSkills_1, function(intSkill, strSkill) {			
					if (! objPlayerSkills.hasOwnProperty(strSkill)) 
						objPlayerSkills[strSkill] = 1;
					// Increment counter for the skill
					else
						objPlayerSkills[strSkill] += 1; 

				});
			});	
			
			// skill requirement check
			$.each(arrSkills, function(i, strSkill) {
			
				// match for "personnel who has 2 Astrometrics or a personnel who has 2 Navigation" for example			
				if (objPlayerSkills.hasOwnProperty(strSkill) && objPlayerSkills[strSkill] >= objSkills[strSkill])
					intSkillPossibilities++;
			});
		}
	});
	
	intStopPossibilities = 0;
	
	var strHtml = "";
	
	// The 'unless' condition was met
	if (intSkillPossibilities > 0) {
		objPlayerFullDeck_U[dilemmaCardId].overcome = true;
		
		// add overcome dilemma to mission area
		arrPlayedDilemmas[intMission].push(dilemmaCardId);
		
		updateMissionContainer();
		
		strHtml += "<br/><br/>A personnel with \"" + arrSkillMessage.join(" or ") + "\" was found. Dilemma overcome.<br/><br/>";
		strHtml += "<button onclick=\"listDilemma();\">Continue...</button><br/>";
	}
	//not met
	else {
	
		var distinctList = [];
		
		$.each(arrCards, function(index, playerCardId) {

			if (objPlayerFullDeck_U[playerCardId].type == "Personnel" && objPlayerFullDeck_U[playerCardId].status == "Unstopped") { 	
		
				$.each(objPlayerFullDeck_U[playerCardId].skills, function(intSkill_1, arrSkills_1) {
					$.each(arrSkills_1, function(intSkill, strSkill) {			
						//match
						if ($.inArray(strSkill, arrSkills) != -1) { 

							// distinct card
							if ($.inArray(playerCardId, distinctList) == -1) {
								intStopPossibilities++;
								strHtml += "<button onclick=\"stopPersonnel('" + playerCardId + "', '" + dilemmaCardId + "');\">Stop (oppenent chooses)</button> " +
									"<span class='list' id='" + playerCardId + "'>" + objPlayerFullDeck_U[playerCardId].name + "</span><br/>";
								distinctList.push(playerCardId);
							}
						}
					});
				});	
			}
		});
	}
	
	// couldn't find a applicable card to use as a Stop selection
	if (intStopPossibilities == 0) {

		// stop all personnel		
		$.each(arrCards, function(index, playerCardId) {
			if (objPlayerFullDeck_U[playerCardId].type == "Personnel" && objPlayerFullDeck_U[playerCardId].status == "Unstopped") { 	
				objPlayerFullDeck_U[playerCardId].status = "Stopped";
			}
		});	
		
		// turn dilemma face up
		objPlayerFullDeck_U[dilemmaCardId].faceup = true;
		
		// dilemma returns to its owner's dilemma pile
		arrPlayerDilemmas.push(dilemmaCardId);
		
		var arrSkillMessage = [];
		$.each(arrSkills, function(index, strSkill) {
			arrSkillMessage.push(objSkills[strSkill] + " " + strSkill);
		});

		strHtml += "<br/><br/>No unstopped personnel with \"" + arrSkillMessage.join(" or ") + 
			"\" found.\n\nAll your personnel are stopped and this dilemma returns to its owner's dilemma pile.<br/><br/>" +
			"<button onclick=\"listDilemma();\">Continue...</button><br/>";
		
		updateMissionContainer();
	}

	return strHtml;	
}


/* ------------------------------------------------------------------------------------------------------------- */


/*
	3. Able to resolve Dilemmas like "Command Decisions - EN01017"
	
	"Choose a personnel who has Leadership or Officer to be stopped. If you cannot, randomly select a personnel to be killed."
	
*/
function dilemmaCommandDecisions(dilemmaCardId, arrCards) {

	var intMission = objDilemma.intMission;
	var intGroup = objDilemma.intGroup;

	var arrSelectedDilemmas = objDilemma.arrSelectedDilemmas;

	var arrSkills = objPlayerFullDeck_U[dilemmaCardId].skills; 
	
	intStopPossibilities = 0;
	
	var strHtml = "";
	
	var distinctList = [];
	
	$.each(arrCards, function(index, playerCardId) {

		if (objPlayerFullDeck_U[playerCardId].type == "Personnel" && objPlayerFullDeck_U[playerCardId].status == "Unstopped") { 	
		
			var arrPlayerSkills = objPlayerFullDeck_U[playerCardId].skills; 
	
			$.each(objPlayerFullDeck_U[playerCardId].skills, function(intSkill_1, arrSkills_1) {
				$.each(arrSkills_1, function(intSkill, strSkill) {			
					//match
					if ($.inArray(strSkill, arrSkills) != -1) { 

						// distinct card
						if ($.inArray(playerCardId, distinctList) == -1) {
							intStopPossibilities++;
							strHtml += "<button onclick=\"stopPersonnel('" + playerCardId + "', '" + dilemmaCardId + "');\">Stop (you choose)</button> " +
								"<span class='list' id='" + playerCardId + "'>" + objPlayerFullDeck_U[playerCardId].name + "</span><br/>";
							distinctList.push(playerCardId);
						}
					}
				});
			});	
		}
	});
	
	// couldn't find a applicable card to use as a Stop selection
	if (intStopPossibilities == 0) {

		var arrKillList = [ ];
	
		// create possible kill	list
		$.each(arrCards, function(index, playerCardId) {
			if (objPlayerFullDeck_U[playerCardId].type == "Personnel" && objPlayerFullDeck_U[playerCardId].status == "Unstopped") { 	
				arrKillList.push(playerCardId);
			}
		});	
	
		// randomly kill one personnel
		if (arrKillList.length > 0) {
		
			arrKillList = shuffle(arrKillList);
			var killedCardId = arrKillList.shift();		
		
			objPlayerFullDeck_U[killedCardId].status = "Killed";
			arrPlayerDiscard.push(killedCardId);
			
			var arrNew = [ ];
			$.each(arrCards, function(index, cardId) {
				if (killedCardId != cardId)
					arrNew.push(cardId);
			});
			arrPlayed[intMission][intGroup] = arrNew;

			// turn dilemma face up
			objPlayerFullDeck_U[dilemmaCardId].faceup = true;
			objPlayerFullDeck_U[dilemmaCardId].overcome = true;
			
			// add overcome dilemma to mission area
			arrPlayedDilemmas[intMission].push(dilemmaCardId);		
			updateMissionContainer();	

			strHtml += "No unstopped personnel with \"" + arrSkills.join(" or ") + "\" found.\n\n<span class='list' id='" + killedCardId + "'>" + 
				objPlayerFullDeck_U[killedCardId].name + "</span> was randomly killed.<br/><br/>" +
				"<button onclick=\"listDilemma();\">Continue...</button><br/>";
		}
	}

	return strHtml;
}


/* ------------------------------------------------------------------------------------------------------------- */

/*
	4. Able to resolve Dilemmas like "An Old Debt - EN03002"
	
	"Unless you have Biology, Physics, and Cunning > 32 or Intelligence and 2 Medical, 
	randomly select a Leadership personnel to be killed."
	
*/
function dilemmaAnOldDebt(dilemmaCardId, arrCards) {

	var intMission = objDilemma.intMission;
	var intGroup = objDilemma.intGroup;
	var arrSelectedDilemmas = objDilemma.arrSelectedDilemmas;

	var arrSkillsDilemma = objPlayerFullDeck_U[dilemmaCardId].skills; 
	var arrAbilityNameDilemma = objPlayerFullDeck_U[dilemmaCardId].abilityname;
	var arrAbilityValueDilemma = objPlayerFullDeck_U[dilemmaCardId].abilityvalue;
	var strSkillKill = objPlayerFullDeck_U[dilemmaCardId].skillkill;
	
	var arrKillList = [];
	var strHtml = "";
	
	// player's skills
	var intStrength = 0;
	var intIntegrity = 0;
	var intCunning = 0;
	var intCount = 0;
	var objSkills = { };	
	
	// each Player card
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
					
					if (v2 == strSkillKill)
						arrKillList.push(cardId);		

				});
			});			
		}
	});		
	
	objSkills.Strength = intStrength;
	objSkills.Integrity = intIntegrity;
	objSkills.Cunning = intCunning;
	
	intRequirementsMetFails = 0;
	
	// learn the dilemmas skill requirements
	$.each(arrSkillsDilemma, function(index1, arrSkill) {
		
		// copy of player's stats
		var objPlayersStats = jQuery.extend(true, {}, objSkills);
		var intFails = 0;
	
		// one group dilemmas skill requirements
		$.each(arrSkill, function(index2, strSkill) {
		
			// Skill doesn't exist (property doesn't exist): it's a fail
			if (! objPlayersStats.hasOwnProperty(strSkill)) 
				intFails += 1;
			else
				objPlayersStats[strSkill] -= 1;
			
			// Not enough skill: it's a fail
			if (objPlayersStats[strSkill] < 0)
				intFails += 1;	
		});	
		
		var strAbilityName = arrAbilityNameDilemma[index1];
		var strAbilityValue = arrAbilityValueDilemma[index1];
		
		if (objPlayersStats[strAbilityName] <= strAbilityValue)
			intFails += 1;
			
		if (intFails > 0)		
			intRequirementsMetFails++;
	});	
	
	// requirements failed
	if (! (intRequirementsMetFails < arrSkillsDilemma.length)) {
	
		var killedCardId = "";
	
		// kill a card if one meets requirements
		if (arrKillList.length > 0) {
		
			arrKillList = arrKillList.unique();
			arrKillList = shuffle(arrKillList);
			killedCardId = arrKillList.shift();		
		
			objPlayerFullDeck_U[killedCardId].status = "Killed";
			arrPlayerDiscard.push(killedCardId);
			
			// take killed card out of group
			var arrNew = [ ];
			$.each(arrCards, function(index, cardId) {
				if (killedCardId != cardId)
					arrNew.push(cardId);
			});
			arrPlayed[intMission][intGroup] = arrNew;
			
			strHtml += "No unstopped personnel with required skills found.\n\n<span class='list' id='" + killedCardId + "'>" + 
				objPlayerFullDeck_U[killedCardId].name + "</span> having \"" + strSkillKill + "\" was randomly killed.<br/><br/>" +
				"<button onclick=\"listDilemma();\">Continue...</button><br/>";
		}
		else {
			strHtml += "No personnel having \"" + strSkillKill + "\" to kill.  Dilemma overcome.<br/><br/>";
			strHtml += "<button onclick=\"listDilemma();\">Continue...</button><br/>";		
		}
	}
	else {
		strHtml += "Dilemma requirements met.  Dilemma overcome.<br/><br/>";
		strHtml += "<button onclick=\"listDilemma();\">Continue...</button><br/>";	
	}
	
	// turn dilemma face up
	objPlayerFullDeck_U[dilemmaCardId].faceup = true;	
	objPlayerFullDeck_U[dilemmaCardId].overcome = true;
	
	// add overcome dilemma to mission area
	arrPlayedDilemmas[intMission].push(dilemmaCardId);
	
	updateMissionContainer();	
	
	return strHtml;
}

/* ------------------------------------------------------------------------------------------------------------- */

/*
	5. Able to resolve Dilemmas like "Pinned Down" - EN01043

	"Randomly select a personnel to be stopped. 
	If you still have nine personnel remaining, randomly select a second personnel to be stopped. 
	If you still have ten personnel remaining, randomly select a third personnel to be stopped."

*/
function dilemmaPinnedDown(dilemmaCardId, arrCards) {

	var intMission = objDilemma.intMission;
	var intGroup = objDilemma.intGroup;
	var arrSelectedDilemmas = objDilemma.arrSelectedDilemmas;
	
	var strHtml = "";
	var arrUnstopped = [];
	
	// unstopped personnel
	$.each(arrCards, function(index, playerCardId) {
		if (objPlayerFullDeck_U[playerCardId].type == "Personnel" && objPlayerFullDeck_U[playerCardId].status == "Unstopped") {
			arrUnstopped.push(playerCardId);
		}
	});
	
	if (arrUnstopped.length >= 1) {
		arrUnstopped = shuffle(arrUnstopped);
		var stopCardId = arrUnstopped.shift();
		objPlayerFullDeck_U[stopCardId].status = "Stopped";	
		
		strHtml += "<span class='list' id='" + stopCardId + "'>" + objPlayerFullDeck_U[stopCardId].name + "</span> was randomly stopped.<br/><br/>";	
	}
	if (arrUnstopped.length >= 9) {
		arrUnstopped = shuffle(arrUnstopped);
		var stopCardId = arrUnstopped.shift();
		objPlayerFullDeck_U[stopCardId].status = "Stopped";	
		
		strHtml += "<span class='list' id='" + stopCardId + "'>" + objPlayerFullDeck_U[stopCardId].name + "</span> was randomly stopped.<br/><br/>";	
	}
	if (arrUnstopped.length >= 10) {
		arrUnstopped = shuffle(arrUnstopped);
		var stopCardId = arrUnstopped.shift();
		objPlayerFullDeck_U[stopCardId].status = "Stopped";	
		
		strHtml += "<span class='list' id='" + stopCardId + "'>" + objPlayerFullDeck_U[stopCardId].name + "</span> was randomly stopped.<br/><br/>";	
	}

	strHtml += "<button onclick=\"listDilemma();\">Continue...</button><br/>";	

	// turn dilemma face up
	objPlayerFullDeck_U[dilemmaCardId].faceup = true;	
	objPlayerFullDeck_U[dilemmaCardId].overcome = true;
	
	// add overcome dilemma to mission area
	arrPlayedDilemmas[intMission].push(dilemmaCardId);
	
	updateMissionContainer();
	return strHtml;
	
}

/* ------------------------------------------------------------------------------------------------------------- */

/*
	6. Able to resolve Dilemmas like "Limited Welcome" - EN01034

	"Randomly select nine personnel. 
	All your other personnel are stopped. 
	Place this dilemma on this mission. 
	When you attempt this mission again, after you opponent draws dilemmas, he or she may take this dilemma and add it to those drawn."

*/
function dilemmaLimitedWelcome(dilemmaCardId, arrCards) {

	var intMission = objDilemma.intMission;
	var intGroup = objDilemma.intGroup;
	var arrSelectedDilemmas = objDilemma.arrSelectedDilemmas;
	
	var strHtml = "";
	var arrUnstopped = [];
	
	// unstopped personnel
	$.each(arrCards, function(index, playerCardId) {
		if (objPlayerFullDeck_U[playerCardId].type == "Personnel" && objPlayerFullDeck_U[playerCardId].status == "Unstopped") {
			arrUnstopped.push(playerCardId);
		}
	});
	
	if (arrUnstopped.length > 9) {
	
		arrUnstopped = shuffle(arrUnstopped);

		// Randomly select nine personnel. All your other personnel are stopped.		
		$.each(arrUnstopped, function(index, playerCardId) {
			if (index >= 9) {
				objPlayerFullDeck_U[playerCardId].status = "Stopped";	
				strHtml += "<span class='list' id='" + playerCardId + "'>" + objPlayerFullDeck_U[playerCardId].name + "</span> was randomly stopped.<br/><br/>";	
			}
		});
	}
	
	strHtml += "<button onclick=\"listDilemma();\">Continue...</button><br/>";	

	// turn dilemma face up; but leave it not overcome
	objPlayerFullDeck_U[dilemmaCardId].faceup = true;	
	objPlayerFullDeck_U[dilemmaCardId].overcome = false;
	
	// add dilemma to mission area
	arrPlayedDilemmas[intMission].push(dilemmaCardId);
	
	updateMissionContainer();
	return strHtml;
	
}

/* ------------------------------------------------------------------------------------------------------------- */

/*
	7. Able to resolve Dilemmas like "Ornaran Threat - EN01041"

	"Randomly select a personnel to be stopped. 
	Unless you have Diplomacy and Medical or 2 Security, that personnel is killed instead, 
	then all your other personnel are stopped 
	and this dilemma returns to its owner's dilemma pile."

*/
function dilemmaOrnaranThreat(dilemmaCardId, arrCards) {

	var strHtml = "";
	
	var arrRandom = [];
	
	// pick random
	$.each(arrCards, function(index, playerCardId) {

		if (objPlayerFullDeck_U[playerCardId].type == "Personnel" && objPlayerFullDeck_U[playerCardId].status == "Unstopped") 
			arrRandom.push(playerCardId);	
	});
	
	arrRandom = shuffle(arrRandom);

	// card to be stopped or killed
	targetCardId = arrRandom.shift();
	

	// learn players skills
	// player's skills
	var objSkills = { };	
	
	// each Player card
	$.each(arrCards, function(index, cardId) {
	
		// For Active (unstopped) Personnel, sum strength/cunning/integrity and skills
		if (objPlayerFullDeck_U[cardId].type == "Personnel" && objPlayerFullDeck_U[cardId].status == "Unstopped") { 
	
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
	
	var arrSkillsDilemma = objPlayerFullDeck_U[dilemmaCardId].skills; 	
	intRequirementsMetFails = 0;
	
	// learn the dilemmas skill requirements
	$.each(arrSkillsDilemma, function(index1, arrSkill) {
		
		// copy of player's stats
		var objPlayersStats = jQuery.extend(true, {}, objSkills);
		var intFails = 0;
	
		// one group dilemmas skill requirements
		$.each(arrSkill, function(index2, strSkill) {
		
			// Skill doesn't exist (property doesn't exist): it's a fail
			if (! objPlayersStats.hasOwnProperty(strSkill)) 
				intFails += 1;
			else
				objPlayersStats[strSkill] -= 1;
			
			// Not enough skill: it's a fail
			if (objPlayersStats[strSkill] < 0)
				intFails += 1;	
		});	
		
		if (intFails > 0)		
			intRequirementsMetFails++;
	});		
	
	// pass skill check
	if (! (intRequirementsMetFails < arrSkillsDilemma.length)) {

		// stop personnel
		objPlayerFullDeck_U[targetCardId].status = "Stopped";
		
		strHtml += "<span class='list' id='" + targetCardId + "'>" + objPlayerFullDeck_U[targetCardId].name + 
			"</span> was randomly stopped.  Skills were met and this dilemma is overcome.<br/><br/>" +
			"<button onclick=\"listDilemma();\">Continue...</button><br/>";			
		
		objPlayerFullDeck_U[dilemmaCardId].overcome = true;
		// add dilemma to mission area
		arrPlayedDilemmas[intMission].push(dilemmaCardId);
	}
	// failed skill check
	else {
	
		// kill personnel
		objPlayerFullDeck_U[targetCardId].status = "Killed";
		arrPlayerDiscard.push(targetCardId);
		
		// take killed card out of group
		var arrNew = [ ];
		$.each(arrCards, function(index, cardId) {
			if (targetCardId != cardId)
				arrNew.push(cardId);
		});
		arrPlayed[intMission][intGroup] = arrNew;
	
		// stop all personnel		
		$.each(arrCards, function(index, playerCardId) {
			if (objPlayerFullDeck_U[playerCardId].type == "Personnel" && objPlayerFullDeck_U[playerCardId].status == "Unstopped") { 	
				objPlayerFullDeck_U[playerCardId].status = "Stopped";
			}
		});	
		
		// turn dilemma face up
		objPlayerFullDeck_U[dilemmaCardId].faceup = true;
		
		// dilemma returns to its owner's dilemma pile
		arrPlayerDilemmas.push(dilemmaCardId);
		
		strHtml += "<span class='list' id='" + targetCardId + "'>" + objPlayerFullDeck_U[targetCardId].name + 
			"</span> was randomly killed. All other personnel are stopped and this dilemma returns to its owners dilemma pile.<br/><br/>" +
			"<button onclick=\"listDilemma();\">Continue...</button><br/>";	
	}
	
	updateMissionContainer();

	return strHtml;	
}


/* ------------------------------------------------------------------------------------------------------------- */

/*
	8. Able to resolve Dilemmas like "Sokath, His Eyes Uncovered! - EN03030"
	
	"Unless you have 2 Diplomacy or Cunning > 35, all your personnel are stopped and this dilemma returns to its owner's dilemma pile."
	
*/
function dilemmaSokath(dilemmaCardId, arrCards) {

	var intMission = objDilemma.intMission;
	var intGroup = objDilemma.intGroup;
	var arrSelectedDilemmas = objDilemma.arrSelectedDilemmas;

	var arrSkillsDilemma = objPlayerFullDeck_U[dilemmaCardId].skills; 
	var arrAbilityNameDilemma = objPlayerFullDeck_U[dilemmaCardId].abilityname;
	var arrAbilityValueDilemma = objPlayerFullDeck_U[dilemmaCardId].abilityvalue;
	var strSkillKill = objPlayerFullDeck_U[dilemmaCardId].skillkill;
	
	var arrKillList = [];
	var strHtml = "";
	
	// player's skills
	var intStrength = 0;
	var intIntegrity = 0;
	var intCunning = 0;
	var intCount = 0;
	var objSkills = { };	
	
	// each Player card
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
					
					if (v2 == strSkillKill)
						arrKillList.push(cardId);		

				});
			});			
		}
	});		
	
	objSkills.Strength = intStrength;
	objSkills.Integrity = intIntegrity;
	objSkills.Cunning = intCunning;
	
	intRequirementsMetFails = 0;
	
	// learn the dilemmas skill requirements
	$.each(arrSkillsDilemma, function(index1, arrSkill) {
		
		// copy of player's stats
		var objPlayersStats = jQuery.extend(true, {}, objSkills);
		var intFails = 0;
	
		// one group dilemmas skill requirements
		$.each(arrSkill, function(index2, strSkill) {
		
			// Skill doesn't exist (property doesn't exist): it's a fail
			if (! objPlayersStats.hasOwnProperty(strSkill)) 
				intFails += 1;
			else
				objPlayersStats[strSkill] -= 1;
			
			// Not enough skill: it's a fail
			if (objPlayersStats[strSkill] < 0)
				intFails += 1;	
		});	
		
		var strAbilityName = arrAbilityNameDilemma[index1];
		var strAbilityValue = arrAbilityValueDilemma[index1];
		
		if (objPlayersStats[strAbilityName] <= strAbilityValue)
			intFails += 1;
			
		if (intFails > 0)		
			intRequirementsMetFails++;
	});	

	// requirements failed
	if (! (intRequirementsMetFails < arrSkillsDilemma.length)) {
	
		// stop all personnel		
		$.each(arrCards, function(index, playerCardId) {
			if (objPlayerFullDeck_U[playerCardId].type == "Personnel" && objPlayerFullDeck_U[playerCardId].status == "Unstopped") { 	
				objPlayerFullDeck_U[playerCardId].status = "Stopped";
			}
		});	
		
		// dilemma returns to its owner's dilemma pile
		arrPlayerDilemmas.push(dilemmaCardId);	
		
		strHtml += "<br/>All personnel are stopped and this dilemma returns to its owners dilemma pile.<br/><br/>";
		strHtml += "<button onclick=\"listDilemma();\">Continue...</button><br/>";			
	}
	else {
		// overcome
		objPlayerFullDeck_U[dilemmaCardId].overcome = true;
		
		// add overcome dilemma to mission area
		arrPlayedDilemmas[intMission].push(dilemmaCardId);		
		
		strHtml += "<br/>Dilemma requirements met.  Dilemma overcome.<br/><br/>";
		strHtml += "<button onclick=\"listDilemma();\">Continue...</button><br/>";	
	}

	// turn dilemma face up
	objPlayerFullDeck_U[dilemmaCardId].faceup = true;	
	
	updateMissionContainer();	
	
	return strHtml;
}

