$(document).ready(function () {

    $(function () {

        // ipad / touch devices
        $('#dialog').touchMouse();
        $('#dialog2').touchMouse();
        $('#dialog3').touchMouse({ delay: 100 });
        $('#dialog4').touchMouse();

        // orders div
        $("#dialog").draggable();
        // dilemmas div
        $("#dialog2").draggable();
        // cardViewer div
        $("#dialog3").draggable({
            // mark a drag as a non click
            start: function (event, ui) {
                $(this).addClass('noclick');
            }
        });
        // groupViewer div
        $("#dialog4").draggable();

        $('#handContainer').touchMouse();
        $("#handContainer").draggable();
    });

    $("#dialog3").click(function () {

        $(this).zindex('up'); //pushes to top of stack

        // click that follows a drag - ignore
        if ($(this).hasClass('noclick'))
            $(this).removeClass('noclick');
        // clicked - hide pop up
        else
            $("#dialog3").hide();
    });

    /*
        bring these divs to top when mouse enters div area
    */
    $("#dialog").mouseenter(function () {
        $(this).zindex('up');
    });
    $("#dialog2").mouseenter(function () {
        $(this).zindex('up');
    });
    $("#dialog3").mouseenter(function () {
        $(this).zindex('up');
    });
    $("#dialog4").mouseenter(function () {
        $(this).zindex('up');
    });
    $("#handContainer").mouseenter(function () {
        $(this).zindex('up');
    });

    // player deck (Borg), then shuffle
    arrPlayerFullDeck = shuffle(deck);


    /*
        Create a version of the deck so cards have unique ids; duplicate cards can be 'independent' of each other
    */
    arrPlayerFullDeck_U = []; // array of unique card ids
    objPlayerFullDeck_U = {}; // unique card id objects
    $.each(arrPlayerFullDeck, function (index, cardId) {
        uniqueCardId = cardId + "-" + index++;
        arrPlayerFullDeck_U.push(uniqueCardId);

        objPlayerFullDeck_U[uniqueCardId] = jQuery.extend(true, {}, objCardDb[cardId]); // IMPORTANT: copy the objCardDb, don't use a reference
        //objPlayerFullDeck_U[uniqueCardId] = JSON.parse(JSON.stringify(objCardDb[cardId]))
    });

    //alert(arrDeck[0]);
    //alert(parseUniqueId(arrDeck[0]));
    //alert(parseCardId(arrDeck[0]));


    // player's card stacks
    arrPlayerMissions = [];
    arrPlayerDilemmas = [];
    arrPlayerDeck = [];
    arrPlayerDiscard = [];


    // Split player's deck into the missions/dilemmas/reserve card stacks
    playerDeckSetup();

    // list of unique cards on the table
    arrUniquePlayed = [];

    // cards on missions
    arrPlayed = [
        [[]],
        [[]],
        [[]],
        [[]],
        [[]]
    ];

    // dilemmas on missions
    arrPlayedDilemmas = [
        [],
        [],
        [],
        [],
        []
    ];

    objDilemma = {};
    /*
    objDilemma.intMission = intMission;
    objDilemma.intGroup = intGroup;
    objDilemma.arrSelectedDilemmas = arrSelectedDilemmas;    
    objDilemma.intDilemma = 0;
    */


    // place a ship and personnel at a mission
    //arrPlayed[3][0][0] = "EN03122";
    //arrPlayed[3].push(["EN03198"]);

    // 
    arrTurns = [
        "1. PLAY AND DRAW CARDS",
        "2. EXECUTE ORDERS",
        "3. DISCARD EXCESS"
    ];

    // column of player's Headquarters
    intPlayerHeadquarters = 0;

    // count of player's remaining counters
    intPlayerCounter = 7;

    // Player turn number
    intPlayerTurn = 0;

    // turn round
    intPlayerRound = 0;

    // player's score
    intPlayerScore = 0;

    // player's count of planet missions completed
    intCompletedPlanetMissions = 0;

    // player's count of space missions completed
    intCompletedSpaceMissions = 0;

    // player's hand
    arrHand = [];

    // show the player's missions
    placePlayerMissions();

    // draw 7 cards and display
    playerDraw(7);

    // render updated turn summary bar 
    updateTurnSummary();

    // click event for img tags
    imgClickToggle();

    // Indicates what the Group Viewer is showing
    objGroupViewer = {
        mission: 0,
        group: 0
    }

});