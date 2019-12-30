window.addEventListener("DOMContentLoaded", init);


//////////////////////////
// INITIALISATION --------
//////////////////////////
function init(){

	// create and configure canvas
	const { canvas, context } = initCanvas();

	// create an app state
	const state = {
		drawing: false,
		lastPosition: {},
		max: Math.min(canvas.width, canvas.height),
		path: []
	};

	// bind all the functions as needed
	const handleDrawStart  = startDraw.bind(true, state);
	const handleDrawEnd    = endDraw.bind(true, state, context, canvas);
	const handleDrawUpdate = draw.bind(true, state, context, canvas);

	// add listeners for relative mouse events
	// NOTE: there's a bug in chromium browsers that has buggy detection with a stylus
	initListeners(canvas, {
		"pointerdown":  handleDrawStart,
		"pointerup":    handleDrawEnd,
		"pointermove":  handleDrawUpdate,
	});

	// create initial circle
	drawCircle(state, context, canvas);

	// add to DOM
	document.body.appendChild(canvas);

}// init

function initCanvas(){
	const canvas  = document.createElement("canvas");
	const context = canvas.getContext("2d");
	const { innerWidth, innerHeight } = window;

	canvas.width     = innerWidth;
	canvas.height    = innerHeight;
	canvas.className = "canvas";

	context.strokeStyle = "#111111";
	context.lineJoin    = "round";
	context.lineWidth   = 5;

	return { canvas, context };
}// initCanvas

function initListeners(element, actions){
	for(let [ event, callback ] of Object.entries(actions)){
		element.addEventListener(event, callback);
	}
}// initListeners


//////////////////////////
// LIFECYCLE -------------
//////////////////////////
function drawCircle(state, context, canvas){

	// circle config
	const { max }   = state;
	const min       = max * 0.1;
	const radius    = (random(min, max) / 2) * 0.9;

	// position config
	const buffer    = radius + (radius * 0.1);
	const xMinBound = buffer;
	const yMinBound = buffer;
	const xMaxBound = window.innerWidth - buffer;
	const yMaxBound = window.innerHeight - buffer; 

	const x = random(xMinBound, xMaxBound);
	const y = random(yMinBound, yMaxBound);

	context.fillStyle = "#DDDDDD";

	context.beginPath();
	context.moveTo(x, y);
	context.arc(x, y, radius, 0, Math.PI * 2)
	context.closePath();

	context.fill();

	console.log("circle drawn!", { x, y, radius })
}// drawCircle


//////////////////////////
// EVENT HANDLING --------
//////////////////////////
function startDraw(state, event){
	console.log("start!")

	event.preventDefault();

	state.drawing = true;
	state.path    = [];
}// startDraw

function endDraw(state, context, canvas, event){

	console.log("end!")

	event.preventDefault();

	const { width, height } = canvas;
	const { path }          = state;

	context.beginPath();

	for(let index in path){
		const { x, y } = path[index];

		if(index === 0) context.moveTo(x, y);
		else            context.lineTo(x, y);
	}

	context.closePath();

	// console.log(path)

	// context.clearRect(0, 0, width, height);
	context.fillStyle = "#000000";
	context.fill()


	// reset
	state.drawing      = false;
	state.lastPosition = {};
	// evaluate
	// new circle!
}// endDraw

function requestDraw(...args){

	requestAnimationFrame(draw.bind(true, ...args))
}// requestDraw

function draw(state, context, canvas, event){

	event.preventDefault();

	const {
		drawing,
		lastPosition,
		path: existingPath
	} = state;

	if(drawing){
		const {
			clientX: x,
			clientY: y
		} = event;

		const {
			width,
			height
		} = canvas;

		const {
			x: lastX,
			y: lastY
		} = lastPosition;

		if(lastX && lastY){

			context.beginPath();

			// create a new path
			const path = new Path2D();

			// draw the portion
			path.moveTo(lastX, lastY);
			path.lineTo(x, y);
			path.closePath();

			// fill it so it's visible
			context.stroke(path);

			// add to the state so that we can use it later
			existingPath.push({ x, y });
		}


		state.lastPosition.x = x;
		state.lastPosition.y = y;
	}
}// draw


//

function random(min, max){

	return Math.floor(Math.random() * (max - min + 1) + min);
}// random