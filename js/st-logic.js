/*
    Scott Eickhoff
    May 2013
*/

/*
function playMP3(soundId){
    document.getElementById("soundId").play();
}
*/

function playAudio(id) {
    var audio = document.getElementById(id);
    audio.play();
}



/* 
    Parse deck into missions/dilemmas/reserve - called once
*/
function playerDeckSetup() {
    $.each(arrPlayerFullDeck_U, function (index, strCard) {

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

    $.each(arrPlayerMissions, function (index, strCard) {

        cardId = parseCardId(strCard);

        if (objCardDb[cardId].type == "Mission") { // [array] notation when property is a variable

            // set column of player's Headquarters
            if (objCardDb[cardId].missiontype == "Headquarters")
                intPlayerHeadquarters = index;

            // add mission to div
            //$("div.mission.c" + index).append("<img id='" + strCard + "' class='thumb' src='" + objPlayerFullDeck_U[strCard].jpg + "'>");        
            $("div.mission.c" + index + " " + "div.outer div.innerCard").html(
                "<img id='" + strCard + "' class='thumb' src='" + objPlayerFullDeck_U[strCard].jpg + "'>"
            );

        }
    });

    imgClickToggle();
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
function parseUniqueId(cardId) {
    arr = cardId.split("-", 2);
    return arr[1];
}

/*
    Return the Card ID portion of the Unique Card ID
*/
function parseCardId(cardId) {
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
    groupViewerRefresh();
    showHand();

    // Game lost: no more moves; cards all gone
    if (arrPlayerDeck.length == 0 && $('.deploy').length == 0) {
        playAudio('gameOver');
        $("td.turn.summary.1").append(", Game Over: YOU LOST!");
        $("td.turn.summary.2").append("");

    }
}

/*
    Turn Incrementer
*/
function nextPhase() {
    playAudio("chirp");
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
        $.each(arrPlayed[intMission], function (intGroup, arrCards) {

            // for each Card on this mission
            $.each(arrCards, function (intCard, cardId) {

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
        $.each(arrPlayed[intMission], function (intGroup, arrCards) {

            // for each Card on this mission
            $.each(arrCards, function (intCard, cardId) {

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

    $("td.turn.summary.1").html("");
    $("td.turn.summary.2").html("");

    $("td.turn.summary.1").append(arrTurns[intPlayerRound] + ". Hand: " + arrHand.length + ", Counters: " +
        intPlayerCounter + ", Turn: " + intPlayerTurn + ", Score: " + intPlayerScore +
        ", Completed Planet Missions: " + intCompletedPlanetMissions + ", Completed Space Missions: " + intCompletedSpaceMissions);

    // check winning condition 
    if (intPlayerScore >= 100 && intCompletedPlanetMissions >= 1 && intCompletedSpaceMissions >= 1) {

        $("td.turn.summary.1").append(", Game Over: YOU WON!");
        $("td.turn.summary.2").append("");

        closeOrders();
        return;
    }

    // check losing condition

    // Orders
    if (intPlayerRound == 1) {
        $("td.turn.summary.2").append("<button class='bigButton' onclick=\"centerListOrders()\">List Orders</button>");
        $("td.turn.summary.2").append("<button class='bigButton' onclick=\"nextPhase()\">Next Phase</button>");
    }

    // Start New Turn /  
    else if (intPlayerRound == 2 && intPlayerCounter == 0 && arrHand.length <= 7 || (arrPlayerDeck.length == 0 && $('.deploy').length == 0)) {
        $("td.turn.summary.2").append("<button class='bigButton' onclick=\"newTurn()\">New Turn</button>");
    }

}

function centerListOrders() {
    playAudio("chirp");
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
    var objSkills = {};

    // each card
    $.each(arrCards, function (index, cardId) {

        // For Active (unstopped) Personnel, sum strength/cunning/integrity and skills
        if (objPlayerFullDeck_U[cardId].type == "Personnel" && objPlayerFullDeck_U[cardId].status == "Unstopped") {

            intStrength += objPlayerFullDeck_U[cardId].strength;
            intIntegrity += objPlayerFullDeck_U[cardId].integrity;
            intCunning += objPlayerFullDeck_U[cardId].cunning;

            // skills
            $.each(objPlayerFullDeck_U[cardId].skills, function (i, v) {
                $.each(v, function (i2, v2) {
                    // new Skill, start tracking it
                    if (!objSkills.hasOwnProperty(v2))
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
    $.each(arrMissionSkills, function (index1, arrSkills) {

        var intFails = 0;

        // copy of player's stats
        var objPlayersStats = jQuery.extend(true, {}, objSkills);

        $.each(arrSkills, function (index2, strSkill) {

            // Skill doesn't exist (property doesn't exist): it's a fail
            if (!objPlayersStats.hasOwnProperty(strSkill))
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
function groupStats(intMission, intGroup, boolPretty) {

    var arrCards = arrPlayed[intMission][intGroup];

    // player's skills
    var intStrength = 0;
    var intIntegrity = 0;
    var intCunning = 0;
    var objSkills = {};
    var intPersonnel = 0;

    // each card
    $.each(arrCards, function (index, cardId) {

        // For Active (unstopped) Personnel, sum strength/cunning/integrity and skills
        if (objPlayerFullDeck_U[cardId].type == "Personnel" && objPlayerFullDeck_U[cardId].status == "Unstopped") {

            intStrength += objPlayerFullDeck_U[cardId].strength;
            intIntegrity += objPlayerFullDeck_U[cardId].integrity;
            intCunning += objPlayerFullDeck_U[cardId].cunning;
            intPersonnel++;

            // skills
            $.each(objPlayerFullDeck_U[cardId].skills, function (i, v) {
                $.each(v, function (i2, v2) {
                    objSkills[v2] = objSkills[v2] + 1 || 1; // Increment counter for each value
                });
            });
        }
    });

    strSkillList = joinSkills(objSkills); // join

    if (boolPretty)
        return ("Unstopped Personnel: " + intPersonnel + "<br/><br/>Integrity: " + intIntegrity + ", Cunning: " + intCunning + ", Strength: " + intStrength + "<br/><br/>" + strSkillList);
    else
        return ("Unstopped Personnel: " + intPersonnel + ", Integrity: " + intIntegrity + ", Cunning: " + intCunning + ", Strength: " + intStrength + ", " + strSkillList);
}

/*
    Auto-pick Dilemmas for mission
*/
function missionDilemmas() {

    var intMission = objDilemma.intMission;
    var intGroup = objDilemma.intGroup;

    var missionCardId = arrPlayerMissions[intMission];

    var arrDrawnDilemmas = [];
    var arrSelectedDilemmas = [];
    var arrSelectedDilemmasSimpleId = [];
    var intSpent = 0;


    // count unstopped personnel
    var arrCards = arrPlayed[intMission][intGroup];
    var intUnstoppedPersonnel = 0;
    $.each(arrCards, function (index, cardId) {
        if (objPlayerFullDeck_U[cardId].type == "Personnel" && objPlayerFullDeck_U[cardId].status == "Unstopped") {
            intUnstoppedPersonnel++;
        }
    });

    // minus overcome dilemmas
    var arrTemp = [];
    $.each(arrPlayedDilemmas[intMission], function (index, cardId) {
        if (objPlayerFullDeck_U[cardId].overcome) {
            intUnstoppedPersonnel--;
            arrTemp.push(cardId); // remember overcome
        }
        // add any extra Dilemmas to drawn pile that are at mission but not overcome (i.e. Limited Welcome)
        else {
            arrDrawnDilemmas.push(cardId);
        }
    });

    // remove the dilemmas not overcome from the mission group (because they are now in the drawn dilemma pile), then refresh the Mission Container UI
    arrPlayedDilemmas[intMission] = arrTemp; // show the overcome
    updateMissionContainer();

    // draw dilemma cards
    for (var i = 0; i < intUnstoppedPersonnel; i++) {
        if (arrPlayerDilemmas.length == 0)
            continue;

        arrDrawnDilemmas.push(arrPlayerDilemmas.shift());
    }

    // select applicable dilemmas
    for (var i = 0; i < arrDrawnDilemmas.length; i++) {
        var dilammaCardId = arrDrawnDilemmas[i];
        var dilammaCardSimpleId = parseCardId(arrDrawnDilemmas[i]);

        // legal dilemma
        if ((objPlayerFullDeck_U[dilammaCardId].where == "Dual" || objPlayerFullDeck_U[dilammaCardId].where == objPlayerFullDeck_U[missionCardId].missiontype) && // matching type for mission
            (objPlayerFullDeck_U[dilammaCardId].deploy + intSpent <= intUnstoppedPersonnel) && // check spent deployment amount
            ($.inArray(dilammaCardSimpleId, arrSelectedDilemmasSimpleId) == -1)) { // check if duplicate (-1: not a duplicate)

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

    // store selection - the dilemma cards are randomized
    objDilemma.arrSelectedDilemmas = shuffle(arrSelectedDilemmas);
    objDilemma.intDilemma = 0;

    //alert("Selected Dilemmas: " + arrSelectedDilemmas);

    if (arrSelectedDilemmas.length > 0) {
        $('#dialog').hide();
        $("#dialog2").center();
        $('#dialog2').show();
    }

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
    $.each(arrPlayed[intMission][intGroup], function (index, playerCardId) {
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

    var strHtml = "";

    // Have a dilemma to present
    if (arrSelectedDilemmas.length > 0) {

        var arrCards = arrPlayed[intMission][intGroup];
        var missionCardId = arrPlayerMissions[intMission];
        var intDilemma = 0;

        // show and resolve each dilemma
        dilemmaCardId = arrSelectedDilemmas.shift();
        objDilemma.intDilemma = objDilemma.intDilemma + 1;

        strHtml += "Mission: <span id='" + missionCardId + "' style='font-weight: bold; font-size: 14pt; color: #CC6666;'>" + objPlayerFullDeck_U[missionCardId].name + "</span><br/><br/>\n";

        strHtml += "Dilemma (" + objDilemma.intDilemma + " of " + (arrSelectedDilemmas.length + objDilemma.intDilemma) +
            "): <span class='listOrange' id='" + dilemmaCardId + "'>" + objPlayerFullDeck_U[dilemmaCardId].name + "</span><br/><br/>\n" +
            "<img id='" + dilemmaCardId + "' class='thumb' src='" + objPlayerFullDeck_U[dilemmaCardId].jpg + "'><br/><br/>";

        // show div HTML content
        $("#dialog2").html(strHtml);

        // so dilemma images are clickable in dialog 2
        imgClickToggle();

        // check if all personnel are killed, stopped
        boolAllStopped = checkAllStopped();

        // resolve
        if (boolAllStopped) {
            $("#dialog2").append(allStopped(dilemmaCardId));
        }
        else if (objPlayerFullDeck_U[dilemmaCardId].rule == "SystemDiagnostics") {
            $("#dialog2").append(dilemmaSystemDiagnostics(dilemmaCardId, arrCards));
        }
        else if (objPlayerFullDeck_U[dilemmaCardId].rule == "Wavefront") {
            $("#dialog2").append(dilemmaWavefront(dilemmaCardId, arrCards));
        }
        else if (objPlayerFullDeck_U[dilemmaCardId].rule == "CommandDecisions") {
            $("#dialog2").append(dilemmaCommandDecisions(dilemmaCardId, arrCards));
        }
        else if (objPlayerFullDeck_U[dilemmaCardId].rule == "AnOldDebt") {
            $("#dialog2").append(dilemmaAnOldDebt(dilemmaCardId, arrCards));
        }
        else if (objPlayerFullDeck_U[dilemmaCardId].rule == "PinnedDown") {
            $("#dialog2").append(dilemmaPinnedDown(dilemmaCardId, arrCards));
        }
        else if (objPlayerFullDeck_U[dilemmaCardId].rule == "LimitedWelcome") {
            $("#dialog2").append(dilemmaLimitedWelcome(dilemmaCardId, arrCards));
        }
        else if (objPlayerFullDeck_U[dilemmaCardId].rule == "OrnaranThreat") {
            $("#dialog2").append(dilemmaOrnaranThreat(dilemmaCardId, arrCards));
        }
        else if (objPlayerFullDeck_U[dilemmaCardId].rule == "Sokath") {
            $("#dialog2").append(dilemmaSokath(dilemmaCardId, arrCards));
        }
        // so spans are clickable in dialog 2
        spanClickToggle();

        // mission requirement helper
        if (!checkMission(arrPlayed[intMission][intGroup], missionCardId))
            $("#dialog2").append("<br/><span class='listRed'>Mission requirements cannot be achieved.</span><br/>");

        // group stats helper
        $("#dialog2").append("<br/><span class='listPink' style='font-size: 9pt;'>" + groupStats(intMission, intGroup, true) + "</span>");

        updateGroupContainer();
        groupViewerRefresh();
    }
    // no dilemmas
    else {
        //alert("Faced all Dilemmas");
        $('#dialog2').hide();
        scoreCompletedMission();
    }
}




/*
    updateMissionContainer
*/
function updateMissionContainer() {

    var intMission = objDilemma.intMission;
    var missionCardId = arrPlayerMissions[intMission];

    // clear td content of specific mission
    $("div.mission.c" + intMission).html("");

    // create a div
    //$("td.player.mission.c" + intMission).append("<div class=\"player mission c" + intMission + "\"style=\"border: solid 1px white; padding: 10px;\">");

    // add mission to div
    $("div.mission.c" + intMission).append("<img id='" + missionCardId + "' class='thumb' src='" + objPlayerFullDeck_U[missionCardId].jpg + "'>");

    // Each dilemma
    $.each(arrPlayedDilemmas[intMission], function (i, c) {

        // add overcome dilemma to div
        if (objPlayerFullDeck_U[c].overcome)
            $("div.mission.c" + intMission).append("<img id='" + c + "' class='thumb red' src='" + objPlayerFullDeck_U[c].jpg + "'/>&nbsp;");
        // add dilemma to div
        else
            $("div.mission.c" + intMission).append("<img id='" + c + "' class='thumb' src='" + objPlayerFullDeck_U[c].jpg + "'/>&nbsp;");
    });

    //$("td.player.mission.c" + intMission).append("</div>"); 

    imgClickToggle();
}


/*
    Attempt mission and reveal results
*/
function attemptMission(intMission, intGroup) {

    playAudio("chirp");

    objDilemma.intMission = intMission;
    objDilemma.intGroup = intGroup;

    //var missionCardId = arrPlayerMissions[intMission];

    // dilemmas
    missionDilemmas();
}

function scoreCompletedMission() {

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
        $("div.mission.c" + intMission).css("padding-top", "48");

        //alert("Mission Completed");

        // show revised score
        updateTurnSummary();

    }
    else {
        //alert("Mission Unsuccessful");    

        // stop all personnel
        $.each(arrCards, function (i, c) {

            if (objPlayerFullDeck_U[c].type == "Personnel")
                objPlayerFullDeck_U[c].status = "Stopped";
        });
    }
    updateMissionContainer();
    updateGroupContainer();
    groupViewerRefresh();
}


function resetObjDilemma() {
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

        strHtml += "<span id='" + missionCardId + "' style='font-weight: bold; font-size: 14pt; color: #CC6666;'>" +
            objPlayerFullDeck_U[missionCardId].name + ": " + objPlayerFullDeck_U[missionCardId].missiontype + "</span><br/>\n";


        // for each grouping on this mission
        $.each(arrPlayed[intMission], function (intGroup, arrCards) {

            // create a row and add cards only if the grouping has cards
            if (arrCards.length > 0) {

                // mission button
                if (!objPlayerFullDeck_U[missionCardId].completed &&
                    ((objPlayerFullDeck_U[missionCardId].missiontype == "Planet" && intGroup == 0) || (objPlayerFullDeck_U[missionCardId].missiontype == "Space" && intGroup > 0))) {

                    // have ability to complete mission ?
                    boolMissionReqCheck = checkMission(arrCards, missionCardId);

                    if (boolMissionReqCheck) {
                        strHtml += "<br/><button onclick=\"attemptMission(" + intMission + ", " + intGroup + ");\">Attempt Mission</button><br/>";
                    }
                }

                strHtml += "<table border='0' width='100%'>\n";

                // show each card
                $.each(arrCards, function (intCard, cardId) {

                    // PERSONNEL GROUP 0, CARD 0
                    if (intGroup == 0 && intCard == 0) {

                        if (intShips > 0)
                            strHtml += "<tr><td><td style='text-align: center; font-size: 10pt; font-weight: bold; color: #cc99cc;' colspan='" + intShips + "'>Beam to...</tr>\n";
                    }

                    // PERSONNEL GROUP 0, CARD 0
                    if (intGroup == 0) {

                        if (objPlayerFullDeck_U[cardId].status == "Stopped")
                            strHtml += "<tr><td id='" + missionCardId + "' class='listStopped'><span id='" + cardId + "' >" + objPlayerFullDeck_U[cardId].name + "</span><td>";
                        else
                            strHtml += "<tr><td id='" + missionCardId + "' class='list'><span id='" + cardId + "'>" + objPlayerFullDeck_U[cardId].name + "</span><td>";

                        // beam to ship buttons
                        for (j = 0; j < intShips; j++) {
                            if (objPlayerFullDeck_U[cardId].status != "Stopped")
                                strHtml += "<button onclick=\"beamCard(" + intMission + ", " + intGroup + ", " + intCard + ", " + (j + 1) + ");\">Ship # " + (j + 1) + "</button>";
                        }
                        strHtml += "</tr>\n";
                    }
                    // PERSONNEL GROUP 0, CARD 1+
                    else if (intGroup == 0 && intCard != 0) {

                        if (objPlayerFullDeck_U[cardId].status == "Stopped")
                            strHtml += "<tr><td class='listStopped'><span id='" + cardId + "'>" + objPlayerFullDeck_U[cardId].name + "</span><td>";
                        else
                            strHtml += "<tr><td class='list'><span id='" + cardId + "'>" + objPlayerFullDeck_U[cardId].name + "</span><td>";

                        // beam to ship buttons
                        for (j = 0; j < intShips; j++) {
                            if (objPlayerFullDeck_U[cardId].status != "Stopped")
                                strHtml += "<button onclick=\"beamCard(" + intMission + ", " + intGroup + ", " + intCard + ", " + (j + 1) + ");\">Ship # " + (j + 1) + "</button>";
                        }
                        strHtml += "</tr>\n";
                    }
                    // SHIP GROUP 1+, CARD 0 (the ship itself)
                    else if (intGroup != 0 && intCard == 0) {

                        // is ship staffed for movement?
                        isStaffed = checkStaffed(arrCards);

                        strHtml += "<tr><td style='text-align: left; font-size: 10pt; font-weight: bold; color: #ff9900;' colspan='" + (intShips + 1) + "'><span id='" + cardId + "'>Ship #" +
                            intGroup + ": " + objPlayerFullDeck_U[cardId].name + " (Range Remaining: " + objPlayerFullDeck_U[cardId].rangeRemaining + ")</span></tr>\n";

                        var intMove = 0;
                        var strHtmlMove = "<tr><td colspan='2'>";

                        // move to other missions
                        for (m = 0; m < 5; m++) {

                            // does ship have enough remaining Range?
                            hasRange = checkRange(intMission, intGroup, m);

                            missionCard = arrPlayerMissions[m];

                            var strMissionRequirements = "normal";
                            //alert (arrPlayed[m]);


                            if (m != intMission && isStaffed && hasRange) {

                                // hint if the group on ship can finnish mission
                                //if (arrPlayed[intMission][intGroup].length > 0 && checkMission(arrPlayed[intMission][intGroup], missionCard))
                                //    strMissionRequirements = "bold";

                                strHtmlMove += "<button style='font-weight: " + strMissionRequirements + ";' onclick=\"moveShip(" + intMission + ", " + intGroup + ", " + m + ");\">" +
                                    objPlayerFullDeck_U[missionCard].name + "</button>";
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

                        //if (intCard == 1 && (strMissionType == "Headquarters" || strMissionType == "Planet"))
                        if (intCard == 1)
                            strHtml += "<tr><td><td style='text-align: center; font-size: 10pt; font-weight: bold; color: #cc99cc;' colspan='" + intShips + "'>Beam to...</tr>\n";

                        if (objPlayerFullDeck_U[cardId].status == "Stopped")
                            strHtml += "<tr><td class='listStopped'><span id='" + cardId + "'>" + objPlayerFullDeck_U[cardId].name + "</span><td>";
                        else
                            strHtml += "<tr><td class='list'><span id='" + cardId + "'>" + objPlayerFullDeck_U[cardId].name + "<span><td>";

                        // beam to headquarters or planet mission button
                        if ((strMissionType == "Headquarters" || strMissionType == "Planet") && objPlayerFullDeck_U[cardId].status != "Stopped") {
                            strHtml += "<button onclick=\"beamCard(" + intMission + ", " + intGroup + ", " + intCard + ", " + 0 + ");\">" + strMissionType + "</button>";
                        }

                        // beam to ship buttons
                        for (j = 0; j < intShips; j++) {
                            if (intGroup != (j + 1) && objPlayerFullDeck_U[cardId].status != "Stopped")
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

    $('#dialog').zindex('up'); //pushes to top of stack
    $('#dialog').show();
    spanClickToggle();

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

    playAudio("warp");

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
    groupViewerRefresh();
    listOrders();
}

/*
    Check if a Ship is staffed; supply the Group (array of ship and personnel onboard)
*/
function checkStaffed(arrCards) {

    objStaffingRequirements = {};
    objStaffingRequirements.staff = 0;
    objStaffingRequirements.command = 0;

    // get staff requirements from ship card
    arrStaffRequirements = objPlayerFullDeck_U[arrCards[0]].staffing[0];

    $.each(arrStaffRequirements, function (index, strType) {
        if (strType == "Staff")
            objStaffingRequirements.staff += 1;
        else if (strType == "Command")
            objStaffingRequirements.command += 1;
    });

    objStaffingPersonnel = {};
    objStaffingPersonnel.staff = 0;
    objStaffingPersonnel.command = 0;

    $.each(arrCards, function (index, cardId) {

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

    playAudio('beam');

    //document.getElementById('beam').play(); // html5

    //remove card
    arrNew = [];
    arrCards = arrPlayed[intMission][intOldGroup];
    $.each(arrCards, function (i, cardId) {
        if (i != intCard)
            arrNew.push(cardId);
    });
    arrPlayed[intMission][intOldGroup] = arrNew;

    arrnew = arrPlayed[intMission][intNewGroup];
    arrnew.push(sourceCardId);
    arrPlayed[intMission][intNewGroup] = arrnew;

    updateGroupContainer();
    groupViewerRefresh();
    listOrders();

}

function closeOrders() {
    playAudio("chirp");
    $('#dialog').hide();
}

/*
    DIV centering function
*/
jQuery.fn.center = function () {
    this.css("position", "absolute");
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
        groupViewerRefresh();
        removeFromHand(strCard);
        showHand();
        updateTurnSummary();
    }

    //noCardsRemainingCheck();

    //  If your deck is empty, you do not have to spend all seven counters.
    // Game lost: no more moves; cards all gone
    /*
    if (arrPlayerDeck.length == 0 && $('.deploy').length == 0) {
        playAudio('gameOver');
        $("td.turn.summary.1").append(", Game Over: YOU LOST!");
        $("td.turn.summary.2").append("");

    }
    */

}


/*
    for all missions, show each group of cards its own div; each grouping: Chars/Equip, Ship1, Ship[n...]
*/
function updateGroupContainer() {

    var boolPersonnelAtMission = false;

    // for all missions
    for (intColumn = 0; intColumn < 5; intColumn++) {

        // clear personnel div content
        $("div.personnel.c" + intColumn).html("");

        boolPersonnelAtMission = false;

        // for each grouping at this mission
        $.each(arrPlayed[intColumn], function (index, arrCards) {

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

                // personnel at mission - place crossed card over mission?
                if (objPlayerFullDeck_U[arrCards[0]].type != "Ship")
                    boolPersonnelAtMission = true;
                else {

                    // inner div concontainer for a grouping            
                    $("div.personnel.c" + intColumn).append(
                        "<div class=\"player personnel c" + intColumn + index + "\" style=\"border: solid 1px blue; padding: 10px;\">" +
                        "<div class='outer'>" +
                        "<div class='innerShipPersonnel'></div>" +
                        "<div class='innerCard'></div>" +
                        "</div>" +
                        "</div>"
                    );

                    // ship
                    $("div.personnel.c" + intColumn + index + " " + "div.outer div.innerCard").html(
                        "<img id='" + arrCards[0] + "' class='thumb' src='" + objPlayerFullDeck_U[arrCards[0]].jpg + "'>"
                    );

                    // personnel on ship
                    if (arrCards.length > 1) {
                        $("div.personnel.c" + intColumn + index + " " + "div.outer div.innerShipPersonnel").html(
                            "<img onclick='groupViewer(" + intColumn + ", " + index + ", 1);' class='thumb' src='./images/card-back.jpg'>"
                        );
                    }
                }
            }
        });

        // personnel on mission
        if (boolPersonnelAtMission) {
            $("div.mission.c" + intColumn + " " + "div.outer div.innerCross").html(
                "<img onclick='groupViewer(" + intColumn + ", " + 0 + ", 1);' class='thumbCross' src='./images/card-back-cross.jpg'>"
            );
        }
        else
            $("div.mission.c" + intColumn + " " + "div.outer div.innerCross").html("");

    }
    imgClickToggle();
}

// calls groupViewer just to refresh
function groupViewerRefresh() {
    groupViewer(objGroupViewer.mission, objGroupViewer.group, 0);
}

// shows the face-down card stacks in a container
function groupViewer(intMission, intGroup, boolShow) {

    //alert(intMission + ", " + intGroup + ", " + boolShow + ": " + arrPlayed[intMission][intGroup]);

    $(".groupViewer").html("<span id='" + arrPlayerMissions[intMission] + "' style='font-weight: bold; font-size: 14pt; color: #CC6666;'>" +
        objPlayerFullDeck_U[arrPlayerMissions[intMission]].name + "</span><br/><br/>");

    // hide if the intMission/intGroup doesn't exist or has no members
    if (!arrPlayed[intMission][intGroup] || arrPlayed[intMission][intGroup].length == 0) {
        $("#dialog4").hide();
        return;
    }

    var strCard = arrPlayed[intMission][intGroup][0] || null;

    if (strCard != null && objPlayerFullDeck_U[strCard].type == "Ship")
        $(".groupViewer").append("<span id='" + arrPlayerMissions[intMission] + "' class='listOrange'>" + objPlayerFullDeck_U[strCard].name + "</span><br/><br/>");
    else
        $(".groupViewer").append("<span class='listOrange'>At mission</span><br/><br/>");

    $(".groupViewer").append(groupStats(intMission, intGroup, true) + "<br/><br/>");

    var arrCards = arrPlayed[intMission][intGroup];

    $.each(arrCards.sort(compareNames), function (index, card) {
        if (objPlayerFullDeck_U[card].type != "Ship") {

            var strClass = "";

            //stopped
            if (objPlayerFullDeck_U[card].type == "Personnel" && objPlayerFullDeck_U[card].status == "Stopped")
                strClass = " red";

            $(".groupViewer").append("<img id='" + card + "' class='thumb" + strClass + "' src='" + objPlayerFullDeck_U[card].jpg + "'/>&nbsp;");
        }
    });

    $(".groupViewer").append("<br/><br/><button onclick=\"$('#dialog4').hide();\">Close</button>");

    if (boolShow)
        $("#dialog4").show();

    imgClickToggle();
    spanClickToggle();

    // store in global for easy refreshes
    objGroupViewer.mission = intMission;
    objGroupViewer.group = intGroup;
}


/*
    Toggle thumbnail / full for IMG tags
    
    Call after each adding of IMG tags
*/
function imgClickToggle() {
    $("img").unbind('click.addit').bind('click.addit',  // Event Namespacing (http://www.learningjquery.com/2008/05/working-with-events-part-2)
        function () {
            if (this.id == "")
                return;

            $("#dialog3").html("<img class='full' src='" + objPlayerFullDeck_U[this.id].jpg + "'>");
            $("#dialog3").zindex('up');
            $("#dialog3").show();

        }
    );
}

function spanClickToggle() {
    $("span").unbind('click.addit').bind('click.addit',  // Event Namespacing (http://www.learningjquery.com/2008/05/working-with-events-part-2)
        function () {
            if (this.id == "")
                return;
            $("#dialog3").html("<img class='full' src='" + objPlayerFullDeck_U[this.id].jpg + "'>");
            $("#dialog3").zindex('up');
            $("#dialog3").show();
        }
    );
}

/*
    Update the display for cards in hand
*/
function showHand() {

    arrHand.sort(compareNames); // sort

    $("tr.playerCardAction").html("");
    $("tr.playerCardContainer").html("");

    for (intCol = 0; intCol < arrHand.length; intCol++) {
        strCard = arrHand[intCol];
        cardId = parseCardId(strCard);

        // show card
        $("tr.playerCardContainer").append("<td><img id='" + strCard + "' class='thumb' src='" + objPlayerFullDeck_U[strCard].jpg + "'></td>");

        // intPlayerCounter is 0 and too many cards
        if (intPlayerRound == 2 && intPlayerCounter == 0 && arrHand.length > 7)
            $("tr.playerCardAction").append("<td><button onclick=\"discard('" + strCard + "')\">Discard</button></td>");
        // can't be deployed: intPlayerCounter is too low
        else if (intPlayerCounter == 0 || intPlayerCounter - objPlayerFullDeck_U[strCard].deploy < 0)
            $("tr.playerCardAction").append("<td></td>");
        // can't be deployed: unique card is already deployed
        else if ($.inArray(cardId, arrUniquePlayed) != -1)
            $("tr.playerCardAction").append("<td></td>");
        // show deploy button    
        else
            $("tr.playerCardAction").append("<td><button class='deploy' onclick=\"deploy('" + strCard + "', " + intPlayerHeadquarters + ")\">Deploy</button></td>");
    }

    // Draw button
    if (intPlayerCounter > 0 && arrPlayerDeck.length > 0)
        $("tr.playerCardAction").prepend("<td><button onclick=\"drawCard()\">Draw</button></td>");
    else
        $("tr.playerCardAction").prepend("<td></td>");

    if (arrPlayerDeck.length > 0)
        $("tr.playerCardContainer").prepend("<td><img src=\"./images/card-back.jpg\" class=\"thumb\"></td>");
    else
        $("tr.playerCardContainer").prepend("<td></td>");

    imgClickToggle();
}

/*
    Draw Card
*/
function drawCard() {
    playAudio("lift");
    cardId = arrPlayerDeck.shift();
    arrHand.push(cardId);

    --intPlayerCounter;

    // check end

    updateTurnSummary();
    showHand();
    //noCardsRemainingCheck();
}

/*
    Game over: No more cards to draw, no counters left
*/
/*
function noCardsRemainingCheck() {
    if (intPlayerCounter == 0 && arrPlayerDeck.length == 0) {
        playAudio('gameOver');
    }
}
*/

/*
    Discard Card
*/
function discard(cardId) {
    playAudio("lift");
    removeFromHand(cardId);
    updateTurnSummary();
    showHand();
}

/*
    Remove a specific card from hand
*/
function removeFromHand(card) {
    playAudio("lift");
    arrNewHand = [];
    match = false;
    $.each(arrHand, function (index, cardId) {
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
    $.each(skills, function (index, value) {
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
    var nameA = objPlayerFullDeck_U[a].name.toLowerCase();
    var nameB = objPlayerFullDeck_U[b].name.toLowerCase();

    var typeA = objPlayerFullDeck_U[a].type.toLowerCase();
    var typeB = objPlayerFullDeck_U[b].type.toLowerCase();

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

Array.prototype.contains = function (v) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] === v) return true;
    }
    return false;
};

Array.prototype.unique = function () {
    var arr = [];
    for (var i = 0; i < this.length; i++) {
        if (!arr.contains(this[i])) {
            arr.push(this[i]);
        }
    }
    return arr;
}





