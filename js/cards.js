
var objCardDb = {
	EN03110:
	{
		name: "Unicomplex, Root of the Hive Mind",
		unique: true,
		type: "Mission",
		missiontype: "Headquarters", 
		quadrant: "Delta",
		range: 2,
		play: ["Equipment", "Borg"],
		jpg: "cards/ST2E-EN03110.jpg"
	},
	EN03094: {
		name: "Hunt Alien",
		unique: true,
		type: "Mission",
		missiontype: "Planet", 
		quadrant: "Delta",
		score: 35,				
		range: 3,
		affiliation: ["Borg", "Klingon"],
		skills: [
			["Exobiology", "Exobiology", "Navigation", "Leadership"], // or
			["Exobiology", "Exobiology", "Navigation", "Security"]
		],
		attribute: "Strength",
		value: 32,
		jpg: "cards/ST2E-EN03094.jpg"		
	},
	EN03103: {
		name: "Salvage Borg Ship",
		unique: true,
		type: "Mission",
		missiontype: "Planet", 
		quadrant: "Alpha",
		score: 35,				
		range: 2,
		affiliation: null, //any
		skills: [
			["Astrometrics", "Engineer", "Medical", "Programming"]
		],
		attribute: "Cunning",
		value: 34,
		jpg: "cards/ST2E-EN03103.jpg"		
	},
	EN03082: {
		name: "Assault on Species 8472",
		unique: true,
		type: "Mission",
		missiontype: "Space", 
		quadrant: "Delta",
		score: 35,				
		range: 4,
		affiliation: ["Borg", "Klingon", "Federation"],
		skills: [
			["Engineer", "Engineer", "Exobiology", "Physics"]
		],
		attribute: "Cunning",
		value: 34,
		jpg: "cards/ST2E-EN03082.jpg"		
	},
	EN03083: {
		name: "Battle Reconnaissance",
		unique: true,
		type: "Mission",
		missiontype: "Space", 
		quadrant: "Delta",
		score: 35,				
		range: 2,
		affiliation: null, //any
		skills: [
			["Exobiology", "Programming", "Security", "Transporters"]
		],
		attribute: "Strength",
		value: 32,
		jpg: "cards/ST2E-EN03083.jpg"		
	},
	EN03118: {
		name: "Acclimation Drone",
		unique: false,
		type: "Personnel",
		affiliation: ["Borg"],
		deploy: 2, 	// deploy modifier on text
		species: ["Borg"],
		other: ["Staff"],				
		skills: [
			["Anthropology", "Engineer", "Exobiology", "Medical"]
		],
		integrity: 5,
		cunning: 5,
		strength: 5,
		jpg: "cards/ST2E-EN03118.jpg"		
	},
	EN03122: { // has order
		name: "Borg Queen, Bringer of Order",
		unique: true,
		type: "Personnel",
		affiliation: ["Borg"],
		deploy: 4, 	// deploy modifier on text
		species: ["Borg"],
		other: ["Command"],				
		skills: [
			["Leadership", "Leadership", "Leadership", "Treachery"]
		],
		integrity: 3,
		cunning: 8,
		strength: 6,
		jpg: "cards/ST2E-EN03122.jpg"		
	},
	EN03124: { // has order
		name: "Calibration Drone",
		unique: false,
		type: "Personnel",
		affiliation: ["Borg"],
		deploy: 2, 	// deploy modifier on text
		species: ["Borg"],
		other: ["Staff"],				
		skills: [
			["Archeology", "Biology", "Geology"]
		],
		integrity: 5,
		cunning: 5,
		strength: 5,
		jpg: "cards/ST2E-EN03124.jpg"		
	},
	EN03125: { // has interlink
		name: "Cartography Drone",
		unique: false,
		type: "Personnel",
		affiliation: ["Borg"],
		deploy: 1, 	
		species: ["Borg"],
		other: ["Staff"],				
		skills: [
			["Engineer"]
		],
		integrity: 5,
		cunning: 5,
		strength: 5,
		jpg: "cards/ST2E-EN03125.jpg"
	},		
	EN03126: { 
		name: "Computation Drone",
		unique: false,
		type: "Personnel",
		affiliation: ["Borg"],
		deploy: 2, 	
		species: ["Borg"],
		other: ["Staff"],				
		skills: [
			["Navigation", "Programming"]
		],
		integrity: 5,
		cunning: 6,
		strength: 5,
		jpg: "cards/ST2E-EN03126.jpg"		
	},		
	EN03130: { // has interlink
		name: "Information Drone",
		unique: false,
		type: "Personnel",
		affiliation: ["Borg"],
		deploy: 2, 	
		species: ["Borg"],
		other: ["Staff"],				
		skills: [
			["Exobiology", "Science", "Transporters"]
		],
		integrity: 5,
		cunning: 5,
		strength: 5,
		jpg: "cards/ST2E-EN03130.jpg"		
	},		
	EN03131: { // has order
		name: "Invasive Drone",
		unique: false,
		type: "Personnel",
		affiliation: ["Borg"],
		deploy: 2, 	
		species: ["Borg"],
		other: ["Staff"],				
		skills: [
			["Programming", "Security", "Transporters"]
		],
		integrity: 5,
		cunning: 5,
		strength: 5,
		jpg: "cards/ST2E-EN03131.jpg"		
	},		
	EN03134: { 
		name: "Opposition Drone",
		unique: false,
		type: "Personnel",
		affiliation: ["Borg"],
		deploy: 2, 	
		species: ["Borg"],
		other: ["Staff"],				
		skills: [
			["Biology", "Security"]
		],
		integrity: 5,
		cunning: 5,
		strength: 6, // has modifier
		jpg: "cards/ST2E-EN03134.jpg"		
	},		
	EN03137: { // has interlink
		name: "Research Drone",
		unique: false,
		type: "Personnel",
		affiliation: ["Borg"],
		deploy: 1, 	
		species: ["Borg"],
		other: ["Staff"],				
		skills: [
			["Medical"]
		],
		integrity: 5,
		cunning: 5,
		strength: 5, 
		jpg: "cards/ST2E-EN03137.jpg"		
	},		
	EN03139: { // has modifier
		name: "Seven of Nine, Representative of the Hive",
		unique: true,
		type: "Personnel",
		affiliation: ["Borg"],
		deploy: 3, 	
		species: ["Borg"],
		other: ["Staff"],				
		skills: [
			["Engineer", "Exobiology", "Physics", "Programming", "Science"]
		],
		integrity: 5,
		cunning: 7,
		strength: 6, 
		jpg: "cards/ST2E-EN03139.jpg"		
	},		
	EN03140: { // has order
		name: "Transwarp Drone",
		unique: false,
		type: "Personnel",
		affiliation: ["Borg"],
		deploy: 2, 	
		species: ["Borg"],
		other: ["Staff"],				
		skills: [
			["Astrometrics", "Navigation", "Physics"]
		],
		integrity: 5,
		cunning: 5,
		strength: 5, 
		jpg: "cards/ST2E-EN03140.jpg"		
	},		
	EN03198: { // SHIP
		name: "Borg Cube",
		unique: false,
		type: "Ship",
		affiliation: ["Borg"],
		deploy: 6, 	
		species: ["Borg"],			
		staffing: [
			["Staff", "Staff", "Staff", "Staff", "Staff"]
		],
		range: 10,
		rangeRemaining: 10,	// resets per turn
		weapons: 12,
		shields: 11, 
		jpg: "cards/ST2E-EN03198.jpg"
	},			
	EN03199: { // SHIP
		name: "Borg Sphere",
		unique: false,
		type: "Ship",
		affiliation: ["Borg"],
		deploy: 5, 	
		species: ["Borg"],			
		staffing: [
			["Staff", "Staff", "Staff", "Staff"]
		],
		range: 9,
		rangeRemaining: 9,	// resets per turn
		weapons: 10,
		shields: 9, 
		jpg: "cards/ST2E-EN03199.jpg"		
	}
};

// possible other personnel attributes
// - facing a dilemma: t/f
// - stopped t/f
// - aboard a ship t/f
