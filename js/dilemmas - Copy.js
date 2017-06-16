
/*
	1. Able to resolve Dilemmas like "System Diagnostics - EN01052"
	
	"Choose a personnel who has Engineer or Programming to be stopped. 
	If you cannot, all your personnel are stopped and this dilemma returns to its owner's dilemma pile."
	
*/
function dilemmaStopElseStopAll(dilemmaCardId, arrCards) {

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
							strHtml += "<button onclick=\"stopPersonnel('" + playerCardId + "', '" + dilemmaCardId + "');\">Stop (you choose)</button>" + objPlayerFullDeck_U[playerCardId].name + "<br/>";
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
		updateGroupContainer();
	}

	return strHtml;	
}

/*
	Personnel selected to satisfy a "Stop" dilemma

*/
function stopPersonnel (personnelId, dilemmaId) {

	objPlayerFullDeck_U[personnelId].status = "Stopped";
	objPlayerFullDeck_U[dilemmaId].overcome = true;

	updateGroupContainer();
	
	var arrSelectedDilemmas = objDilemma.arrSelectedDilemmas;
	var intMission = objDilemma.intMission;
	
	// add overcome dilemma to mission area
	arrPlayedDilemmas[intMission].push(dilemmaId);
	
	// go to next dilemma else score mission attempt
	if (arrSelectedDilemmas.length > 0) {
	
		updateMissionContainer();
		updateGroupContainer();	
		
		listDilemma();
	}
	else {
		$('#dialog2').hide();
		scoreCompletedMission();
	}	
}


/* ------------------------------------------------------------------------------------------------------------- */

/*
	2. Able to resolve Dilemmas like "Wavefront - EN01060"
	
	"Unless you have a personnel who has 2 Astrometrics or a personnel who has 2 Navigation, 
	your opponent chooses an Astrometrics or Navigation personnel to be stopped. 
	
	If your opponent cannot, all your personnel are stopped and this dilemma returns to its owner's dilemma pile."
	
*/
function dilemmaUnlessStopElseStopAll(dilemmaCardId, arrCards) {

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
								strHtml += "<button onclick=\"stopPersonnel('" + playerCardId + "', '" + dilemmaCardId + "');\">Stop (oppenent chooses)</button>" + objPlayerFullDeck_U[playerCardId].name + "<br/>";
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

		strHtml += "<br/><br/>No unstopped personnel with \"" + arrSkillMessage.join(" or ") + "\" found.\n\nAll your personnel are stopped and this dilemma returns to its owner's dilemma pile.<br/><br/>";
		strHtml += "<button onclick=\"listDilemma();\">Continue...</button><br/>";
		
		updateMissionContainer();
		updateGroupContainer();	

		
	}

	return strHtml;	
}


/* ------------------------------------------------------------------------------------------------------------- */


/*
	3. Able to resolve Dilemmas like "Command Decisions - EN01017"
	
	"Choose a personnel who has Leadership or Officer to be stopped. If you cannot, randomly select a personnel to be killed."
	
*/
function dilemmaStopElseKill(dilemmaCardId, arrCards) {

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
							strHtml += "<button onclick=\"stopPersonnel('" + playerCardId + "', '" + dilemmaCardId + "');\">Stop (you choose)</button>" + objPlayerFullDeck_U[playerCardId].name + "<br/>";
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
	
		// randomly kill one personnel	
		$.each(arrCards, function(index, playerCardId) {
			if (objPlayerFullDeck_U[playerCardId].type == "Personnel" && objPlayerFullDeck_U[playerCardId].status == "Unstopped") { 	
				arrKillList.push(playerCardId);
			}
		});	
		
		if (arrKillList.length > 0) {
		
			arrKillList = shuffle(arrKillList);
			var killedCardId = arrKillList.shift();		
		
			objPlayerFullDeck_U[killedCardId].status == "Killed";
			arrPlayerDiscard.push(killedCardId);
			
			var arrNew = [ ];
			$.each(arrCards, function(index, cardId) {
				if (killedCardId != cardId)
					arrNew.push(cardId);
			});
			arrPlayed[intMission][intGroup] = arrNew;
			
			strHtml += "No unstopped personnel with \"" + arrSkills.join(", ") + "\" found.\n\n\"" + objPlayerFullDeck_U[killedCardId].name + "\" was randomly killed.<br/><br/>";
			strHtml += "<button onclick=\"listDilemma();\">Continue...</button><br/>";
		}
		

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
	4. Able to resolve Dilemmas like "An Old Debt - EN03002"
	
	"Unless you have Biology, Physics, and Cunning>32 or Intelligence and 2 Medical, 
	randomly select a Leadership personnel to be killed."
	
*/
function dilemmaUnlessRandomKill(dilemmaCardId, arrCards) {

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
		
			objPlayerFullDeck_U[killedCardId].status == "Killed";
			arrPlayerDiscard.push(killedCardId);
			
			// take killed card out of group
			var arrNew = [ ];
			$.each(arrCards, function(index, cardId) {
				if (killedCardId != cardId)
					arrNew.push(cardId);
			});
			arrPlayed[intMission][intGroup] = arrNew;
			
			strHtml += "No unstopped personnel with required skills found.\n\n\"" + objPlayerFullDeck_U[killedCardId].name + "\" having \"" + strSkillKill + "\" was randomly killed.<br/><br/>";
			strHtml += "<button onclick=\"listDilemma();\">Continue...</button><br/>";

			updateGroupContainer();
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